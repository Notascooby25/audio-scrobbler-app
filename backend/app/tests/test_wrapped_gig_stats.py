from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.models import AttendedConcert, GeoCache, UserPreferences
from backend.app.services.geocoding_service import cache_key
from backend.app.services.wrapped_gig_stats import build_gig_stats

LEEDS = (53.8008, -1.5491)
LONDON = (51.5074, -0.1278)
TODAY = date(2026, 12, 31)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


def _cache(db, query, point):
    db.merge(
        GeoCache(
            cache_key=cache_key(query),
            lat=point[0] if point else None,
            lng=point[1] if point else None,
            expires_at=utc_now() + timedelta(days=1),
        )
    )
    db.commit()


def _home(db, point=LEEDS):
    db.add(UserPreferences(user_id=1, home_city="Leeds", home_lat=point[0], home_lng=point[1]))
    db.commit()


def _gig(db, artist, day, venue="O2 Academy", city="London", country="United Kingdom", support=False, **kwargs):
    db.add(
        AttendedConcert(
            user_id=kwargs.pop("user_id", 1),
            setlist_id=f"{artist}-{day.isoformat()}-{venue}",
            artist_name=artist,
            venue_name=venue,
            city=city,
            country=country,
            event_date=day,
            is_support_act=support,
            **kwargs,
        )
    )
    db.commit()


def test_none_without_gigs_in_year(db_session):
    _gig(db_session, "Old", datetime(2025, 5, 1))
    assert build_gig_stats(db_session, 1, 2026, today=TODAY) is None


def test_headliner_plus_support_is_one_night(db_session):
    _gig(db_session, "Headliner", datetime(2026, 3, 1))
    _gig(db_session, "Support", datetime(2026, 3, 1), support=True)
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["nights"] == 1
    assert stats["artists"] == 2


def test_festival_nights_from_flag(db_session):
    _gig(db_session, "A", datetime(2026, 6, 26), venue="Field", is_festival=True)
    _gig(db_session, "B", datetime(2026, 6, 26), venue="Field", is_festival=True)
    _gig(db_session, "C", datetime(2026, 6, 27), venue="Field", is_festival=True)
    _gig(db_session, "D", datetime(2026, 8, 1))
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["nights"] == 3
    assert stats["festival_nights"] == 2


def test_only_gigs_in_the_year_and_not_in_future(db_session):
    _gig(db_session, "In", datetime(2026, 3, 1))
    _gig(db_session, "Next year", datetime(2027, 1, 2))
    _gig(db_session, "Not yet", datetime(2026, 12, 31), venue="Late")
    stats = build_gig_stats(db_session, 1, 2026, today=date(2026, 12, 30))
    assert stats["nights"] == 1


def test_gig_list_has_one_entry_per_night_headliner_first_in_date_order(db_session):
    _gig(db_session, "Support", datetime(2026, 5, 2), venue="Hall", city="Leeds", support=True)
    _gig(db_session, "Headliner", datetime(2026, 5, 2), venue="Hall", city="Leeds")
    _gig(db_session, "Early", datetime(2026, 2, 1), venue="Club", city="York")
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["gig_list"] == [
        {"date": "2026-02-01", "end_date": None, "artist": "Early", "venue": "Club", "city": "York", "festival": None},
        {
            "date": "2026-05-02",
            "end_date": None,
            "artist": "Headliner",
            "venue": "Hall",
            "city": "Leeds",
            "festival": None,
        },
    ]


def test_gig_list_names_the_festival_and_is_capped(db_session):
    _gig(db_session, "Band", datetime(2026, 6, 26), venue="Field", is_festival=True, festival_name="Big Weekend")
    for day in range(1, 29):
        _gig(db_session, f"Act {day}", datetime(2026, 7, day), venue=f"Venue {day}")
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["gig_list"][0]["festival"] == "Big Weekend"
    assert len(stats["gig_list"]) == 18
    assert stats["gig_list_total"] == 29  # 1 festival + 28 gigs; only the list is capped
    assert stats["nights"] == 29  # the total is never capped, only the list


