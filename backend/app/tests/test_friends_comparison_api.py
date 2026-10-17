from __future__ import annotations

from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import analytics as analytics_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import Follow, ListeningEvent, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class MockUser:
    def __init__(self, user_id: int):
        self.id = user_id


def setup_function():
    db = TestingSession()
    db.query(Follow).delete()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()

    alice = User(
        id=1, spotify_user_id="u1", username="alice", display_name="Alice", refresh_token_cipher="c", is_active=True
    )
    bob = User(id=2, spotify_user_id="u2", username="bob", display_name="Bob", refresh_token_cipher="c", is_active=True)
    db.add_all([alice, bob])
    db.commit()

    db.add(Follow(follower_id=1, followee_id=2))
    now = datetime.utcnow()
    # Both listened to Lime Garden
    db.add(
        ListeningEvent(
            user_id=1,
            track_id="t1",
            track_name="Stain",
            artist_name="Lime Garden",
            played_at=now - timedelta(hours=1),
            duration_ms=180000,
            source="spotify",
            play_id="p1",
        )
    )
    db.add(
        ListeningEvent(
            user_id=2,
            track_id="t2",
            track_name="Stain",
            artist_name="Lime Garden",
            played_at=now - timedelta(hours=2),
            duration_ms=180000,
            source="spotify",
            play_id="p2",
        )
    )
    db.commit()


def teardown_function():
    app.dependency_overrides.clear()


def test_friends_comparison_route_auth_required():
    app.dependency_overrides.clear()
    response = client.get("/reports/friends-comparison")
    assert response.status_code == 401


def test_friends_comparison_route_success():
    db = TestingSession()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: MockUser(1)

    response = client.get("/reports/friends-comparison?range=last.week")
    assert response.status_code == 200
    data = response.json()
    assert data["has_friends"] is True
    assert len(data["top_artists"]) == 1
    assert data["top_artists"][0]["name"] == "Lime Garden"
    assert data["top_artists"][0]["total_scrobbles"] == 2
    assert len(data["top_tracks"]) == 1
    assert data["top_tracks"][0]["name"] == "Stain"
    assert len(data["leaderboard"]) == 2


def test_friends_comparison_route_custom_dates():
    db = TestingSession()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: MockUser(1)

    start_date = (datetime.utcnow() - timedelta(days=2)).date().isoformat()
    end_date = (datetime.utcnow() + timedelta(days=1)).date().isoformat()

    response = client.get(f"/reports/friends-comparison?range=custom&start_date={start_date}&end_date={end_date}")
    assert response.status_code == 200
    data = response.json()
    assert data["has_friends"] is True


def test_friends_comparison_route_invalid_range():
    db = TestingSession()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: MockUser(1)

    response = client.get("/reports/friends-comparison?range=invalid_range")
    assert response.status_code == 400
