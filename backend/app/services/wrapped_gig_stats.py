"""Gig numbers for a person's Wrapped.

A night is one date at one venue, so a headliner plus support acts is one night. Distances are
as the crow flies, home to venue and back, from places the worker has already set on the map.
Private notes are never read.
"""

from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..datetime_utils import utc_now
from ..models import AttendedConcert, UserPreferences
from .gig_distance_service import haversine_km, place_venue

MILES_PER_KM = 0.621371


def _night_key(row: Any) -> tuple[date, str]:
    return row.event_date.date(), row.venue_name.strip().casefold()


def build_gig_stats(db: Session, user_id: int, year: int, today: date | None = None) -> dict[str, Any] | None:
    """The gig half of a Wrapped, or None when the person has no gig night in the year."""
    today = today or utc_now().date()
    rows = db.execute(
        select(
            AttendedConcert.artist_name,
            AttendedConcert.venue_name,
            AttendedConcert.city,
            AttendedConcert.country,
            AttendedConcert.event_date,
            AttendedConcert.is_support_act,
            AttendedConcert.is_festival,
            AttendedConcert.festival_name,
            AttendedConcert.song_count,
        ).where(AttendedConcert.user_id == user_id)
    ).all()

    in_year = [r for r in rows if r.event_date.year == year and r.event_date.date() <= today]
    if not in_year:
        return None
    earlier_venues = {r.venue_name.strip().casefold() for r in rows if r.event_date.year < year}

    nights: dict[tuple[date, str], list[Any]] = {}
    for row in in_year:
        nights.setdefault(_night_key(row), []).append(row)

    venues = {key[1] for key in nights}
    night_dates = sorted(key[0] for key in nights)
    month_counts: Counter[int] = Counter(key[0].month for key in nights)
    busiest_month = min(month_counts, key=lambda m: (-month_counts[m], m))

    headliner_nights: Counter[str] = Counter()
    display_names: dict[str, str] = {}
    for group in nights.values():
        for artist in {r.artist_name.casefold() for r in group if not r.is_support_act}:
            headliner_nights[artist] += 1
        for r in group:
            display_names.setdefault(r.artist_name.casefold(), r.artist_name)
    most_seen = None
    if headliner_nights:
        top_key = min(headliner_nights, key=lambda k: (-headliner_nights[k], k))
        if headliner_nights[top_key] >= 2:  # seeing everyone once isn't a favourite
            most_seen = {"artist": display_names[top_key], "times": headliner_nights[top_key]}

    gig_entries = _gig_list(nights)
    gaps = [(b - a).days for a, b in zip(night_dates, night_dates[1:])]

    return {
        "nights": len(nights),
        "artists": len({r.artist_name.casefold() for r in in_year}),
        "venues": len(venues),
        "new_venues": len(venues - earlier_venues),
        "festival_nights": sum(1 for group in nights.values() if any(r.is_festival for r in group)),
        "miles": _miles(db, user_id, nights),
        "months_with_gigs": sorted(month_counts),
        "busiest_month": {"month": busiest_month, "nights": month_counts[busiest_month]},
        "most_seen": most_seen,
        "first_night": night_dates[0].isoformat(),
        "last_night": night_dates[-1].isoformat(),
        "longest_gap_days": max(gaps) if gaps else None,
        "songs_heard_live": sum(r.song_count or 0 for r in in_year),
        "gig_list": gig_entries[:GIG_LIST_LIMIT],
        "gig_list_total": len(gig_entries),
    }


GIG_LIST_LIMIT = 18


def _gig_list(nights: dict[tuple[date, str], list[Any]]) -> list[dict[str, Any]]:
    """The gigs to list, in date order. A named festival is ONE entry however many acts, stages or days it had
    (just its title, the first and last day, and the city). Anything else is one entry per night, headliner
    first. Only artist, venue, city and festival title are included, never notes. The caller caps the list."""
    entries: list[dict[str, Any]] = []
    festivals: dict[str, dict[str, Any]] = {}
    for (night, _venue), group in sorted(nights.items(), key=lambda item: item[0]):
        title = next((r.festival_name.strip() for r in group if r.is_festival and r.festival_name), None)
        if title:
            key = title.casefold()
            if key in festivals:
                festivals[key]["end_date"] = night.isoformat()
                continue
            entry = {
                "date": night.isoformat(),
                "end_date": None,
                "artist": title,
                "venue": None,
                "city": group[0].city,
                "festival": title,
            }
            festivals[key] = entry
            entries.append(entry)
            continue
        lead = next((r for r in group if not r.is_support_act), group[0])
        entries.append(
            {
                "date": night.isoformat(),
                "end_date": None,
                "artist": lead.artist_name,
                "venue": lead.venue_name,
                "city": lead.city,
                "festival": None,
            }
        )
    return entries


def _miles(db: Session, user_id: int, nights: dict[tuple[date, str], list[Any]]) -> dict[str, Any] | None:
    preferences = db.execute(select(UserPreferences).where(UserPreferences.user_id == user_id)).scalars().first()
    if preferences is None or preferences.home_lat is None or preferences.home_lng is None:
        return None
    home = (preferences.home_lat, preferences.home_lng)

    total_miles = 0.0
    left_out = by_city = 0
    furthest: dict[str, Any] | None = None
    place_cache: dict[str, tuple[bool, tuple[float, float] | None, bool]] = {}
    for key, group in nights.items():
        sample = group[0]
        if key[1] not in place_cache:
            place_cache[key[1]] = place_venue(db, sample.venue_name, sample.city, sample.country)
        known, point, approximate = place_cache[key[1]]
        if not known or point is None:
            left_out += 1
            continue
        one_way = haversine_km(home, point) * MILES_PER_KM
        total_miles += 2 * one_way
        by_city += 1 if approximate else 0
        if furthest is None or one_way > furthest["miles"]:
            furthest = {"venue": sample.venue_name, "city": sample.city, "miles": one_way}

    if furthest is not None:
        furthest["miles"] = round(furthest["miles"])
    return {"total": round(total_miles), "furthest": furthest, "left_out": left_out, "by_city": by_city}
