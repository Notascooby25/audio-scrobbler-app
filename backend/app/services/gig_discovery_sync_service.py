from __future__ import annotations

import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

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

logger = logging.getLogger(__name__)

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


def sanitize_external_url(url: str | None) -> str | None:
    """Allow only http/https external URLs; drop javascript:, data:, or malformed strings."""
    if not url or not isinstance(url, str):
        return None
    cleaned = url.strip()
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
        return None
    return cleaned[:512]


def normalize_artist_key(name: str | None) -> str:
    return (name or "").strip().lower()


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


def get_user_discovery_artists(
    db: Session,
    user_id: int,
    filters: dict[str, Any] | None = None,
) -> set[str]:
    """Return normalized artist keys matching the user's configured 'My Artists' criteria."""
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
    else:
        stmt = stmt.order_by(func.count(ListeningEvent.id).desc()).limit(limit)

    artists: set[str] = set()
    for row in db.execute(stmt).all():
        key = normalize_artist_key(row.artist_key)
        if key and key not in blocked:
            artists.add(key)

    if include_seen_live:
        seen_rows = db.scalars(
            select(AttendedConcert.artist_name).where(AttendedConcert.user_id == user_id)
        ).all()
        for name in seen_rows:
            key = normalize_artist_key(name)
            if key and key not in blocked:
                artists.add(key)

    return artists


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


def _upsert_events(db: Session, raw_events: list[dict[str, Any]], now: datetime) -> int:
    upserted = 0
    for raw in raw_events:
        parsed = _parse_ticketmaster_event(raw)
        if not parsed:
            continue
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


def sync_discovered_gigs(db: Session, user_id: int | None = None) -> dict[str, int]:
    """Sweep Ticketmaster for active users' artists and home locations, caching results in DB."""
    client = TicketmasterClient()
    if not client.api_key:
        return {"configured": 0, "upserted": 0, "pruned": 0, "artist_queries": 0, "local_queries": 0}

    now = utc_now()
    cutoff_date = date.today() - timedelta(days=1)
    pruned_result = db.execute(delete(DiscoveredGig).where(DiscoveredGig.event_date < cutoff_date))
    pruned = int(pruned_result.rowcount or 0)

    user_stmt = select(User).where(User.is_active.is_(True))
    if user_id is not None:
        user_stmt = user_stmt.where(User.id == user_id)
    users = db.scalars(user_stmt).all()

    artist_display_names: dict[str, str] = {}
    local_targets: list[tuple[float, float, int]] = []

    for user in users:
        prefs = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
        filters = merge_discovery_filters(prefs.gig_discovery_filters if prefs else None)
        artist_keys = get_user_discovery_artists(db, user.id, filters)
        for key in artist_keys:
            if key not in artist_display_names:
                artist_display_names[key] = key

        if prefs and prefs.home_lat is not None and prefs.home_lng is not None:
            radius = max(int(prefs.local_gig_radius_miles or 10), 25)
            local_targets.append((prefs.home_lat, prefs.home_lng, min(radius, 100)))

    start_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    upserted = 0
    artist_queries = 0
    local_queries = 0

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

    db.commit()
    return {
        "configured": 1,
        "upserted": upserted,
        "pruned": pruned,
        "artist_queries": artist_queries,
        "local_queries": local_queries,
    }
