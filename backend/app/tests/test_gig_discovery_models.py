from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import DiscoveredGig, DiscoveredGigInterest, User, UserPreferences


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_discovered_gig_and_interest_constraints(db_session: Session):
    user = User(
        spotify_user_id="sp-1",
        username="tester",
        display_name="Tester",
        refresh_token_cipher="cipher",
    )
    db_session.add(user)
    db_session.flush()

    gig = DiscoveredGig(
        source="ticketmaster",
        external_id="tm-123",
        artist_name="Fontaines D.C.",
        artist_key="fontaines d.c.",
        attraction_names=["Fontaines D.C.", "Kneecap"],
        attraction_keys=["fontaines d.c.", "kneecap"],
        event_name="Fontaines D.C. Live",
        venue_name="Finsbury Park",
        city="London",
        country_code="GB",
        event_date=date(2026, 7, 5),
    )
    db_session.add(gig)
    db_session.commit()
    assert gig.id is not None

    interest = DiscoveredGigInterest(user_id=user.id, discovered_gig_id=gig.id)
    db_session.add(interest)
    db_session.commit()
    assert interest.id is not None

    dup_interest = DiscoveredGigInterest(user_id=user.id, discovered_gig_id=gig.id)
    db_session.add(dup_interest)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    prefs = UserPreferences(user_id=user.id)
    db_session.add(prefs)
    db_session.commit()
    assert prefs.local_gig_radius_miles == 10
    assert prefs.gig_discovery_filters is None
