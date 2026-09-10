from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


DATE_RANGES = {"last.week", "last.month", "last.year", "custom"}
VIEWS = {"list", "grid"}
PAGE_SIZES = {10, 25, 50, 100}


class UserPreferencesResponse(BaseModel):
    user_id: int
    default_date_range: str
    default_page_size: int
    default_library_view: str
    scrobbles_view: str | None
    artists_view: str | None
    albums_view: str | None
    tracks_view: str | None
    liked_tracks_view: str | None
    show_artwork: bool
    show_source_badges: bool
    timestamp_mode: str

    model_config = ConfigDict(from_attributes=True)


class UserPreferencesUpdate(BaseModel):
    default_date_range: str | None = None
    default_page_size: int | None = Field(default=None)
    default_library_view: str | None = None
    scrobbles_view: str | None = None
    artists_view: str | None = None
    albums_view: str | None = None
    tracks_view: str | None = None
    liked_tracks_view: str | None = None
    show_artwork: bool | None = None
    show_source_badges: bool | None = None
    timestamp_mode: str | None = None