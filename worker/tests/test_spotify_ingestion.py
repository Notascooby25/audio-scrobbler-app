from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from spotify_ingestion import (
    CheckpointRecord,
    ScrobbleSettingsRecord,
    SpotifyClient,
    SpotifyRateLimitedError,
    UserRecord,
    backfill_playlist_names,
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




# --- SpotifyClient.playlist ---

class FakePlaylistResponse:
    status_code = 200
    headers = {}

    def __init__(self, name="Road Trip Mix"):
        self._name = name

    def raise_for_status(self):
        return None

    def json(self):
        return {"name": self._name}


def test_playlist_requests_name_field_only(monkeypatch):
    captured = {}

    def _fake_get(url, timeout, **kwargs):
        captured["url"] = url
        captured["headers"] = kwargs.get("headers")
        captured["params"] = kwargs.get("params")
        return FakePlaylistResponse("Road Trip Mix")

    monkeypatch.setattr("spotify_ingestion.requests.get", _fake_get)
    client = SpotifyClient("client-id", "client-secret", "test-key")

    result = client.playlist("access-token", "37i9dQZF1")

    assert result == {"name": "Road Trip Mix"}
    assert captured["url"] == "https://api.spotify.com/v1/playlists/37i9dQZF1"
    assert captured["headers"] == {"Authorization": "Bearer access-token"}
    assert captured["params"] == {"fields": "name"}


# --- backfill_playlist_names ---

class FakeUserSession:
    def __init__(self, users_by_id=None):
        self.users_by_id = users_by_id or {}
        self.commits = 0

    def get(self, model, record_id):
        assert model is UserRecord
        return self.users_by_id.get(record_id)

    def commit(self):
        self.commits += 1


class FakePlaylistClient:
    refresh_token_key = "test-key"

    def __init__(self, names=None, raise_on=None, rotated_refresh_token=None):
        self.names = names or {}
        self.raise_on = raise_on or {}
        self.rotated_refresh_token = rotated_refresh_token
        self.calls = []

    def refresh_access_token(self, refresh_token):
        return "access-token", self.rotated_refresh_token

    def playlist(self, access_token, playlist_id):
        self.calls.append(playlist_id)
        if playlist_id in self.raise_on:
            raise self.raise_on[playlist_id]
        return {"name": self.names.get(playlist_id, "Unknown Playlist")}


def _user(user_id=1, active=True):
    return UserRecord(id=user_id, spotify_user_id="s", display_name="U", refresh_token_cipher="cipher", is_active=active)


def _http_error(status_code):
    import requests
    response = SimpleNamespace(status_code=status_code)
    return requests.HTTPError(response=response)


def _patch_decrypt(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")


def _patch_pending(monkeypatch, items, fetch_error=None):
    if fetch_error is not None:
        monkeypatch.setattr(
            "spotify_ingestion.fetch_pending_playlist_uris",
            lambda *a, **k: (_ for _ in ()).throw(fetch_error),
        )
    else:
        monkeypatch.setattr("spotify_ingestion.fetch_pending_playlist_uris", lambda *a, **k: items)


def _patch_submit(monkeypatch, *, error=None):
    captured = {}
    if error is not None:
        def _submit(*a, **k):
            raise error
    else:
        def _submit(backend_url, worker_token, items):
            captured["items"] = items
    monkeypatch.setattr("spotify_ingestion.submit_playlist_cache_with_retries", _submit)
    return captured


def test_backfill_playlist_names_resolves_and_submits(monkeypatch):
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [{"playlist_uri": "spotify:playlist:abc", "user_id": 1}])
    captured = _patch_submit(monkeypatch)
    session = FakeUserSession({1: _user()})
    client = FakePlaylistClient(names={"abc": "Road Trip Mix"})

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert result == {"processed": 1, "resolved": 1, "failures": 0}
    assert captured["items"] == [{"playlist_uri": "spotify:playlist:abc", "name": "Road Trip Mix"}]
    assert client.calls == ["abc"]


def test_backfill_playlist_names_stops_at_the_rate_limit_and_still_submits_prior_successes(monkeypatch):
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [
        {"playlist_uri": "spotify:playlist:first", "user_id": 1},
        {"playlist_uri": "spotify:playlist:second", "user_id": 1},
        {"playlist_uri": "spotify:playlist:third", "user_id": 1},
    ])
    captured = _patch_submit(monkeypatch)
    session = FakeUserSession({1: _user()})
    client = FakePlaylistClient(
        names={"first": "Playlist One"},
        raise_on={"second": SpotifyRateLimitedError(datetime.now(timezone.utc) + timedelta(minutes=30))},
    )

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    # "first" resolved; "second" was attempted and IS the one that hit the rate
    # limit (so it counts as processed, just not resolved); "third" is never
    # attempted at all once the loop stops.
    assert result == {"processed": 2, "resolved": 1, "failures": 0}
    assert client.calls == ["first", "second"]
    assert captured["items"] == [{"playlist_uri": "spotify:playlist:first", "name": "Playlist One"}]


