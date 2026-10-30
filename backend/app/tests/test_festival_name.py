from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert
from backend.app.services.setlist_attendance_service import SetlistAttendanceService, _festival_name
from unittest.mock import MagicMock


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_festival_name_is_trimmed_and_kept_only_for_festivals():
    assert _festival_name(True, "  Victorious   Festival 2026 ") == "Victorious Festival 2026"
    assert _festival_name(True, "   ") is None
    assert _festival_name(False, "Victorious Festival 2026") is None
    assert _festival_name(True, None) is None


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
