from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import LikedTrack, SavedAlbum, User

client = TestClient(app)


class FakeQuery:
    def __init__(self, items=None):
        self.items = items or []

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.items[0] if self.items else None

    def all(self):
        return self.items

    def delete(self):
        count = len(self.items)
        self.items.clear()
        return count


class FakeDB:
    def __init__(self, user=None, liked_tracks=None, saved_albums=None):
        self.user = user
        self.liked_tracks = liked_tracks or []
        self.saved_albums = saved_albums or []
        self.added = []
        self.committed = False

    def query(self, *models):
        if not models:
            return FakeQuery([])
        first_model = models[0]
        if first_model is User:
            return FakeQuery([self.user] if self.user else [])
        if first_model is LikedTrack:
            return FakeQuery(self.liked_tracks)
        if first_model is SavedAlbum:
            return FakeQuery(self.saved_albums)
        return FakeQuery([])

    def add(self, item):
        self.added.append(item)
        if isinstance(item, LikedTrack):
            self.liked_tracks.append(item)
        elif isinstance(item, SavedAlbum):
            self.saved_albums.append(item)

    def commit(self):
        self.committed = True

    def flush(self):
        pass


@pytest.fixture
def mock_user():
    return User(
        id=1,
        spotify_user_id="spotify-user-1",
        username="testuser",
        display_name="Test User",
        refresh_token_cipher="mock-cipher",
        is_active=True,
    )


def test_like_track_success(mock_user):
    fake_db = FakeDB(user=mock_user)
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: fake_db

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.status_code = 200

    with (
        patch("backend.app.services.spotify_library_service._refresh_access_token", return_value="access-token"),
        patch("requests.request", return_value=mock_resp) as mock_req,
    ):
        res = client.put(
            "/spotify/like-track/track123",
            json={"track_name": "Song A", "artist_name": "Artist B", "album_name": "Album C"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["is_liked"] is True
        assert len(fake_db.liked_tracks) == 1
        assert fake_db.liked_tracks[0].spotify_track_id == "track123"
        assert fake_db.liked_tracks[0].track_name == "Song A"
        assert mock_req.call_args[0][0] == "PUT"

    app.dependency_overrides.clear()


def test_unlike_track_success(mock_user):
    existing = LikedTrack(
        id=1, user_id=mock_user.id, spotify_track_id="track123", track_name="Song A", artist_name="Artist B"
    )
    fake_db = FakeDB(user=mock_user, liked_tracks=[existing])
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: fake_db

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.status_code = 200

    with (
        patch("backend.app.services.spotify_library_service._refresh_access_token", return_value="access-token"),
        patch("requests.request", return_value=mock_resp) as mock_req,
    ):
        res = client.delete("/spotify/like-track/track123")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["is_liked"] is False
        assert mock_req.call_args[0][0] == "DELETE"

    app.dependency_overrides.clear()


def test_like_track_missing_scope(mock_user):
    fake_db = FakeDB(user=mock_user)
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: fake_db

    mock_resp = MagicMock()
    mock_resp.ok = False
    mock_resp.status_code = 403
    mock_resp.json.return_value = {"error": {"message": "Insufficient client scope"}}

    with (
        patch("backend.app.services.spotify_library_service._refresh_access_token", return_value="access-token"),
        patch("requests.request", return_value=mock_resp),
    ):
        res = client.put(
            "/spotify/like-track/track123",
            json={"track_name": "Song A", "artist_name": "Artist B"},
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "needs_spotify_reconnect"

    app.dependency_overrides.clear()


def test_like_album_success(mock_user):
    fake_db = FakeDB(user=mock_user)
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: fake_db

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.status_code = 200

    with (
        patch("backend.app.services.spotify_library_service._refresh_access_token", return_value="access-token"),
        patch("requests.request", return_value=mock_resp) as mock_req,
    ):
        res = client.put(
            "/spotify/like-album/album123",
            json={"album_name": "Album C", "artist_name": "Artist B"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["is_liked"] is True
        assert data["spotify_album_id"] == "album123"
        assert len(fake_db.saved_albums) == 1
        assert fake_db.saved_albums[0].spotify_album_id == "album123"
        assert mock_req.call_args[0][0] == "PUT"

    app.dependency_overrides.clear()


def test_like_album_search_fallback(mock_user):
    fake_db = FakeDB(user=mock_user)
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: fake_db

    mock_search = MagicMock()
    mock_search.ok = True
    mock_search.json.return_value = {
        "albums": {"items": [{"id": "resolved-album-456", "images": [{"url": "http://art.jpg"}]}]}
    }

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.status_code = 200

    with (
        patch("backend.app.services.spotify_library_service._refresh_access_token", return_value="access-token"),
        patch("requests.get", return_value=mock_search),
        patch("requests.request", return_value=mock_resp),
    ):
        res = client.put(
            "/spotify/like-album/In%20Rainbows",
            json={"album_name": "In Rainbows", "artist_name": "Radiohead"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["is_liked"] is True
        assert data["spotify_album_id"] == "resolved-album-456"
        assert len(fake_db.saved_albums) == 1
        assert fake_db.saved_albums[0].spotify_album_id == "resolved-album-456"

    app.dependency_overrides.clear()


def test_unlike_album_success(mock_user):
    existing = SavedAlbum(
        id=1, user_id=mock_user.id, spotify_album_id="album123", album_name="Album C", artist_name="Artist B"
    )
    fake_db = FakeDB(user=mock_user, saved_albums=[existing])
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: fake_db

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.status_code = 200

    with (
        patch("backend.app.services.spotify_library_service._refresh_access_token", return_value="access-token"),
        patch("requests.request", return_value=mock_resp) as mock_req,
    ):
        res = client.delete("/spotify/like-album/album123")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["is_liked"] is False
        assert mock_req.call_args[0][0] == "DELETE"

    app.dependency_overrides.clear()