def test_backfill_playlist_names_caches_a_placeholder_for_404_and_403(monkeypatch):
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [
        {"playlist_uri": "spotify:playlist:gone", "user_id": 1},
        {"playlist_uri": "spotify:playlist:private", "user_id": 1},
    ])
    captured = _patch_submit(monkeypatch)
    session = FakeUserSession({1: _user()})
    client = FakePlaylistClient(raise_on={"gone": _http_error(404), "private": _http_error(403)})

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert result == {"processed": 2, "resolved": 2, "failures": 0}
    assert {"playlist_uri": "spotify:playlist:gone", "name": "Unknown Playlist"} in captured["items"]
    assert {"playlist_uri": "spotify:playlist:private", "name": "Unknown Playlist"} in captured["items"]


def test_backfill_playlist_names_counts_other_http_errors_as_failures(monkeypatch):
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [{"playlist_uri": "spotify:playlist:broken", "user_id": 1}])
    _patch_submit(monkeypatch)
    session = FakeUserSession({1: _user()})
    client = FakePlaylistClient(raise_on={"broken": _http_error(500)})

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert result == {"processed": 1, "resolved": 0, "failures": 1}


def test_backfill_playlist_names_skips_missing_or_inactive_users_without_calling_spotify(monkeypatch):
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [
        {"playlist_uri": "spotify:playlist:a", "user_id": 1},   # not in users_by_id at all
        {"playlist_uri": "spotify:playlist:b", "user_id": 2},   # inactive
    ])
    _patch_submit(monkeypatch)
    session = FakeUserSession({2: _user(user_id=2, active=False)})
    client = FakePlaylistClient()

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert result == {"processed": 2, "resolved": 0, "failures": 2}
    assert client.calls == []


def test_backfill_playlist_names_rotates_refresh_token_and_commits(monkeypatch):
    _patch_decrypt(monkeypatch)
    monkeypatch.setattr("spotify_ingestion.encrypt_refresh_token", lambda token, key: f"encrypted({token})")
    _patch_pending(monkeypatch, [{"playlist_uri": "spotify:playlist:abc", "user_id": 1}])
    _patch_submit(monkeypatch)
    user = _user()
    session = FakeUserSession({1: user})
    client = FakePlaylistClient(names={"abc": "Name"}, rotated_refresh_token="new-refresh-token")

    backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert user.refresh_token_cipher == "encrypted(new-refresh-token)"
    assert session.commits == 1


def test_backfill_playlist_names_reuses_one_lookup_per_repeated_user(monkeypatch):
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [
        {"playlist_uri": "spotify:playlist:a", "user_id": 1},
        {"playlist_uri": "spotify:playlist:b", "user_id": 1},
    ])
    _patch_submit(monkeypatch)

    class CountingSession(FakeUserSession):
        def __init__(self, users_by_id):
            super().__init__(users_by_id)
            self.get_calls = 0

        def get(self, model, record_id):
            self.get_calls += 1
            return super().get(model, record_id)

    session = CountingSession({1: _user()})
    client = FakePlaylistClient(names={"a": "A", "b": "B"})

    backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert session.get_calls == 1


