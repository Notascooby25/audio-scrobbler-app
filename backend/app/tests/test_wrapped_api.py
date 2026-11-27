from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.config import settings
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent, User, YearReview
from backend.app.services import wrapped_service

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False)
Base.metadata.create_all(engine)
client = TestClient(app)


def _override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _setup():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    db = TestingSession()
    for user_id in (1, 2):
        db.add(
            User(
                id=user_id,
                spotify_user_id=f"s{user_id}",
                username=f"u{user_id}",
                display_name=f"U{user_id}",
                refresh_token_cipher="x",
                is_active=True,
            )
        )
    db.commit()
    db.close()
    yield
    app.dependency_overrides.clear()


def _row(user_id=1, year=2026, stage="unlock", is_sample=False, seen=False, dismissed=False, changed=None):
    db = TestingSession()
    now = datetime(2026, 12, 31, 18, 0)
    db.add(
        YearReview(
            user_id=user_id,
            year=year,
            stage=stage,
            format_version=1,
            data={
                "year": year,
                "date_from": f"{year}-01-01",
                "date_to": f"{year}-12-31",
                "music": {"top_artists": [{"name": "Artist A", "plays": 9, "artwork_url": "https://img/a.jpg"}]},
                "gigs": None,
                "changed": changed or [],
            },
            is_sample=is_sample,
            window_start=now,
            window_end=now,
            generated_at=now,
            seen_at=now if seen else None,
            dismissed_at=now if dismissed else None,
        )
    )
    db.commit()
    db.close()


def _early(*ids):
    return patch.object(wrapped_service, "early_access_ids", lambda: list(ids))


def test_cannot_read_another_users_year():
    _row(user_id=2)
    assert client.get("/wrapped/2026").status_code == 404
    assert client.post("/wrapped/2026/seen").status_code == 404


def test_own_year_is_readable_and_shaped():
    _row()
    body = client.get("/wrapped/2026").json()
    assert body["stage"] == "unlock"
    assert body["data"]["music"]["top_artists"][0]["name"] == "Artist A"


def test_preview_hidden_without_early_access():
    _row(stage="preview")
    assert client.get("/wrapped/2026").status_code == 404
    assert client.get("/wrapped").json()["years"] == []


def test_sample_hidden_without_early_access():
    _row(year=2025, stage="final", is_sample=True)
    assert client.get("/wrapped/2025").status_code == 404
    assert client.get("/wrapped").json()["years"] == []


def test_early_access_user_sees_preview_and_sample_but_no_banner():
    _row(stage="preview")
    _row(year=2025, stage="final", is_sample=True)
    with _early(1):
        assert client.get("/wrapped/2026").status_code == 200
        assert client.get("/wrapped/2025").status_code == 200
        body = client.get("/wrapped").json()
    assert [entry["year"] for entry in body["years"]] == [2026, 2025]
    assert body["banner"] is None


def test_newest_stage_is_served_and_marked_updated():
    _row(stage="unlock")
    _row(stage="final", changed=["music.total_plays"])
    body = client.get("/wrapped/2026").json()
    assert body["stage"] == "final"
    assert body["updated"] is True


def test_list_entry_has_card_details():
    _row()
    entry = client.get("/wrapped").json()["years"][0]
    assert entry["status"] == "ready"
    assert entry["top_artist"] == "Artist A"
    assert entry["date_to"] == "2026-12-31"


def test_banner_shows_then_clears_after_seen():
    _row()
    assert client.get("/wrapped").json()["banner"] == {"year": 2026}
    assert client.post("/wrapped/2026/seen").status_code == 204
    assert client.get("/wrapped").json()["banner"] is None


def test_banner_clears_after_dismiss():
    _row()
    assert client.post("/wrapped/2026/dismiss").status_code == 204
    assert client.get("/wrapped").json()["banner"] is None


def test_final_replacing_unlock_does_not_bring_banner_back():
    _row(stage="unlock", seen=True)
    _row(stage="final")
    assert client.get("/wrapped").json()["banner"] is None


def test_owner_opening_a_preview_does_not_clear_the_real_banner():
    _row(stage="preview")
    with _early(1):
        client.post("/wrapped/2026/seen")
    _row(stage="unlock")
    assert client.get("/wrapped").json()["banner"] == {"year": 2026}


def test_locked_entry_before_unlock_for_eligible_user():
    db = TestingSession()
    for i in range(35):
        db.add(
            ListeningEvent(
                user_id=1,
                track_id=f"t{i}",
                track_name="S",
                artist_name="A",
                played_at=datetime(2026, 3, 1) + timedelta(minutes=i),
                source="spotify",
                play_id=f"p{i}",
            )
        )
    db.commit()
    db.close()
    with patch("backend.app.api.wrapped.utc_now", lambda: datetime(2026, 11, 28, 12, 0)):
        entry = client.get("/wrapped").json()["years"][0]
    assert entry["status"] == "locked"
    assert entry["year"] == 2026
    assert entry["unlocks_at"].startswith("2026-12-31T18:00")


def test_no_locked_entry_for_ineligible_user():
    with patch("backend.app.api.wrapped.utc_now", lambda: datetime(2026, 11, 28, 12, 0)):
        assert client.get("/wrapped").json()["years"] == []


def test_internal_route_rejects_missing_or_wrong_token():
    assert client.post("/wrapped/internal/run-due").status_code == 401
    assert client.post("/wrapped/internal/run-due", headers={"X-Worker-Token": "nope"}).status_code == 401


def test_internal_route_runs_with_token():
    response = client.post("/wrapped/internal/run-due", headers={"X-Worker-Token": settings.worker_ingestion_token})
    assert response.status_code == 200
    assert response.json() == {"generated": 0}
