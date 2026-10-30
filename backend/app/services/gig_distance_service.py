from __future__ import annotations

import math
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import AttendedConcert, UserPreferences
from .geocoding_service import GeocodingUnavailableError, find_cached, locate
from .preferences_service import get_or_create

EARTH_RADIUS_KM = 6371.0
FURTHEST_LIMIT = 5


class HomeCityNotFoundError(ValueError):
    """The map service didn't recognise the home city."""


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lng) points, in kilometres."""
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    hav = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(hav))


def _venue_query(venue_name: str, city: str, country: str) -> str:
    return ", ".join(part for part in (venue_name.strip(), city.strip(), country.strip()) if part)


def set_home_city(db: Session, user_id: int, city: str) -> UserPreferences:
    """Looks the city up on the map and stores where it is. Raises if it can't be found."""
    text = " ".join(city.split())
    point = locate(db, text)
    if point is None:
        raise HomeCityNotFoundError("Couldn't find that place. Try the city and country, like Leeds, United Kingdom.")
    preferences = get_or_create(db, user_id)
    preferences.home_city = text
    preferences.home_lat, preferences.home_lng = point
    db.commit()
    db.refresh(preferences)
    return preferences


def clear_home_city(db: Session, user_id: int) -> UserPreferences:
    preferences = get_or_create(db, user_id)
    preferences.home_city = None
    preferences.home_lat = None
    preferences.home_lng = None
    db.commit()
    db.refresh(preferences)
    return preferences


def _queries(venue_name: str, city: str, country: str) -> tuple[str, str | None]:
    """The exact venue query, and a city-level fallback for venues the map doesn't know."""
    venue_query = _venue_query(venue_name, city, country)
    city_query = _venue_query("", city, country)
    return venue_query, city_query or None


def geocode_pending_venues(db: Session, limit: int) -> dict[str, int]:
    """Places up to `limit` headline-gig venues on the map. A venue the map doesn't know is
    placed at its city instead. Run by the worker, so report pages never wait on the map.
    Stops early if the service is unavailable."""
    rows = (
        db.query(AttendedConcert.venue_name, AttendedConcert.city, AttendedConcert.country)
        .filter(AttendedConcert.is_support_act.is_(False))
        .order_by(desc(AttendedConcert.event_date))
        .all()
    )
    pairs = list(dict.fromkeys(_queries(venue, city, country) for venue, city, country in rows))
    checked = found = 0
    unavailable = False

    def ensure(query: str) -> bool:
        """True once the query is cached. Looks it up if there's budget left."""
        nonlocal checked, found, unavailable
        if find_cached(db, query)[0]:
            return True
        if unavailable or checked >= limit:
            return False
        try:
            point = locate(db, query)
        except GeocodingUnavailableError:
            unavailable = True
            return False
        checked += 1
        found += point is not None
        return True

    pending = 0
    for venue_query, city_query in pairs:
        done = ensure(venue_query)
        if done and find_cached(db, venue_query)[1] is None and city_query:
            done = ensure(city_query)
        if not done:
            pending += 1
    return {"checked": checked, "found": found, "pending": pending}


def _place(db: Session, venue_query: str, city_query: str | None) -> tuple[bool, tuple[float, float] | None, bool]:
    """(placed yet, point or None if the map doesn't know it, approximate: placed at city level)."""
    known, point = find_cached(db, venue_query)
    if not known:
        return False, None, False
    if point is not None or city_query is None:
        return True, point, False
    known_city, city_point = find_cached(db, city_query)
    if not known_city:
        return False, None, False
    return True, city_point, city_point is not None


# Gigs listed under one venue in the furthest list. A festival can have dozens of bands.
MAX_GIGS_PER_VENUE = 50


def furthest_gigs(db: Session, user_id: int) -> dict[str, Any]:
    """The five venues furthest from the user's home city, each with the headline gigs there.

    Reads only places the worker has already set. Gigs whose place isn't set yet are counted
    as pending.
    """
    preferences = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if preferences is None or preferences.home_lat is None or preferences.home_lng is None:
        return {"home_set": False, "located_gigs": 0, "pending_gigs": 0, "furthest": []}
    home = (preferences.home_lat, preferences.home_lng)

    gigs = (
        db.query(AttendedConcert)
        .filter(AttendedConcert.user_id == user_id, AttendedConcert.is_support_act.is_(False))
        .order_by(desc(AttendedConcert.event_date))
        .all()
    )
    venues: dict[str, dict[str, Any]] = {}
    for gig in gigs:
        venue_query, city_query = _queries(gig.venue_name, gig.city, gig.country)
        venue = venues.setdefault(
            venue_query.casefold(),
            {"venue_query": venue_query, "city_query": city_query, "gigs": []},
        )
        venue["gigs"].append(gig)

    placed = []
    pending = 0
    for venue in venues.values():
        known, point, approximate = _place(db, venue["venue_query"], venue["city_query"])
        if not known:
            pending += len(venue["gigs"])
            continue
        if point is None:
            continue
        placed.append((haversine_km(home, point), approximate, venue["gigs"]))

    placed.sort(key=lambda item: item[0], reverse=True)
    return {
        "home_set": True,
        "located_gigs": sum(len(item[2]) for item in placed),
        "pending_gigs": pending,
        "furthest": [
            {
                "venue_name": gigs_here[0].venue_name,
                "city": gigs_here[0].city,
                "country": gigs_here[0].country,
                "distance_km": round(distance),
                "approximate": approximate,
                "gig_count": len(gigs_here),
                "gigs": [
                    {
                        "id": gig.id,
                        "artist_name": gig.artist_name,
                        "date": gig.event_date.strftime("%d %b %Y") if gig.event_date else "",
                        "event_date": gig.event_date.isoformat() if gig.event_date else None,
                    }
                    for gig in gigs_here[:MAX_GIGS_PER_VENUE]
                ],
            }
            for distance, approximate, gigs_here in placed[:FURTHEST_LIMIT]
        ],
    }
