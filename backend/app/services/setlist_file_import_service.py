from __future__ import annotations

import csv
import io
import json
import re
import uuid
from datetime import datetime, timedelta
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.orm import Session

from ..models import AttendedConcert
from .setlist_attendance_service import SetlistAttendanceService, extract_songs_from_setlist_data
from .setlist_service import (
    SetlistApiAuthError,
    SetlistApiKeyMissingError,
    SetlistRateLimitError,
    extract_setlist_id,
)

MAX_FILE_CHARS = 2_000_000
MAX_ROWS = 2000
MAX_RAW_DATA_CHARS = 200_000
MAX_TRACK_NAME = 255

# Export prefixes these with "'" so spreadsheets don't run them as formulas
_CSV_FORMULA_ESCAPE = re.compile(r"^'(?=[=+\-@\t\r])")


class FileImportError(ValueError):
    """The file as a whole can't be imported (wrong format, too big, unreadable)."""


class ImportedGigRow(BaseModel):
    """One gig from an exported CSV or JSON file. Everything here is untrusted input."""

    setlist_id: str | None = Field(None, max_length=64)
    artist_name: str = Field(..., min_length=1, max_length=255)
    venue_name: str = Field(..., min_length=1, max_length=255)
    # Blank CSV cells arrive as None
    city: str | None = Field(None, max_length=128)
    country: str | None = Field(None, max_length=128)
    event_date: datetime
    tour_name: str | None = Field(None, max_length=255)
    is_support_act: bool | None = None
    setlist_url: str | None = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=2000)
    raw_data: dict[str, Any] | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _clean_text(cls, value: object) -> object:
        if isinstance(value, str):
            value = _CSV_FORMULA_ESCAPE.sub("", value.strip())
            return value or None
        return value

    @field_validator("event_date", mode="before")
    @classmethod
    def _parse_date(cls, value: object) -> object:
        if isinstance(value, str):
            for parse in (datetime.fromisoformat, lambda v: datetime.strptime(v, "%d-%m-%Y")):
                try:
                    return parse(value)
                except ValueError:
                    continue
            raise ValueError("date must look like 2026-10-16")
        return value

    @field_validator("event_date")
    @classmethod
    def _sensible_year(cls, value: datetime) -> datetime:
        if not 1950 <= value.year <= 2100:
            raise ValueError("date is out of range")
        return value.replace(tzinfo=None)

    @field_validator("setlist_url")
    @classmethod
    def _http_only(cls, value: str | None) -> str | None:
        if value and not value.lower().startswith(("https://", "http://")):
            raise ValueError("link must start with http:// or https://")
        return value

    @field_validator("raw_data")
    @classmethod
    def _cap_raw_data(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is not None and len(json.dumps(value)) > MAX_RAW_DATA_CHARS:
            raise ValueError("setlist data is too large")
        return value


def _read_rows(file_format: str, content: str) -> list[tuple[int, dict[str, Any]]]:
    """Returns (line or item number, row) pairs from the file text."""
    if len(content) > MAX_FILE_CHARS:
        raise FileImportError("File is too large (max 2 MB).")
    content = content.lstrip("﻿")

    if file_format == "json":
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise FileImportError("File isn't valid JSON.") from exc
        if not isinstance(data, list):
            raise FileImportError("JSON file should be a list of gigs, like the Set Lists export.")
        rows = [(idx + 1, item if isinstance(item, dict) else {}) for idx, item in enumerate(data)]
    else:
        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames or "artist_name" not in reader.fieldnames:
            raise FileImportError("CSV file needs an artist_name column, like the Set Lists export.")
        # Line numbers count the header as line 1
        rows = [(idx + 2, dict(row)) for idx, row in enumerate(reader)]

    if len(rows) > MAX_ROWS:
        raise FileImportError(f"File has {len(rows)} gigs; the limit is {MAX_ROWS} per import.")
    return rows


def _first_error(exc: ValidationError) -> str:
    err = exc.errors()[0]
    field = ".".join(str(part) for part in err.get("loc", ())) or "row"
    message = str(err.get("msg", "invalid value")).removeprefix("Value error, ")
    return f"{field}: {message}"


def import_gigs_from_file(user_id: int, file_format: str, content: str, db: Session, setlist_service: Any) -> dict:
    """Imports gigs from an exported Set Lists CSV/JSON file for one user.

    Gigs already logged are skipped. JSON rows carry their songs; CSV rows with a
    Setlist.fm link fetch songs through the cached, quota-limited Setlist.fm client.
    """
    rows = _read_rows(file_format, content)
    attendance = SetlistAttendanceService(db=db, setlist_service=setlist_service)

    imported = 0
    skipped_existing = 0
    without_songs = 0
    quota_reached = False
    invalid: list[dict[str, Any]] = []

    for line, raw_row in rows:
        try:
            row = ImportedGigRow.model_validate(raw_row)
        except ValidationError as exc:
            invalid.append({"line": line, "error": _first_error(exc)})
            continue

        setlist_id = row.setlist_id
        # CSV exports have no setlist_id column, but a Setlist.fm link carries the show ID
        if not setlist_id and row.setlist_url and "setlist.fm" in row.setlist_url.lower():
            setlist_id = extract_setlist_id(row.setlist_url)
        is_manual = not setlist_id or setlist_id.startswith("manual-")

        if attendance.find_existing_gig(user_id, setlist_id, row.artist_name, row.event_date):
            skipped_existing += 1
            continue

        setlist_data = row.raw_data if row.raw_data and row.raw_data.get("sets") else None
        if setlist_data is None and not is_manual and not quota_reached:
            try:
                setlist_data = setlist_service.get_setlist(setlist_id) or None
            except SetlistRateLimitError:
                quota_reached = True
            except (SetlistApiKeyMissingError, SetlistApiAuthError, httpx.HTTPError, ValueError):
                setlist_data = None

        if not setlist_id:
            setlist_id = f"manual-{uuid.uuid4().hex[:12]}"
        songs = [name[:MAX_TRACK_NAME] for name in extract_songs_from_setlist_data(setlist_data or {})]
        if not songs and not is_manual:
            without_songs += 1

        concert = AttendedConcert(
            user_id=user_id,
            setlist_id=setlist_id,
            artist_name=row.artist_name,
            venue_name=row.venue_name,
            city=row.city or "",
            country=row.country or "",
            event_date=row.event_date,
            tour_name=row.tour_name,
            setlist_url=row.setlist_url,
            is_support_act=bool(row.is_support_act),
            raw_data=setlist_data or row.raw_data or {"id": setlist_id, "sets": {"set": []}, "is_manual": is_manual},
            song_count=len(songs),
            notes=row.notes,
        )
        db.add(concert)
        if songs:
            day = datetime.combine(row.event_date.date(), datetime.min.time())
            attendance._create_scrobbles_for_setlist(
                user_id=user_id,
                setlist_id=setlist_id,
                artist_name=row.artist_name,
                venue_name=row.venue_name,
                tour_name=row.tour_name,
                songs=songs,
                start_time=day + (timedelta(hours=18, minutes=45) if row.is_support_act else timedelta(hours=20)),
            )
        imported += 1

    db.commit()
    return {
        "imported": imported,
        "skipped_existing": skipped_existing,
        "without_songs": without_songs,
        "quota_reached": quota_reached,
        "invalid": invalid[:50],
        "invalid_count": len(invalid),
    }
