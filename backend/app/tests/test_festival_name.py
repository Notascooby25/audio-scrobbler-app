from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert
from backend.app.services.setlist_stats_service import SetlistStatsService
from backend.app.services.setlist_attendance_service import SetlistAttendanceService, festival_name_for
from unittest.mock import MagicMock


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_festival_name_is_trimmed_and_kept_only_for_festivals():
    assert festival_name_for(True, "  Victorious   Festival 2026 ") == "Victorious Festival 2026"
    assert festival_name_for(True, "   ") is None
    assert festival_name_for(False, "Victorious Festival 2026") is None
    assert festival_name_for(True, None) is None


def test_update_stores_the_name_and_unticking_festival_clears_it(db_session: Session):
    concert = AttendedConcert(
        user_id=1,
        setlist_id="doves-1",
        artist_name="Doves",
        venue_name="Castle Stage",
        city="Portsmouth",
        country="United Kingdom",
        event_date=datetime(2026, 8, 29),
    )
    db_session.add(concert)
    db_session.commit()
    service = SetlistAttendanceService(db=db_session, setlist_service=MagicMock())
    details = {
        "user_id": 1,
        "concert_id": concert.id,
        "artist_name": "Doves",
        "venue_name": "Castle Stage",
        "city": "Portsmouth",
        "country": "United Kingdom",
        "event_date_str": "2026-08-29",
    }

    service.update_concert_details(**details, is_festival=True, festival_name="Victorious Festival 2026")
    assert concert.festival_name == "Victorious Festival 2026"

    service.update_concert_details(**details, is_festival=False)
    assert concert.festival_name is None


def test_artists_seen_gigs_carry_the_festival_name(db_session: Session):
    db_session.add(
        AttendedConcert(
            user_id=1,
            setlist_id="doves-2",
            artist_name="Doves",
            venue_name="Castle Stage",
            city="Portsmouth",
            country="United Kingdom",
            event_date=datetime(2026, 8, 29),
            is_festival=True,
            festival_name="Victorious Festival 2026",
        )
    )
    db_session.commit()

    artist = SetlistStatsService(db=db_session).get_artists_seen_leaderboard(user_id=1)[0]

    assert artist["gigs"][0]["festival_name"] == "Victorious Festival 2026"
