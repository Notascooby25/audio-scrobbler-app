from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.api import preferences as preferences_module
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import UserPreferences

client = TestClient(app)


class DemoUser:
    id = 1


class FakeQuery:
    def __init__(self, value=None):
        self.value = value

    def filter(self, *args):
        return self

    def first(self):
        return self.value


class FakeDB:
    def __init__(self):
        self.preferences = None

    def query(self, model):
        return FakeQuery(self.preferences if model is UserPreferences else None)

    def add(self, value):
        self.preferences = value

    def commit(self):
        return None

    def refresh(self, value):
        return None


def setup_function():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    app.dependency_overrides[preferences_module.get_current_user] = lambda: DemoUser()


def teardown_function():
    app.dependency_overrides.clear()


def test_settings_returns_last_week_defaults():
    response = client.get("/users/me/settings", headers={"Authorization": "Bearer demo"})
    assert response.status_code == 200
    assert response.json()["default_date_range"] == "last.week"
    assert response.json()["default_page_size"] == 50
    assert response.json()["default_library_view"] == "list"


def test_settings_rejects_invalid_page_size():
    response = client.patch(
        "/users/me/settings",
        json={"default_page_size": 20},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 400
