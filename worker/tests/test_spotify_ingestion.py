from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from spotify_ingestion import (
    CheckpointRecord,
    SpotifyClient,
    SpotifyRateLimitedError,
    UserRecord,
    normalize_recent_item,
    spotify_rate_limit_blocked_until,
    sync_user,
)


@pytest.fixture(autouse=True)
def _reset_spotify_rate_limit(monkeypatch):
    monkeypatch.setattr("spotify_ingestion._spotify_blocked_until", None)


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


class FakeRateLimitedResponse:
    status_code = 429
    headers = {"Retry-After": "90"}

    def raise_for_status(self):
        raise AssertionError("raise_for_status should not be reached on a 429")


def test_request_marks_app_wide_block_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.time.sleep", lambda _seconds: None)
    monkeypatch.setattr("spotify_ingestion.requests.get", lambda *args, **kwargs: FakeRateLimitedResponse())
    client = SpotifyClient("client-id", "client-secret", "test-key")

    with pytest.raises(SpotifyRateLimitedError):
        client.recently_played("access-token")

    blocked_until = spotify_rate_limit_blocked_until()
    assert blocked_until is not None
    assert blocked_until > datetime.now(timezone.utc)


def test_request_skips_the_network_call_while_already_blocked(monkeypatch):
    monkeypatch.setattr(
        "spotify_ingestion._spotify_blocked_until", datetime.now(timezone.utc) + timedelta(minutes=10)
    )

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Spotify should not be contacted during an active rate-limit block")

    monkeypatch.setattr("spotify_ingestion.requests.get", _fail_if_called)
    client = SpotifyClient("client-id", "client-secret", "test-key")

    with pytest.raises(SpotifyRateLimitedError):
        client.recently_played("access-token")


