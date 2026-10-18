from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import BlockedItem, ListeningEvent
from backend.app.services.spotify_playlist_service import normalize_spotify_uri


class DemoUser:
    id = 1
    spotify_user_id = "test-user-1"
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


def test_normalize_spotify_uri():
    assert normalize_spotify_uri("spotify:track:4cOdK2wGLETKBW3PvgPWqT") == "spotify:track:4cOdK2wGLETKBW3PvgPWqT"
    assert (
        normalize_spotify_uri("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc")
        == "spotify:track:4cOdK2wGLETKBW3PvgPWqT"
    )
    assert normalize_spotify_uri("4cOdK2wGLETKBW3PvgPWqT") == "spotify:track:4cOdK2wGLETKBW3PvgPWqT"
    assert normalize_spotify_uri("") is None
    assert normalize_spotify_uri("invalid uri with spaces") is None


def test_rediscover_requires_authentication(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    unauthed_client = TestClient(app)

    res_get = unauthed_client.get("/analytics/rediscover")
    assert res_get.status_code == 401

    res_post = unauthed_client.post("/analytics/rediscover/playlist", json={"mode": "forgotten"})
    assert res_post.status_code == 401

    app.dependency_overrides.clear()


def test_rediscover_forgotten_favorites(client, db_session):
    now = datetime.utcnow()

    # Track A: 4 plays, all > 100 days ago -> Qualified forgotten favorite
    for i in range(4):
        db_session.add(
            ListeningEvent(
                user_id=1,
                track_id="spotify-track-a-12345678",
                track_name="Old Gold",
                artist_name="Classic Band",
                album_name="Greatest Hits",
                played_at=now - timedelta(days=120 + i),
                source="spotify",
                play_id=f"a-{i}",
            )
        )

    # Track B: 5 plays, but most recent was 5 days ago (< 90 days) -> Not forgotten
    for i in range(4):
        db_session.add(
            ListeningEvent(
                user_id=1,
                track_id="spotify-track-b-12345678",
                track_name="Recent Hit",
                artist_name="Current Artist",
                played_at=now - timedelta(days=100 + i),
                source="spotify",
                play_id=f"b-{i}",
            )
        )
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="spotify-track-b-12345678",
            track_name="Recent Hit",
            artist_name="Current Artist",
            played_at=now - timedelta(days=5),
            source="spotify",
            play_id="b-recent",
        )
    )

    # Track C: only 2 plays > 100 days ago -> Under threshold (min_plays=3)
    for i in range(2):
        db_session.add(
            ListeningEvent(
                user_id=1,
                track_id="spotify-track-c-12345678",
                track_name="Two Play Wonder",
                artist_name="One Hit Band",
                played_at=now - timedelta(days=110 + i),
                source="spotify",
                play_id=f"c-{i}",
            )
        )

    # Track D: 5 plays > 100 days ago, but artist is blocked
    db_session.add(BlockedItem(user_id=1, entity_type="artist", name="Blocked Artist"))
    for i in range(5):
        db_session.add(
            ListeningEvent(
                user_id=1,
                track_id="spotify-track-d-12345678",
                track_name="Blocked Jam",
                artist_name="Blocked Artist",
                played_at=now - timedelta(days=150 + i),
                source="spotify",
                play_id=f"d-{i}",
            )
        )

    # Track E: User 2's track (4 plays > 100 days ago) -> Isolated from User 1
    for i in range(4):
        db_session.add(
            ListeningEvent(
                user_id=2,
                track_id="spotify-track-e-12345678",
                track_name="Other User Track",
                artist_name="Other Artist",
                played_at=now - timedelta(days=130 + i),
                source="spotify",
                play_id=f"e-{i}",
            )
        )

    db_session.commit()

    res = client.get("/analytics/rediscover?mode=forgotten")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == 1
    assert data["mode"] == "forgotten"
    assert len(data["tracks"]) == 1

    track = data["tracks"][0]
    assert track["track_name"] == "Old Gold"
    assert track["artist_name"] == "Classic Band"
    assert track["album_name"] == "Greatest Hits"
    assert track["play_count"] == 4
    assert "4 plays · Last played" in track["context_badge"]


