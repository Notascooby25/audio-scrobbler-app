from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.api import spotify_library as spotify_library_module
from backend.app.db import get_db
from backend.app.main import app

client = TestClient(app)


class DemoUser:
    id = 1


class UnusedDB:
    pass


def setup_function():
    app.dependency_overrides[get_db] = lambda: UnusedDB()
    app.dependency_overrides[spotify_library_module.get_current_user] = lambda: DemoUser()


def teardown_function():
    app.dependency_overrides.clear()


def test_like_route_returns_liked_state(monkeypatch):
    monkeypatch.setattr(spotify_library_module, "set_track_liked", lambda db, user, track_id, liked: {
        "spotify_track_id": track_id,
        "is_liked": liked,
    })

    response = client.put("/spotify/tracks/track-123/like")

    assert response.status_code == 200
    assert response.json() == {"spotify_track_id": "track-123", "is_liked": True}


def test_unlike_route_returns_unliked_state(monkeypatch):
    monkeypatch.setattr(spotify_library_module, "set_track_liked", lambda db, user, track_id, liked: {
        "spotify_track_id": track_id,
        "is_liked": liked,
    })

    response = client.delete("/spotify/tracks/track-123/like")

    assert response.status_code == 200
    assert response.json() == {"spotify_track_id": "track-123", "is_liked": False}
