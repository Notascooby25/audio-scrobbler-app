from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.gig_reports_service import GigReportsService
from backend.app.services.setlist_attendance_service import SetlistAttendanceService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _gig(
    db: Session,
    setlist_id: str,
    artist: str,
    day: datetime,
    *,
    festival: bool = False,
    support: bool = False,
    user_id: int = 1,
) -> AttendedConcert:
    concert = AttendedConcert(
        user_id=user_id,
        setlist_id=setlist_id,
        artist_name=artist,
        venue_name="Venue",
        city="City",
        country="Country",
        event_date=day,
        is_support_act=support,
        is_festival=festival,
    )
    db.add(concert)
    db.commit()
    return concert


def _play(db: Session, artist: str, played_at: datetime, *, source: str = "spotify", user_id: int = 1) -> None:
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=uuid.uuid4().hex,
            track_name="Song",
            artist_name=artist,
            played_at=played_at,
            source=source,
            play_id=f"{source}-{uuid.uuid4().hex}",
        )
    )
    db.commit()


def test_gigs_by_period_fills_empty_months_and_counts_festivals(db_session: Session):
    _gig(db_session, "a", "Band A", datetime(2025, 11, 5))
    _gig(db_session, "b", "Band B", datetime(2026, 1, 10), festival=True)
    _gig(db_session, "c", "Band C", datetime(2026, 1, 20))

    result = GigReportsService(db_session).get_gigs_by_period(user_id=1)

    assert result["by_year"] == [
        {"period": "2025", "gigs": 1, "festivals": 0},
        {"period": "2026", "gigs": 2, "festivals": 1},
    ]
    months = {row["period"]: row for row in result["by_month"]}
    assert list(months) == ["2025-11", "2025-12", "2026-01"]
    assert months["2025-12"] == {"period": "2025-12", "gigs": 0, "festivals": 0}
    assert months["2026-01"] == {"period": "2026-01", "gigs": 2, "festivals": 1}


def test_gigs_by_period_is_scoped_to_the_user(db_session: Session):
    _gig(db_session, "a", "Band A", datetime(2026, 1, 10), user_id=2)

    assert GigReportsService(db_session).get_gigs_by_period(user_id=1) == {"by_year": [], "by_month": []}


def test_live_gap_lists_top_artists_never_seen_live(db_session: Session):
    _gig(db_session, "a", "Seen Band", datetime(2026, 1, 10))
    for _ in range(5):
        _play(db_session, "seen band", datetime(2026, 1, 1))
    for _ in range(3):
        _play(db_session, "Unseen Band", datetime(2026, 1, 2))
    _play(db_session, "Rare Band", datetime(2026, 1, 3))
    # Scrobbles written from a gig's setlist are not listening
    for _ in range(9):
        _play(db_session, "Gig Only", datetime(2026, 1, 4), source="setlistfm")

    gap = GigReportsService(db_session).get_live_gap(user_id=1)

    assert gap == [
        {"artist_name": "Unseen Band", "plays": 3},
        {"artist_name": "Rare Band", "plays": 1},
    ]


def test_gig_bump_compares_plays_either_side_of_each_gig(db_session: Session):
    now = datetime(2026, 10, 30, 12, 0)
    gig_day = datetime(2026, 9, 1)
    _gig(db_session, "a", "Band A", gig_day)
    # Two weeks before: 4 plays. Two weeks after (day after the gig onwards): 8 plays
    for offset in range(1, 5):
        _play(db_session, "X", gig_day - timedelta(days=offset))
    for offset in range(2, 10):
        _play(db_session, "X", gig_day + timedelta(days=offset))
        _play(db_session, "X", gig_day + timedelta(days=offset, hours=5))
    # The gig night itself is not in either window
    _play(db_session, "X", gig_day + timedelta(hours=23))

    bump = GigReportsService(db_session).get_gig_bump(user_id=1, now=now)

    assert bump == {
        "window_days": 14,
        "gigs_analysed": 1,
        "average_plays_before": 4.0,
        "average_plays_after": 16.0,
        "change_percent": 300.0,
    }


def test_gig_bump_skips_gigs_whose_after_window_has_not_passed(db_session: Session):
    now = datetime(2026, 10, 30, 12, 0)
    _gig(db_session, "a", "Recent Band", datetime(2026, 10, 25))
    _gig(db_session, "b", "Upcoming Band", datetime(2026, 12, 1))
    _gig(db_session, "c", "Support Act", datetime(2026, 9, 1), support=True)

    bump = GigReportsService(db_session).get_gig_bump(user_id=1, now=now)

    assert bump["gigs_analysed"] == 0
    assert bump["average_plays_before"] == 0.0
    assert bump["change_percent"] is None


def test_update_concert_details_sets_festival_only_when_given(db_session: Session):
    concert = _gig(db_session, "a", "Band A", datetime(2026, 7, 4))
    service = SetlistAttendanceService(db=db_session, setlist_service=MagicMock())
    details = {
        "user_id": 1,
        "concert_id": concert.id,
        "artist_name": "Band A",
        "venue_name": "Venue",
        "city": "City",
        "country": "Country",
        "event_date_str": "2026-07-04",
    }

    service.update_concert_details(**details, is_festival=True)
    assert concert.is_festival is True

    service.update_concert_details(**details)
    assert concert.is_festival is True

    service.update_concert_details(**details, is_festival=False)
    assert concert.is_festival is False


def test_live_gap_matches_spelling_differences_between_spotify_and_setlist_fm(db_session: Session):
    # Logged from Setlist.fm: accent and curly apostrophe. Played on Spotify: plain spelling.
    _gig(db_session, "a", "Maxïmo Park", datetime(2026, 1, 10))
    _gig(db_session, "b", "Noel Gallagher’s High Flying Birds", datetime(2026, 2, 10))
    for _ in range(4):
        _play(db_session, "Maximo Park", datetime(2026, 1, 1))
    for _ in range(2):
        _play(db_session, "Noel Gallagher's High Flying Birds", datetime(2026, 1, 2))
    _play(db_session, "Unseen Act", datetime(2026, 1, 3))

    gap = GigReportsService(db_session).get_live_gap(user_id=1)

    assert gap == [{"artist_name": "Unseen Act", "plays": 1}]
