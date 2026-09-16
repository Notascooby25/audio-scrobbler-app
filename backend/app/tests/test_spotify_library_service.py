from __future__ import annotations

from datetime import datetime

import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import LikedTrack, User
from backend.app.services import spotify_library_service

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


class FakeResponse:
    def __init__(self, status_code, headers=None, payload=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_request_retries_after_429_and_succeeds(monkeypatch):
    responses = iter([
        FakeResponse(429, headers={"Retry-After": "0"}),
        FakeResponse(200, payload={"ok": True}),
    ])
    sleeps = []
    monkeypatch.setattr(spotify_library_service.requests, "request", lambda *a, **k: next(responses))
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: sleeps.append(seconds))

    response = spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")

    assert response.json() == {"ok": True}
    assert sleeps == [0.0]


def test_request_retries_after_server_error_with_backoff(monkeypatch):
    responses = iter([
        FakeResponse(503),
        FakeResponse(200, payload={"ok": True}),
    ])
    sleeps = []
    monkeypatch.setattr(spotify_library_service.requests, "request", lambda *a, **k: next(responses))
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: sleeps.append(seconds))

    response = spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")

    assert response.json() == {"ok": True}
    assert sleeps == [1]


def test_request_raises_after_exhausting_retries_on_persistent_429(monkeypatch):
    monkeypatch.setattr(
        spotify_library_service.requests,
        "request",
        lambda *a, **k: FakeResponse(429, headers={"Retry-After": "0"}),
    )
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: None)

    # The final attempt (attempt == 2) no longer qualifies for a retry, so it
    # falls through to raise_for_status() rather than the trailing guard —
    # matching the worker's identical SpotifyClient._request behavior.
    try:
        spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")
    except requests.HTTPError as exc:
        assert "429" in str(exc)
    else:
        raise AssertionError("Expected requests.HTTPError after exhausting retries")


def test_request_does_not_retry_on_other_client_errors(monkeypatch):
    calls = []

    def fake_request(*args, **kwargs):
        calls.append(1)
        return FakeResponse(401)

    monkeypatch.setattr(spotify_library_service.requests, "request", fake_request)
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: None)

    try:
        spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")
    except requests.HTTPError:
        pass
    else:
        raise AssertionError("Expected requests.HTTPError for a non-retryable status")

    assert len(calls) == 1


def _make_user(db, user_id):
    user = User(
        id=user_id,
        spotify_user_id=f"spotify-{user_id}",
        username=f"user{user_id}",
        display_name="Demo User",
        refresh_token_cipher="cipher",
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def _track_item(track_id, name, artist, added_at):
    return {
        "added_at": added_at,
        "track": {
            "id": track_id,
            "name": name,
            "artists": [{"id": f"artist-id-{artist}", "name": artist}],
            "album": {"name": "Album", "images": []},
        },
    }


class FakeJsonResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_sync_liked_tracks_walks_full_library_on_first_sync(monkeypatch):
    db = TestingSession()
    user = _make_user(db, 101)
    monkeypatch.setattr(spotify_library_service, "_refresh_access_token", lambda db, user: "access-token")

    page = [_track_item(f"track-{i}", f"Track {i}", "Artist", "2026-01-05T00:00:00Z") for i in range(50)]
    saved_track_calls = []

    def fake_request(method, url, **kwargs):
        if url == spotify_library_service.SPOTIFY_SAVED_TRACKS_URL:
            saved_track_calls.append(kwargs["params"]["offset"])
            return FakeJsonResponse({"items": page if kwargs["params"]["offset"] == 0 else []})
        return FakeJsonResponse({"artists": []})

    monkeypatch.setattr(spotify_library_service, "_request", fake_request)

    result = spotify_library_service.sync_liked_tracks(db, user)

    assert result == {"fetched": 50, "inserted": 50, "updated": 0, "artwork_updated": 0}
    # One full page (50, the limit) plus one more to confirm the list ended.
    assert saved_track_calls == [0, 50]
    db.close()


def test_sync_liked_tracks_stops_once_watermark_reached_without_extra_pages(monkeypatch):
    db = TestingSession()
    user = _make_user(db, 102)
    db.add(LikedTrack(
        user_id=user.id,
        spotify_track_id="already-known",
        track_name="Already Known",
        artist_name="Known Artist",
        added_at=datetime(2026, 1, 1, 0, 0, 0),
    ))
    db.commit()
    monkeypatch.setattr(spotify_library_service, "_refresh_access_token", lambda db, user: "access-token")

    # Spotify returns newest-first: two tracks liked after the watermark,
    # then the already-known one (a same-timestamp boundary item, still
    # reprocessed rather than skipped), then something genuinely older.
    page = [
        _track_item("new-1", "New One", "Artist A", "2026-01-05T00:00:00Z"),
        _track_item("new-2", "New Two", "Artist B", "2026-01-03T00:00:00Z"),
        _track_item("already-known", "Already Known", "Known Artist", "2026-01-01T00:00:00Z"),
        _track_item("older", "Older", "Artist C", "2025-12-01T00:00:00Z"),
    ]
    saved_track_calls = []

    def fake_request(method, url, **kwargs):
        if url == spotify_library_service.SPOTIFY_SAVED_TRACKS_URL:
            saved_track_calls.append(kwargs["params"]["offset"])
            return FakeJsonResponse({"items": page})
        return FakeJsonResponse({"artists": []})

    monkeypatch.setattr(spotify_library_service, "_request", fake_request)

    result = spotify_library_service.sync_liked_tracks(db, user)

    assert result["inserted"] == 2
    assert result["updated"] == 1
    assert result["fetched"] == 3
    # Never requests a second page, and "older" is never touched: the
    # in-progress page's first below-watermark item stops everything.
    assert saved_track_calls == [0]
    assert db.query(LikedTrack).filter_by(user_id=user.id, spotify_track_id="older").first() is None
    db.close()


def test_sync_liked_tracks_makes_a_single_request_when_nothing_new(monkeypatch):
    db = TestingSession()
    user = _make_user(db, 103)
    db.add(LikedTrack(
        user_id=user.id,
        spotify_track_id="already-known",
        track_name="Already Known",
        artist_name="Known Artist",
        added_at=datetime(2026, 2, 1, 0, 0, 0),
    ))
    db.commit()
    monkeypatch.setattr(spotify_library_service, "_refresh_access_token", lambda db, user: "access-token")

    page = [_track_item("already-known", "Already Known", "Known Artist", "2026-01-05T00:00:00Z")]
    saved_track_calls = []

    def fake_request(method, url, **kwargs):
        if url == spotify_library_service.SPOTIFY_SAVED_TRACKS_URL:
            saved_track_calls.append(kwargs["params"]["offset"])
            return FakeJsonResponse({"items": page})
        return FakeJsonResponse({"artists": []})

    monkeypatch.setattr(spotify_library_service, "_request", fake_request)

    result = spotify_library_service.sync_liked_tracks(db, user)

    assert result == {"fetched": 0, "inserted": 0, "updated": 0, "artwork_updated": 0}
    assert saved_track_calls == [0]
    db.close()
