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


def test_internal_sync_liked_tracks_requires_worker_token():
    response = client.post("/spotify/internal/sync-liked-tracks", json={"user_id": 1})

    assert response.status_code == 401


def test_internal_backfill_artwork_requires_worker_token():
    response = client.post("/spotify/internal/backfill-artwork", json={"user_id": 1})

    assert response.status_code == 401


def test_internal_sync_liked_tracks_rejects_unknown_user():
    app.dependency_overrides[get_db] = lambda: FakeDB(user=None)

    response = client.post(
        "/spotify/internal/sync-liked-tracks",
        headers={"X-Worker-Token": WORKER_TOKEN},
        json={"user_id": 999},
    )

    assert response.status_code == 404


def test_internal_sync_liked_tracks_returns_sync_result(monkeypatch):
    user = User(id=4, spotify_user_id="spotify-4", username="user4", display_name="User Four", is_active=True)
    app.dependency_overrides[get_db] = lambda: FakeDB(user=user)
    monkeypatch.setattr(
        spotify_library_module,
        "sync_liked_tracks",
        lambda db, passed_user: {
            "fetched": 3,
            "inserted": 2,
            "updated": 1,
            "artwork_updated": 0,
        } if passed_user.id == 4 else (_ for _ in ()).throw(AssertionError("wrong user")),
    )

    response = client.post(
        "/spotify/internal/sync-liked-tracks",
        headers={"X-Worker-Token": WORKER_TOKEN},
        json={"user_id": 4},
    )

    assert response.status_code == 200
    assert response.json() == {"fetched": 3, "inserted": 2, "updated": 1, "artwork_updated": 0}


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
