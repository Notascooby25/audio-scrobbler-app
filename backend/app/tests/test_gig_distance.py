from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, GeoCache, UserPreferences
from backend.app.services import gig_distance_service, geocoding_service
from backend.app.services.gig_distance_service import (
    HomeCityNotFoundError,
    clear_home_city,
    furthest_gigs,
    haversine_km,
    set_home_city,
)
from backend.app.services.geocoding_service import GeocodingUnavailableError, cache_key, locate

LONDON = (51.5074, -0.1278)
PARIS = (48.8566, 2.3522)
LEEDS = (53.8008, -1.5491)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _cache_place(db: Session, query: str, point: tuple[float, float] | None) -> None:
    db.merge(
        GeoCache(
            cache_key=cache_key(query),
            lat=point[0] if point else None,
            lng=point[1] if point else None,
            expires_at=datetime.utcnow() + timedelta(days=1),
        )
    )
    db.commit()


def _home(db: Session, point: tuple[float, float]) -> None:
    db.add(UserPreferences(user_id=1, home_city="Leeds", home_lat=point[0], home_lng=point[1]))
    db.commit()


def _gig(db: Session, artist: str, venue: str, city: str, country: str, day: datetime, support: bool = False):
    db.add(
        AttendedConcert(
            user_id=1,
            setlist_id=f"id-{artist}-{day.isoformat()}-{venue}",
            artist_name=artist,
            venue_name=venue,
            city=city,
            country=country,
            event_date=day,
            is_support_act=support,
        )
    )
    db.commit()


def test_haversine_matches_known_distance():
    assert haversine_km(LONDON, PARIS) == pytest.approx(343.5, abs=2)
    assert haversine_km(LONDON, LONDON) == pytest.approx(0)


def test_furthest_gigs_ranks_headline_gigs_by_distance_from_home(db_session: Session):
    _home(db_session, LEEDS)
    _cache_place(db_session, "Venue One, London, United Kingdom", LONDON)
    _cache_place(db_session, "Venue Two, Paris, France", PARIS)
    _gig(db_session, "Near Band", "Venue One", "London", "United Kingdom", datetime(2026, 1, 1))
    _gig(db_session, "Far Band", "Venue Two", "Paris", "France", datetime(2026, 2, 1))
    _gig(db_session, "Support Act", "Venue Two", "Paris", "France", datetime(2026, 2, 1), support=True)

    result = furthest_gigs(db_session, user_id=1)

    assert result["home_set"] is True
    assert result["located_gigs"] == 2
    assert result["pending_gigs"] == 0
    assert [gig["artist_name"] for gig in result["furthest"]] == ["Far Band", "Near Band"]
    assert result["furthest"][0]["distance_km"] == round(haversine_km(LEEDS, PARIS))


def test_furthest_gigs_without_home_says_so(db_session: Session):
    _gig(db_session, "Band", "Venue", "Leeds", "United Kingdom", datetime(2026, 1, 1))

    assert furthest_gigs(db_session, user_id=1) == {
        "home_set": False,
        "located_gigs": 0,
        "pending_gigs": 0,
        "furthest": [],
    }


def test_unlocated_venues_are_capped_per_request_and_counted_as_pending(db_session: Session):
    _home(db_session, LEEDS)
    for index in range(8):
        _gig(db_session, f"Band {index}", f"Venue {index}", "City", "Country", datetime(2026, 1, index + 1))

    with patch.object(gig_distance_service, "locate", return_value=None) as lookup:
        result = furthest_gigs(db_session, user_id=1)

    assert lookup.call_count == gig_distance_service.MAX_NEW_LOOKUPS_PER_REQUEST
    assert result["pending_gigs"] == 3
    assert result["furthest"] == []


def test_map_outage_stops_lookups_and_leaves_gigs_pending(db_session: Session):
    _home(db_session, LEEDS)
    _gig(db_session, "Band A", "Venue A", "City", "Country", datetime(2026, 1, 1))
    _gig(db_session, "Band B", "Venue B", "City", "Country", datetime(2026, 1, 2))

    with patch.object(gig_distance_service, "locate", side_effect=GeocodingUnavailableError("down")) as lookup:
        result = furthest_gigs(db_session, user_id=1)

    assert lookup.call_count == 1
    assert result["pending_gigs"] == 2


def test_set_home_city_stores_the_location_and_clear_removes_it(db_session: Session):
    with patch.object(gig_distance_service, "locate", return_value=LEEDS):
        preferences = set_home_city(db_session, user_id=1, city="  Leeds,   United Kingdom ")

    assert preferences.home_city == "Leeds, United Kingdom"
    assert (preferences.home_lat, preferences.home_lng) == LEEDS

    preferences = clear_home_city(db_session, user_id=1)
    assert preferences.home_city is None
    assert preferences.home_lat is None


def test_set_home_city_refuses_a_place_the_map_does_not_know(db_session: Session):
    with patch.object(gig_distance_service, "locate", return_value=None):
        with pytest.raises(HomeCityNotFoundError):
            set_home_city(db_session, user_id=1, city="Nowhereville")


def test_locate_caches_found_places_and_misses(db_session: Session):
    response = MagicMock()
    response.json.return_value = [{"lat": "53.8", "lon": "-1.55"}]
    with (
        patch.object(geocoding_service, "_wait_for_turn"),
        patch.object(geocoding_service.httpx, "get", return_value=response) as get,
    ):
        first = locate(db_session, "Leeds")
        second = locate(db_session, "leeds")

    assert first == (53.8, -1.55)
    assert second == first
    assert get.call_count == 1

    empty = MagicMock()
    empty.json.return_value = []
    with (
        patch.object(geocoding_service, "_wait_for_turn"),
        patch.object(geocoding_service.httpx, "get", return_value=empty) as get,
    ):
        assert locate(db_session, "Nowhere") is None
        assert locate(db_session, "Nowhere") is None

    assert get.call_count == 1


def test_locate_does_not_cache_a_failed_request(db_session: Session):
    with (
        patch.object(geocoding_service, "_wait_for_turn"),
        patch.object(geocoding_service.httpx, "get", side_effect=geocoding_service.httpx.ConnectError("offline")),
    ):
        with pytest.raises(GeocodingUnavailableError):
            locate(db_session, "Leeds")

    assert db_session.query(GeoCache).count() == 0


def test_long_venue_queries_fit_the_cache_key_column(db_session: Session):
    # Venue (255) + city (128) + country (128) can be longer than the 255-character key column
    long_query = ", ".join(["A" * 255, "B" * 128, "C" * 128])
    response = MagicMock()
    response.json.return_value = [{"lat": "1.0", "lon": "2.0"}]
    with (
        patch.object(geocoding_service, "_wait_for_turn"),
        patch.object(geocoding_service.httpx, "get", return_value=response),
    ):
        assert locate(db_session, long_query) == (1.0, 2.0)

    assert len(cache_key(long_query)) <= 255
