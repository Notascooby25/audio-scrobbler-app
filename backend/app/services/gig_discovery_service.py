from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..datetime_utils import utc_now
from ..models import (
    AttendedConcert,
    DiscoveredGig,
    DiscoveredGigInterest,
    UserPreferences,
)
from .gig_discovery_sync_service import (
    configured_sources,
    get_blocked_artist_keys,
    get_user_discovery_artists,
    merge_discovery_filters,
)
from .gig_discovery_text import canonical_artist_key, match_key

logger = logging.getLogger(__name__)

_EARTH_RADIUS_MILES = 3958.7613


def haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_MILES * math.asin(min(1.0, math.sqrt(h)))


def _is_discovery_configured() -> bool:
    return bool(configured_sources())


_MIN_TITLE_MATCH_LENGTH = 4


def _loose(text: str | None) -> str:
    """Spelling-insensitive key (see match_key): 'DMA\u2019s', "DMA's" and 'DMAs' are all the same."""
    return match_key(text)


def _attendance_matches(gig_keys: list[str], title: str, title_only: bool, attended_key: str) -> bool:
    """Is a gig you logged the same show as this discovered one? (Callers already know the date matches.)"""
    if not attended_key:
        return False
    if attended_key in gig_keys:
        return True
    # Listings with no artist list name their bands only in the title: look for the artist there.
    if not title_only or len(attended_key) < _MIN_TITLE_MATCH_LENGTH or "tribute" in title.split():
        return False
    return f" {attended_key} " in f" {title} "


def _is_title_only_listing(gig: DiscoveredGig) -> bool:
    """Skiddle listings with no artist list: the only 'artist' we hold is the event title itself."""
    if gig.source != "skiddle":
        return False
    keys = gig.attraction_keys or []
    return len(keys) <= 1 and canonical_artist_key(gig.artist_name) == canonical_artist_key(gig.event_name)


def _possible_title_match(gig: DiscoveredGig, my_artists_loose: set[str]) -> bool:
    """True when one of your artists appears, as whole words, in a title-only listing."""
    if not my_artists_loose or not _is_title_only_listing(gig):
        return False
    title = _loose(gig.event_name)
    if "tribute" in title.split():
        return False
    padded = f" {title} "
    return any(f" {artist} " in padded for artist in my_artists_loose)


def _weekend_bounds(today: date) -> tuple[date, date]:
    """Return (start_date, end_date) for the current/upcoming Fri-Sun weekend."""
    wd = today.weekday()  # Mon=0 .. Sat=5, Sun=6
    if wd == 5:  # Saturday -> Sat..Sun
        return today, today + timedelta(days=1)
    if wd == 6:  # Sunday -> Sun..Sun
        return today, today
    # Mon..Fri -> upcoming Fri..Sun
    friday = today + timedelta(days=(4 - wd))
    return friday, friday + timedelta(days=2)


def _is_newly_announced(gig: DiscoveredGig, now: datetime) -> bool:
    if gig.onsale_start_at is not None:
        if now - timedelta(days=14) <= gig.onsale_start_at <= now + timedelta(days=7):
            return True
    if gig.first_seen_at is not None and gig.first_seen_at >= now - timedelta(days=7):
        return True
    return False


def trigger_worker_discovery_sync(user_id: int | None = None) -> None:
    """Fire-and-forget trigger to the worker so location/radius changes populate promptly."""
    # Use the app's settings (which default to the worker's address inside the compose network):
    # the production compose file does not pass INGESTION_WORKER_URL, so reading the raw
    # environment variable meant saving settings never triggered a sync there.
    worker_url = (settings.ingestion_worker_url or "").strip().rstrip("/")
    token = (settings.worker_ingestion_token or "").strip()
    if not worker_url or not token or not _is_discovery_configured():
        return
    try:
        payload = {"user_id": user_id} if user_id is not None else {}
        with httpx.Client(timeout=2.0) as client:
            client.post(
                f"{worker_url}/internal/trigger-gig-discovery",
                json=payload,
                headers={"X-Worker-Token": token},
            )
    except Exception as exc:
        logger.debug("Non-fatal worker discovery trigger skip: %s", exc)


