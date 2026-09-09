from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import ingestion as ingestion_module
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent
from backend.app.schemas.ingestion import ListeningEventCreate
from backend.app.services.canonical_scrobble import canonicalize_scrobble
from backend.app.services.ingestion_service import ingest_listening_event
from backend.app.services.spotify_import_service import import_spotify_history
from backend.app.services.youtube_import_service import import_youtube_history


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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


def test_ingestion_rejects_negative_duration():
    with pytest.raises(ValidationError):
        ListeningEventCreate(
            track_id="track-duration",
            track_name="Track Duration",
            artist_name="Artist Duration",
            played_at=datetime(2026, 1, 15, 12, 30),
            duration_ms=-1,
        )


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


def test_worker_ingest_route_requires_worker_token():
    response = client.post(
        "/ingestion/internal/events",
        json={
            "user_id": 1,
            "track_id": "track-4",
            "track_name": "Track Four",
            "artist_name": "Artist Four",
            "played_at": "2026-01-15T12:30:00",
        },
    )

    assert response.status_code == 401


def test_worker_ingest_route_rejects_unknown_user():
    class Query:
        def filter(self, *args):
            return self

        def first(self):
            return None

    class FakeDB:
        def query(self, *args):
            return Query()

    app.dependency_overrides[get_db] = lambda: FakeDB()
    response = client.post(
        "/ingestion/internal/events",
        headers={"X-Worker-Token": "dev-worker-token"},
        json={
            "user_id": 999,
            "track_id": "track-5",
            "track_name": "Track Five",
            "artist_name": "Artist Five",
            "played_at": "2026-01-15T12:30:00",
        },
    )
    app.dependency_overrides.clear()

    assert response.status_code == 404


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


def test_listening_event_supports_canonical_import_identity_fields():
    event = ListeningEvent(
        user_id=1,
        track_id="track-legacy",
        track_name="Legacy Track",
        artist_name="Legacy Artist",
        played_at=datetime(2026, 1, 15, 12, 30),
        source="spotify",
        play_id="spotify-play-123",
        raw_metadata={"platform": "spotify", "country": "US"},
    )

    assert event.play_id == "spotify-play-123"
    assert event.source == "spotify"
    assert event.raw_metadata == {"platform": "spotify", "country": "US"}


def test_canonicalize_scrobble_normalizes_spotify_and_youtube_records():
    spotify_record = {
        "played_at": "2026-01-15T12:30:00.000Z",
        "track": {
            "id": "spotify-track-1",
            "name": "Daylight",
            "artists": [{"name": "Matt Berninger"}],
            "album": {"name": "Trouble Will Find Me"},
            "duration_ms": 220000,
        },
        "context": {"platform": "spotify", "country": "US"},
    }
    youtube_record = {
        "title": "Midnight City",
        "artist": "M83",
        "album": "Hurry Up, We're Dreaming",
        "time": "2026-01-15T12:31:00Z",
        "duration_ms": 240000,
        "context": {"platform": "youtube", "country": "GB"},
    }

    spotify = canonicalize_scrobble(user_id=1, source="spotify", raw_item=spotify_record)
    youtube = canonicalize_scrobble(user_id=1, source="youtube", raw_item=youtube_record)

    assert spotify["user_id"] == 1
    assert spotify["source"] == "spotify"
    assert spotify["play_id"] == "spotify-track-1"
    assert spotify["track_name"] == "Daylight"
    assert spotify["album_name"] == "Trouble Will Find Me"
    assert spotify["context"]["platform"] == "spotify"
    assert spotify["context"]["country"] == "US"

    assert youtube["source"] == "youtube"
    assert youtube["play_id"] == "youtube-midnight-city-2026-01-15T12:31:00Z"
    assert youtube["track_name"] == "Midnight City"
    assert youtube["artist_name"] == "M83"
    assert youtube["context"]["platform"] == "youtube"
    assert youtube["context"]["country"] == "GB"


def test_import_spotify_history_inserts_valid_tracks_and_skips_bad_rows():
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.commit()

    entries = [
        {
            "endTime": "2026-01-15 12:30:00",
            "artistName": "The National",
            "trackName": "Slow Show",
            "albumName": "Trouble Will Find Me",
            "msPlayed": 240000,
            "trackUri": "spotify:track:slow-show",
        },
        {
            "endTime": "2026-01-15 12:45:00",
            "artistName": "The National",
            "trackName": "Mistaken for Strangers",
            "albumName": "Trouble Will Find Me",
            "msPlayed": 210000,
        },
    ]

    summary = import_spotify_history(db, 1, entries)

    assert summary["inserted"] == 1
    assert summary["skipped"] == 1
    assert db.query(ListeningEvent).filter(ListeningEvent.user_id == 1).count() == 1
    assert db.query(ListeningEvent).first().source == "spotify"
    db.close()


def test_import_youtube_history_inserts_valid_tracks_and_skips_bad_rows():
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.commit()

    entries = [
        {
            "title": "Midnight City",
            "artist": "M83",
            "album": "Hurry Up, We're Dreaming",
            "time": "2026-01-15T12:31:00Z",
            "duration_ms": 240000,
            "context": {"platform": "youtube", "country": "GB"},
        },
        {
            "title": "",
            "artist": "M83",
            "time": "2026-01-15T12:35:00Z",
            "duration_ms": 195000,
        },
    ]

    summary = import_youtube_history(db, 1, entries)

    assert summary["inserted"] == 1
    assert summary["skipped"] == 1
    assert db.query(ListeningEvent).filter(ListeningEvent.user_id == 1).count() == 1
    assert db.query(ListeningEvent).first().source == "youtube"
    db.close()


def test_import_route_accepts_unified_source_payloads():
    db = TestingSession()
    app.dependency_overrides[ingestion_module.get_current_user] = lambda: DemoUser()
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.post(
            "/import/scrobbles",
            json={
                "source": "spotify",
                "entries": [
                    {
                        "endTime": "2026-01-15 12:30:00",
                        "artistName": "The National",
                        "trackName": "Slow Show",
                        "albumName": "Trouble Will Find Me",
                        "msPlayed": 240000,
                        "trackUri": "spotify:track:slow-show",
                    }
                ],
            },
            headers={"Authorization": "Bearer test-token"},
        )
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 200
    assert response.json()["source"] == "spotify"
    assert response.json()["summary"]["inserted"] == 1