from __future__ import annotations

from datetime import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert
from backend.app.services.gig_badges_service import GigBadgesService


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


def test_opening_act_unlocked_when_support_logged(db_session: Session):
    # Support act gig on 2024-06-01
    db_session.add(
        AttendedConcert(
            user_id=1,
            setlist_id="c2",
            artist_name="Yard Act",
            venue_name="Academy",
            city="Manchester",
            country="United Kingdom",
            event_date=datetime(2024, 6, 1),
            is_support_act=True,
        )
    )
    db_session.commit()

    badges = GigBadgesService(db_session).evaluate_badges(user_id=1)
    badge_map = {b["id"]: b for b in badges}
    assert "opening_act" in badge_map
    assert badge_map["opening_act"]["unlocked"] is True
