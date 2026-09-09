from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.api import analytics as analytics_module
from backend.app.db import get_db
from backend.app.main import app
from backend.app.services.analytics_service import get_monthly_summary

client = TestClient(app)


class FakeRow:
    month = "2026-01"
    total_plays = 12
    unique_tracks = 4


class FakeQuery:
    def filter(self, *args, **kwargs):
        return self

    def group_by(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return [FakeRow()]


class FakeDB:
    def query(self, *args, **kwargs):
        return FakeQuery()


class DemoUser:
    id = 1
    spotify_user_id = "demo-user"


def test_monthly_summary_requires_authentication():
    app.dependency_overrides[get_db] = lambda: FakeDB()
    response = client.get("/analytics/monthly-summary")
    assert response.status_code == 401
    app.dependency_overrides.clear()


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


@pytest.mark.asyncio
async def test_service_get_monthly_summary_builds_monthly_rows():
    class Result:
        def all(self):
            return [
                SimpleNamespace(month="2026-01", total_plays=12, unique_tracks=5, total_duration_ms=600000),
                SimpleNamespace(month="2026-02", total_plays=7, unique_tracks=3, total_duration_ms=300000),
            ]

    class FakeDBFactory:
        async def execute(self, stmt):
            return Result()

    user_id = uuid4()
    result = await get_monthly_summary(FakeDBFactory(), user_id, "2026-01", "2026-02")
    assert result.user_id == user_id
    assert result.total_months == 2
    assert result.summary[0].month == "2026-01"
    assert result.summary[0].total_plays == 12
