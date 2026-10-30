from __future__ import annotations


from spotify_ingestion import (
    ScrobbleSettingsRecord,
    UserRecord,
    normalize_saved_album_item,
    sync_saved_albums_for_user,
)


class FakeResponse:
    status_code = 200

    def raise_for_status(self):
        pass


class FakeSession:
    def commit(self):
        pass


class FakeSavedAlbumsClient:
    def __init__(self, pages):
        self.pages = pages
        self.requested_offsets = []
        self.refresh_token_key = "test-key"

    def refresh_access_token(self, refresh_token):
        return "access", None

    def saved_albums(self, access_token, *, offset=0, limit=50):
        self.requested_offsets.append(offset)
        return self.pages.get(offset, [])


def _saved_album_raw(album_id: str, added_at: str):
    return {
        "added_at": added_at,
        "album": {
            "id": album_id,
            "name": f"Album {album_id}",
            "artists": [{"id": "artist-1", "name": "Artist 1"}],
            "release_date": "2020-05-10",
            "label": "Test Records",
            "images": [{"url": "https://img.spotify.com/art.jpg"}],
            "external_urls": {"spotify": f"https://open.spotify.com/album/{album_id}"},
            "tracks": {
                "items": [
                    {"duration_ms": 180000},
                    {"duration_ms": 200000},
                ]
            },
        },
    }


def _saved_albums_settings(**overrides):
    defaults = dict(
        id=1,
        user_id=4,
        poll_interval_minutes=5,
        liked_tracks_sync_enabled=False,
        liked_tracks_backfill_offset=None,
        liked_tracks_watermark=None,
        liked_tracks_catch_up_floor=None,
        liked_tracks_last_synced_at=None,
        saved_albums_sync_enabled=True,
        saved_albums_backfill_offset=None,
        saved_albums_last_synced_at=None,
    )
    defaults.update(overrides)
    return ScrobbleSettingsRecord(**defaults)


def _user():
    return UserRecord(
        id=4, refresh_token_cipher="cipher", is_active=True, spotify_user_id="spotify", display_name="User"
    )


def test_normalize_saved_album_item():
    raw = _saved_album_raw("alb-1", "2026-02-01T12:00:00Z")
    normalized = normalize_saved_album_item(raw, user_id=4, artist_genres_map={"artist-1": ["Rock"]})

    assert normalized["user_id"] == 4
    assert normalized["spotify_album_id"] == "alb-1"
    assert normalized["album_name"] == "Album alb-1"
    assert normalized["artist_name"] == "Artist 1"
    assert normalized["release_year"] == 2020
    assert normalized["duration_ms"] == 380000
    assert normalized["genres"] == ["Rock"]
    assert normalized["label"] == "Test Records"


def test_sync_saved_albums_backfill(monkeypatch):
    monkeypatch.setattr("spotify_ingestion.decrypt_refresh_token", lambda cipher, key: "refresh")
    monkeypatch.setattr("spotify_ingestion.requests.post", lambda *args, **kwargs: FakeResponse())
    page = [_saved_album_raw(f"alb-{i}", "2026-02-01T12:00:00Z") for i in range(50)]
    client = FakeSavedAlbumsClient(pages={0: page})
    settings = _saved_albums_settings(saved_albums_backfill_offset=0)
    session = FakeSession()

    count = sync_saved_albums_for_user(session, _user(), settings, client, "http://backend", "worker-token")

    assert count == 50
    assert settings.saved_albums_backfill_offset == 50
    assert settings.saved_albums_last_synced_at is None
