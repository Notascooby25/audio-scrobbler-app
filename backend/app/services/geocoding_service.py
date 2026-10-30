from __future__ import annotations

import hashlib
import logging
import threading
import time
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from ..models import GeoCache

logger = logging.getLogger(__name__)

# OpenStreetMap's Nominatim. Its usage policy asks for an identifying User-Agent and at most one request a second.
GEOCODE_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "AudioScrobblerApp/0.28 (personal listening stats; https://github.com/Notascooby25/audio-scrobbler-app)"
MIN_SECONDS_BETWEEN_REQUESTS = 1.0
FOUND_TTL = timedelta(days=90)
MISS_TTL = timedelta(hours=1)

_throttle_lock = threading.Lock()
_last_request_at = [0.0]


class GeocodingUnavailableError(RuntimeError):
    """The map service couldn't be reached. Nothing was cached, so the lookup can be retried."""


def _wait_for_turn() -> None:
    with _throttle_lock:
        wait = MIN_SECONDS_BETWEEN_REQUESTS - (time.monotonic() - _last_request_at[0])
        if wait > 0:
            time.sleep(wait)
        _last_request_at[0] = time.monotonic()


def cache_key(query: str) -> str:
    """Fixed-length key: venue, city and country together can be longer than the key column."""
    normalised = " ".join(query.split()).casefold()
    return f"geo:{hashlib.sha256(normalised.encode()).hexdigest()}"


def find_cached(db: Session, query: str) -> tuple[bool, tuple[float, float] | None]:
    """(True, point) for a place already looked up, (True, None) for one the map didn't know,
    and (False, None) when it hasn't been looked up or the answer has expired."""
    cached = (
        db.query(GeoCache)
        .filter(GeoCache.cache_key == cache_key(query), GeoCache.expires_at > datetime.utcnow())
        .first()
    )
    if cached is None:
        return False, None
    if cached.lat is None or cached.lng is None:
        return True, None
    return True, (cached.lat, cached.lng)


def locate(db: Session, query: str) -> tuple[float, float] | None:
    """Latitude and longitude for a place name, from the cache when possible.

    Makes a map request (at most one a second) only when the place isn't cached.
    """
    known, point = find_cached(db, query)
    if known:
        return point

    _wait_for_turn()
    try:
        response = httpx.get(
            GEOCODE_URL,
            params={"q": " ".join(query.split()), "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=5.0,
        )
        response.raise_for_status()
        results = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Map lookup failed: %s", exc)
        raise GeocodingUnavailableError("The map service is unavailable right now.") from exc

    point = None
    if isinstance(results, list) and results and isinstance(results[0], dict):
        try:
            point = (float(results[0]["lat"]), float(results[0]["lon"]))
        except (KeyError, TypeError, ValueError):
            point = None

    expires_at = datetime.utcnow() + (FOUND_TTL if point else MISS_TTL)
    db.merge(
        GeoCache(
            cache_key=cache_key(query),
            lat=point[0] if point else None,
            lng=point[1] if point else None,
            expires_at=expires_at,
        )
    )
    db.commit()
    return point
