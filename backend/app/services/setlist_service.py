from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ..models import SetlistApiUsage, SetlistCache

logger = logging.getLogger(__name__)

SETLIST_FM_BASE_URL = "https://api.setlist.fm/rest/1.0"
MAX_DAILY_CALLS = 1400  # safety threshold under 1,440 daily limit
MIN_INTERVAL_SECONDS = 0.55  # strictly enforce <= 2 req/second


class SetlistRateLimitError(Exception):
    """Raised when the daily or per-second rate limit is exceeded."""


class SetlistService:
    def __init__(self, db: Session, api_key: str | None = None) -> None:
        self.db = db
        self.api_key = api_key or os.getenv("SETLIST_FM_API_KEY", "")

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
            logger.warning("SETLIST_FM_API_KEY is not set.")
            return {}

        self._acquire_rate_limit()

        headers = {
            "Accept": "application/json",
            "x-api-key": self.api_key,
            "User-Agent": "AudioScrobblerApp/1.0",
        }
        url = f"{SETLIST_FM_BASE_URL}{endpoint}"

        try:
            resp = httpx.get(url, headers=headers, params=params, timeout=15.0)
            if resp.status_code == 404:
                return {}
            if resp.status_code == 429:
                raise SetlistRateLimitError("Setlist.fm returned HTTP 429: Too Many Requests.")
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, dict) else {}
        except httpx.HTTPStatusError as e:
            logger.error("Setlist.fm HTTP error: %s", e)
            raise

    def get_setlist(self, setlist_id: str) -> dict[str, Any]:
        cache_key = f"setlist:{setlist_id}"
        now = datetime.utcnow()
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

    def search_setlists_raw(self, params: dict[str, Any]) -> dict[str, Any]:
        return self._request("/search/setlists", params=params)

    def search_setlists(
        self,
        artist_name: str | None = None,
        country_code: str | None = None,
        year: int | None = None,
        venue_name: str | None = None,
        p: int = 1,
    ) -> dict[str, Any]:
        query_parts = [
            f"artist:{artist_name or ''}",
            f"country:{country_code or ''}",
            f"year:{year or ''}",
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
        if data:
            new_cache = SetlistCache(
                cache_key=cache_key,
                response_json=data,
                expires_at=now + timedelta(days=1),
            )
            self.db.merge(new_cache)
            self.db.commit()
        return data

    def get_venue_date_setlists(
        self,
        venue_id: str,
        event_date_str: str,
        exclude_setlist_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Finds other setlists at the same venue on the same date (support acts/festival bill).

        Capped at 10 items max to prevent festival lineups from overwhelming the UI.
        """
        params = {"venueId": venue_id, "date": event_date_str}
        data = self.search_setlists_raw(params)
        setlists = data.get("setlist", []) if isinstance(data, dict) else []
        if not isinstance(setlists, list):
            return []

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
        return self._request(f"/user/{username}/attended", params={"p": p})
