from __future__ import annotations

from datetime import datetime
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import imports as imports_module
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ArtworkCache, ListeningEvent, User
from backend.app.services.processed_import_service import (
    clean_title,
    detect_source,
    generate_track_id,
    is_artist_match,
    normalize_record,
    process_unified_import,
)


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

    user = User(
        id=1,
        spotify_user_id="test-user",
        username="testuser",
        display_name="Test User",
        refresh_token_cipher="cipher",
        is_active=True,
    )
    session.add(user)
    session.commit()

    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def mock_deezer(monkeypatch):
    from backend.app.services import processed_import_service
    monkeypatch.setattr(processed_import_service, "deezer_search", lambda artist, title, timeout=5.0: None)


@pytest.fixture
def client(db_session):
    app.dependency_overrides[imports_module.get_current_user] = lambda: DemoUser()
    app.dependency_overrides[imports_module.get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


# ─── Unit Tests: Metadata Helpers ─────────────────────────────────────────────

def test_clean_title_removes_parenthetical_and_bracketed_metadata():
    assert clean_title("Comfortably Numb (2011 - Remaster)") == "Comfortably Numb"
    assert clean_title("Paranoid Android [Live at Glastonbury]") == "Paranoid Android"
    assert clean_title("Midnight City - Radio Edit") == "Midnight City"
    assert clean_title("Starboy (feat. Daft Punk)") == "Starboy"
    assert clean_title("Standard Track Name") == "Standard Track Name"


def test_is_artist_match_supports_exact_and_featured_artists():
    assert is_artist_match("Daft Punk", "Daft Punk")
    assert is_artist_match("the weeknd", "The Weeknd feat. Daft Punk")
    assert is_artist_match("Daft Punk", "The Weeknd & Daft Punk")
    assert not is_artist_match("Radiohead", "Coldplay")


def test_generate_track_id_is_deterministic_uuid():
    id1 = generate_track_id("spotify", "Radiohead", "Creep")
    id2 = generate_track_id("spotify", "Radiohead", "Creep")
    id3 = generate_track_id("spotify", "Radiohead", "Karma Police")
    assert id1 == id2
    assert id1 != id3
    assert len(id1) == 36  # UUID standard string format length


def test_detect_source_identifies_spotify_and_youtube():
    spotify_account_data = [{"trackName": "Song", "artistName": "Artist", "endTime": "2026-01-01 12:00"}]
    spotify_extended = [{"master_metadata_track_name": "Song", "ts": "2026-01-01T12:00:00Z"}]
    youtube_takeout = [{"header": "YouTube Music", "title": "Watched Song", "subtitles": [{"name": "Artist - Topic"}]}]
    youtube_direct = [{"song": "Song", "artist": "Artist", "time": "2026-01-01T12:00:00Z"}]

    assert detect_source(spotify_account_data) == "spotify"
    assert detect_source(spotify_extended) == "spotify"
    assert detect_source(youtube_takeout) == "youtube"
    assert detect_source(youtube_direct) == "youtube"


# ─── Unit Tests: Normalization ────────────────────────────────────────────────

def test_normalize_record_spotify_skips_podcasts_and_audiobooks():
    podcast = {"episode_name": "Tech Talk Podcast", "ts": "2026-01-01T00:00:00Z"}
    audiobook = {"audiobook_title": "Audiobook Chapter", "ts": "2026-01-01T00:00:00Z"}
    valid_track = {
        "master_metadata_track_name": "Everything in Its Right Place",
        "master_metadata_album_artist_name": "Radiohead",
        "master_metadata_album_album_name": "Kid A",
        "ts": "2026-01-01T12:00:00Z",
        "spotify_track_uri": "spotify:track:kid-a-1",
        "ms_played": 251000,
    }

    assert normalize_record(podcast, "spotify") is None
    assert normalize_record(audiobook, "spotify") is None

    norm = normalize_record(valid_track, "spotify")
    assert norm is not None
    assert norm["song_name"] == "Everything in Its Right Place"
    assert norm["artist_name"] == "Radiohead"
    assert norm["album_name"] == "Kid A"
    assert norm["source"] == "spotify"
    assert norm["duration_ms"] == 251000


def test_normalize_record_youtube_takeout_cleans_watched_and_topic():
    yt_entry = {
        "header": "YouTube Music",
        "title": "Watched Starless (Live)",
        "subtitles": [{"name": "King Crimson - Topic"}],
        "time": "2026-02-14T20:15:00Z",
    }
    norm = normalize_record(yt_entry, "youtube")
    assert norm is not None
    assert norm["song_name"] == "Starless (Live)"
    assert norm["artist_name"] == "King Crimson"
    assert norm["source"] == "youtube"


# ─── Integration Tests: Artwork Cache & Endpoints ─────────────────────────────

def test_process_unified_import_persists_and_reuses_artwork_cache(db_session):
    # Pre-cache artwork in artwork_cache table
    track_id = generate_track_id("spotify", "The National", "Fake Empire")
    cached_art = ArtworkCache(
        track_id=track_id,
        artwork_url="https://images.example.com/boxer.jpg",
        cached_at=datetime.utcnow(),
    )
    db_session.add(cached_art)
    db_session.commit()

    entries = [
        {
            "trackName": "Fake Empire",
            "artistName": "The National",
            "albumName": "Boxer",
            "endTime": "2026-03-01 10:00",
        }
    ]

    result = process_unified_import(db_session, user_id=1, entries=entries)
    assert result["status"] == "ok"
    assert result["summary"]["inserted"] == 1

    event = db_session.query(ListeningEvent).filter(ListeningEvent.user_id == 1).first()
    assert event is not None
    assert event.artwork_url == "https://images.example.com/boxer.jpg"


def test_post_unified_import_endpoint_json_mode(client, db_session):
    payload = {
        "entries": [
            {
                "master_metadata_track_name": "Videotape",
                "master_metadata_album_artist_name": "Radiohead",
                "master_metadata_album_album_name": "In Rainbows",
                "ts": "2026-03-02T11:00:00Z",
                "spotify_track_uri": "spotify:track:videotape-123",
            }
        ]
    }

    response = client.post("/import/unified", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["source"] == "spotify"
    assert data["summary"]["inserted"] == 1

    # Verify deduplication on re-upload
    second_response = client.post("/import/unified", json=payload)
    assert second_response.status_code == 200
    second_data = second_response.json()
    assert second_data["summary"]["inserted"] == 0
    assert second_data["summary"]["duplicate"] == 1


def test_post_unified_import_endpoint_streaming_sse_mode(client, db_session):
    payload = {
        "entries": [
            {
                "song": "Nangs",
                "artist": "Tame Impala",
                "album": "Currents",
                "time": "2026-03-05T08:00:00Z",
            }
        ]
    }

    response = client.post("/import/unified?stream=true", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    lines = response.text.split("\n\n")
    stages = []
    for line in lines:
        if "data: " in line:
            json_part = line.split("data: ")[1].strip()
            if json_part:
                event = json.loads(json_part)
                stages.append(event.get("stage"))

    assert "file_validation" in stages
    assert "record_normalization" in stages
    assert "completion" in stages


def test_get_artwork_cache_lookup_endpoint(client, db_session):
    test_id = "test-track-uuid"
    db_session.add(ArtworkCache(track_id=test_id, artwork_url="https://art.example.com/cover.png"))
    db_session.commit()

    res = client.get(f"/artwork/cache/{test_id}")
    assert res.status_code == 200
    assert res.json()["artwork_url"] == "https://art.example.com/cover.png"

    missing = client.get("/artwork/cache/non-existent-track")
    assert missing.status_code == 404
