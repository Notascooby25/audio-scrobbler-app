from __future__ import annotations

from datetime import datetime

import pytest
import requests

from spotify_ingestion import (
    CheckpointRecord,
    UserRecord,
    normalize_recent_item,
    sync_liked_tracks_and_artwork,
    sync_user,
)


ITEM = {
    "played_at": "2026-02-01T12:00:00.000Z",
    "track": {
        "id": "track-1",
        "name": "Track One",
        "duration_ms": 210000,
        "artists": [{"name": "Artist One"}],
    },
}


def test_normalize_recent_item_maps_spotify_fields():
    event = normalize_recent_item(ITEM, 4)

    assert event["user_id"] == 4
    assert event["track_id"] == "track-1"
    assert event["play_id"] == f"track-1:{ITEM['played_at']}"
    assert event["artist_name"] == "Artist One"
    assert event["album_name"] is None
    assert event["duration_ms"] == 210000
    assert event["played_at"] == "2026-02-01T12:00:00"
    assert event["raw_metadata"] == ITEM
    assert event["source"] == "spotify"


def test_normalize_recent_item_maps_album_name_when_present():
    item = {
        "played_at": "2026-02-01T12:00:00.000Z",
        "track": {
            "id": "track-1",
            "name": "Track One",
            "duration_ms": 210000,
            "artists": [{"name": "Artist One"}],
            "album": {"name": "Album One"},
        },
    }

    event = normalize_recent_item(item, 4)

    assert event["album_name"] == "Album One"


def test_normalize_recent_item_skips_malformed_items():
    assert normalize_recent_item({"track": {}, "played_at": "bad"}, 4) is None


class FakeClient:
    refresh_token_key = "test-key"

    def refresh_access_token(self, refresh_token):
        assert refresh_token == "refresh"
        return "access", None

    def recently_played(self, access_token, after):
        assert access_token == "access"
        assert after is None
        return [ITEM]


class FakeResponse:
    status_code = 201
    headers = {}

    def raise_for_status(self):
        return None


class FakeSession:
    def __init__(self):
        self.checkpoint = None
        self.commits = 0
        self.added = None

    def get(self, model, user_id):
        return self.checkpoint

    def add(self, record):
        self.added = record
        self.checkpoint = record

    def commit(self):
        self.commits += 1


def test_sync_advances_checkpoint_after_success(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: FakeResponse())
    user = UserRecord(id=4, refresh_token_cipher="cipher", is_active=True, spotify_user_id="spotify", display_name="User")
    session = FakeSession()

    count = sync_user(session, user, FakeClient(), "http://backend", "worker-token")

    assert count == 1
    assert session.commits == 1
    assert session.checkpoint.last_played_at == datetime(2026, 2, 1, 12, 0)


def test_sync_does_not_commit_when_backend_submission_fails(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("backend failed")))
    user = UserRecord(id=4, refresh_token_cipher="cipher", is_active=True, spotify_user_id="spotify", display_name="User")
    session = FakeSession()

    with pytest.raises(RuntimeError):
        sync_user(session, user, FakeClient(), "http://backend", "worker-token")

    assert session.commits == 0


class FakeInternalResponse:
    def __init__(self, status_code, headers=None, payload=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_sync_liked_tracks_and_artwork_calls_both_internal_endpoints(monkeypatch):
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append((url, json, headers))
        return FakeInternalResponse(200, payload={"fetched": 1, "inserted": 1, "updated": 0, "artwork_updated": 0})

    monkeypatch.setattr("spotify_ingestion.requests.post", fake_post)

    sync_liked_tracks_and_artwork("http://backend", "worker-token", 4)

    assert [call[0] for call in calls] == [
        "http://backend/spotify/internal/sync-liked-tracks",
        "http://backend/spotify/internal/backfill-artwork",
    ]
    assert all(call[1] == {"user_id": 4} for call in calls)
    assert all(call[2] == {"X-Worker-Token": "worker-token"} for call in calls)


def test_sync_liked_tracks_and_artwork_retries_on_429(monkeypatch):
    responses = iter([
        FakeInternalResponse(429, headers={"Retry-After": "0"}),
        FakeInternalResponse(200, payload={"fetched": 0, "inserted": 0, "updated": 0, "artwork_updated": 0}),
        FakeInternalResponse(200, payload={"fetched": 0, "inserted": 0, "updated": 0, "artwork_updated": 0}),
    ])
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *a, **k: next(responses))
    monkeypatch.setattr("spotify_ingestion.time.sleep", lambda seconds: None)

    sync_liked_tracks_and_artwork("http://backend", "worker-token", 4)


def test_sync_liked_tracks_and_artwork_raises_when_first_call_fails(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *a, **k: FakeInternalResponse(401))

    with pytest.raises(requests.HTTPError):
        sync_liked_tracks_and_artwork("http://backend", "worker-token", 4)