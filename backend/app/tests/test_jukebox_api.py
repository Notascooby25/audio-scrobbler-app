from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import User, SavedAlbum

client = TestClient(app)

WORKER_TOKEN = "dev-worker-token"


class FakeQuery:
    def __init__(self, items=None):
        self.items = items or []

    def filter(self, *args, **kwargs):
        return self

    def group_by(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def all(self):
        return self.items

    def first(self):
        return self.items[0] if self.items else None


class FakeDB:
    def __init__(self, user=None, albums=None):
        self.user = user
        self.albums = albums or []

    def query(self, *models):
        if not models:
            return FakeQuery([])
        first_model = models[0]
        if first_model is User:
            return FakeQuery([self.user] if self.user else [])
        if first_model is SavedAlbum:
            return FakeQuery(self.albums)
        return FakeQuery([])

    def execute(self, *args, **kwargs):
        class Result:
            def all(self):
                return []

            def first(self):
                return None

        return Result()

    def commit(self):
        pass

    def add(self, item):
        pass


def teardown_function():
    app.dependency_overrides.clear()


def test_jukebox_albums_unauthorized():
    response = client.get("/jukebox/albums")
    assert response.status_code == 401


def test_jukebox_albums_authorized():
    user = User(id=1, spotify_user_id="sp-1", username="user1", display_name="User", is_active=True)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: FakeDB(user=user)

    response = client.get("/jukebox/albums")
    assert response.status_code == 200
    data = response.json()
    assert "albums" in data
    assert isinstance(data["albums"], list)


def test_internal_saved_albums_requires_worker_token():
    response = client.post("/spotify/internal/saved-albums", json={"user_id": 1, "albums": []})
    assert response.status_code == 401
