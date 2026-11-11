from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent, User


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def test_user(db_session):
    user = User(
        spotify_user_id="user_1001",
        username="user1001",
        display_name="User 1001",
        refresh_token_cipher="test",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def client(db_session, test_user):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_get_1001_albums_seeding_and_threshold(client, db_session, test_user):
    # Album 1 is Frank Sinatra - "In The Wee Small Hours", track_count = 12
    # 10 distinct tracks = 10/12 = 83.3% (< 90% threshold -> NOT completed)
    for i in range(1, 11):
        db_session.add(
            ListeningEvent(
                user_id=test_user.id,
                track_id=f"fs_{i}",
                track_name=f"Track {i}",
                artist_name="Frank Sinatra",
                album_name="In The Wee Small Hours",
                played_at=datetime.now(timezone.utc),
                play_id=f"fs_play_{i}",
            )
        )
    db_session.commit()

    resp = client.get("/jukebox/1001-albums")
    assert resp.status_code == 200
    data = resp.json()
    assert "albums" in data
    assert "completed_count" in data
    assert "decade_stats" in data
    assert len(data["albums"]) == 1001

    album1 = next(a for a in data["albums"] if a["id"] == 1)
    assert album1["is_completed"] is False

    # Add 11th track -> 11/12 = 91.6% (>= 90% -> completed)
    db_session.add(
        ListeningEvent(
            user_id=test_user.id,
            track_id="fs_11",
            track_name="Track 11",
            artist_name="Frank Sinatra",
            album_name="In The Wee Small Hours",
            played_at=datetime.now(timezone.utc),
            play_id="fs_play_11",
        )
    )
    db_session.commit()

    resp2 = client.get("/jukebox/1001-albums")
    assert resp2.status_code == 200
    data2 = resp2.json()
    album1_updated = next(a for a in data2["albums"] if a["id"] == 1)
    assert album1_updated["is_completed"] is True
    assert album1_updated["source"] == "scrobble_85pct"
    assert data2["completed_count"] >= 1


def test_toggle_completed_and_persistent_unmark(client, db_session, test_user):
    # Album 2 is Duke Ellington - "Ellington at Newport '56", track_count = 12
    # Manually mark album 2 as completed
    resp = client.post("/jukebox/1001-albums/2/toggle-completed", json={"is_completed": True, "source": "manual"})
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True

    # Manually unmark album 2
    resp2 = client.post(
        "/jukebox/1001-albums/2/toggle-completed", json={"is_completed": False, "source": "manual_unmark"}
    )
    assert resp2.status_code == 200
    assert resp2.json()["is_completed"] is False

    # Now add 12/12 scrobbles for Duke Ellington - Ellington at Newport '56
    for i in range(1, 13):
        db_session.add(
            ListeningEvent(
                user_id=test_user.id,
                track_id=f"de_{i}",
                track_name=f"Ellington Track {i}",
                artist_name="Duke Ellington",
                album_name="Ellington at Newport '56",
                played_at=datetime.now(timezone.utc),
                play_id=f"de_play_{i}",
            )
        )
    db_session.commit()

    # GET /jukebox/1001-albums should NOT auto-mark album 2 because it was manually unmarked
    resp3 = client.get("/jukebox/1001-albums")
    assert resp3.status_code == 200
    album2 = next(a for a in resp3.json()["albums"] if a["id"] == 2)
    assert album2["is_completed"] is False
    assert album2["source"] == "manual_unmark"


def test_pending_play_and_dismissal(client):
    # Record pending play for album 3
    resp = client.post("/jukebox/1001-albums/pending-play", json={"album_id": 3})
    assert resp.status_code == 200

    catalog = client.get("/jukebox/1001-albums").json()
    assert catalog.get("pending_confirmation") is not None
    assert catalog["pending_confirmation"]["album_id"] == 3

    # Dismiss pending play
    resp_dismiss = client.post("/jukebox/1001-albums/dismiss-pending")
    assert resp_dismiss.status_code == 200

    catalog2 = client.get("/jukebox/1001-albums").json()
    assert catalog2.get("pending_confirmation") is None