def test_a_festival_is_one_entry_however_many_acts_stages_or_days(db_session):
    kwargs = {"is_festival": True, "festival_name": "Victorious Festival - 2026", "city": "Portsmouth"}
    _gig(db_session, "Primal Scream", datetime(2026, 8, 29), venue="Castle Stage", **kwargs)
    _gig(db_session, "The Black Keys", datetime(2026, 8, 29), venue="Common Stage", **kwargs)
    _gig(db_session, "Another Act", datetime(2026, 8, 30), venue="Castle Stage", **kwargs)
    _gig(db_session, "Solo Show", datetime(2026, 9, 5), venue="Hall", city="Leeds")
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["gig_list"] == [
        {
            "date": "2026-08-29",
            "end_date": "2026-08-30",
            "artist": "Victorious Festival - 2026",
            "venue": None,
            "city": "Portsmouth",
            "festival": "Victorious Festival - 2026",
        },
        {
            "date": "2026-09-05",
            "end_date": None,
            "artist": "Solo Show",
            "venue": "Hall",
            "city": "Leeds",
            "festival": None,
        },
    ]
    assert stats["gig_list_total"] == 2
    assert stats["nights"] == 4  # the headline totals still count every night


def test_festival_rows_with_no_title_stay_as_ordinary_gigs(db_session):
    _gig(db_session, "Band", datetime(2026, 6, 26), venue="Field", is_festival=True)
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["gig_list"][0]["artist"] == "Band"
    assert stats["gig_list"][0]["festival"] is None


def test_months_busiest_first_last_gap_and_songs(db_session):
    _gig(db_session, "A", datetime(2026, 1, 10), song_count=20)
    _gig(db_session, "A", datetime(2026, 6, 1), venue="V2", song_count=15)
    _gig(db_session, "B", datetime(2026, 6, 20), venue="V3", song_count=10)
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["months_with_gigs"] == [1, 6]
    assert stats["busiest_month"] == {"month": 6, "nights": 2}
    assert stats["most_seen"] == {"artist": "A", "times": 2}
    assert stats["first_night"] == "2026-01-10"
    assert stats["last_night"] == "2026-06-20"
    assert stats["longest_gap_days"] == 142
    assert stats["songs_heard_live"] == 45


def test_new_venues_exclude_places_seen_before(db_session):
    _gig(db_session, "A", datetime(2025, 2, 1), venue="Old Place")
    _gig(db_session, "A", datetime(2026, 2, 1), venue="Old Place")
    _gig(db_session, "A", datetime(2026, 3, 1), venue="New Place")
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    assert stats["venues"] == 2
    assert stats["new_venues"] == 1


def test_miles_return_trip_haversine(db_session):
    _home(db_session)
    _cache(db_session, "O2 Academy, London, United Kingdom", LONDON)
    _gig(db_session, "A", datetime(2026, 3, 1))
    _gig(db_session, "B", datetime(2026, 4, 1))
    stats = build_gig_stats(db_session, 1, 2026, today=TODAY)
    one_way_miles = 169.3  # Leeds to London, about 272 km
    assert stats["miles"]["total"] == pytest.approx(4 * one_way_miles, abs=15)
    assert stats["miles"]["furthest"]["miles"] == pytest.approx(one_way_miles, abs=8)
    assert stats["miles"]["left_out"] == 0
    assert stats["miles"]["by_city"] == 0


def test_no_home_city_gives_no_miles(db_session):
    _gig(db_session, "A", datetime(2026, 3, 1))
    assert build_gig_stats(db_session, 1, 2026, today=TODAY)["miles"] is None


def test_unplaced_venue_left_out_and_counted(db_session):
    _home(db_session)
    _gig(db_session, "A", datetime(2026, 3, 1))
    miles = build_gig_stats(db_session, 1, 2026, today=TODAY)["miles"]
    assert miles["total"] == 0
    assert miles["left_out"] == 1
    assert miles["furthest"] is None


def test_city_level_placement_counted_in_by_city(db_session):
    _home(db_session)
    _cache(db_session, "O2 Academy, London, United Kingdom", None)
    _cache(db_session, "London, United Kingdom", LONDON)
    _gig(db_session, "A", datetime(2026, 3, 1))
    miles = build_gig_stats(db_session, 1, 2026, today=TODAY)["miles"]
    assert miles["by_city"] == 1
    assert miles["total"] > 300


def test_notes_never_in_result(db_session):
    _gig(db_session, "A", datetime(2026, 3, 1), notes="secret note about my day")
    assert "secret note" not in repr(build_gig_stats(db_session, 1, 2026, today=TODAY))


def test_other_users_gigs_ignored(db_session):
    _gig(db_session, "A", datetime(2026, 3, 1), user_id=2)
    assert build_gig_stats(db_session, 1, 2026, today=TODAY) is None
