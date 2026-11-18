from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import users as users_module
from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import Follow, ListeningEvent, Notification, User

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)
AUTH = {"Authorization": "Bearer test"}


NAMES = {
    1: ("viewer", "Viewer"),
    2: ("music-fan", "Music Fan"),
    4: ("viewer-two", "Viewer"),  # same display name as user 1
}


class FakeUser:
    """Stands in for the signed-in User the auth dependency returns."""

    def __init__(self, user_id: int) -> None:
        self.id = user_id
        self.spotify_user_id = f"user-{user_id}"
        self.username, self.display_name = NAMES.get(user_id, (f"user{user_id}", f"User {user_id}"))


@pytest.fixture()
def db(monkeypatch):
    session = TestingSession()
    session.query(Notification).delete()
    session.query(Follow).delete()
    session.query(ListeningEvent).delete()
    session.query(User).delete()
    session.commit()
    session.add(
        User(
            id=1,
            spotify_user_id="u1",
            username="viewer",
            display_name="Viewer",
            refresh_token_cipher="c",
            is_active=True,
        )
    )
    session.add(
        User(
            id=2,
            spotify_user_id="u2",
            username="music-fan",
            display_name="Music Fan",
            refresh_token_cipher="c",
            is_active=True,
        )
    )
    session.add(
        User(
            id=3,
            spotify_user_id="u3",
            username="inactive-user",
            display_name="Inactive",
            refresh_token_cipher="c",
            is_active=False,
        )
    )
    session.commit()
    pushes: list[tuple] = []
    monkeypatch.setattr(users_module, "queue_push", lambda *args, **kwargs: pushes.append(args))
    session.pushes = pushes  # type: ignore[attr-defined]
    app.dependency_overrides[users_module.get_db] = lambda: session
    yield session
    app.dependency_overrides.clear()
    session.close()


def _as(user_id: int) -> None:
    app.dependency_overrides[users_module.get_current_user] = lambda: FakeUser(user_id)


def _follow_notifications(db, user_id: int) -> list[Notification]:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.type == "follow").all()


def test_new_follow_creates_notification_and_push(db):
    _as(1)
    response = client.post("/users/2/follow", headers=AUTH)
    assert response.status_code == 200
    notes = _follow_notifications(db, 2)
    assert len(notes) == 1
    assert notes[0].title == "New follower"
    assert notes[0].message == "Viewer started following you"
    assert notes[0].link == "/following?from=1"
    assert db.pushes == [(2, "New follower", "Viewer started following you", "/following?from=1")]


def test_two_followers_with_the_same_display_name_both_notify(db):
    db.add(
        User(
            id=4,
            spotify_user_id="u4",
            username="viewer-two",
            display_name="Viewer",
            refresh_token_cipher="c",
            is_active=True,
        )
    )
    db.commit()
    _as(1)
    client.post("/users/2/follow", headers=AUTH)
    _as(4)
    client.post("/users/2/follow", headers=AUTH)
    assert len(_follow_notifications(db, 2)) == 2


def test_renaming_does_not_bypass_the_cooldown(db):
    _as(1)
    client.post("/users/2/follow", headers=AUTH)
    client.delete("/users/2/follow", headers=AUTH)
    db.query(User).filter(User.id == 1).update({"display_name": "Totally New Name"})
    db.commit()
    NAMES[1] = ("viewer", "Totally New Name")
    try:
        client.post("/users/2/follow", headers=AUTH)
    finally:
        NAMES[1] = ("viewer", "Viewer")
    assert len(_follow_notifications(db, 2)) == 1


def test_repeat_follow_does_not_notify_again(db):
    _as(1)
    client.post("/users/2/follow", headers=AUTH)
    client.post("/users/2/follow", headers=AUTH)
    assert len(_follow_notifications(db, 2)) == 1
    assert len(db.pushes) == 1


def test_follow_unfollow_spam_is_rate_limited(db):
    _as(1)
    client.post("/users/2/follow", headers=AUTH)
    client.delete("/users/2/follow", headers=AUTH)
    client.post("/users/2/follow", headers=AUTH)
    assert len(_follow_notifications(db, 2)) == 1
    assert len(db.pushes) == 1


def test_follow_notifies_again_after_24_hours(db):
    _as(1)
    client.post("/users/2/follow", headers=AUTH)
    client.delete("/users/2/follow", headers=AUTH)
    note = _follow_notifications(db, 2)[0]
    note.created_at = utc_now() - timedelta(hours=25)
    db.commit()
    client.post("/users/2/follow", headers=AUTH)
    assert len(_follow_notifications(db, 2)) == 2


def test_followers_list_requires_auth():
    assert client.get("/users/me/followers").status_code == 401


def test_followers_list_has_no_last_scrobble(db):
    db.add(
        ListeningEvent(
            user_id=1,
            track_id="t1",
            track_name="Secret Song",
            artist_name="Artist",
            played_at=utc_now(),
            source="spotify",
        )
    )
    db.add(Follow(follower_id=1, followee_id=2))
    db.commit()
    _as(2)
    response = client.get("/users/me/followers", headers=AUTH)
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert set(results[0].keys()) == {"id", "username", "display_name"}
    assert "Secret Song" not in response.text


def test_followers_list_hides_inactive_users(db):
    db.add(Follow(follower_id=3, followee_id=2))
    db.commit()
    _as(2)
    assert client.get("/users/me/followers", headers=AUTH).json()["results"] == []


def test_remove_follower_requires_auth():
    assert client.delete("/users/me/followers/1").status_code == 401


def test_remove_follower_removes_access(db):
    db.add(Follow(follower_id=1, followee_id=2))
    db.commit()
    _as(1)
    assert client.get("/users/2/profile", headers=AUTH).json()["can_view_details"] is True
    _as(2)
    response = client.delete("/users/me/followers/1", headers=AUTH)
    assert response.status_code == 200
    assert response.json() == {"follower_count": 0}
    _as(1)
    assert client.get("/users/2/profile", headers=AUTH).json()["can_view_details"] is False


def test_remove_follower_is_idempotent_and_scoped(db):
    db.add(Follow(follower_id=2, followee_id=1))  # user 2 follows user 1
    db.commit()
    _as(2)
    # user 2 has no followers: removing user 1 as a "follower" is a harmless no-op
    response = client.delete("/users/me/followers/1", headers=AUTH)
    assert response.status_code == 200
    assert response.json() == {"follower_count": 0}
    # and it did not delete the follow where user 2 is the follower
    assert db.query(Follow).filter(Follow.follower_id == 2, Follow.followee_id == 1).count() == 1


def test_remove_follower_sends_no_notification(db):
    db.add(Follow(follower_id=1, followee_id=2))
    db.commit()
    _as(2)
    client.delete("/users/me/followers/1", headers=AUTH)
    assert db.query(Notification).count() == 0
    assert db.pushes == []
