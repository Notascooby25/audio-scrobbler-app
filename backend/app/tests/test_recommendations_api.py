from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import Follow, MusicRecommendation, Notification, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSession()
    db.query(MusicRecommendation).delete()
    db.query(Notification).delete()
    db.query(Follow).delete()
    db.query(User).delete()
    db.commit()
    db.close()


def teardown_function():
    app.dependency_overrides.clear()


def test_create_recommendation_success():
    db = TestingSession()
    u1 = User(spotify_user_id="user1", username="user1", display_name="Alice", refresh_token_cipher="test_cipher", is_active=True)
    u2 = User(spotify_user_id="user2", username="user2", display_name="Bob", refresh_token_cipher="test_cipher", is_active=True)
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1)
    db.refresh(u2)

    # u1 follows u2
    f = Follow(follower_id=u1.id, followee_id=u2.id)
    db.add(f)
    db.commit()
    u1_id = u1.id
    u2_id = u2.id
    db.close()

    app.dependency_overrides[get_current_user] = lambda: u1

    resp = client.post(
        "/recommendations",
        json={
            "receiver_id": u2_id,
            "item_type": "track",
            "title": "Glasgow",
            "artist_name": "The Snuts",
            "album_name": "W.L.",
            "image_url": "https://example.com/art.jpg",
            "spotify_uri": "spotify:track:12345",
            "spotify_url": "https://open.spotify.com/track/12345",
            "note": "Brilliant song!",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Glasgow"
    assert data["sender_id"] == u1_id
    assert data["receiver_id"] == u2_id
    assert data["status"] == "pending"

    # Notification created for u2
    db = TestingSession()
    stmt = select(Notification).where(Notification.user_id == u2_id)
    notif = db.scalars(stmt).first()
    assert notif is not None
    assert "Alice" in notif.message
    assert "Glasgow" in notif.message
    assert notif.link == "/play"
    assert notif.type == "recommendation"
    db.close()


def test_create_recommendation_rejected_when_not_following():
    db = TestingSession()
    u1 = User(spotify_user_id="user1", username="user1", display_name="Alice", refresh_token_cipher="test_cipher", is_active=True)
    u3 = User(spotify_user_id="user3", username="user3", display_name="Charlie", refresh_token_cipher="test_cipher", is_active=True)
    db.add_all([u1, u3])
    db.commit()
    db.refresh(u1)
    db.refresh(u3)
    db.close()

    # u1 does not follow u3
    app.dependency_overrides[get_current_user] = lambda: u1

    resp = client.post(
        "/recommendations",
        json={
            "receiver_id": u3.id,
            "item_type": "track",
            "title": "Song",
            "artist_name": "Artist",
        },
    )
    assert resp.status_code == 403


def test_active_recommendations_and_status_update():
    db = TestingSession()
    u1 = User(spotify_user_id="user1", username="user1", display_name="Alice", refresh_token_cipher="test_cipher", is_active=True)
    u2 = User(spotify_user_id="user2", username="user2", display_name="Bob", refresh_token_cipher="test_cipher", is_active=True)
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1)
    db.refresh(u2)

    rec = MusicRecommendation(
        sender_id=u1.id,
        receiver_id=u2.id,
        item_type="track",
        title="Always",
        artist_name="The Snuts",
        status="pending",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    u2_id = u2.id
    rec_id = rec.id

    # u2 fetches active recommendations
    app.dependency_overrides[get_current_user] = lambda: db.get(User, u2_id)

    resp = client.get("/recommendations/active")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == rec_id
    assert items[0]["sender_name"] == "Alice"

    # u2 marks as listened
    patch_resp = client.patch(f"/recommendations/{rec_id}/status", json={"status": "listened"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "listened"

    # now active returns 0
    resp2 = client.get("/recommendations/active")
    assert resp2.status_code == 200
    assert len(resp2.json()) == 0


def test_create_recommendation_also_sends_a_phone_push():
    db = TestingSession()
    u1 = User(spotify_user_id="p1", username="p1", display_name="Alice", refresh_token_cipher="c", is_active=True)
    u2 = User(spotify_user_id="p2", username="p2", display_name="Bob", refresh_token_cipher="c", is_active=True)
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    db.add(Follow(follower_id=u1.id, followee_id=u2.id))
    db.commit()
    u2_id = u2.id
    db.refresh(u1)
    db.close()
    app.dependency_overrides[get_current_user] = lambda: u1

    with patch("backend.app.api.recommendations.queue_push") as push:
        resp = client.post(
            "/recommendations",
            json={"receiver_id": u2_id, "item_type": "track", "title": "Glasgow", "artist_name": "The Snuts"},
        )

    assert resp.status_code == 201
    push.assert_called_once_with(u2_id, "Music Recommendation", "Alice recommended Glasgow by The Snuts", "/play")
