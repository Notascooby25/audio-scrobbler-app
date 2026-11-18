from __future__ import annotations

import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..datetime_utils import utc_now
from ..models import (
    AttendedConcert,
    BlockedItem,
    DiscoveredGig,
    ListeningEvent,
    User,
    UserPreferences,
)

from .gig_discovery_text import normalize_artist_key, sanitize_external_url
from .skiddle_service import SkiddleClient, parse_skiddle_event

logger = logging.getLogger(__name__)

# Skiddle sweeps. Fewer, wider requests: one geo search per home location, and the UK-wide
# list is read in date windows so far-off gigs are covered too (days from today: start, end).
SKIDDLE_LOCAL_MIN_RADIUS_MILES = 25
SKIDDLE_LOCAL_MAX_PAGES = 3
SKIDDLE_UK_WINDOW_DAYS = ((0, 30), (30, 90), (90, 180), (180, 365))
SKIDDLE_UK_MAX_PAGES_PER_WINDOW = 2
# Plus one name search per favourite artist (their gigs anywhere, which the capped UK pages can miss).
SKIDDLE_ARTISTS_PER_USER = 30
SKIDDLE_ARTIST_SEARCH_CAP = 60

TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2"
MIN_INTERVAL_SECONDS = 0.35  # <= ~3 req/sec (under Ticketmaster's 5 req/sec limit)
MAX_ARTISTS_PER_SYNC = 150
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

DEFAULT_DISCOVERY_FILTERS: dict[str, Any] = {
    "scope": "my_artists",
    "local_only_my_artists": False,
    "date_window": "all",
    "country_code": "",
    "my_artists_mode": "top_n",
    "my_artists_limit": 100,
    "my_artists_min_plays": 5,
    "my_artists_months": 12,
    "include_seen_live": True,
}


def encode_geohash(lat: float, lng: float, precision: int = 7) -> str:
    """Encode latitude/longitude into a standard base32 geohash for Ticketmaster geoPoint."""
    lat_interval = [-90.0, 90.0]
    lng_interval = [-180.0, 180.0]
    geohash: list[str] = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True

    while len(geohash) < precision:
        if even:
            mid = (lng_interval[0] + lng_interval[1]) / 2.0
            if lng >= mid:
                ch |= bits[bit]
                lng_interval[0] = mid
            else:
                lng_interval[1] = mid
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2.0
            if lat >= mid:
                ch |= bits[bit]
                lat_interval[0] = mid
            else:
                lat_interval[1] = mid
        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(_BASE32[ch])
            bit = 0
            ch = 0
    return "".join(geohash)


def configured_sources() -> list[str]:
    """Names of the discovery sources that currently have an API key."""
    sources: list[str] = []
    if os.getenv("TICKETMASTER_API_KEY", "").strip("'\" \r\n"):
        sources.append("ticketmaster")
    if os.getenv("SKIDDLE_API_KEY", "").strip("'\" \r\n"):
        sources.append("skiddle")
    return sources