def test_backfill_playlist_names_respects_max_items_via_the_pending_request(monkeypatch):
    _patch_decrypt(monkeypatch)
    captured = {}

    def _fetch(backend_url, worker_token, limit):
        captured["limit"] = limit
        return []

    monkeypatch.setattr("spotify_ingestion.fetch_pending_playlist_uris", _fetch)
    session = FakeUserSession({})
    client = FakePlaylistClient()

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=7)

    assert captured["limit"] == 7
    assert result == {"processed": 0, "resolved": 0, "failures": 0}


def test_backfill_playlist_names_handles_a_dead_backend_when_fetching_pending(monkeypatch):
    import requests
    _patch_pending(monkeypatch, None, fetch_error=requests.ConnectionError("backend unreachable"))
    session = FakeUserSession({})
    client = FakePlaylistClient()

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert result == {"processed": 0, "resolved": 0, "failures": 1}


def test_backfill_playlist_names_counts_failures_if_submitting_results_fails(monkeypatch):
    import requests
    _patch_decrypt(monkeypatch)
    _patch_pending(monkeypatch, [{"playlist_uri": "spotify:playlist:abc", "user_id": 1}])
    _patch_submit(monkeypatch, error=requests.ConnectionError("backend unreachable"))
    session = FakeUserSession({1: _user()})
    client = FakePlaylistClient(names={"abc": "Name"})

    result = backfill_playlist_names(session, client, "http://backend", "worker-token", max_items=10)

    assert result == {"processed": 1, "resolved": 0, "failures": 1}


# --- fetch_pending_playlist_uris / submit_playlist_cache_with_retries (real HTTP path) ---

def test_fetch_pending_playlist_uris_sends_worker_token_and_limit(monkeypatch):
    from spotify_ingestion import fetch_pending_playlist_uris
    captured = {}

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"items": [{"playlist_uri": "spotify:playlist:x", "user_id": 1}]}

    def _fake_get(url, headers, params, timeout):
        captured.update(url=url, headers=headers, params=params)
        return _Resp()

    monkeypatch.setattr("spotify_ingestion.requests.get", _fake_get)

    items = fetch_pending_playlist_uris("http://backend", "worker-token", 5)

    assert items == [{"playlist_uri": "spotify:playlist:x", "user_id": 1}]
    assert captured["url"] == "http://backend/spotify/internal/playlist-cache/pending"
    assert captured["headers"] == {"X-Worker-Token": "worker-token"}
    assert captured["params"] == {"limit": 5}


def test_submit_playlist_cache_with_retries_retries_on_5xx_then_succeeds(monkeypatch):
    from spotify_ingestion import submit_playlist_cache_with_retries
    monkeypatch.setattr("spotify_ingestion.time.sleep", lambda _s: None)
    calls = []

    class _FailThenOk:
        def __init__(self, status_code):
            self.status_code = status_code
            self.headers = {}

        def raise_for_status(self):
            return None

    def _fake_post(url, json, headers, timeout):
        calls.append(json)
        return _FailThenOk(503) if len(calls) == 1 else _FailThenOk(200)

    monkeypatch.setattr("spotify_ingestion.requests.post", _fake_post)

    submit_playlist_cache_with_retries("http://backend", "worker-token", [{"playlist_uri": "u", "name": "n"}])

    assert len(calls) == 2


def test_submit_playlist_cache_with_retries_noop_for_empty_items(monkeypatch):
    from spotify_ingestion import submit_playlist_cache_with_retries
    monkeypatch.setattr(
        "spotify_ingestion.requests.post",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not POST with no items")),
    )

    submit_playlist_cache_with_retries("http://backend", "worker-token", [])
