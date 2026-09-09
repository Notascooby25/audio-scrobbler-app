from __future__ import annotations

from backend.app.models import User
from backend.app.services import bootstrap_service


class Query:
    def __init__(self, user):
        self.user = user

    def filter(self, *args):
        return self

    def first(self):
        return self.user


class FakeDB:
    def __init__(self, user=None):
        self.user = user
        self.added = None
        self.commits = 0

    def query(self, *args):
        return Query(self.user)

    def add(self, user):
        self.added = user
        self.user = user

    def commit(self):
        self.commits += 1

    def refresh(self, user):
        return None


def test_bootstrap_creates_development_user(monkeypatch):
    monkeypatch.setattr(bootstrap_service, "settings", type("Settings", (), {
        "environment": "development",
        "dev_user_id": 7,
        "dev_user_spotify_id": "dev-seven",
        "dev_user_display_name": "Dev Seven",
    })())
    db = FakeDB()

    user = bootstrap_service.bootstrap_development_user(db)

    assert isinstance(user, User)
    assert user.id == 7
    assert user.spotify_user_id == "dev-seven"
    assert db.commits == 1


def test_bootstrap_is_idempotent(monkeypatch):
    monkeypatch.setattr(bootstrap_service, "settings", type("Settings", (), {
        "environment": "development",
        "dev_user_id": 1,
    })())
    existing = User(id=1, spotify_user_id="existing", display_name="Existing", refresh_token_cipher="cipher")
    db = FakeDB(existing)

    user = bootstrap_service.bootstrap_development_user(db)

    assert user is existing
    assert db.commits == 0


def test_bootstrap_is_disabled_outside_development(monkeypatch):
    monkeypatch.setattr(bootstrap_service, "settings", type("Settings", (), {"environment": "production"})())
    db = FakeDB()

    assert bootstrap_service.bootstrap_development_user(db) is None
    assert db.added is None