def query_discovered_gigs(
    db: Session,
    user_id: int,
    *,
    scope: str | None = None,
    only_my_artists: bool | None = None,
    radius_miles: int | None = None,
    date_window: str | None = None,
    country: str | None = None,
) -> dict[str, Any]:
    prefs = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user_id))
    saved_radius = int(prefs.local_gig_radius_miles if prefs and prefs.local_gig_radius_miles else 10)
    saved_filters = merge_discovery_filters(prefs.gig_discovery_filters if prefs else None)
    has_home_city = bool(prefs and prefs.home_lat is not None and prefs.home_lng is not None)
    home_point = (prefs.home_lat, prefs.home_lng) if has_home_city and prefs else None

    effective_scope = scope or str(saved_filters.get("scope") or "my_artists")
    effective_only_my_artists = (
        bool(only_my_artists)
        if only_my_artists is not None
        else bool(saved_filters.get("local_only_my_artists", False))
    )
    effective_radius = max(1, min(100, int(radius_miles if radius_miles is not None else saved_radius)))
    effective_window = date_window or str(saved_filters.get("date_window") or "all")
    effective_country = (
        country.strip().upper() if country is not None else str(saved_filters.get("country_code") or "").strip().upper()
    )

    configured = _is_discovery_configured()
    if not configured:
        return {
            "configured": False,
            "has_home_city": has_home_city,
            "home_city": prefs.home_city if prefs else None,
            "saved_radius_miles": saved_radius,
            "saved_filters": saved_filters,
            "countries": [],
            "items": [],
        }

    today = date.today()
    now = utc_now()
    my_artists = {k for k in (match_key(a) for a in get_user_discovery_artists(db, user_id, saved_filters)) if k}
    blocked = {k for k in (match_key(b) for b in get_blocked_artist_keys(db, user_id)) if k}
    my_artists_loose = {
        loose for loose in (_loose(a) for a in my_artists if a not in blocked) if len(loose) >= _MIN_TITLE_MATCH_LENGTH
    }

    interested_ids = set(
        db.scalars(
            select(DiscoveredGigInterest.discovered_gig_id).where(DiscoveredGigInterest.user_id == user_id)
        ).all()
    )

    attended_rows = db.execute(
        select(
            AttendedConcert.id,
            AttendedConcert.artist_name,
            AttendedConcert.event_date,
        ).where(AttendedConcert.user_id == user_id)
    ).all()
    attended_by_date: dict[date, list[tuple[str, int]]] = {}
    seen_live_keys: set[str] = set()
    for row in attended_rows:
        akey = match_key(row.artist_name)
        if akey:
            seen_live_keys.add(akey)
            if row.event_date:
                attended_by_date.setdefault(row.event_date.date(), []).append((akey, row.id))

    stmt = (
        select(DiscoveredGig)
        .where(DiscoveredGig.event_date >= today, DiscoveredGig.is_cancelled.is_(False))
        .order_by(DiscoveredGig.event_date.asc(), DiscoveredGig.event_name.asc())
    )
    all_upcoming = db.scalars(stmt).all()

    available_countries = sorted({g.country_code for g in all_upcoming if g.country_code})
    weekend_start, weekend_end = _weekend_bounds(today)

    items: list[dict[str, Any]] = []
    for gig in all_upcoming:
        gig_keys = [match_key(k) for k in (gig.attraction_keys or []) if k]
        artist_key = match_key(gig.artist_key)
        if artist_key and artist_key not in gig_keys:
            gig_keys.insert(0, artist_key)

        if any(k in blocked for k in gig_keys) and not any(k in my_artists for k in gig_keys if k not in blocked):
            continue

        exact_match = any(k in my_artists and k not in blocked for k in gig_keys)
        possible_match = not exact_match and _possible_title_match(gig, my_artists_loose)
        is_my_artist = exact_match or possible_match
        is_seen_live = any(k in seen_live_keys for k in gig_keys)
        is_interested = gig.id in interested_ids
        is_newly = _is_newly_announced(gig, now)

        distance_miles: float | None = None
        if home_point is not None and gig.lat is not None and gig.lng is not None:
            distance_miles = round(haversine_miles(home_point, (gig.lat, gig.lng)), 1)

        if effective_window == "interested":
            if not is_interested:
                continue
        else:
            if effective_scope == "local":
                if not has_home_city:
                    continue
                if distance_miles is None or distance_miles > effective_radius:
                    continue
                if effective_only_my_artists and not is_my_artist:
                    continue
            else:
                if not is_my_artist:
                    continue
                if effective_country and gig.country_code.upper() != effective_country:
                    continue

            if effective_window == "weekend":
                if not (weekend_start <= gig.event_date <= weekend_end):
                    continue
            elif effective_window == "7d":
                if gig.event_date > today + timedelta(days=7):
                    continue
            elif effective_window == "30d":
                if gig.event_date > today + timedelta(days=30):
                    continue
            elif effective_window == "newly_announced":
                if not is_newly:
                    continue

        already_concert_id = None
        title = _loose(gig.event_name)
        title_only = _is_title_only_listing(gig)
        for attended_key, concert_id in attended_by_date.get(gig.event_date, []):
            if _attendance_matches(gig_keys, title, title_only, attended_key):
                already_concert_id = concert_id
                break

        items.append(
            {
                "id": gig.id,
                "source": gig.source,
                "external_id": gig.external_id,
                "artist_name": gig.artist_name,
                "attraction_names": gig.attraction_names or [gig.artist_name],
                "event_name": gig.event_name,
                "venue_name": gig.venue_name,
                "city": gig.city,
                "country_code": gig.country_code,
                "event_date": gig.event_date.isoformat(),
                "event_time": gig.event_time,
                "ticket_url": gig.ticket_url,
                "image_url": gig.image_url,
                "distance_miles": distance_miles,
                "is_my_artist": is_my_artist,
                "is_possible_match": possible_match,
                "is_seen_live": is_seen_live,
                "is_newly_announced": is_newly,
                "is_interested": is_interested,
                "already_going": already_concert_id is not None,
                "concert_id": already_concert_id,
            }
        )

    return {
        "configured": True,
        "has_home_city": has_home_city,
        "home_city": prefs.home_city if prefs else None,
        "saved_radius_miles": saved_radius,
        "saved_filters": saved_filters,
        "countries": available_countries,
        "items": items,
    }


