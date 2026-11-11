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
        spotify_user_id="user_rt_test",
        username="user_rt",
        display_name="User RT",
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


def test_rough_trade_api_endpoints(client, db_session, test_user):
    # 1. Fetch catalog
    res = client.get("/jukebox/rough-trade-albums")
    assert res.status_code == 200
    data = res.json()
    assert data["total_albums"] == 700
    assert len(data["albums"]) == 700
    assert "2026" in data["year_stats"]

    # 2. Toggle completion on album 10
    toggle_res = client.post(
        "/jukebox/rough-trade-albums/10/toggle-completed",
        json={"is_completed": True, "source": "manual"},
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_completed"] is True
    assert toggle_res.json()["completed_count"] == 1

    # 3. Toggle off
    toggle_res2 = client.post(
        "/jukebox/rough-trade-albums/10/toggle-completed",
        json={"is_completed": False, "source": "manual_unmark"},
    )
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["is_completed"] is False
    assert toggle_res2.json()["completed_count"] == 0

    # 4. Out of bounds album ID error
    bad_res = client.post(
        "/jukebox/rough-trade-albums/9999/toggle-completed",
        json={"is_completed": True, "source": "manual"},
    )
    assert bad_res.status_code == 400
