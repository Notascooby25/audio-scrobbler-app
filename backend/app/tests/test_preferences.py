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
        if getattr(value, "theme", None) is None:
            value.theme = "system"
        if getattr(value, "accent_color", None) is None:
            value.accent_color = "blue_monday"
        if getattr(value, "notify_recaps", None) is None:
            value.notify_recaps = True
        if getattr(value, "notify_milestones", None) is None:
            value.notify_milestones = True
        if getattr(value, "notify_system", None) is None:
            value.notify_system = False
        if getattr(value, "recap_frequency", None) is None:
            value.recap_frequency = "weekly"
        if getattr(value, "jukebox_source", None) is None:
            value.jukebox_source = "spotify_saved"
        if getattr(value, "jukebox_archive_limit", None) is None:
            value.jukebox_archive_limit = 100
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
    assert response.json()["theme"] == "system"


def test_settings_updates_theme():
    response = client.patch(
        "/users/me/settings",
        json={"theme": "dark"},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"


def test_settings_rejects_invalid_page_size():
    response = client.patch(
        "/users/me/settings",
        json={"default_page_size": 20},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 400


def test_settings_returns_blue_monday_default():
    response = client.get("/users/me/settings", headers={"Authorization": "Bearer demo"})
    assert response.status_code == 200
    assert response.json()["accent_color"] == "blue_monday"


def test_settings_updates_accent_color():
    response = client.patch(
        "/users/me/settings",
        json={"accent_color": "purple_rain"},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 200
    assert response.json()["accent_color"] == "purple_rain"


def test_settings_rejects_invalid_accent_color():
    response = client.patch(
        "/users/me/settings",
        json={"accent_color": "neon_yellow"},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 400


def test_settings_returns_jukebox_archive_limit_default():
    response = client.get("/users/me/settings", headers={"Authorization": "Bearer demo"})
    assert response.status_code == 200
    assert response.json()["jukebox_archive_limit"] == 100


def test_settings_updates_jukebox_archive_limit():
    response = client.patch(
        "/users/me/settings",
        json={"jukebox_archive_limit": 250},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 200
    assert response.json()["jukebox_archive_limit"] == 250


def test_settings_rejects_invalid_jukebox_archive_limit():
    response = client.patch(
        "/users/me/settings",
        json={"jukebox_archive_limit": 500},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 400

