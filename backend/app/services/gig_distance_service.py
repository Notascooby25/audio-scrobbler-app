from __future__ import annotations

import math
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import AttendedConcert, UserPreferences
from .geocoding_service import GeocodingUnavailableError, find_cached, locate
from .preferences_service import get_or_create

EARTH_RADIUS_KM = 6371.0
# New venues looked up in one request. Each lookup waits about a second, so this keeps a page load short.
MAX_NEW_LOOKUPS_PER_REQUEST = 5
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


def furthest_gigs(db: Session, user_id: int) -> dict[str, Any]:
    """The five headline gigs furthest from the user's home city.

    Venues are looked up at most a few at a time; gigs whose venue is still unknown are counted
    as pending and fill in on the next visit.
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
    queries = {gig.id: _venue_query(gig.venue_name, gig.city, gig.country) for gig in gigs}
    points: dict[str, tuple[float, float] | None] = {}
    new_lookups = 0
    map_unavailable = False
    for query in dict.fromkeys(queries.values()):
        known, point = find_cached(db, query)
        if known:
            points[query] = point
            continue
        if map_unavailable or new_lookups >= MAX_NEW_LOOKUPS_PER_REQUEST:
            continue
        new_lookups += 1
        try:
            points[query] = locate(db, query)
        except GeocodingUnavailableError:
            map_unavailable = True

    distances = []
    pending = 0
    for gig in gigs:
        query = queries[gig.id]
        if query not in points:
            pending += 1
            continue
        point = points[query]
        if point is None:
            continue
        distances.append((haversine_km(home, point), gig))

    distances.sort(key=lambda item: item[0], reverse=True)
    return {
        "home_set": True,
        "located_gigs": len(distances),
        "pending_gigs": pending,
        "furthest": [
            {
                "id": gig.id,
                "artist_name": gig.artist_name,
                "venue_name": gig.venue_name,
                "city": gig.city,
                "country": gig.country,
                "date": gig.event_date.strftime("%d %b %Y") if gig.event_date else "",
                "event_date": gig.event_date.isoformat() if gig.event_date else None,
                "distance_km": round(distance),
            }
            for distance, gig in distances[:FURTHEST_LIMIT]
        ],
    }
