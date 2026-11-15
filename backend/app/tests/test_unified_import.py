from __future__ import annotations

from datetime import datetime
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import imports as imports_module
from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import ArtworkCache, ListeningEvent, User
from backend.app.services import processed_import_service
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


def test_detect_source_identifies_spotify_and_youtube_and_apple():
    spotify_account_data = [{"trackName": "Song", "artistName": "Artist", "endTime": "2026-01-01 12:00"}]
    spotify_extended = [{"master_metadata_track_name": "Song", "ts": "2026-01-01T12:00:00Z"}]
    youtube_takeout = [{"header": "YouTube Music", "title": "Watched Song", "subtitles": [{"name": "Artist - Topic"}]}]
    youtube_direct = [{"song": "Song", "artist": "Artist", "time": "2026-01-01T12:00:00Z"}]
    apple_processed = [{"source": "Apple Music", "song": "Song", "artist": "Artist", "time": "2026-01-01T12:00:00Z"}]

    assert detect_source(spotify_account_data) == "spotify"
    assert detect_source(spotify_extended) == "spotify"
    assert detect_source(youtube_takeout) == "youtube"
    assert detect_source(youtube_direct) == "youtube"
    assert detect_source(apple_processed) == "apple"


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


def test_normalize_record_apple_extracts_correct_fields():
    apple_entry = {
        "source": "Apple Music",
        "artist": "Radiohead",
        "song": "Paranoid Android",
        "release": "OK Computer",
        "time": "2026-03-10T10:00:00Z"
    }
    norm = normalize_record(apple_entry, "apple")
    assert norm is not None
    assert norm["song_name"] == "Paranoid Android"
    assert norm["artist_name"] == "Radiohead"
    assert norm["album_name"] == "OK Computer"
    assert norm["source"] == "apple"
    assert norm["play_id"].startswith(f"apple-{norm['track_id']}-")


def test_detect_source_prefers_explicit_spotify_over_song_key():
    prepped_spotify = [
        {
            "source": "Spotify",
            "artist": "Foals",
            "song": "Spanish Sahara",
            "release": "Total Life Forever",
            "artwork": "https://cdn.example/art.jpg",
            "time": "2012-11-24T15:31:53Z",
        }
    ]
    assert detect_source(prepped_spotify) == "spotify"


def test_normalize_spotify_accepts_prepped_script_format():
    prepped = {
        "source": "Spotify",
        "artist": "Foals",
        "song": "Spanish Sahara",
        "release": "Total Life Forever",
        "artwork": "https://cdn.example/art.jpg",
        "time": "2012-11-24T15:31:53Z",
    }
    norm = normalize_record(prepped, "spotify")
    assert norm is not None
    assert norm["artist_name"] == "Foals"
    assert norm["song_name"] == "Spanish Sahara"
    assert norm["album_name"] == "Total Life Forever"
    assert norm["artwork_url"] == "https://cdn.example/art.jpg"
    assert norm["source"] == "spotify"


def test_normalize_spotify_extended_streaming_history_skips_non_music():
    null_track = {
        "ts": "2012-04-27T18:59:45Z",
        "master_metadata_track_name": None,
        "master_metadata_album_artist_name": None,
        "spotify_track_uri": None,
    }
    podcast = {
        "ts": "2024-01-01T10:00:00Z",
        "master_metadata_track_name": None,
        "episode_name": "Ep 1",
        "spotify_episode_uri": "spotify:episode:123",
    }
    audiobook = {
        "ts": "2024-01-01T10:00:00Z",
        "audiobook_title": "Chapter 1",
        "audiobook_uri": "spotify:audiobook:123",
    }
    assert normalize_record(null_track, "spotify") is None
    assert normalize_record(podcast, "spotify") is None
    assert normalize_record(audiobook, "spotify") is None


def test_normalize_youtube_raw_takeout_requires_youtube_music_and_topic_channel():
    non_music_video = {
        "header": "YouTube",
        "title": "Watched Funny Cats",
        "subtitles": [{"name": "Cat Channel"}],
        "time": "2026-02-14T20:15:00Z",
    }
    non_topic_ytm = {
        "header": "YouTube Music",
        "title": "Watched Podcast Clip",
        "subtitles": [{"name": "Some Creator"}],
        "time": "2026-02-14T20:15:00Z",
    }
    valid_ytm = {
        "header": "YouTube Music",
        "title": "Watched Spanish Sahara",
        "subtitles": [{"name": "Foals - Topic"}],
        "time": "2026-02-14T20:15:00Z",
    }
    assert normalize_record(non_music_video, "youtube") is None
    assert normalize_record(non_topic_ytm, "youtube") is None
    norm = normalize_record(valid_ytm, "youtube")
    assert norm is not None
    assert norm["artist_name"] == "Foals"
    assert norm["song_name"] == "Spanish Sahara"


