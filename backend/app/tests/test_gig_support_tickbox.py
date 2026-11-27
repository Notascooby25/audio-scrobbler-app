from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.setlist_attendance_service import SetlistAttendanceService

DAY = datetime(2026, 11, 26)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


def _gig(db: Session, setlist_id: str, artist: str, *, user_id: int = 1, day: datetime = DAY, hour: int = 20):
    gig = AttendedConcert(
        user_id=user_id,
        setlist_id=setlist_id,
        artist_name=artist,
        venue_name="O2 Institute",
        city="Birmingham",
        country="United Kingdom",
        event_date=day,
    )
    db.add(gig)
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=f"t-{setlist_id}",
            track_name="Song",
            artist_name=artist,
            played_at=day.replace(hour=hour),
            source="setlistfm",
            play_id=f"setlistfm_{setlist_id}_0",
        )
    )
    db.commit()
    return gig


def _event(db: Session, setlist_id: str) -> ListeningEvent:
    return db.query(ListeningEvent).filter_by(play_id=f"setlistfm_{setlist_id}_0").one()


def _update(db: Session, gig: AttendedConcert, **extra):
    service = SetlistAttendanceService(db=db, setlist_service=MagicMock())
    return service.update_concert_details(
        user_id=gig.user_id,
        concert_id=gig.id,
        artist_name=gig.artist_name,
        venue_name=gig.venue_name,
        city=gig.city,
        country=gig.country,
        event_date_str=extra.pop("event_date_str", gig.event_date.strftime("%Y-%m-%d")),
        **extra,
    )


def test_tick_links_to_same_night_headliner_and_moves_scrobbles_to_support_slot(db_session: Session):
    fat_dog = _gig(db_session, "fd", "Fat Dog")
    lemon = _gig(db_session, "ls", "LEMONSUCKR")

    result = _update(db_session, lemon, is_support_act=True)

    assert result.is_support_act is True
    assert result.parent_setlist_id == fat_dog.setlist_id
    assert _event(db_session, "ls").played_at == datetime(2026, 11, 26, 18, 45)


def test_untick_clears_link_and_returns_to_headliner_slot(db_session: Session):
    fat_dog = _gig(db_session, "fd", "Fat Dog")
    lemon = _gig(db_session, "ls", "LEMONSUCKR")
    _update(db_session, lemon, is_support_act=True)

    result = _update(db_session, lemon, is_support_act=False)

    assert result.is_support_act is False
    assert result.parent_setlist_id is None
    assert _event(db_session, "ls").played_at == datetime(2026, 11, 26, 20, 0)
    assert fat_dog.is_support_act is False


def test_tick_with_no_other_gig_only_labels(db_session: Session):
    lemon = _gig(db_session, "ls", "LEMONSUCKR")

    result = _update(db_session, lemon, is_support_act=True)

    assert result.is_support_act is True
    assert result.parent_setlist_id is None


def test_tick_refused_when_gig_has_its_own_supports(db_session: Session):
    headliner = _gig(db_session, "hl", "Fat Dog")
    support = _gig(db_session, "sp", "LEMONSUCKR")
    _update(db_session, support, is_support_act=True)

    with pytest.raises(ValueError, match="Remove its support acts first"):
        _update(db_session, headliner, is_support_act=True)


def test_other_users_gig_is_never_the_headliner(db_session: Session):
    _gig(db_session, "theirs", "Fat Dog", user_id=2)
    lemon = _gig(db_session, "ls", "LEMONSUCKR")

    result = _update(db_session, lemon, is_support_act=True)

    assert result.parent_setlist_id is None


def test_tick_with_date_change_uses_new_date(db_session: Session):
    old_night = _gig(db_session, "old", "Other Act", day=datetime(2026, 11, 25))
    new_night = _gig(db_session, "new", "Fat Dog", day=datetime(2026, 11, 27))
    lemon = _gig(db_session, "ls", "LEMONSUCKR")

    result = _update(db_session, lemon, is_support_act=True, event_date_str="2026-11-27")

    assert result.parent_setlist_id == new_night.setlist_id != old_night.setlist_id
    assert _event(db_session, "ls").played_at == datetime(2026, 11, 27, 18, 45)


def test_tick_on_gig_with_no_scrobbles_does_not_crash(db_session: Session):
    _gig(db_session, "fd", "Fat Dog")
    manual = AttendedConcert(
        user_id=1,
        setlist_id="manual-1",
        artist_name="LEMONSUCKR",
        venue_name="O2 Institute",
        city="Birmingham",
        country="United Kingdom",
        event_date=DAY,
    )
    db_session.add(manual)
    db_session.commit()

    result = _update(db_session, manual, is_support_act=True)

    assert result.parent_setlist_id == "fd"


def test_manual_log_with_support_flag_links_to_headliner(db_session: Session):
    _gig(db_session, "fd", "Fat Dog")
    service = SetlistAttendanceService(db=db_session, setlist_service=MagicMock())

    concert = service.log_manual_concert(
        user_id=1,
        artist_name="LEMONSUCKR",
        venue_name="O2 Institute",
        city="Birmingham",
        country="United Kingdom",
        event_date_str="2026-11-26",
        is_support_act=True,
    )

    assert concert.is_support_act is True
    assert concert.parent_setlist_id == "fd"