def test_rediscover_on_this_day(client, db_session):
    now = datetime.utcnow()

    # Track 1yr: played exactly 365 days ago
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="track-1yr-1234567890123",
            track_name="Last Year Memory",
            artist_name="Nostalgia Band",
            played_at=now - timedelta(days=365),
            source="spotify",
            play_id="yr1-1",
        )
    )

    # Track 2yr: played exactly 730 days ago
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="track-2yr-1234567890123",
            track_name="Two Years Ago Jam",
            artist_name="Vintage Artist",
            played_at=now - timedelta(days=730),
            source="spotify",
            play_id="yr2-1",
        )
    )

    # Track 6mo: played 180 days ago -> Not on this day/anniversary
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="track-6mo-1234567890123",
            track_name="Mid Year Track",
            artist_name="Mid Year Artist",
            played_at=now - timedelta(days=180),
            source="spotify",
            play_id="6mo-1",
        )
    )

    # Blocked track: 365 days ago, but track name is blocked
    db_session.add(BlockedItem(user_id=1, entity_type="track", name="Blocked Anniversary Track"))
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="track-blocked-1234567890",
            track_name="Blocked Anniversary Track",
            artist_name="Some Artist",
            played_at=now - timedelta(days=365),
            source="spotify",
            play_id="blk-1",
        )
    )

    db_session.commit()

    res = client.get("/analytics/rediscover?mode=anniversary")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == 1
    assert data["mode"] == "anniversary"
    assert len(data["tracks"]) == 2

    # Should be ordered by most recent anniversary first
    assert data["tracks"][0]["track_name"] == "Last Year Memory"
    assert "Played 1 year ago" in data["tracks"][0]["context_badge"]
    assert data["tracks"][1]["track_name"] == "Two Years Ago Jam"
    assert "Played 2 years ago" in data["tracks"][1]["context_badge"]


def test_export_rediscover_playlist_success(client, db_session):
    now = datetime.utcnow()

    # Seed 2 forgotten favorites
    for i in range(3):
        db_session.add(
            ListeningEvent(
                user_id=1,
                track_id="4cOdK2wGLETKBW3PvgPWqT",
                track_name="Forgotten One",
                artist_name="Artist One",
                played_at=now - timedelta(days=100 + i),
                source="spotify",
                play_id=f"f1-{i}",
            )
        )
        db_session.add(
            ListeningEvent(
                user_id=1,
                track_id="5lODk3wgLetkBW4pVGPwqt",
                track_name="Forgotten Two",
                artist_name="Artist Two",
                played_at=now - timedelta(days=120 + i),
                source="spotify",
                play_id=f"f2-{i}",
            )
        )
    db_session.commit()

    with patch("backend.app.api.analytics.create_playlist") as mock_create:
        mock_create.return_value = (
            "Forgotten Favorites — Oct 2026",
            "https://open.spotify.com/playlist/fake123",
            2,
        )

        res = client.post(
            "/analytics/rediscover/playlist",
            json={"mode": "forgotten"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["playlist_name"] == "Forgotten Favorites — Oct 2026"
        assert data["playlist_url"] == "https://open.spotify.com/playlist/fake123"
        assert data["track_count"] == 2

        mock_create.assert_called_once()
        args, kwargs = mock_create.call_args
        assert kwargs["track_uris"] == [
            "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
            "spotify:track:5lODk3wgLetkBW4pVGPwqt",
        ]


def test_export_rediscover_playlist_no_tracks(client, db_session):
    # Empty DB has no tracks
    res = client.post(
        "/analytics/rediscover/playlist",
        json={"mode": "forgotten"},
    )
    assert res.status_code == 400
    assert "No Spotify tracks found" in res.json()["detail"]
