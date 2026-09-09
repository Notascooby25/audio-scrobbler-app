from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.app.api import analytics as analytics_module
from backend.app.config import Settings
from backend.app.db import get_db
from backend.app.main import app
from backend.app import main as main_module
from backend.app.services.analytics_service import get_monthly_summary, get_recent_scrobbles

client = TestClient(app)


class FakeRow:
    month = "2026-01"
    total_plays = 12
    unique_tracks = 4


class FakeDB:
    def execute(self, statement):
        class Result:
            def all(self):
                return [FakeRow()]

        return Result()


class DemoUser:
    id = 1
    spotify_user_id = "demo-user"


def test_monthly_summary_requires_authentication():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    response = client.get("/analytics/monthly-summary")
    assert response.status_code == 401
    app.dependency_overrides.clear()


def test_health_reports_current_application_version():
    response = client.get("/health", headers={"X-Request-ID": "test-request-id"})
    assert response.status_code == 200
    assert response.json()["version"] == "0.2.4"
    assert response.headers["X-Request-ID"] == "test-request-id"
    assert "ingestion_events" in response.json()


def test_metrics_exposes_prometheus_counters_without_sensitive_data():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "audio_scrobbler_ingestion_events_total" in response.text
    assert "spotify" not in response.text.lower()


def test_readiness_reports_ready(monkeypatch):
    monkeypatch.setattr(main_module, "check_backend_readiness", lambda engine: (True, "ready"))
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_readiness_reports_database_failure(monkeypatch):
    monkeypatch.setattr(main_module, "check_backend_readiness", lambda engine: (False, "database is unavailable"))
    response = client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"


def test_production_settings_reject_placeholder_secrets():
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(environment="production").validate()


def test_monthly_summary_accepts_authenticated_user():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    response = client.get(
        "/analytics/monthly-summary",
        headers={"Authorization": "Bearer demo-user"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == 1
    assert payload["total_months"] == 1
    assert payload["summary"][0]["month"] == "2026-01"
    app.dependency_overrides.clear()


def test_monthly_summary_rejects_invalid_month_range():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    response = client.get(
        "/analytics/monthly-summary?from_month=2026-13&to_month=2026-01",
        headers={"Authorization": "Bearer demo-user"},
    )
    assert response.status_code == 400
    app.dependency_overrides.clear()


def test_monthly_summary_rejects_reversed_range():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    response = client.get(
        "/analytics/monthly-summary?from_month=2026-03&to_month=2026-01",
        headers={"Authorization": "Bearer demo-user"},
    )
    assert response.status_code == 400
    app.dependency_overrides.clear()


def test_service_get_monthly_summary_builds_monthly_rows():
    class Result:
        def all(self):
            return [
                SimpleNamespace(month="2026-01", total_plays=12, unique_tracks=5, total_duration_ms=3600000),
                SimpleNamespace(month="2026-02", total_plays=7, unique_tracks=3, total_duration_ms=0),
            ]

    class FakeDBFactory:
        def execute(self, stmt):
            return Result()

    result = get_monthly_summary(FakeDBFactory(), 1, "2026-01", "2026-02")
    assert result.user_id == 1
    assert result.total_months == 2
    assert result.summary[0].month == "2026-01"
    assert result.summary[0].total_plays == 12
    assert result.summary[0].total_listening_minutes == 60
    assert result.summary[1].total_listening_minutes == 0


def test_recent_scrobbles_requires_authentication():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    response = client.get("/analytics/recent-scrobbles")
    assert response.status_code == 401
    app.dependency_overrides.clear()


def test_recent_scrobbles_returns_source_per_entry():
    class ScrobbleRow:
        def __init__(self, id_, track_name, artist_name, source, played_at):
            self.id = id_
            self.track_name = track_name
            self.artist_name = artist_name
            self.source = source
            self.played_at = played_at

    class ScrobbleDB:
        def execute(self, statement):
            class Result:
                def all(self):
                    return [
                        ScrobbleRow(2, "Midnight City", "M83", "youtube", datetime(2026, 1, 15, 12, 31)),
                        ScrobbleRow(1, "Daylight", "Matt Berninger", "spotify", datetime(2026, 1, 15, 12, 30)),
                    ]

            return Result()

    app.dependency_overrides[get_db] = lambda: ScrobbleDB()
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    response = client.get(
        "/analytics/recent-scrobbles",
        headers={"Authorization": "Bearer demo-user"},
    )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == 1
    assert [entry["source"] for entry in payload["scrobbles"]] == ["youtube", "spotify"]


def test_recent_scrobbles_supports_pagination_params():
    captured = {}

    class ScrobbleDB:
        def execute(self, statement):
            captured["compiled"] = str(statement.compile(compile_kwargs={"literal_binds": True}))

            class Result:
                def all(self):
                    return []

            return Result()

    app.dependency_overrides[get_db] = lambda: ScrobbleDB()
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    response = client.get(
        "/analytics/recent-scrobbles?limit=5&offset=10",
        headers={"Authorization": "Bearer demo-user"},
    )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"user_id": 1, "scrobbles": [], "limit": 5, "offset": 10}
    assert "LIMIT 5" in captured["compiled"]
    assert "OFFSET 10" in captured["compiled"]


def test_service_get_recent_scrobbles_builds_scrobble_list():
    class Result:
        def all(self):
            return [
                SimpleNamespace(id=1, track_name="Daylight", artist_name="Matt Berninger", source="spotify", played_at=datetime(2026, 1, 15, 12, 30)),
            ]

    class FakeDBFactory:
        def execute(self, stmt):
            return Result()

    result = get_recent_scrobbles(FakeDBFactory(), 1, limit=10, offset=0)
    assert result.user_id == 1
    assert result.limit == 10
    assert result.offset == 0
    assert result.scrobbles[0].source == "spotify"
