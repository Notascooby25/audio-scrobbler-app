from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.api import ingestion as ingestion_module
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent
from backend.app.schemas.ingestion import ListeningEventCreate
from backend.app.services.ingestion_service import ingest_listening_event


engine = create_engine("sqlite:///:memory:")
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class DemoUser:
    id = 1
    spotify_user_id = "demo-user"


def test_ingest_service_inserts_and_deduplicates_events():
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.commit()
    event = ListeningEventCreate(
        track_id="track-1",
        track_name="Track One",
        artist_name="Artist One",
        played_at=datetime(2026, 1, 15, 12, 30),
    )

    first = ingest_listening_event(db, 1, event)
    duplicate = ingest_listening_event(db, 1, event)

    assert first.duplicate is False
    assert duplicate.duplicate is True
    assert duplicate.event_id == first.event_id
    assert db.query(ListeningEvent).count() == 1
    db.close()


def test_ingest_service_keeps_users_isolated():
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.commit()
    event = ListeningEventCreate(
        track_id="track-2",
        track_name="Track Two",
        artist_name="Artist Two",
        played_at=datetime(2026, 1, 15, 12, 30),
    )

    first = ingest_listening_event(db, 1, event)
    second = ingest_listening_event(db, 2, event)

    assert first.duplicate is False
    assert second.duplicate is False
    assert db.query(ListeningEvent).count() == 2
    db.close()


def test_ingest_route_requires_authentication():
    response = client.post(
        "/ingestion/events",
        json={
            "track_id": "track-3",
            "track_name": "Track Three",
            "artist_name": "Artist Three",
            "played_at": "2026-01-15T12:30:00",
        },
    )

    assert response.status_code == 401


def test_ingest_route_rejects_invalid_payload():
    app.dependency_overrides[ingestion_module.get_current_user] = lambda: DemoUser()
    response = client.post(
        "/ingestion/events",
        json={
            "track_id": "",
            "track_name": "Track Three",
            "artist_name": "Artist Three",
            "played_at": "2026-01-15T12:30:00",
        },
    )
    app.dependency_overrides.clear()

    assert response.status_code == 422