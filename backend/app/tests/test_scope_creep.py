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
from backend.app.models import FollowedShow, ListeningEvent, User
from backend.app.services.bbc_sounds_service import _normalize_spotify_uri
from backend.app.services.spotify_playlist_service import _extract_playlist_id, get_user_playlists

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
    db.query(FollowedShow).delete()
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

def teardown_function():
    app.dependency_overrides.clear()


def test_normalize_spotify_uri():
    assert _normalize_spotify_uri(None) is None
    assert _normalize_spotify_uri("") is None
    assert _normalize_spotify_uri("spotify:track:0fBSs3fRoh1yJcne77fdu9") == "spotify:track:0fBSs3fRoh1yJcne77fdu9"
    assert (
        _normalize_spotify_uri("https://open.spotify.com/track/0fBSs3fRoh1yJcne77fdu9?si=123")
        == "spotify:track:0fBSs3fRoh1yJcne77fdu9"
    )


def test_extract_playlist_id():
    assert _extract_playlist_id("37i9dQZF1DXcBWIGoYBM5M") == "37i9dQZF1DXcBWIGoYBM5M"
    assert _extract_playlist_id("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M") == "37i9dQZF1DXcBWIGoYBM5M"
    assert (
        _extract_playlist_id("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abcdef123456")
        == "37i9dQZF1DXcBWIGoYBM5M"
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
    assert data["tracks"][0]["image_url"] == "https://example.com/art.jpg"


@patch("backend.app.api.tools.create_playlist")
def test_scope_creep_playlist(mock_create):
    mock_create.return_value = ("Indie Chill", "https://open.spotify.com/playlist/test12345", 1)

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
    assert "Created playlist 'Indie Chill' with 1 tracks." in data["message"]


@patch("backend.app.api.tools.add_tracks_to_playlist")
def test_scope_creep_playlist_existing(mock_add):
    mock_add.return_value = ("My Favs", "https://open.spotify.com/playlist/existing123", 1)

    res = client.post(
        "/tools/scope-creep/playlist",
        json={
            "mode": "existing",
            "playlist_id": "existing123",
            "spotify_uris": ["spotify:track:0fBSs3fRoh1yJcne77fdu9"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["playlist_url"] == "https://open.spotify.com/playlist/existing123"
    assert "Added 1 tracks to playlist 'My Favs'." in data["message"]

    # Test missing playlist_id returns 400
    bad_res = client.post(
        "/tools/scope-creep/playlist",
        json={
            "mode": "existing",
            "playlist_id": "",
            "spotify_uris": ["spotify:track:0fBSs3fRoh1yJcne77fdu9"],
        },
    )
    assert bad_res.status_code == 400


@patch("backend.app.api.tools.get_user_playlists")
def test_scope_creep_playlists(mock_get):
    mock_get.return_value = {
        "playlists": [{"id": "pl1", "name": "Chill Hits", "url": "https://open.spotify.com/playlist/pl1"}],
        "needs_scope": False,
    }

    res = client.get("/tools/scope-creep/playlists")
    assert res.status_code == 200
    data = res.json()
    assert len(data["playlists"]) == 1
    assert data["playlists"][0]["name"] == "Chill Hits"
    assert data["needs_scope"] is False


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
                "artwork_url": "https://example.com/art.jpg",
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
    assert events[0].artwork_url == "https://example.com/art.jpg"
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


@patch("backend.app.services.spotify_playlist_service._refresh_access_token")
@patch("backend.app.services.spotify_playlist_service.requests.get")
def test_get_user_playlists_service_403_and_pagination(mock_get, mock_refresh):
    mock_refresh.return_value = "fake-token"

    # 1. Test 403 Forbidden handling
    class Fake403Response:
        status_code = 403
        ok = False

        def raise_for_status(self):
            import requests
            raise requests.exceptions.HTTPError(response=self)

    mock_get.return_value = Fake403Response()
    db = TestingSession()
    user = User(id=1, spotify_user_id="testuser", refresh_token_cipher="cipher")

    res = get_user_playlists(db, user)
    assert res["needs_scope"] is True
    assert res["playlists"] == []

    # 2. Test pagination handling
    class FakePage1Response:
        status_code = 200
        ok = True

        def raise_for_status(self):
            pass

        def json(self):
            return {
                "items": [{"id": "pl1", "name": "Playlist 1", "external_urls": {"spotify": "https://open.spotify.com/playlist/pl1"}}],
                "next": "https://api.spotify.com/v1/me/playlists?offset=50&limit=50",
            }

    class FakePage2Response:
        status_code = 200
        ok = True

        def raise_for_status(self):
            pass

        def json(self):
            return {
                "items": [{"id": "pl2", "name": "Playlist 2", "external_urls": {"spotify": "https://open.spotify.com/playlist/pl2"}}],
                "next": None,
            }

    mock_get.side_effect = [FakePage1Response(), FakePage2Response()]
    res_paginated = get_user_playlists(db, user)
    assert res_paginated["needs_scope"] is False
    assert len(res_paginated["playlists"]) == 2
    assert res_paginated["playlists"][0]["id"] == "pl1"
    assert res_paginated["playlists"][1]["id"] == "pl2"
    db.close()


@patch("backend.app.api.tools.resolve_brand_info")
@patch("backend.app.api.tools.fetch_brand_episodes")
@patch("backend.app.api.tools.search_bbc_shows")
def test_followed_shows_endpoints(mock_search, mock_episodes, mock_resolve):
    mock_resolve.return_value = {
        "brand_id": "b01fm4ss",
        "title": "Gilles Peterson",
        "synopsis": "Joining the musical dots",
        "image_url": "https://example.com/gilles.jpg",
    }
    mock_episodes.return_value = [
        {
            "play_id": "m0031w3y",
            "title": "Gilles Peterson: In session",
            "synopsis": "Fiery session with Knats",
            "release_date": "26 Sep 2026",
            "availability": "Available for 29 days",
            "duration": "180 mins",
            "image_url": "https://example.com/gilles.jpg",
            "url": "https://www.bbc.co.uk/sounds/play/m0031w3y",
        }
    ]
    mock_search.return_value = [
        {
            "brand_id": "b01fm4ss",
            "title": "Gilles Peterson",
            "synopsis": "Joining the musical dots",
            "image_url": "https://example.com/gilles.jpg",
        }
    ]

    # 1. Search shows
    search_res = client.get("/tools/scope-creep/search-shows?q=gilles")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data["results"]) == 1
    assert search_data["results"][0]["is_followed"] is False

    # 2. Follow show
    follow_res = client.post("/tools/scope-creep/followed-shows", json={"url_or_id": "https://www.bbc.co.uk/sounds/brand/b01fm4ss"})
    assert follow_res.status_code == 200
    follow_data = follow_res.json()
    assert follow_data["brand_id"] == "b01fm4ss"
    assert follow_data["title"] == "Gilles Peterson"

    # Search again and verify is_followed is True
    search_res2 = client.get("/tools/scope-creep/search-shows?q=gilles")
    assert search_res2.status_code == 200
    assert search_res2.json()["results"][0]["is_followed"] is True

    # 3. List followed shows
    list_res = client.get("/tools/scope-creep/followed-shows")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data["shows"]) == 1
    assert list_data["shows"][0]["brand_id"] == "b01fm4ss"

    # 4. Fetch episodes for followed show
    ep_res = client.get("/tools/scope-creep/followed-shows/b01fm4ss/episodes")
    assert ep_res.status_code == 200
    ep_data = ep_res.json()
    assert ep_data["brand_id"] == "b01fm4ss"
    assert len(ep_data["episodes"]) == 1
    assert ep_data["episodes"][0]["play_id"] == "m0031w3y"

    # 5. Unfollow show
    del_res = client.delete("/tools/scope-creep/followed-shows/b01fm4ss")
    assert del_res.status_code == 200
    assert del_res.json()["brand_id"] == "b01fm4ss"

    # List again and verify empty
    list_res2 = client.get("/tools/scope-creep/followed-shows")
    assert list_res2.status_code == 200
    assert len(list_res2.json()["shows"]) == 0


@patch("backend.app.api.tools.fetch_bbc_playlist")
def test_scope_creep_fetch_brand_info(mock_fetch):
    mock_fetch.return_value = {
        "title": "Indie Chill - 23 Sep 2026",
        "tracks": [],
        "spotify_uris": [],
        "brand_info": {
            "brand_id": "m002zttt",
            "title": "Indie Chill",
            "synopsis": "Chill indie music",
            "image_url": "https://example.com/indie.jpg",
        },
    }

    res = client.post("/tools/scope-creep/fetch", json={"url": "https://www.bbc.co.uk/sounds/play/m0031tc6"})
    assert res.status_code == 200
    data = res.json()
    assert data["brand_info"] is not None
    assert data["brand_info"]["brand_id"] == "m002zttt"
    assert data["brand_info"]["is_followed"] is False

    # Add to followed shows in DB
    db = TestingSession()
    db.add(FollowedShow(user_id=1, brand_id="m002zttt", title="Indie Chill"))
    db.commit()
    db.close()

    res2 = client.post("/tools/scope-creep/fetch", json={"url": "https://www.bbc.co.uk/sounds/play/m0031tc6"})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["brand_info"]["is_followed"] is True

