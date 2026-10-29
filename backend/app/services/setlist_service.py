from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from ..models import SetlistApiUsage, SetlistCache

logger = logging.getLogger(__name__)

SETLIST_FM_BASE_URL = "https://api.setlist.fm/rest/1.0"
MAX_DAILY_CALLS = 1400  # safety threshold under 1,440 daily limit
MIN_INTERVAL_SECONDS = 0.55  # strictly enforce <= 2 req/second


class SetlistRateLimitError(Exception):
    """Raised when the daily or per-second rate limit is exceeded."""


class SetlistApiKeyMissingError(Exception):
    """Raised when SETLIST_FM_API_KEY is not configured."""


class SetlistApiAuthError(Exception):
    """Raised when Setlist.fm rejects the API key with 401 or 403."""


class SetlistUserNotFoundError(Exception):
    """Raised when a Setlist.fm user is not found or has no public concerts."""


def sanitize_setlist_username(raw: str) -> str:
    """Extract and normalize a Setlist.fm username from a username or full profile URL.

    Preserves exact casing because Setlist.fm's REST API is case-sensitive on usernames.
    Supports /user/<username>, /attended/<username>, and /concerts/<username> URLs.
    """
    if not raw:
        return ""
    cleaned = raw.strip()
    if "setlist.fm" in cleaned:
        if not cleaned.startswith(("http://", "https://")):
            cleaned = "https://" + cleaned
        parsed = urlparse(cleaned)
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 2 and parts[0] in ("user", "attended", "concerts"):
            return parts[1]
        elif len(parts) == 1:
            return parts[0]
    cleaned = cleaned.strip("/").split("/")[0].split("?")[0].strip()
    return cleaned


def _matches_month(event_date_str: str | None, target_month: int) -> bool:
    if not event_date_str:
        return False
    parts = event_date_str.split("-")
    if len(parts) == 3:
        if len(parts[0]) <= 2 and len(parts[2]) == 4:
            try:
                return int(parts[1]) == target_month
            except ValueError:
                pass
        elif len(parts[0]) == 4:
            try:
                return int(parts[1]) == target_month
            except ValueError:
                pass
    return False


def extract_setlist_id(raw: str | None) -> str | None:
    """Extract a Setlist.fm setlist/show ID from a full URL or direct ID.

    Examples:
    - https://www.setlist.fm/setlist/artist/2026/venue-334a28f1.html -> 334a28f1
    - https://www.setlist.fm/show/2026-11-14/venue-334a28f1.html -> 334a28f1
    - 334a28f1 -> 334a28f1
    """
    if not raw:
        return None
    val = raw.strip()
    if not val:
        return None
    match = re.search(r"([0-9a-fA-F]{7,8})(?:\.html)?(?:$|[?#])", val)
    if match:
        return match.group(1).lower()
    if re.fullmatch(r"[0-9a-fA-F]{7,10}", val):
        return val.lower()
    return None


