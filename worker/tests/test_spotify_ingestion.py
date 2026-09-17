from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from spotify_ingestion import (
    CheckpointRecord,
    ScrobbleSettingsRecord,
    SpotifyClient,
    SpotifyRateLimitedError,
    UserRecord,
    normalize_recent_item,
    spotify_rate_limit_blocked_until,
    sync_liked_tracks_for_user,
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


def _saved_item(track_id, added_at):
    return {
        "added_at": added_at,
        "track": {"id": track_id, "name": f"Track {track_id}", "artists": [{"name": "Artist"}]},
    }


class FakeLikedTracksClient:
    refresh_token_key = "test-key"

    def __init__(self, pages):
        self.pages = pages  # {offset: [raw_item, ...]}
        self.requested_offsets = []

    def refresh_access_token(self, refresh_token):
        return "access", None

    def saved_tracks(self, access_token, *, offset=0, limit=40):
        self.requested_offsets.append(offset)
        return self.pages.get(offset, [])


def _liked_settings(**overrides):
    defaults = dict(
        id=1,
        user_id=4,
        poll_interval_minutes=5,
        liked_tracks_sync_enabled=True,
        liked_tracks_backfill_offset=None,
        liked_tracks_watermark=None,
        liked_tracks_catch_up_floor=None,
        liked_tracks_last_synced_at=None,
    )
    defaults.update(overrides)
    return ScrobbleSettingsRecord(**defaults)


def _liked_user():
    return UserRecord(id=4, refresh_token_cipher="cipher", is_active=True, spotify_user_id="spotify", display_name="User")


def test_liked_tracks_backfill_continues_across_ticks_on_a_full_page(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: FakeResponse())
    page = [_saved_item(f"track-{i}", "2026-02-01T12:00:00.000Z") for i in range(40)]
    client = FakeLikedTracksClient(pages={0: page})
    settings = _liked_settings(liked_tracks_backfill_offset=0)
    session = FakeSession()

    count = sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")

    assert count == 40
    assert settings.liked_tracks_backfill_offset == 40
    assert settings.liked_tracks_watermark == datetime(2026, 2, 1, 12, 0)
    assert settings.liked_tracks_last_synced_at is None


def test_liked_tracks_backfill_completes_on_a_short_page(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: FakeResponse())
    first_page = [_saved_item(f"track-{i}", "2026-02-01T12:00:00.000Z") for i in range(40)]
    second_page = [_saved_item("track-old", "2025-01-01T00:00:00.000Z")]
    client = FakeLikedTracksClient(pages={0: first_page, 40: second_page})
    settings = _liked_settings(liked_tracks_backfill_offset=0)
    session = FakeSession()

    sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")
    assert settings.liked_tracks_backfill_offset == 40

    count = sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")

    assert count == 1
    assert settings.liked_tracks_backfill_offset is None
    assert settings.liked_tracks_last_synced_at is not None
    # The watermark was fixed from the walk's very first page and must not
    # be regressed backward by an older, later page finishing the walk.
    assert settings.liked_tracks_watermark == datetime(2026, 2, 1, 12, 0)


def test_liked_tracks_steady_state_skips_when_not_yet_due(monkeypatch):
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Spotify should not be contacted before the daily interval elapses")

    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", _fail_if_called)
    client = FakeLikedTracksClient(pages={})
    settings = _liked_settings(liked_tracks_last_synced_at=datetime.now(timezone.utc).replace(tzinfo=None))
    session = FakeSession()

    count = sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")

    assert count == 0
    assert client.requested_offsets == []


def test_liked_tracks_steady_state_stops_at_the_watermark(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: FakeResponse())
    page = [
        _saved_item("track-new-2", "2026-02-03T00:00:00.000Z"),
        _saved_item("track-new-1", "2026-02-02T00:00:00.000Z"),
        _saved_item("track-old", "2026-02-01T00:00:00.000Z"),
    ]
    client = FakeLikedTracksClient(pages={0: page})
    settings = _liked_settings(
        liked_tracks_watermark=datetime(2026, 2, 1, 0, 0),
        liked_tracks_last_synced_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2),
    )
    session = FakeSession()

    count = sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")

    assert count == 2
    assert settings.liked_tracks_backfill_offset is None
    assert settings.liked_tracks_watermark == datetime(2026, 2, 3, 0, 0)


def test_liked_tracks_more_than_one_page_since_last_check_is_not_lost(monkeypatch):
    """Regression test: a full page where every item is still newer than the
    watermark must not advance the watermark and stop — there may be more
    beyond it, so the walk must continue via offset on the next tick."""
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: FakeResponse())
    full_page = [_saved_item(f"track-{i}", "2026-02-05T00:00:00.000Z") for i in range(40)]
    client = FakeLikedTracksClient(pages={0: full_page, 40: []})
    stale_last_synced_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)
    settings = _liked_settings(
        liked_tracks_watermark=datetime(2026, 2, 1, 0, 0),
        liked_tracks_last_synced_at=stale_last_synced_at,
    )
    session = FakeSession()

    count = sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")

    assert count == 40
    # Still catching up — must not be marked "done" (offset advances,
    # last_synced_at is left untouched) after only one of possibly several
    # pages of new likes.
    assert settings.liked_tracks_backfill_offset == 40
    assert settings.liked_tracks_last_synced_at == stale_last_synced_at

    # The next tick continues the walk unconditionally (bypassing the daily
    # gate, since `catching_up` is now true) and this time finds a short
    # page, finishing the catch-up.
    count_2 = sync_liked_tracks_for_user(session, _liked_user(), settings, client, "http://backend", "worker-token")
    assert count_2 == 0
    assert settings.liked_tracks_backfill_offset is None
    assert settings.liked_tracks_last_synced_at != stale_last_synced_at
    assert settings.liked_tracks_watermark == datetime(2026, 2, 5, 0, 0)


