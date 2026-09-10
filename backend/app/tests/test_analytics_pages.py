from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.api import analytics as analytics_module
from backend.app.db import get_db
from backend.app.main import app
from backend.app.schemas.analytics import ChartResponse, LibraryResponse, LibraryScrobbleResponse, StatsResponse


client = TestClient(app)


class DemoUser:
    id = 1


class UnusedDB:
    pass


def setup_function():
    app.dependency_overrides[get_db] = lambda: UnusedDB()
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()


def teardown_function():
    app.dependency_overrides.clear()


def test_stats_routes_use_expected_paths(monkeypatch):
    monkeypatch.setattr(analytics_module, "get_stats_summary", lambda db, user_id: StatsResponse(
        user_id=user_id, total_scrobbles=4, unique_artists=2, loved_tracks=0
    ))
    monkeypatch.setattr(analytics_module, "get_user_charts", lambda db, user_id, entity, range_key, limit: ChartResponse(
        user_id=user_id, entity=entity, range=range_key, entries=[]
    ))

    assert client.get("/stats/summary").status_code == 200
    assert client.get("/stats/top-artists").json()["entity"] == "artists"
    assert client.get("/stats/top-albums").json()["entity"] == "albums"
    assert client.get("/stats/top-tracks").json()["entity"] == "tracks"


def test_library_scrobbles_route_uses_expected_path(monkeypatch):
    monkeypatch.setattr(analytics_module, "get_library_scrobbles", lambda db, user_id, limit, offset: LibraryScrobbleResponse(
        user_id=user_id, scrobbles=[], limit=limit, offset=offset, total_count=0
    ))

    response = client.get("/library/scrobbles?limit=10&offset=20")

    assert response.status_code == 200
    assert response.json()["limit"] == 10
    assert response.json()["offset"] == 20


def test_library_entity_route_uses_expected_path(monkeypatch):
    monkeypatch.setattr(analytics_module, "get_library_entities", lambda db, user_id, entity, limit, offset: LibraryResponse(
        user_id=user_id, entries=[], limit=limit, offset=offset, total_count=0
    ))

    response = client.get("/library/artists")

    assert response.status_code == 200
    assert response.json()["entries"] == []