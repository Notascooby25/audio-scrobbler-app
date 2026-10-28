from __future__ import annotations

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, SetlistApiUsage, SetlistCache


def test_setlist_models_crud() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    with Session(engine) as session:
        # Test AttendedConcert
        concert = AttendedConcert(
            user_id=1,
            setlist_id="test_setlist_123",
            artist_name="Foo Fighters",
            artist_mbid="mbid-123",
            venue_name="Anfield",
            city="Liverpool",
            country="United Kingdom",
            event_date=datetime(2026, 6, 27, 20, 0),
            tour_name="Take Cover",
            setlist_url="https://www.setlist.fm/setlist/test",
            is_support_act=False,
            parent_setlist_id=None,
            raw_data={"songs": ["All My Life", "Everlong"]},
            song_count=2,
        )
        session.add(concert)

        # Test SetlistCache
        cache = SetlistCache(
            cache_key="search:foo_fighters:gb",
            response_json={"total": 1, "setlists": []},
            expires_at=datetime(2026, 7, 1, 0, 0),
        )
        session.add(cache)

        # Test SetlistApiUsage
        usage = SetlistApiUsage(
            id=1,
            last_call_at=datetime.utcnow(),
            daily_date="2026-10-28",
            daily_count=5,
        )
        session.add(usage)
        session.commit()

        # Verify query back
        queried_concert = session.query(AttendedConcert).filter_by(setlist_id="test_setlist_123").first()
        assert queried_concert is not None
        assert queried_concert.artist_name == "Foo Fighters"
        assert queried_concert.venue_name == "Anfield"
        assert queried_concert.song_count == 2
        assert queried_concert.raw_data == {"songs": ["All My Life", "Everlong"]}

        queried_cache = session.query(SetlistCache).filter_by(cache_key="search:foo_fighters:gb").first()
        assert queried_cache is not None
        assert queried_cache.response_json["total"] == 1

        queried_usage = session.query(SetlistApiUsage).filter_by(id=1).first()
        assert queried_usage is not None
        assert queried_usage.daily_count == 5
