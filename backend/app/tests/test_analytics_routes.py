from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.app.api import analytics as analytics_module
from backend.app.config import Settings
from backend.app.db import get_db
from backend.app.main import app
from backend.app.services.analytics_service import get_monthly_summary

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
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["version"] == "0.1.8"


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
