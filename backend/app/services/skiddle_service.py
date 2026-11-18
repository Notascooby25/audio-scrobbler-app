"""Skiddle events API: a polite client and a parser for the discovered_gigs cache.

Follows Skiddle's client guidelines (https://www.skiddle.com/api/join.php#client-guidelines):
a User-Agent naming this app, version and URL on every request, one request at a time with
a pause between them, short timeouts, exponential back-off with jitter, honouring Retry-After,
no retries on 4xx, and the key sent from the server only and never written to a log.
"""

from __future__ import annotations

import logging
import os
import random
import time
from collections.abc import Callable
from datetime import date
from typing import Any

import httpx

from ..config import settings
from .gig_discovery_text import canonical_artist_key, sanitize_external_url

logger = logging.getLogger(__name__)

SKIDDLE_BASE_URL = "https://www.skiddle.com/api/v1"
SKIDDLE_SOURCE = "skiddle"
PAGE_SIZE = 100  # the API maximum
MIN_INTERVAL_SECONDS = 1.0  # one request at a time, with a pause between them
REQUEST_TIMEOUT_SECONDS = 8.0
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 2.0
MAX_RETRY_AFTER_SECONDS = 60.0
DEFAULT_USER_AGENT_URL = "https://github.com/Notascooby25/audio-scrobbler-app"


def build_user_agent() -> str:
    url = os.getenv("SKIDDLE_USER_AGENT_URL", "").strip() or DEFAULT_USER_AGENT_URL
    return f"AudioScrobblerApp/{settings.app_version} ({url})"