# ─── Integration Tests: Artwork Cache & Endpoints ─────────────────────────────

def test_process_unified_import_persists_and_reuses_artwork_cache(db_session):
    # Pre-cache artwork in artwork_cache table
    track_id = generate_track_id("spotify", "The National", "Fake Empire")
    cached_art = ArtworkCache(
        track_id=track_id,
        artwork_url="https://images.example.com/boxer.jpg",
        cached_at=utc_now(),
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


def test_process_unified_import_does_not_call_external_artwork_apis(db_session, monkeypatch):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("External artwork lookup should not run during upload")

    monkeypatch.setattr(processed_import_service, "deezer_search", fail_if_called)
    monkeypatch.setattr(processed_import_service, "itunes_artwork", fail_if_called)

    entries = [
        {
            "master_metadata_track_name": "Unseen Track",
            "master_metadata_album_artist_name": "Unseen Artist",
            "master_metadata_album_album_name": "Unseen Album",
            "ts": "2026-03-06T12:00:00Z",
            "spotify_track_uri": "spotify:track:unseen-123",
        }
    ]

    result = process_unified_import(db_session, user_id=1, entries=entries)
    assert result["status"] == "ok"
    assert result["summary"]["inserted"] == 1


def test_process_unified_import_sanitizes_long_and_null_byte_fields(db_session):
    long_title = ("A" * 300) + "\x00"
    long_artist = ("B" * 300) + "\x00"
    long_album = ("C" * 300) + "\x00"
    entries = [
        {
            "master_metadata_track_name": long_title,
            "master_metadata_album_artist_name": long_artist,
            "master_metadata_album_album_name": long_album,
            "ts": "2026-03-07T12:00:00Z",
            "spotify_track_uri": "spotify:track:" + ("x" * 300) + "\x00",
        }
    ]

    result = process_unified_import(db_session, user_id=1, entries=entries)
    assert result["summary"]["inserted"] == 1

    event = db_session.query(ListeningEvent).filter(ListeningEvent.user_id == 1).first()
    assert event is not None
    assert len(event.track_name) <= 255
    assert len(event.artist_name) <= 255
    assert len(event.album_name or "") <= 255
    assert len(event.track_id) <= 255
    assert len(event.play_id) <= 255
    assert "\x00" not in event.track_name
    assert "\x00" not in event.artist_name


def test_process_unified_import_chunked_dedup_across_batches(db_session):
    # Pre-insert two existing events: one matched by (track_id, played_at), one by (source, play_id)
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id=generate_track_id("spotify", "Artist 0", "Song 0", "spotify:track:existing-0"),
            track_name="Song 0",
            artist_name="Artist 0",
            album_name="Album",
            played_at=datetime(2026, 1, 1, 0, 0, 0),
            source="spotify",
            play_id="different-play-id",
            payload="",
        )
    )
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="other",
            track_name="Song 1",
            artist_name="Artist 1",
            album_name="Album",
            played_at=datetime(2026, 1, 1, 0, 1, 0),
            source="spotify",
            play_id="spotify:track:existing-1:2026-01-01T00:02:00Z",
            payload="",
        )
    )
    db_session.commit()

    entries = [
        {
            "master_metadata_track_name": "Song 0",
            "master_metadata_album_artist_name": "Artist 0",
            "ts": "2026-01-01T00:00:00Z",
            "spotify_track_uri": "spotify:track:existing-0",
        },
        {
            "master_metadata_track_name": "Song 1",
            "master_metadata_album_artist_name": "Artist 1",
            "ts": "2026-01-01T00:02:00Z",
            "spotify_track_uri": "spotify:track:existing-1",
        },
    ]
    # Add 550 new unique tracks + 1 intra-batch duplicate
    for i in range(550):
        entries.append(
            {
                "master_metadata_track_name": f"Track {i}",
                "master_metadata_album_artist_name": "Batch Artist",
                "ts": f"2026-02-{(i // 24) + 1:02d}T{i % 24:02d}:00:00Z",
                "spotify_track_uri": f"spotify:track:batch-{i}",
            }
        )
    entries.append(entries[-1])  # intra-batch duplicate

    result = process_unified_import(db_session, user_id=1, entries=entries)
    assert result["summary"]["inserted"] == 550
    assert result["summary"]["duplicate"] == 3

