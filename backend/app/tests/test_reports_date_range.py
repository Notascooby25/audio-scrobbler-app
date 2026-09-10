from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import analytics as analytics_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import ListeningEvent, User
from backend.app.queries.analytics_queries import resolve_date_range

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class DemoUser:
    id = 1


def _seed(db):
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()
    db.add(User(id=1, spotify_user_id="demo", username="demo", display_name="Demo", refresh_token_cipher="c", is_active=True))
    db.commit()

    now = datetime.utcnow()
    offsets_days = [1, 1, 1, 10, 10, 100, 400]
    for index, days_ago in enumerate(offsets_days):
        db.add(
            ListeningEvent(
                user_id=1,
                track_id=f"track-{index}",
                track_name=f"Track {index}",
                artist_name="The National",
                album_name="Trouble Will Find Me",
                played_at=now - timedelta(days=days_ago),
                source="spotify",
                play_id=f"track-{index}",
            )
        )
    db.commit()


@pytest.fixture(autouse=True)
def override_dependencies():
    db = TestingSession()
    _seed(db)
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    yield
    app.dependency_overrides.clear()
    db.close()


# --- resolve_date_range (pure unit tests) ---

def test_resolve_date_range_last_week():
    now = datetime(2026, 6, 15)
    start, end, previous_start, previous_end, granularity = resolve_date_range("last.week", now=now)
    assert (end - start) == timedelta(days=7)
    assert end == now
    assert previous_end == start
    assert (start - previous_start) == timedelta(days=7)
    assert granularity == "day"


def test_resolve_date_range_last_year_uses_month_granularity():
    _start, _end, _previous_start, _previous_end, granularity = resolve_date_range("last.year", now=datetime(2026, 6, 15))
    assert granularity == "month"


def test_resolve_date_range_custom_short_span_uses_day_granularity():
    start, end, previous_start, previous_end, granularity = resolve_date_range("custom", "2026-01-01", "2026-01-10")
    assert start == datetime(2026, 1, 1)
    assert end == datetime(2026, 1, 10)
    assert previous_end == start
    assert previous_start == start - (end - start)
    assert granularity == "day"


def test_resolve_date_range_custom_long_span_uses_month_granularity():
    _start, _end, _previous_start, _previous_end, granularity = resolve_date_range("custom", "2025-01-01", "2026-01-01")
    assert granularity == "month"


def test_resolve_date_range_custom_requires_dates():
    with pytest.raises(ValueError, match="required for a custom range"):
        resolve_date_range("custom", None, None)


def test_resolve_date_range_custom_rejects_reversed_dates():
    with pytest.raises(ValueError, match="earlier than or equal to"):
        resolve_date_range("custom", "2026-02-01", "2026-01-01")


def test_resolve_date_range_rejects_unsupported_range():
    with pytest.raises(ValueError, match="Unsupported date range"):
        resolve_date_range("last.decade")


# --- /reports/summary ---

def test_reports_summary_defaults_to_last_month():
    response = client.get("/reports/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["range"] == "last.month"
    assert payload["period_scrobbles"] == 5
    assert payload["total_scrobbles"] == 7


def test_reports_summary_last_month_includes_broader_window():
    response = client.get("/reports/summary?range=last.month")
    assert response.status_code == 200
    assert response.json()["period_scrobbles"] == 5


def test_reports_summary_custom_range_filters_explicitly():
    now = datetime.utcnow()
    start_date = (now - timedelta(days=150)).date().isoformat()
    end_date = now.date().isoformat()
    response = client.get(f"/reports/summary?range=custom&start_date={start_date}&end_date={end_date}")
    assert response.status_code == 200
    assert response.json()["period_scrobbles"] == 6


def test_reports_summary_compare_to_previous_false_skips_comparison():
    response = client.get("/reports/summary?compare_to_previous=false")
    assert response.status_code == 200
    payload = response.json()
    assert payload["previous_period_scrobbles"] == 0
    assert payload["comparison_percent"] == 0.0


def test_reports_summary_rejects_unsupported_range():
    response = client.get("/reports/summary?range=last.decade")
    assert response.status_code == 400


def test_reports_summary_custom_requires_start_and_end():
    response = client.get("/reports/summary?range=custom")
    assert response.status_code == 400


# --- /reports/{entity} ---

def test_reports_entity_filters_by_range():
    response = client.get("/reports/artists?range=last.week")
    assert response.status_code == 200
    assert response.json()["entries"][0]["play_count"] == 3


def test_reports_entity_rejects_unsupported_range():
    response = client.get("/reports/artists?range=never")
    assert response.status_code == 400


def test_reports_entity_rejects_unknown_entity():
    response = client.get("/reports/playlists")
    assert response.status_code == 404


# --- /stats/top-artists optional range ---

def test_top_artists_defaults_to_all_time():
    response = client.get("/stats/top-artists")
    assert response.status_code == 200
    assert response.json()["entries"][0]["play_count"] == 7


def test_top_artists_range_filters_results():
    response = client.get("/stats/top-artists?range=last.week")
    assert response.status_code == 200
    assert response.json()["entries"][0]["play_count"] == 3


def test_top_artists_rejects_unsupported_range():
    response = client.get("/stats/top-artists?range=never")
    assert response.status_code == 400


# --- /library/artists optional range ---

def test_library_entities_defaults_to_all_time():
    response = client.get("/library/artists")
    assert response.status_code == 200
    assert response.json()["entries"][0]["play_count"] == 7
    assert response.json()["total_count"] == 1


def test_library_entities_range_filters_results():
    response = client.get("/library/artists?range=last.month")
    assert response.status_code == 200
    assert response.json()["entries"][0]["play_count"] == 5


def test_library_scrobbles_range_filters_results():
    response = client.get("/library/scrobbles?range=last.week")
    assert response.status_code == 200
    assert response.json()["total_count"] == 3


# --- /reports/charts (uses Postgres-only date_trunc/to_char; use a FakeDB like other route tests) ---

class FakeReportRow:
    def __init__(self, label, count):
        self.label = label
        self.count = count


class FakeChartsDB:
    def execute(self, statement):
        class Result:
            def all(self):
                return [FakeReportRow("5", 3)]

        return Result()


def test_reports_charts_returns_data_for_default_range():
    app.dependency_overrides[analytics_module.get_db] = lambda: FakeChartsDB()
    response = client.get("/reports/charts")
    assert response.status_code == 200
    payload = response.json()
    assert payload["range"] == "last.month"
    assert payload["weekly_scrobbles"][0]["count"] == 3


def test_reports_charts_rejects_unsupported_range():
    app.dependency_overrides[analytics_module.get_db] = lambda: FakeChartsDB()
    response = client.get("/reports/charts?range=never")
    assert response.status_code == 400


def test_reports_charts_custom_requires_dates():
    app.dependency_overrides[analytics_module.get_db] = lambda: FakeChartsDB()
    response = client.get("/reports/charts?range=custom")
    assert response.status_code == 400
