from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import users as users_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import Follow, ListeningEvent, User

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class ViewerUser:
    id = 1
    spotify_user_id = "viewer"


def _seed_users(db):
    db.query(Follow).delete()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()
    db.add(User(id=1, spotify_user_id="viewer", username="viewer", display_name="Viewer", refresh_token_cipher="c", is_active=True))
    db.add(User(id=2, spotify_user_id="target", username="music-fan", display_name="Music Fan", refresh_token_cipher="c", is_active=True))
    db.add(User(id=3, spotify_user_id="inactive", username="inactive-user", display_name="Inactive", refresh_token_cipher="c", is_active=False))
    db.commit()


def test_follow_requires_authentication():
    response = client.post("/users/2/follow")
    assert response.status_code == 401


def test_follow_rejects_self_follow():
    db = TestingSession()
    _seed_users(db)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.post("/users/1/follow", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 400


def test_follow_rejects_inactive_user():
    db = TestingSession()
    _seed_users(db)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.post("/users/3/follow", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 404


def test_follow_then_unfollow_is_idempotent_and_updates_counts():
    db = TestingSession()
    _seed_users(db)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        first = client.post("/users/2/follow", headers={"Authorization": "Bearer test"})
        second = client.post("/users/2/follow", headers={"Authorization": "Bearer test"})
        unfollow = client.delete("/users/2/follow", headers={"Authorization": "Bearer test"})
        unfollow_again = client.delete("/users/2/follow", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert first.status_code == 200
    assert first.json() == {"following": True, "follower_count": 1}
    assert second.json() == {"following": True, "follower_count": 1}
    assert unfollow.json() == {"following": False, "follower_count": 0}
    assert unfollow_again.json() == {"following": False, "follower_count": 0}


def test_search_requires_authentication():
    response = client.get("/users/search?q=music")
    assert response.status_code == 401


def test_search_matches_username_and_display_name():
    db = TestingSession()
    _seed_users(db)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/users/search?q=music", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 200
    usernames = [result["username"] for result in response.json()["results"]]
    assert usernames == ["music-fan"]


def test_search_excludes_inactive_users():
    db = TestingSession()
    _seed_users(db)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/users/search?q=inactive", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.json()["results"] == []


def _seed_scrobble(db, user_id: int):
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id="track-1",
            track_name="Slow Show",
            artist_name="The National",
            album_name="Trouble Will Find Me",
            played_at=datetime(2026, 1, 15, 12, 30),
            source="spotify",
            play_id="track-1",
        )
    )
    db.commit()


def test_profile_requires_authentication():
    response = client.get("/users/2/profile")
    assert response.status_code == 401


def test_profile_returns_404_for_unknown_user():
    db = TestingSession()
    _seed_users(db)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/users/999/profile", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 404


def test_profile_hides_last_scrobble_from_non_followers():
    db = TestingSession()
    _seed_users(db)
    _seed_scrobble(db, 2)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/users/2/profile", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    payload = response.json()
    assert payload["is_self"] is False
    assert payload["is_following"] is False
    assert payload["can_view_details"] is False
    assert payload["last_scrobble"] is None
    assert payload["username"] == "music-fan"


def test_profile_reveals_last_scrobble_to_followers():
    db = TestingSession()
    _seed_users(db)
    _seed_scrobble(db, 2)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        client.post("/users/2/follow", headers={"Authorization": "Bearer test"})
        response = client.get("/users/2/profile", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    payload = response.json()
    assert payload["is_following"] is True
    assert payload["can_view_details"] is True
    assert payload["last_scrobble"]["track_name"] == "Slow Show"
    assert payload["last_scrobble"]["album_name"] == "Trouble Will Find Me"


def test_profile_always_reveals_last_scrobble_to_self():
    db = TestingSession()
    _seed_users(db)
    _seed_scrobble(db, 1)
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/users/1/profile", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    payload = response.json()
    assert payload["is_self"] is True
    assert payload["can_view_details"] is True
    assert payload["last_scrobble"]["track_name"] == "Slow Show"