def set_gig_interest(db: Session, user_id: int, gig_id: int, interested: bool) -> bool:
    gig = db.scalar(select(DiscoveredGig).where(DiscoveredGig.id == gig_id))
    if gig is None:
        raise ValueError("Discovered gig not found")

    if interested:
        existing = db.scalar(
            select(DiscoveredGigInterest).where(
                DiscoveredGigInterest.user_id == user_id,
                DiscoveredGigInterest.discovered_gig_id == gig_id,
            )
        )
        if existing is None:
            db.add(DiscoveredGigInterest(user_id=user_id, discovered_gig_id=gig_id))
            db.commit()
        return True

    db.execute(
        delete(DiscoveredGigInterest).where(
            DiscoveredGigInterest.user_id == user_id,
            DiscoveredGigInterest.discovered_gig_id == gig_id,
        )
    )
    db.commit()
    return False


def attend_discovered_gig(db: Session, user_id: int, gig_id: int) -> AttendedConcert:
    gig = db.scalar(select(DiscoveredGig).where(DiscoveredGig.id == gig_id))
    if gig is None:
        raise ValueError("Discovered gig not found")

    setlist_id = f"discover-{gig.source}-{gig.external_id}"[:64]
    existing = db.scalar(
        select(AttendedConcert).where(
            AttendedConcert.user_id == user_id,
            AttendedConcert.setlist_id == setlist_id,
        )
    )
    if existing is not None:
        return existing

    # The same show may already be logged (from Setlist.fm or by hand) under a different spelling.
    day_start = datetime.combine(gig.event_date, datetime.min.time())
    logged_that_day = db.scalars(
        select(AttendedConcert).where(
            AttendedConcert.user_id == user_id,
            AttendedConcert.event_date >= day_start,
            AttendedConcert.event_date < day_start + timedelta(days=1),
        )
    ).all()
    gig_keys = [k for k in (match_key(x) for x in [*(gig.attraction_keys or []), gig.artist_key]) if k]
    title = _loose(gig.event_name)
    title_only = _is_title_only_listing(gig)
    for logged in logged_that_day:
        if _attendance_matches(gig_keys, title, title_only, match_key(logged.artist_name)):
            return logged

    concert = AttendedConcert(
        user_id=user_id,
        setlist_id=setlist_id,
        artist_name=gig.artist_name,
        venue_name=gig.venue_name or "TBA",
        city=gig.city or "",
        country=gig.country_code or "",
        event_date=datetime.combine(gig.event_date, datetime.min.time()),
        tour_name=gig.event_name if gig.event_name != gig.artist_name else None,
        setlist_url=gig.ticket_url,
    )
    db.add(concert)
    db.commit()
    db.refresh(concert)
    return concert