class SkiddleClient:
    """Thin, throttled, server-side client for the Skiddle events search API."""

    def __init__(
        self,
        api_key: str | None = None,
        sleep: Callable[[float], None] = time.sleep,
        jitter: Callable[[], float] = lambda: random.uniform(0.0, 1.0),
    ) -> None:
        raw = api_key if api_key is not None else os.getenv("SKIDDLE_API_KEY", "")
        self.api_key = (raw or "").strip("'\" \r\n")
        self.blocked = False  # set once Skiddle refuses us or keeps failing; ends the sweep
        self.backoff_waits: list[float] = []
        self._sleep = sleep
        self._jitter = jitter
        self._last_request_at: float | None = None

    def _throttle(self) -> None:
        if self._last_request_at is not None:
            remaining = MIN_INTERVAL_SECONDS - (time.monotonic() - self._last_request_at)
            if remaining > 0:
                self._sleep(remaining)
        self._last_request_at = time.monotonic()

    def _back_off(self, attempt: int, retry_after: float | None = None) -> None:
        wait = BACKOFF_BASE_SECONDS * (2**attempt) + self._jitter()
        if retry_after is not None:
            wait = max(wait, min(retry_after, MAX_RETRY_AFTER_SECONDS))
        self.backoff_waits.append(wait)
        self._sleep(wait)

    def _fetch(self, params: dict[str, Any]) -> dict[str, Any] | None:
        """One search request with back-off. Returns the decoded body, or None on failure."""
        if not self.api_key or self.blocked:
            return None
        query = {"limit": PAGE_SIZE, **params, "api_key": self.api_key}
        headers = {"User-Agent": build_user_agent(), "Accept": "application/json"}
        url = f"{SKIDDLE_BASE_URL}/events/search/"

        for attempt in range(MAX_ATTEMPTS):
            self._throttle()
            retry_after: float | None = None
            try:
                with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS) as http:
                    resp = http.get(url, params=query, headers=headers)
                status = resp.status_code
                if status in (401, 403):
                    # Never log the exception or URL: both can carry the key.
                    logger.warning("Skiddle API refused the request (%s); stopping sweep", status)
                    self.blocked = True
                    return None
                if status == 429 or status >= 500:
                    raw_retry = resp.headers.get("Retry-After")
                    try:
                        retry_after = float(raw_retry) if raw_retry is not None else None
                    except (TypeError, ValueError):
                        retry_after = None
                    logger.warning("Skiddle API temporary failure (%s)", status)
                elif status >= 400:
                    logger.warning("Skiddle API rejected the request (%s); not retrying", status)
                    return None
                else:
                    try:
                        body = resp.json()
                    except ValueError:
                        logger.warning("Skiddle API returned a non-JSON body")
                        return None
                    if not isinstance(body, dict) or str(body.get("error", 0)) not in ("0", ""):
                        logger.warning("Skiddle API reported an error in the response; not retrying")
                        return None
                    return body
            except httpx.HTTPError as exc:
                # Log the exception type only: httpx messages can include the ?api_key= URL.
                logger.warning("Skiddle request failed (%s)", type(exc).__name__)

            if attempt < MAX_ATTEMPTS - 1:
                self._back_off(attempt, retry_after)

        logger.warning("Skiddle API still failing after %s attempts; stopping sweep", MAX_ATTEMPTS)
        self.blocked = True
        return None

    def search_events(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        body = self._fetch(params)
        return list((body or {}).get("results") or [])

    def search_all(self, params: dict[str, Any], max_pages: int = 3) -> list[dict[str, Any]]:
        """Page through one search (same filters and order each time), up to max_pages requests."""
        collected: list[dict[str, Any]] = []
        for page in range(max(1, max_pages)):
            offset = page * PAGE_SIZE
            body = self._fetch({**params, "limit": PAGE_SIZE, "offset": offset})
            results = list((body or {}).get("results") or [])
            collected.extend(results)
            try:
                total = int((body or {}).get("totalcount") or 0)
            except (TypeError, ValueError):
                total = 0
            if len(results) < PAGE_SIZE or offset + PAGE_SIZE >= total:
                break
        return collected


def _parse_coordinate(value: Any) -> float | None:
    try:
        return float(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def parse_skiddle_event(event: dict[str, Any]) -> dict[str, Any] | None:
    """Map one Skiddle search result onto discovered_gigs columns, or None if unusable."""
    external_id = str(event.get("id") or "").strip()
    if not external_id:
        return None
    try:
        event_date = date.fromisoformat(str(event.get("date") or "")[:10])
    except ValueError:
        return None

    event_time: str | None = None
    start = str(event.get("startdate") or "")
    if len(start) >= 16 and start[10] in ("T", " "):
        event_time = start[11:16]

    event_name = str(event.get("eventname") or "").strip()[:255] or "Live Event"

    names: list[str] = []
    keys: list[str] = []
    for artist in event.get("artists") or []:
        name = str((artist or {}).get("name") or "").strip()
        key = canonical_artist_key(name)
        if name and key and key not in keys:
            names.append(name[:255])
            keys.append(key[:255])
    if not names:
        # Many local shows list their bands only in the event name.
        names = [event_name]
        keys = [canonical_artist_key(event_name)[:255]]

    venue = event.get("venue") or {}
    image = sanitize_external_url(event.get("largeimageurl")) or sanitize_external_url(event.get("imageurl"))

    return {
        "source": SKIDDLE_SOURCE,
        "external_id": external_id[:128],
        "artist_name": names[0],
        "artist_key": keys[0],
        "attraction_names": names,
        "attraction_keys": keys,
        "event_name": event_name,
        "venue_name": str(venue.get("name") or "").strip()[:255],
        "city": str(venue.get("town") or "").strip()[:128],
        "country_code": str(venue.get("country") or "").strip().upper()[:8],
        "lat": _parse_coordinate(venue.get("latitude")),
        "lng": _parse_coordinate(venue.get("longitude")),
        "event_date": event_date,
        "event_time": event_time,
        "onsale_start_at": None,
        "ticket_url": sanitize_external_url(event.get("link")),
        "image_url": image,
        "is_cancelled": str(event.get("cancelled") or "0").strip().lower() in ("1", "true", "yes"),
    }
