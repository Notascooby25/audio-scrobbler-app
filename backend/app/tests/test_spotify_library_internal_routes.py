from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.api import spotify_library as spotify_library_module
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import User

client = TestClient(app)

WORKER_TOKEN = "dev-worker-token"


class Query:
    def __init__(self, user=None):
        self.user = user

    def filter(self, *args):
        return self

    def first(self):
        return self.user


class FakeDB:
    def __init__(self, user=None):
        self.user = user

    def query(self, *args):
        return Query(self.user)


def teardown_function():
    app.dependency_overrides.clear()


def test_internal_backfill_artwork_requires_worker_token():
    response = client.post("/spotify/internal/backfill-artwork", json={"user_id": 1})

    assert response.status_code == 401


def test_internal_backfill_artwork_rejects_unknown_user():
    app.dependency_overrides[get_db] = lambda: FakeDB(user=None)

    response = client.post(
        "/spotify/internal/backfill-artwork",
        headers={"X-Worker-Token": WORKER_TOKEN},
        json={"user_id": 999},
    )

    assert response.status_code == 404


def test_internal_backfill_artwork_returns_result(monkeypatch):
    user = User(id=4, spotify_user_id="spotify-4", username="user4", display_name="User Four", is_active=True)
    app.dependency_overrides[get_db] = lambda: FakeDB(user=user)
    monkeypatch.setattr(
        spotify_library_module,
        "backfill_scrobble_artwork",
        lambda db, passed_user: {"fetched": 5, "inserted": 0, "updated": 0, "artwork_updated": 5},
    )

    response = client.post(
        "/spotify/internal/backfill-artwork",
        headers={"X-Worker-Token": WORKER_TOKEN},
        json={"user_id": 4},
    )

    assert response.status_code == 200
    assert response.json() == {"fetched": 5, "inserted": 0, "updated": 0, "artwork_updated": 5}


def test_internal_playlist_cache_pending_requires_worker_token():
    response = client.get("/spotify/internal/playlist-cache/pending")

    assert response.status_code == 401


def test_internal_playlist_cache_pending_returns_service_result(monkeypatch):
    app.dependency_overrides[get_db] = lambda: FakeDB()
    monkeypatch.setattr(
        spotify_library_module,
        "find_pending_playlist_uris",
        lambda db, limit: [{"playlist_uri": "spotify:playlist:abc", "user_id": 4}],
    )

    response = client.get(
        "/spotify/internal/playlist-cache/pending",
        headers={"X-Worker-Token": WORKER_TOKEN},
        params={"limit": 5},
    )

    assert response.status_code == 200
    assert response.json() == {"items": [{"playlist_uri": "spotify:playlist:abc", "user_id": 4}]}


def test_internal_playlist_cache_pending_rejects_limit_out_of_range():
    response = client.get(
        "/spotify/internal/playlist-cache/pending",
        headers={"X-Worker-Token": WORKER_TOKEN},
        params={"limit": 999},
    )

    assert response.status_code == 422


def test_internal_playlist_cache_upsert_requires_worker_token():
    response = client.post("/spotify/internal/playlist-cache", json={"items": []})

    assert response.status_code == 401


def test_internal_playlist_cache_upsert_returns_count(monkeypatch):
    app.dependency_overrides[get_db] = lambda: FakeDB()
    captured = {}

    def _fake_upsert(db, items):
        captured["items"] = items
        return len(items)

    monkeypatch.setattr(spotify_library_module, "upsert_playlist_cache", _fake_upsert)

    response = client.post(
        "/spotify/internal/playlist-cache",
        headers={"X-Worker-Token": WORKER_TOKEN},
        json={"items": [{"playlist_uri": "spotify:playlist:abc", "name": "Road Trip"}]},
    )

    assert response.status_code == 200
    assert response.json() == {"upserted": 1}
    assert captured["items"][0].playlist_uri == "spotify:playlist:abc"
    assert captured["items"][0].name == "Road Trip"
