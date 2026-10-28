from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import FollowedYouTubeChannel, ListeningEvent, User

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


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: DemoUser()
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.query(FollowedYouTubeChannel).delete()
    db.query(User).delete()
    db.add(
        User(
            id=1,
            spotify_user_id="testuser",
            username="testuser",
            display_name="Test User",
            refresh_token_cipher="cipher",
            is_active=True,
        )
    )
    db.commit()
    db.close()


def teardown_function():
    app.dependency_overrides.clear()


def test_followed_channels_lifecycle():
    # 1. List initially empty
    resp = client.get("/tools/youtube/followed-channels")
    assert resp.status_code == 200
    assert resp.json()["channels"] == []

    # 2. Follow channel with mock
    mock_info = {
        "channel_id": "UC4eYXhJI4-7wSWc8UNUu4HA",
        "channel_handle": "@nprmusic",
        "title": "NPR Music",
        "image_url": "https://example.com/avatar.jpg",
    }
    with patch("backend.app.api.tools.resolve_channel_info", return_value=mock_info):
        resp = client.post("/tools/youtube/followed-channels", json={"url_or_handle": "@nprmusic"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["channel_id"] == "UC4eYXhJI4-7wSWc8UNUu4HA"
        assert data["title"] == "NPR Music"

    # 3. List contains 1 channel
    resp = client.get("/tools/youtube/followed-channels")
    assert resp.status_code == 200
    assert len(resp.json()["channels"]) == 1

    # 4. Unfollow channel
    resp = client.delete("/tools/youtube/followed-channels/UC4eYXhJI4-7wSWc8UNUu4HA")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # 5. List is empty again
    resp = client.get("/tools/youtube/followed-channels")
    assert resp.status_code == 200
    assert resp.json()["channels"] == []


def test_get_channel_recent_videos_route():
    mock_videos = [
        {
            "video_id": "y38qQRg3UDI",
            "title": "Dua Lipa: Tiny Desk Concert",
            "published_at": "2024-10-25T16:00:00Z",
            "thumbnail_url": "https://i.ytimg.com/vi/y38qQRg3UDI/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=y38qQRg3UDI",
        }
    ]
    with patch("backend.app.api.tools.get_channel_recent_videos", return_value=mock_videos):
        resp = client.get("/tools/youtube/followed-channels/UC4eYXhJI4-7wSWc8UNUu4HA/videos")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["videos"]) == 1
        assert data["videos"][0]["video_id"] == "y38qQRg3UDI"


def test_youtube_search_route():
    mock_results = [
        {
            "video_id": "y38qQRg3UDI",
            "title": "Dua Lipa: Tiny Desk Concert",
            "channel_title": "NPR Music",
            "duration": "18:26",
            "thumbnail_url": "https://i.ytimg.com/vi/y38qQRg3UDI/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=y38qQRg3UDI",
        }
    ]
    with patch("backend.app.api.tools.search_youtube_videos", return_value=mock_results):
        resp = client.get("/tools/youtube/search?q=Dua+Lipa&channel=NPR+Music")
        assert resp.status_code == 200
        assert len(resp.json()["results"]) == 1
        assert resp.json()["results"][0]["video_id"] == "y38qQRg3UDI"


def test_youtube_fetch_and_scrobble():
    mock_details = {
        "video_id": "y38qQRg3UDI",
        "title": "Dua Lipa: Tiny Desk Concert",
        "author": "NPR Music",
        "artist": "Dua Lipa",
        "duration_seconds": 1100,
        "thumbnail_url": "https://i.ytimg.com/vi/y38qQRg3UDI/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=y38qQRg3UDI",
        "tracks": [
            {
                "segment_id": "seg_0",
                "artist": "Dua Lipa",
                "title": "Training Season",
                "offset_seconds": 0,
                "duration_seconds": 240,
                "spotify_uri": None,
                "image_url": None,
            },
            {
                "segment_id": "seg_1",
                "artist": "Dua Lipa",
                "title": "These Walls",
                "offset_seconds": 240,
                "duration_seconds": 240,
                "spotify_uri": None,
                "image_url": None,
            },
        ],
    }
    with patch("backend.app.api.tools.fetch_youtube_video_details", return_value=mock_details):
        resp = client.post("/tools/youtube/fetch", json={"url": "https://www.youtube.com/watch?v=y38qQRg3UDI"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "y38qQRg3UDI"
        assert len(data["tracks"]) == 2

    # Now scrobble tracks
    scrobble_payload = {
        "video_id": "y38qQRg3UDI",
        "listened_at": datetime.now(timezone.utc).isoformat(),
        "tracks": [
            {
                "segment_id": "seg_0",
                "artist": "Dua Lipa",
                "title": "Training Season",
                "offset_seconds": 0,
                "duration_seconds": 240,
                "spotify_uri": None,
                "artwork_url": "https://example.com/art.jpg",
            },
            {
                "segment_id": "seg_1",
                "artist": "Dua Lipa",
                "title": "These Walls",
                "offset_seconds": 240,
                "duration_seconds": 240,
                "spotify_uri": None,
                "artwork_url": "https://example.com/art.jpg",
            },
        ],
    }
    resp = client.post("/tools/youtube/scrobble", json=scrobble_payload)
    assert resp.status_code == 200
    assert resp.json()["scrobbled_count"] == 2

    # Verify rows in database
    db = TestingSession()
    events = db.query(ListeningEvent).filter_by(source="youtube").all()
    assert len(events) == 2
    assert events[0].artist_name == "Dua Lipa"
    assert events[0].track_name == "Training Season"
    assert events[0].artwork_url == "https://example.com/art.jpg"
    assert "yt_y38qQRg3UDI_seg_0" in events[0].play_id
    db.close()
