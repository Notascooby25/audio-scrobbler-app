from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from .setlist_attendance_service import extract_songs_from_setlist_data
from .setlist_file_import_service import MAX_FILE_CHARS, MAX_ROWS

# Setlist.fm returns 20 shows a page. This stops a runaway profile before it reaches the row limit.
MAX_EXPORT_PAGES = MAX_ROWS // 20


class ProfileExportTooLargeError(ValueError):
    """The profile's gigs won't fit in one import file."""


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _event_date(value: object) -> str | None:
    """Setlist.fm dates are dd-mm-yyyy; the import file uses yyyy-mm-dd."""
    text = _text(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, "%d-%m-%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _export_row(item: dict[str, Any]) -> dict[str, Any] | None:
    """One show in the file-import format, keeping only what the import reads: the songs
    travel with the row, so importing the file never calls Setlist.fm."""
    setlist_id = _text(item.get("id"))
    artist = item.get("artist") if isinstance(item.get("artist"), dict) else {}
    venue = item.get("venue") if isinstance(item.get("venue"), dict) else {}
    city = venue.get("city") if isinstance(venue.get("city"), dict) else {}
    country = city.get("country") if isinstance(city.get("country"), dict) else {}
    tour = item.get("tour") if isinstance(item.get("tour"), dict) else {}

    artist_name = _text(artist.get("name"))
    venue_name = _text(venue.get("name"))
    event_date = _event_date(item.get("eventDate"))
    if not (setlist_id and artist_name and venue_name and event_date):
        return None

    songs = [{"name": name} for name in extract_songs_from_setlist_data(item)]
    tour_name = _text(tour.get("name"))
    url = _text(item.get("url")) or ""
    return {
        "setlist_id": setlist_id,
        "artist_name": artist_name,
        "venue_name": venue_name,
        "city": _text(city.get("name")) or "",
        "country": _text(country.get("name")) or "",
        "event_date": event_date,
        "tour_name": tour_name,
        "setlist_url": url or None,
        "is_support_act": False,
        "raw_data": {
            "id": setlist_id,
            "artist": {"name": artist_name},
            "venue": {
                "name": venue_name,
                "city": {"name": city.get("name") or "", "country": {"name": country.get("name") or ""}},
            },
            "tour": {"name": tour_name} if tour_name else None,
            "url": url,
            # An empty list still counts as "has sets", so these import without a Setlist.fm call
            "sets": {"set": [{"song": songs}] if songs else []},
        },
    }


def build_profile_export(service: Any, username: str) -> tuple[str, int, int]:
    """Every attended show on a Setlist.fm profile, as a file the import reads.

    Returns (json text, shows exported, shows skipped because they were missing a name, venue or date).
    Pages come through the day's cache, so a preview made earlier costs nothing here.
    """
    rows: list[dict[str, Any]] = []
    skipped = 0
    page = 1
    while page <= MAX_EXPORT_PAGES:
        data = service.get_user_attended(username=username, p=page)
        setlists = data.get("setlist", []) if isinstance(data, dict) else []
        if not setlists:
            break
        for item in setlists:
            row = _export_row(item) if isinstance(item, dict) else None
            if row is None:
                skipped += 1
            else:
                rows.append(row)
        per_page = int(data.get("itemsPerPage", 20) or 20)
        if page * per_page >= int(data.get("total", 0) or 0):
            break
        page += 1

    content = json.dumps(rows, ensure_ascii=False)
    if len(content) > MAX_FILE_CHARS:
        raise ProfileExportTooLargeError(
            f"This profile has too many gigs to export in one file ({len(rows)} gigs). Import it in parts instead."
        )
    return content, len(rows), skipped
