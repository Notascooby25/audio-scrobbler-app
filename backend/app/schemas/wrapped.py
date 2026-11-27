from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class WrappedYearEntry(BaseModel):
    year: int
    status: str  # "ready" or "locked"
    stage: str | None = None
    unlocks_at: datetime | None = None
    updated: bool = False
    seen: bool = False
    is_sample: bool = False
    top_artist: str | None = None
    top_artist_artwork: str | None = None
    date_from: str | None = None
    date_to: str | None = None


class WrappedBanner(BaseModel):
    year: int


class WrappedListResponse(BaseModel):
    years: list[WrappedYearEntry]
    banner: WrappedBanner | None = None


class WrappedDetailResponse(BaseModel):
    year: int
    stage: str
    is_sample: bool
    updated: bool
    format_version: int
    data: dict[str, Any]
