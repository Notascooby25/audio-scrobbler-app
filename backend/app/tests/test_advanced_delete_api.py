from __future__ import annotations

from datetime import datetime

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
    session = sessionmaker(bind=engine, autoflush=False)()
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


def _event(user_id: int, play_id: str, source: str, created_at: datetime) -> ListeningEvent:
    return ListeningEvent(
        user_id=user_id,
        track_id=play_id,
        play_id=play_id,
        track_name="Song",
        artist_name="Artist",
        source=source,
        played_at=datetime(2026, 1, 1, 12, 0, 0),
        created_at=created_at,
    )


def test_batch_delete_with_source_leaves_other_source_in_the_same_hour(client, db_session):
    same_hour = datetime(2026, 11, 20, 18, 20, 0)
    db_session.add_all(
        [
            _event(1, "s1", "spotify", same_hour),
            _event(1, "s2", "spotify", same_hour),
            _event(1, "y1", "youtube", same_hour),
            _event(1, "y2", "youtube", same_hour),
            _event(1, "y3", "youtube", same_hour),
            # Spotify in a different hour must survive too.
            _event(1, "s3", "spotify", datetime(2026, 11, 20, 17, 5, 0)),
            # Another user's data in the same hour and source must survive.
            _event(2, "o1", "youtube", same_hour),
        ]
    )
    db_session.commit()

    response = client.post(
        "/import/advanced-delete",
        json={"source": "youtube", "batch_time": "2026-11-20T18:00:00"},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": 3}
    remaining = {e.play_id for e in db_session.query(ListeningEvent).all()}
    assert remaining == {"s1", "s2", "s3", "o1"}
