from __future__ import annotations

from datetime import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.gig_badges_service import GigBadgesService
from backend.app.services.gig_reports_service import GigReportsService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_solo_explorer_unlocked_when_no_companions(db_session: Session):
    # Log a concert with no companions
    db_session.add(
        AttendedConcert(
            user_id=1,
            setlist_id="c1",
            artist_name="Fontaines D.C.",
            venue_name="Brudenell Social Club",
            city="Leeds",
            country="United Kingdom",
            event_date=datetime(2025, 5, 10),
            is_support_act=False,
            is_festival=False,
        )
    )
    db_session.commit()

    service = GigBadgesService(db_session)
    badges = service.evaluate_badges(user_id=1)
    badge_map = {b["id"]: b for b in badges}

    assert "solo_explorer" in badge_map
    assert badge_map["solo_explorer"]["unlocked"] is True
    assert badge_map["solo_explorer"]["progress"] == 1


def test_live_first_detected_when_gig_precedes_first_scrobble(db_session: Session):
    # Gig was on 2024-06-01
    db_session.add(
        AttendedConcert(
            user_id=1,
            setlist_id="c2",
            artist_name="Yard Act",
            venue_name="Academy",
            city="Manchester",
            country="United Kingdom",
            event_date=datetime(2024, 6, 1),
            is_support_act=False,
        )
    )
    # First Spotify scrobble was on 2024-08-15
    db_session.add(
        ListeningEvent(
            user_id=1,
            track_id="t1",
            track_name="Fixer Upper",
            artist_name="Yard Act",
            played_at=datetime(2024, 8, 15),
            source="spotify",
            play_id="sp-1",
        )
    )
    db_session.commit()

    service = GigReportsService(db_session)
    discoveries = service.get_live_first_discoveries(user_id=1)

    assert len(discoveries) == 1
    assert discoveries[0]["artist_name"] == "Yard Act"
    assert discoveries[0]["lifetime_plays"] == 1

    badges = GigBadgesService(db_session).evaluate_badges(user_id=1)
    badge_map = {b["id"]: b for b in badges}
    assert badge_map["live_first"]["unlocked"] is True
