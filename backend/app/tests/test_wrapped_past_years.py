"""Past years (before the live 2026 release) are built for everyone as quiet "archive" snapshots."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import ListeningEvent, Notification, User, YearReview
from backend.app.services import wrapped_service
from backend.app.services.wrapped_service import run_due

NOW = datetime(2026, 11, 28, 12, 0)  # well before the 2026 stages are due


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


def _user(db, user_id, active=True):
    db.add(
        User(
            id=user_id,
            spotify_user_id=f"s{user_id}",
            username=f"u{user_id}",
            display_name=f"U{user_id}",
            refresh_token_cipher="x",
            is_active=active,
        )
    )
    db.commit()


def _plays(db, user_id, year, count=40):
    for i in range(count):
        db.add(
            ListeningEvent(
                user_id=user_id,
                track_id=f"t{i}",
                track_name=f"Song {i % 5}",
                artist_name="Artist",
                album_name="Album",
                played_at=datetime(year, 3, 1, 12, 0) + timedelta(minutes=5 * i),
                duration_ms=180_000,
                source="spotify",
                play_id=uuid.uuid4().hex,
            )
        )
    db.commit()


def _from(year):
    return patch.object(wrapped_service, "backfill_from_year", lambda: year)


def test_builds_an_archive_snapshot_for_each_past_year_with_data(db_session):
    _user(db_session, 1)
    _plays(db_session, 1, 2021)
    _plays(db_session, 1, 2024)
    with _from(2020):
        counts = run_due(db_session, NOW)
    rows = db_session.query(YearReview).order_by(YearReview.year).all()
    assert [(r.year, r.stage, r.is_sample) for r in rows] == [(2021, "archive", False), (2024, "archive", False)]
    assert counts["archived"] == 2
    assert rows[0].data["date_to"] == "2021-12-31"  # the whole year


def test_only_from_the_chosen_year_and_never_the_live_year(db_session):
    _user(db_session, 1)
    for year in (2019, 2020, 2025, 2026):
        _plays(db_session, 1, year)
    with _from(2020), patch.object(wrapped_service, "queue_push"):
        run_due(db_session, NOW)
    assert sorted(r.year for r in db_session.query(YearReview)) == [2020, 2025]


def test_everyone_gets_theirs_but_nobody_is_notified(db_session):
    for user_id in (1, 2):
        _user(db_session, user_id)
        _plays(db_session, user_id, 2025)
    with _from(2020), patch.object(wrapped_service, "queue_push") as push:
        run_due(db_session, NOW)
    assert {r.user_id for r in db_session.query(YearReview)} == {1, 2}
    assert db_session.query(Notification).count() == 0
    assert push.call_count == 0


def test_inactive_and_ineligible_people_get_nothing(db_session):
    _user(db_session, 1, active=False)
    _plays(db_session, 1, 2025)
    _user(db_session, 2)
    _plays(db_session, 2, 2025, count=10)
    with _from(2020):
        run_due(db_session, NOW)
    assert db_session.query(YearReview).count() == 0


def test_running_again_changes_nothing(db_session):
    _user(db_session, 1)
    _plays(db_session, 1, 2025)
    with _from(2020):
        run_due(db_session, NOW)
        first = db_session.query(YearReview).one()
        generated_at = first.generated_at
        counts = run_due(db_session, NOW + timedelta(hours=1))
    assert db_session.query(YearReview).count() == 1
    assert counts["archived"] == 0
    assert db_session.query(YearReview).one().generated_at == generated_at  # frozen


def test_off_when_the_setting_is_zero(db_session):
    _user(db_session, 1)
    _plays(db_session, 1, 2025)
    with _from(0):
        run_due(db_session, NOW)
    assert db_session.query(YearReview).count() == 0


def test_a_year_someone_already_has_is_left_alone(db_session):
    _user(db_session, 1)
    _plays(db_session, 1, 2025)
    wrapped_service.generate_year_review(db_session, 1, 2025, "final", NOW, is_sample=True)
    with _from(2020):
        run_due(db_session, NOW)
    assert [(r.stage, r.is_sample) for r in db_session.query(YearReview)] == [("final", True)]


def test_one_failing_person_does_not_stop_the_rest(db_session):
    for user_id in (1, 2):
        _user(db_session, user_id)
        _plays(db_session, user_id, 2025)
    real = wrapped_service.build_music_stats

    def flaky(db, user_id, start, end):
        if user_id == 1:
            raise RuntimeError("boom")
        return real(db, user_id, start, end)

    with _from(2020), patch.object(wrapped_service, "build_music_stats", flaky):
        counts = run_due(db_session, NOW)
    assert [(r.user_id, r.stage) for r in db_session.query(YearReview)] == [(2, "archive")]
    assert counts["failed"] == 6  # person 1 fails for each of the six past years; person 2 is unaffected


# --- through the API -------------------------------------------------------------------------------------------

api_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
ApiSession = sessionmaker(bind=api_engine, autoflush=False)
client = TestClient(app)


def _override_db():
    db = ApiSession()
    try:
        yield db
    finally:
        db.close()


def test_archive_years_are_listed_and_readable_but_never_make_a_banner():
    Base.metadata.drop_all(api_engine)
    Base.metadata.create_all(api_engine)
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    try:
        db = ApiSession()
        _user(db, 1)
        _plays(db, 1, 2025)
        with _from(2020):
            run_due(db, NOW)
        db.close()
        listing = client.get("/year-reviews").json()
        assert [(e["year"], e["status"], e["is_sample"]) for e in listing["years"]] == [(2025, "ready", False)]
        assert listing["banner"] is None
        assert client.get("/year-reviews/2025").json()["stage"] == "archive"
    finally:
        app.dependency_overrides.clear()