def merge_discovery_filters(raw: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(DEFAULT_DISCOVERY_FILTERS)
    if isinstance(raw, dict):
        for key in DEFAULT_DISCOVERY_FILTERS:
            if key in raw and raw[key] is not None:
                merged[key] = raw[key]
    return merged


def get_blocked_artist_keys(db: Session, user_id: int) -> set[str]:
    rows = db.scalars(
        select(BlockedItem.name).where(
            BlockedItem.user_id == user_id,
            BlockedItem.entity_type == "artist",
        )
    ).all()
    return {normalize_artist_key(name) for name in rows if normalize_artist_key(name)}


def get_user_ranked_artist_keys(
    db: Session,
    user_id: int,
    filters: dict[str, Any] | None = None,
) -> list[str]:
    """Artist keys matching the user's 'My Artists' criteria: most played first, then seen-live."""
    cfg = merge_discovery_filters(filters)
    blocked = get_blocked_artist_keys(db, user_id)

    months = max(0, min(120, int(cfg.get("my_artists_months") or 0)))
    mode = str(cfg.get("my_artists_mode") or "top_n")
    limit = max(1, min(500, int(cfg.get("my_artists_limit") or 100)))
    min_plays = max(1, min(500, int(cfg.get("my_artists_min_plays") or 5)))
    include_seen_live = bool(cfg.get("include_seen_live", True))

    stmt = select(
        func.lower(func.trim(ListeningEvent.artist_name)).label("artist_key"),
        func.count(ListeningEvent.id).label("play_count"),
    ).where(ListeningEvent.user_id == user_id)

    if months > 0:
        cutoff = utc_now() - timedelta(days=months * 30)
        stmt = stmt.where(ListeningEvent.played_at >= cutoff)
    if blocked:
        stmt = stmt.where(~func.lower(func.trim(ListeningEvent.artist_name)).in_(blocked))

    stmt = stmt.group_by(func.lower(func.trim(ListeningEvent.artist_name)))
    if mode == "min_plays":
        stmt = stmt.having(func.count(ListeningEvent.id) >= min_plays)
        stmt = stmt.order_by(func.count(ListeningEvent.id).desc())
    else:
        stmt = stmt.order_by(func.count(ListeningEvent.id).desc()).limit(limit)

    artists: list[str] = []
    for row in db.execute(stmt).all():
        key = normalize_artist_key(row.artist_key)
        if key and key not in blocked and key not in artists:
            artists.append(key)

    if include_seen_live:
        seen_rows = db.scalars(select(AttendedConcert.artist_name).where(AttendedConcert.user_id == user_id)).all()
        for name in seen_rows:
            key = normalize_artist_key(name)
            if key and key not in blocked and key not in artists:
                artists.append(key)

    return artists


def get_user_discovery_artists(
    db: Session,
    user_id: int,
    filters: dict[str, Any] | None = None,
) -> set[str]:
    """Return normalized artist keys matching the user's configured 'My Artists' criteria."""
    return set(get_user_ranked_artist_keys(db, user_id, filters))


class TicketmasterClient:
    """Thin throttled client for Ticketmaster Discovery API v2."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = (api_key if api_key is not None else os.getenv("TICKETMASTER_API_KEY", "")).strip("'\" \r\n")
        self._last_request_at = 0.0
        self.rate_limited = False

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < MIN_INTERVAL_SECONDS:
            time.sleep(MIN_INTERVAL_SECONDS - elapsed)
        self._last_request_at = time.monotonic()

    def search_events(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        if not self.api_key or self.rate_limited:
            return []
        query = {
            "apikey": self.api_key,
            "classificationName": "music",
            "sort": "date,asc",
            "size": 50,
            **params,
        }
        for attempt in range(2):
            self._throttle()
            try:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.get(f"{TICKETMASTER_BASE_URL}/events.json", params=query)
                if resp.status_code == 429:
                    raw_retry = resp.headers.get("Retry-After", "2")
                    try:
                        retry_after = float(raw_retry)
                    except (TypeError, ValueError):
                        retry_after = 2.0
                    if attempt == 0:
                        time.sleep(max(0.5, min(retry_after, 10.0)))
                        continue
                    self.rate_limited = True
                    logger.warning("Ticketmaster API rate limited (429); stopping sync sweep")
                    return []
                if resp.status_code in (401, 403):
                    logger.warning("Ticketmaster API auth error (%s)", resp.status_code)
                    return []
                resp.raise_for_status()
                data = resp.json()
                return list((data.get("_embedded") or {}).get("events") or [])
            except httpx.HTTPStatusError as exc:
                logger.warning("Ticketmaster HTTP error (%s)", exc.response.status_code)
                return []
            except httpx.HTTPError as exc:
                # Never log exc directly — httpx exceptions can include the ?apikey= query param
                logger.warning("Ticketmaster request failed (%s)", type(exc).__name__)
                return []
        return []


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        cleaned = value.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


def _parse_ticketmaster_event(event: dict[str, Any]) -> dict[str, Any] | None:
    external_id = str(event.get("id") or "").strip()
    if not external_id:
        return None

    dates_start = (event.get("dates") or {}).get("start") or {}
    local_date_str = dates_start.get("localDate")
    if not local_date_str:
        return None
    try:
        event_date = date.fromisoformat(str(local_date_str)[:10])
    except ValueError:
        return None

    local_time = dates_start.get("localTime")
    event_time = str(local_time)[:5] if local_time else None

    embedded = event.get("_embedded") or {}
    attractions = embedded.get("attractions") or []
    attraction_names: list[str] = []
    attraction_keys: list[str] = []
    for attr in attractions:
        name = str((attr or {}).get("name") or "").strip()
        key = normalize_artist_key(name)
        if name and key and key not in attraction_keys:
            attraction_names.append(name[:255])
            attraction_keys.append(key[:255])

    event_name = str(event.get("name") or "").strip()[:255] or "Live Event"
    primary_artist = attraction_names[0] if attraction_names else event_name
    primary_key = attraction_keys[0] if attraction_keys else normalize_artist_key(primary_artist)
    if not attraction_names:
        attraction_names = [primary_artist]
        attraction_keys = [primary_key]

    venues = embedded.get("venues") or []
    venue = venues[0] if venues else {}
    venue_name = str(venue.get("name") or "").strip()[:255]
    city = str((venue.get("city") or {}).get("name") or "").strip()[:128]
    country_code = str((venue.get("country") or {}).get("countryCode") or "").strip().upper()[:8]

    loc = venue.get("location") or {}
    lat = None
    lng = None
    try:
        if loc.get("latitude") is not None and loc.get("longitude") is not None:
            lat = float(loc["latitude"])
            lng = float(loc["longitude"])
    except (TypeError, ValueError):
        lat = None
        lng = None

    onsale_raw = ((event.get("sales") or {}).get("public") or {}).get("startDateTime")
    onsale_start_at = _parse_iso_datetime(onsale_raw)

    status_code = str(((event.get("dates") or {}).get("status") or {}).get("code") or "").lower()
    is_cancelled = status_code in ("cancelled", "canceled")

    images = event.get("images") or []
    image_url = None
    if images:
        best = max(images, key=lambda img: int((img or {}).get("width") or 0))
        image_url = sanitize_external_url((best or {}).get("url"))

    return {
        "source": "ticketmaster",
        "external_id": external_id[:128],
        "artist_name": primary_artist[:255],
        "artist_key": primary_key[:255],
        "attraction_names": attraction_names,
        "attraction_keys": attraction_keys,
        "event_name": event_name,
        "venue_name": venue_name,
        "city": city,
        "country_code": country_code,
        "lat": lat,
        "lng": lng,
        "event_date": event_date,
        "event_time": event_time,
        "onsale_start_at": onsale_start_at,
        "ticket_url": sanitize_external_url(event.get("url")),
        "image_url": image_url,
        "is_cancelled": is_cancelled,
    }


def _upsert_parsed(db: Session, parsed_events: list[dict[str, Any]], now: datetime) -> int:
    upserted = 0
    for parsed in parsed_events:
        existing = db.scalar(
            select(DiscoveredGig).where(
                DiscoveredGig.source == parsed["source"],
                DiscoveredGig.external_id == parsed["external_id"],
            )
        )
        if existing is None:
            db.add(
                DiscoveredGig(
                    **parsed,
                    first_seen_at=now,
                    last_synced_at=now,
                )
            )
        else:
            for key, value in parsed.items():
                setattr(existing, key, value)
            existing.last_synced_at = now
        upserted += 1
    return upserted


def _upsert_events(db: Session, raw_events: list[dict[str, Any]], now: datetime) -> int:
    parsed = [p for p in (_parse_ticketmaster_event(raw) for raw in raw_events) if p]
    return _upsert_parsed(db, parsed, now)


def _upsert_skiddle_events(db: Session, raw_events: list[dict[str, Any]], now: datetime) -> int:
    # Skiddle also returns long-running listings (courses, exhibitions) that started in the past.
    today = date.today()
    parsed = [p for p in (parse_skiddle_event(raw) for raw in raw_events) if p and p["event_date"] >= today]
    return _upsert_parsed(db, parsed, now)


def _merge_ranked_artists(ranked_lists: list[list[str]], cap: int) -> list[str]:
    """Interleave each user's favourites (best first), dropping repeats, up to cap names."""
    merged: list[str] = []
    longest = max((len(r) for r in ranked_lists), default=0)
    for position in range(longest):
        for ranked in ranked_lists:
            if position < len(ranked) and ranked[position] not in merged:
                merged.append(ranked[position])
                if len(merged) >= cap:
                    return merged
    return merged


def _sweep_skiddle(
    db: Session,
    client: SkiddleClient,
    local_targets: list[tuple[float, float, int]],
    artist_keys: list[str],
    include_uk: bool,
    today: date,
    now: datetime,
) -> tuple[int, int]:
    """Run the Skiddle searches. Returns (searches made, events stored)."""
    searches = 0
    upserted = 0

    seen_targets: set[tuple[float, float, int]] = set()
    for lat, lng, radius in local_targets:
        if client.blocked:
            return searches, upserted
        target = (round(lat, 2), round(lng, 2), radius)
        if target in seen_targets:
            continue
        seen_targets.add(target)
        events = client.search_all(
            {
                "latitude": lat,
                "longitude": lng,
                "radius": radius,
                "eventcode": "LIVE",
                "minDate": today.isoformat(),
                "description": 1,
                "order": "distance",
            },
            max_pages=SKIDDLE_LOCAL_MAX_PAGES,
        )
        searches += 1
        upserted += _upsert_skiddle_events(db, events, now)

    for artist_key in artist_keys:
        if client.blocked:
            return searches, upserted
        events = client.search_all(
            {
                "keyword": artist_key,
                "eventcode": "LIVE",
                "minDate": today.isoformat(),
                "description": 1,
            },
            max_pages=1,
        )
        searches += 1
        upserted += _upsert_skiddle_events(db, events, now)

    if include_uk:
        for start_days, end_days in SKIDDLE_UK_WINDOW_DAYS:
            if client.blocked:
                break
            events = client.search_all(
                {
                    "country": "GB",
                    "eventcode": "LIVE",
                    "minDate": (today + timedelta(days=start_days)).isoformat(),
                    "maxDate": (today + timedelta(days=end_days)).isoformat(),
                    "description": 1,
                },
                max_pages=SKIDDLE_UK_MAX_PAGES_PER_WINDOW,
            )
            searches += 1
            upserted += _upsert_skiddle_events(db, events, now)

    return searches, upserted


def sync_discovered_gigs(db: Session, user_id: int | None = None) -> dict[str, int]:
    """Sweep the configured sources (Ticketmaster, Skiddle) and cache results in the database."""
    client = TicketmasterClient()
    skiddle = SkiddleClient()
    stats = {
        "configured": 0,
        "upserted": 0,
        "pruned": 0,
        "artist_queries": 0,
        "local_queries": 0,
        "skiddle_queries": 0,
        "skiddle_upserted": 0,
    }
    if not client.api_key and not skiddle.api_key:
        return stats

    now = utc_now()
    today = date.today()
    cutoff_date = today - timedelta(days=1)
    pruned_result = db.execute(delete(DiscoveredGig).where(DiscoveredGig.event_date < cutoff_date))
    pruned = int(pruned_result.rowcount or 0)

    user_stmt = select(User).where(User.is_active.is_(True))
    if user_id is not None:
        user_stmt = user_stmt.where(User.id == user_id)
    users = db.scalars(user_stmt).all()

    artist_display_names: dict[str, str] = {}
    ranked_by_user: list[list[str]] = []
    local_targets: list[tuple[float, float, int]] = []

    for user in users:
        prefs = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
        filters = merge_discovery_filters(prefs.gig_discovery_filters if prefs else None)
        ranked = get_user_ranked_artist_keys(db, user.id, filters)
        ranked_by_user.append(ranked[:SKIDDLE_ARTISTS_PER_USER])
        for key in ranked:
            if key not in artist_display_names:
                artist_display_names[key] = key

        if prefs and prefs.home_lat is not None and prefs.home_lng is not None:
            radius = max(int(prefs.local_gig_radius_miles or 10), 25)
            local_targets.append((prefs.home_lat, prefs.home_lng, min(radius, 100)))

    start_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    upserted = 0
    artist_queries = 0
    local_queries = 0

    if client.api_key:
        for artist_key in sorted(artist_display_names)[:MAX_ARTISTS_PER_SYNC]:
            if getattr(client, "rate_limited", False):
                break
            events = client.search_events({"keyword": artist_key, "startDateTime": start_iso})
            upserted += _upsert_events(db, events, now)
            artist_queries += 1

        seen_geohashes: set[tuple[str, int]] = set()
        for lat, lng, radius in local_targets:
            if getattr(client, "rate_limited", False):
                break
            gh = encode_geohash(lat, lng, precision=6)
            if (gh, radius) in seen_geohashes:
                continue
            seen_geohashes.add((gh, radius))
            events = client.search_events(
                {
                    "geoPoint": gh,
                    "radius": radius,
                    "unit": "miles",
                    "startDateTime": start_iso,
                    "size": 100,
                }
            )
            upserted += _upsert_events(db, events, now)
            local_queries += 1

    skiddle_queries = 0
    skiddle_upserted = 0
    if skiddle.api_key:
        # The UK-wide list only makes sense for a full sweep, not a single user's refresh.
        include_uk = user_id is None and bool(artist_display_names)
        skiddle_artists = _merge_ranked_artists(ranked_by_user, SKIDDLE_ARTIST_SEARCH_CAP)
        skiddle_queries, skiddle_upserted = _sweep_skiddle(
            db, skiddle, local_targets, skiddle_artists, include_uk, today, now
        )

    db.commit()
    stats.update(
        {
            "configured": 1,
            "upserted": upserted,
            "pruned": pruned,
            "artist_queries": artist_queries,
            "local_queries": local_queries,
            "skiddle_queries": skiddle_queries,
            "skiddle_upserted": skiddle_upserted,
        }
    )
    return stats
