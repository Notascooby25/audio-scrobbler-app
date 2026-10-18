from __future__ import annotations

import csv
from datetime import datetime
import io
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent


class DemoUser:
    id = 1
    spotify_user_id = "test-user"
    username = "testuser"
    display_name = "Test User"
    refresh_token_cipher = "cipher"
    is_active = True


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
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: DemoUser()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_export_scrobbles_requires_authentication(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # No get_current_user override
    unauthed_client = TestClient(app)
    response = unauthed_client.get("/import/export")
    assert response.status_code == 401
    app.dependency_overrides.clear()


def test_export_scrobbles_csv(client, db_session):
    db_session.add_all([
        ListeningEvent(
            user_id=1,
            track_id="t1",
            track_name="Song A",
            artist_name="Artist X",
            album_name="Album 1",
            duration_ms=180000,
            source="spotify",
            played_at=datetime(2026, 1, 15, 12, 0, 0),
        ),
        ListeningEvent(
            user_id=1,
            track_id="t2",
            track_name="Song B",
            artist_name="Artist Y",
            album_name=None,
            duration_ms=None,
            source="youtube",
            played_at=datetime(2026, 1, 16, 14, 30, 0),
        ),
        # Another user's scrobble should NOT be exported
        ListeningEvent(
            user_id=2,
            track_id="t3",
            track_name="Secret Song",
            artist_name="Other Artist",
            album_name=None,
            duration_ms=200000,
            source="spotify",
            played_at=datetime(2026, 1, 17, 10, 0, 0),
        ),
    ])
    db_session.commit()

    response = client.get("/import/export?format=csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert ".csv" in response.headers["content-disposition"]

    reader = list(csv.reader(io.StringIO(response.text)))
    assert len(reader) == 3  # header + 2 user-1 scrobbles
    assert reader[0] == ["played_at", "track_name", "artist_name", "album_name", "duration_ms", "source"]

    # First row should be the most recent (Song B)
    assert reader[1][1] == "Song B"
    assert reader[1][2] == "Artist Y"
    assert reader[1][3] == ""
    assert reader[1][5] == "youtube"

    # Second row should be Song A
    assert reader[2][1] == "Song A"
    assert reader[2][2] == "Artist X"
    assert reader[2][3] == "Album 1"
    assert reader[2][4] == "180000"
    assert reader[2][5] == "spotify"


def test_export_scrobbles_json(client, db_session):
    db_session.add_all([
        ListeningEvent(
            user_id=1,
            track_id="t1",
            track_name="Song A",
            artist_name="Artist X",
            album_name="Album 1",
            duration_ms=180000,
            source="spotify",
            played_at=datetime(2026, 1, 15, 12, 0, 0),
        ),
        ListeningEvent(
            user_id=2,
            track_id="t3",
            track_name="Secret Song",
            artist_name="Other Artist",
            source="spotify",
            played_at=datetime(2026, 1, 17, 10, 0, 0),
        ),
    ])
    db_session.commit()

    response = client.get("/import/export?format=json")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert ".json" in response.headers["content-disposition"]

    data = json.loads(response.text)
    assert len(data) == 1
    assert data[0]["track_name"] == "Song A"
    assert data[0]["artist_name"] == "Artist X"
    assert data[0]["source"] == "spotify"
    assert data[0]["duration_ms"] == 180000
