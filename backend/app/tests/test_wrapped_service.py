from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent, Notification, User, YearReview
from backend.app.services import wrapped_service
from backend.app.services.wrapped_service import generate_year_review, run_due


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


def _user(db, user_id=1, active=True):
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


def _plays(db, user_id=1, count=40, start=datetime(2026, 3, 1, 12, 0)):
    for i in range(count):
        db.add(
            ListeningEvent(
                user_id=user_id,
                track_id=f"t{i}",
                track_name=f"Song {i % 5}",
                artist_name="Artist",
                album_name="Album",
                played_at=start + timedelta(minutes=5 * i),
                duration_ms=180_000,
                source="spotify",
                play_id=uuid.uuid4().hex,
            )
        )
    db.commit()


def _gig(db, user_id=1, day=datetime(2026, 5, 1)):
    db.add(
        AttendedConcert(
            user_id=user_id,
            setlist_id=f"g-{user_id}-{day.isoformat()}",
            artist_name="Band",
            venue_name="Hall",
            city="Leeds",
            country="United Kingdom",
            event_date=day,
        )
    )
    db.commit()


def test_run_due_before_30_dec_does_nothing(db_session):
    _user(db_session)
    _plays(db_session)
    assert run_due(db_session, datetime(2026, 12, 30, 7, 59)) == {"generated": 0, "failed": 0}
    assert db_session.query(YearReview).count() == 0


def test_preview_due_from_30_dec_morning(db_session):
    _user(db_session)
    _plays(db_session)
    run_due(db_session, datetime(2026, 12, 30, 8, 0))
    assert [r.stage for r in db_session.query(YearReview)] == ["preview"]


def test_unlock_due_at_1800_london_not_before(db_session):
    _user(db_session)
    _plays(db_session)
    run_due(db_session, datetime(2026, 12, 31, 17, 59))
    assert {r.stage for r in db_session.query(YearReview)} == {"preview"}
    run_due(db_session, datetime(2026, 12, 31, 18, 0))
    assert {r.stage for r in db_session.query(YearReview)} == {"preview", "unlock"}


def test_summer_clock_uses_london_time(db_session):
    # A BST year-end check: 17:00 UTC is 18:00 London in summer. The stage clock is for 31 Dec only,
    # so verify the conversion helper directly.
    assert wrapped_service.london_to_utc_naive(datetime(2026, 7, 1, 18, 0)) == datetime(2026, 7, 1, 17, 0)
    assert wrapped_service.london_to_utc_naive(datetime(2026, 12, 31, 18, 0)) == datetime(2026, 12, 31, 18, 0)


def test_final_due_after_midnight_and_marks_changed(db_session):
    _user(db_session)
    _plays(db_session)
    run_due(db_session, datetime(2026, 12, 31, 18, 0))
    _plays(db_session, count=10, start=datetime(2026, 12, 31, 19, 0))  # late listening
    run_due(db_session, datetime(2027, 1, 1, 0, 5))
    final = db_session.query(YearReview).filter_by(stage="final").one()
    unlock = db_session.query(YearReview).filter_by(stage="unlock").one()
    assert final.data["music"]["total_plays"] == 50
    assert unlock.data["music"]["total_plays"] == 40  # frozen
    assert "music.total_plays" in final.data["changed"]


def test_run_due_twice_creates_one_row_one_notification(db_session):
    _user(db_session)
    _plays(db_session)
    with patch.object(wrapped_service, "queue_push") as push:
        run_due(db_session, datetime(2026, 12, 31, 18, 0))
        run_due(db_session, datetime(2026, 12, 31, 18, 30))
    assert db_session.query(YearReview).filter_by(stage="unlock").count() == 1
    assert db_session.query(Notification).count() == 1
    assert push.call_count == 1


def test_unlock_notification_content_and_push(db_session):
    _user(db_session)
    _plays(db_session)
    with patch.object(wrapped_service, "queue_push") as push:
        run_due(db_session, datetime(2026, 12, 31, 18, 0))
    note = db_session.query(Notification).one()
    assert (note.user_id, note.type, note.link) == (1, "wrapped", "/wrapped/2026")
    assert "2026" in note.title
    assert push.call_args.args[0] == 1
    assert push.call_args.args[3] == "/wrapped/2026"


def test_preview_and_final_send_no_notification(db_session):
    _user(db_session)
    _plays(db_session)
    with patch.object(wrapped_service, "queue_push") as push:
        run_due(db_session, datetime(2026, 12, 30, 9, 0))
        run_due(db_session, datetime(2027, 1, 1, 0, 5))
    assert db_session.query(YearReview).filter_by(stage="final").count() == 1
    assert db_session.query(Notification).count() == 1  # only the one created when unlock caught up
    assert push.call_count == 1


def test_inactive_user_skipped(db_session):
    _user(db_session, active=False)
    _plays(db_session)
    run_due(db_session, datetime(2026, 12, 31, 18, 0))
    assert db_session.query(YearReview).count() == 0


def test_ineligible_user_gets_no_row(db_session):
    _user(db_session)
    _plays(db_session, count=10)
    run_due(db_session, datetime(2026, 12, 31, 18, 0))
    assert db_session.query(YearReview).count() == 0


def test_gigs_alone_make_a_user_eligible(db_session):
    _user(db_session)
    _gig(db_session)
    run_due(db_session, datetime(2026, 12, 31, 18, 0))
    row = db_session.query(YearReview).filter_by(stage="unlock").one()
    assert row.data["music"] is None
    assert row.data["gigs"]["nights"] == 1


def test_never_backfills_the_sample_year(db_session):
    _user(db_session)
    _plays(db_session, start=datetime(2025, 3, 1, 12, 0))
    _plays(db_session, start=datetime(2026, 3, 1, 12, 0))
    run_due(db_session, datetime(2026, 6, 1, 12, 0))
    run_due(db_session, datetime(2026, 12, 31, 18, 0))
    assert {r.year for r in db_session.query(YearReview)} == {2026}


def test_unlock_row_is_never_overwritten(db_session):
    _user(db_session)
    _plays(db_session)
    first = generate_year_review(db_session, 1, 2026, "unlock", datetime(2026, 12, 31, 18, 0))
    _plays(db_session, count=5, start=datetime(2026, 12, 31, 12, 0))
    second = generate_year_review(db_session, 1, 2026, "unlock", datetime(2026, 12, 31, 18, 5))
    assert second.id == first.id
    assert second.data["music"]["total_plays"] == 40


def test_sample_year_for_owner_sends_nothing(db_session):
    _user(db_session)
    _plays(db_session, start=datetime(2025, 3, 1, 12, 0))
    with patch.object(wrapped_service, "queue_push") as push:
        row = generate_year_review(db_session, 1, 2025, "final", datetime(2026, 11, 28, 9, 0), is_sample=True)
    assert row.is_sample is True
    assert row.data["music"]["total_plays"] == 40
    assert db_session.query(Notification).count() == 0
    assert push.call_count == 0


def test_partial_year_is_labelled(db_session):
    _user(db_session)
    _plays(db_session, start=datetime(2026, 3, 14, 12, 0))
    row = generate_year_review(db_session, 1, 2026, "preview", datetime(2026, 12, 30, 9, 0))
    assert row.data["partial_from"] == "2026-03-14"
