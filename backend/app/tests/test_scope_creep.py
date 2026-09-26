from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent, User
from backend.app.services.bbc_sounds_service import _normalize_spotify_uri

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)

class DemoUser:
    id = 1
    spotify_user_id = "testuser"
    username = "testuser"
    display_name = "Test User"

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = lambda: DemoUser()

client = TestClient(app)

def setup_function():
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.add(User(
        id=1,
        spotify_user_id="testuser",
        username="testuser",
        display_name="Test User",
        refresh_token_cipher="cipher",
        is_active=True,
    ))
    db.commit()
    db.close()


def test_normalize_spotify_uri():
    assert _normalize_spotify_uri(None) is None
    assert _normalize_spotify_uri("") is None
    assert _normalize_spotify_uri("spotify:track:0fBSs3fRoh1yJcne77fdu9") == "spotify:track:0fBSs3fRoh1yJcne77fdu9"
    assert (
        _normalize_spotify_uri("https://open.spotify.com/track/0fBSs3fRoh1yJcne77fdu9?si=123")
        == "spotify:track:0fBSs3fRoh1yJcne77fdu9"
    )


@patch("backend.app.api.tools.fetch_bbc_playlist")
def test_scope_creep_fetch(mock_fetch):
    mock_fetch.return_value = {
        "title": "Indie Chill",
        "tracks": [
            {
                "segment_id": "seg_1",
                "artist": "Lana Del Rey",
                "title": "Video Games",
                "offset_seconds": 38,
                "duration_seconds": 240,
                "spotify_uri": "spotify:track:0fBSs3fRoh1yJcne77fdu9",
                "image_url": "https://example.com/art.jpg",
            }
        ],
        "spotify_uris": ["spotify:track:0fBSs3fRoh1yJcne77fdu9"],
    }

    res = client.post("/tools/scope-creep/fetch", json={"url": "https://www.bbc.co.uk/sounds/play/m0031tc6"})
    assert res.status_code == 200
    data = res.json()
    assert data["play_id"] == "m0031tc6"
    assert data["title"] == "Indie Chill"
    assert len(data["tracks"]) == 1
    assert data["tracks"][0]["artist"] == "Lana Del Rey"


@patch("backend.app.api.tools.create_playlist")
def test_scope_creep_playlist(mock_create):
    mock_create.return_value = "https://open.spotify.com/playlist/test12345"

    res = client.post(
        "/tools/scope-creep/playlist",
        json={
            "url": "https://www.bbc.co.uk/sounds/play/m0031tc6",
            "title": "Indie Chill",
            "spotify_uris": ["spotify:track:0fBSs3fRoh1yJcne77fdu9"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["playlist_url"] == "https://open.spotify.com/playlist/test12345"
    assert "Created playlist" in data["message"]


def test_scope_creep_scrobble():
    db = TestingSession()
    req = {
        "play_id": "m0031tc6",
        "listened_at": "2026-09-26T12:00:00Z",
        "tracks": [
            {
                "segment_id": "seg_1",
                "artist": "Lana Del Rey",
                "title": "Video Games",
                "offset_seconds": 0,
                "duration_seconds": 240,
                "spotify_uri": "spotify:track:0fBSs3fRoh1yJcne77fdu9",
            },
            {
                "segment_id": "seg_2",
                "artist": "Radiohead",
                "title": "Karma Police",
                "offset_seconds": 240,
                "duration_seconds": 260,
                "spotify_uri": "spotify:track:12345",
            },
        ],
    }

    res = client.post("/tools/scope-creep/scrobble", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["scrobbled_count"] == 2
    assert data["duplicate_count"] == 0

    events = db.query(ListeningEvent).filter(ListeningEvent.user_id == 1).order_by(ListeningEvent.played_at).all()
    assert len(events) == 2
    assert events[0].artist_name == "Lana Del Rey"
    assert events[0].source == "bbc_sounds"
    assert events[0].play_id == "bbc_m0031tc6_seg_1"
    assert events[1].artist_name == "Radiohead"
    assert events[1].play_id == "bbc_m0031tc6_seg_2"
    # Verify timestamp offset
    assert events[1].played_at > events[0].played_at

    # Test deduplication on re-scrobble
    res_dup = client.post("/tools/scope-creep/scrobble", json=req)
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["scrobbled_count"] == 0
    assert dup_data["duplicate_count"] == 2
    db.close()