class SetlistService:
    def __init__(self, db: Session, api_key: str | None = None) -> None:
        self.db = db
        self.api_key = (api_key or os.getenv("SETLIST_FM_API_KEY", "")).strip("'\" \r\n")

    def get_status(self) -> dict[str, Any]:
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        usage = self.db.query(SetlistApiUsage).filter_by(id=1).first()
        daily_count = usage.daily_count if usage and usage.daily_date == today_str else 0
        return {
            "configured": bool(self.api_key),
            "daily_quota": MAX_DAILY_CALLS,
            "daily_count": daily_count,
        }

    def _acquire_rate_limit(self) -> None:
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        now = datetime.utcnow()

        usage = self.db.query(SetlistApiUsage).filter_by(id=1).with_for_update().first()
        if not usage:
            usage = SetlistApiUsage(
                id=1,
                last_call_at=now - timedelta(seconds=1),
                daily_date=today_str,
                daily_count=0,
            )
            self.db.add(usage)
            self.db.flush()

        # Reset daily counter if new day
        if usage.daily_date != today_str:
            usage.daily_date = today_str
            usage.daily_count = 0

        # Check daily quota
        if usage.daily_count >= MAX_DAILY_CALLS:
            raise SetlistRateLimitError(
                f"Daily Setlist.fm API quota reached ({usage.daily_count}/{MAX_DAILY_CALLS}). Resumes tomorrow."
            )

        # Enforce minimum interval between calls across containers
        elapsed = (now - usage.last_call_at).total_seconds()
        if elapsed < MIN_INTERVAL_SECONDS:
            sleep_needed = MIN_INTERVAL_SECONDS - elapsed
            time.sleep(sleep_needed)

        usage.last_call_at = datetime.utcnow()
        usage.daily_count += 1
        self.db.commit()

    def _request(self, endpoint: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.api_key:
            raise SetlistApiKeyMissingError(
                "Setlist.fm API key is not configured. Please set SETLIST_FM_API_KEY in your environment."
            )

        self._acquire_rate_limit()

        headers = {
            "Accept": "application/json",
            "x-api-key": self.api_key,
            "User-Agent": "AudioScrobblerApp/1.0",
        }
        url = f"{SETLIST_FM_BASE_URL}{endpoint}"

        try:
            logger.info("Setlist.fm API request: GET %s (params=%s)", url, params)
            resp = httpx.get(url, headers=headers, params=params, timeout=15.0)
            logger.info("Setlist.fm API response [%s] for %s: %s", resp.status_code, url, resp.text[:250])
            if resp.status_code == 404:
                if endpoint.startswith("/user/"):
                    raise SetlistUserNotFoundError("User not found or has no public attended concerts on Setlist.fm.")
                return {}
            if resp.status_code in (401, 403):
                raise SetlistApiAuthError(
                    f"Setlist.fm API key was rejected ({resp.status_code} Forbidden/Unauthorized). "
                    "Please verify your SETLIST_FM_API_KEY in your server configuration."
                )
            if resp.status_code == 429:
                raise SetlistRateLimitError("Setlist.fm returned HTTP 429: Too Many Requests.")
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, dict) else {}
        except httpx.HTTPStatusError as e:
            logger.error("Setlist.fm HTTP error: %s", e)
            raise

    def get_setlist(self, setlist_id: str, force_refresh: bool = False) -> dict[str, Any]:
        """One setlist, served from the cache unless `force_refresh` (Refresh from Setlist.fm)."""
        cache_key = f"setlist:{setlist_id}"
        now = datetime.utcnow()
        if not force_refresh:
            cached = (
                self.db.query(SetlistCache)
                .filter(SetlistCache.cache_key == cache_key, SetlistCache.expires_at > now)
                .first()
            )
            if cached and isinstance(cached.response_json, dict):
                return cached.response_json

        data = self._request(f"/setlist/{setlist_id}")
        if data:
            new_cache = SetlistCache(
                cache_key=cache_key,
                response_json=data,
                expires_at=now + timedelta(days=7),
            )
            self.db.merge(new_cache)
            self.db.commit()
        return data

    def remember_setlists(self, items: object) -> None:
        """Caches full setlists that list responses (attended, search, venue bill) already
        returned, so logging one of them later doesn't spend another API call.

        Only setlists with songs are kept: an empty one may be filled in on Setlist.fm
        later, and AGENTS.md rules out long-lived empty cache entries.
        """
        if not isinstance(items, list):
            return
        expires_at = datetime.utcnow() + timedelta(days=7)
        stored = False
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
                continue
            sets = item.get("sets")
            if not isinstance(sets, dict) or not sets.get("set"):
                continue
            self.db.merge(SetlistCache(cache_key=f"setlist:{item['id']}", response_json=item, expires_at=expires_at))
            stored = True
        if stored:
            self.db.commit()

    def search_setlists_raw(self, params: dict[str, Any]) -> dict[str, Any]:
        return self._request("/search/setlists", params=params)

    def search_setlists(
        self,
        artist_name: str | None = None,
        country_code: str | None = None,
        year: int | None = None,
        month: int | None = None,
        venue_name: str | None = None,
        setlist_url_or_id: str | None = None,
        p: int = 1,
    ) -> dict[str, Any]:
        # 1. Check for direct Setlist.fm URL or Setlist ID in query
        direct_id = extract_setlist_id(setlist_url_or_id)
        if not direct_id and artist_name:
            trimmed_artist = artist_name.strip()
            if "setlist.fm" in trimmed_artist or (re.fullmatch(r"[0-9a-fA-F]{7,8}", trimmed_artist) and not venue_name):
                direct_id = extract_setlist_id(trimmed_artist)

        if direct_id:
            try:
                single_setlist = self.get_setlist(direct_id)
                if single_setlist and isinstance(single_setlist, dict) and single_setlist.get("id"):
                    return {
                        "type": "setlists",
                        "itemsPerPage": 20,
                        "page": 1,
                        "total": 1,
                        "setlist": [single_setlist],
                    }
            except Exception as e:
                logger.warning("Failed to direct-fetch setlist ID %s: %s", direct_id, e)

        query_parts = [
            f"url_or_id:{setlist_url_or_id or ''}",
            f"artist:{artist_name or ''}",
            f"country:{country_code or ''}",
            f"year:{year or ''}",
            f"month:{month or ''}",
            f"venue:{venue_name or ''}",
            f"p:{p}",
        ]
        cache_key = f"search:{':'.join(query_parts)}"
        now = datetime.utcnow()

        cached = (
            self.db.query(SetlistCache)
            .filter(SetlistCache.cache_key == cache_key, SetlistCache.expires_at > now)
            .first()
        )
        if cached and isinstance(cached.response_json, dict):
            return cached.response_json

        params: dict[str, Any] = {"p": p}
        if artist_name:
            params["artistName"] = artist_name
        if country_code:
            params["countryCode"] = country_code
        if year:
            params["year"] = year
        if venue_name:
            params["venueName"] = venue_name

        data = self.search_setlists_raw(params=params)
        if not data:
            return {"total": 0, "setlist": []}

        if month:
            raw_list = data.get("setlist", []) if isinstance(data, dict) else []
            filtered_list = [s for s in raw_list if isinstance(s, dict) and _matches_month(s.get("eventDate"), month)]
            total_raw = int(data.get("total", 0)) if isinstance(data, dict) else 0
            curr_p = p
            max_pages_to_scan = 3
            while len(filtered_list) < 10 and (curr_p * 20 < total_raw) and (curr_p - p < max_pages_to_scan):
                curr_p += 1
                next_params = dict(params)
                next_params["p"] = curr_p
                next_data = self.search_setlists_raw(params=next_params)
                next_setlists = next_data.get("setlist", []) if isinstance(next_data, dict) else []
                if not next_setlists:
                    break
                filtered_list.extend(
                    [s for s in next_setlists if isinstance(s, dict) and _matches_month(s.get("eventDate"), month)]
                )
            data = dict(data)
            data["setlist"] = filtered_list
            data["total"] = len(filtered_list)

        new_cache = SetlistCache(
            cache_key=cache_key,
            response_json=data,
            expires_at=now + timedelta(days=1),
        )
        self.db.merge(new_cache)
        self.db.commit()
        return data

    def _cached_venue_date_setlists(self, venue_id: str, event_date_str: str) -> list[dict[str, Any]]:
        """Every setlist at a venue on a date, cached so gig pages don't spend API quota.

        A found bill is kept for 7 days; an empty one for only an hour, so a show that
        Setlist.fm hasn't indexed yet isn't hidden for long.
        """
        cache_key = f"venue-date:{venue_id}:{event_date_str}"
        now = datetime.utcnow()
        cached = (
            self.db.query(SetlistCache)
            .filter(SetlistCache.cache_key == cache_key, SetlistCache.expires_at > now)
            .first()
        )
        if cached and isinstance(cached.response_json, dict):
            setlists = cached.response_json.get("setlist", [])
        else:
            data = self.search_setlists_raw({"venueId": venue_id, "date": event_date_str})
            setlists = data.get("setlist", []) if isinstance(data, dict) else []
            if not isinstance(setlists, list):
                setlists = []
            ttl = timedelta(days=7) if setlists else timedelta(hours=1)
            self.db.merge(SetlistCache(cache_key=cache_key, response_json={"setlist": setlists}, expires_at=now + ttl))
            self.db.commit()
        return [s for s in setlists if isinstance(s, dict)]

    def get_venue_date_setlists(
        self,
        venue_id: str,
        event_date_str: str,
        exclude_setlist_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Finds other setlists at the same venue on the same date (support acts/festival bill).

        Capped at 10 items max to prevent festival lineups from overwhelming the UI.
        """
        setlists = self._cached_venue_date_setlists(venue_id, event_date_str)

        results = []
        for s in setlists:
            if not isinstance(s, dict):
                continue
            if exclude_setlist_id and s.get("id") == exclude_setlist_id:
                continue
            results.append(s)
            if len(results) >= 10:
                break
        return results

    def get_user_attended(self, username: str, p: int = 1) -> dict[str, Any]:
        cleaned_username = sanitize_setlist_username(username)
        if not cleaned_username:
            raise SetlistUserNotFoundError("Invalid Setlist.fm username.")

        # Candidate casings: exact as provided, Capitalized, and lowercase.
        # Setlist.fm's REST API is case-sensitive on usernames.
        casings: list[str] = []
        for c in [
            cleaned_username,
            cleaned_username.capitalize(),
            cleaned_username.lower(),
        ]:
            if c and c not in casings:
                casings.append(c)

        last_data: dict[str, Any] | None = None
        last_exc: Exception | None = None

        for candidate in casings:
            try:
                data = self._request(f"/user/{candidate}/attended", params={"p": p})
                total = int(data.get("total", 0)) if isinstance(data, dict) else 0
                setlists = data.get("setlist", []) if isinstance(data, dict) else []
                if total > 0 or len(setlists) > 0:
                    logger.info("Setlist.fm found %s shows with username casing '%s'", total, candidate)
                    # Each attended show is a full setlist; keep them so importing costs no extra calls
                    self.remember_setlists(setlists)
                    return data
                if last_data is None:
                    last_data = data
            except SetlistUserNotFoundError as exc:
                last_exc = exc
                continue

        if last_data is not None:
            return last_data
        if last_exc:
            raise last_exc
        return {"total": 0, "setlist": []}
