from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


DATE_RANGES = {"last.week", "last.month", "last.year", "all.time", "custom"}
VIEWS = {"list", "grid"}
PAGE_SIZES = {10, 25, 50, 100}
ACCENT_COLORS = {
    "blue_monday",
    "spotify_green",
    "red_red_wine",
    "purple_rain",
    "fools_gold",
    "paint_it_black",
    "pretty_in_pink",
    "orange_crush",
}


class HomeCityRequest(BaseModel):
    city: str = Field(..., min_length=1, max_length=128)


class UserPreferencesResponse(BaseModel):
    user_id: int
    home_city: str | None = None
    default_date_range: str
    theme: str
    accent_color: str = "blue_monday"
    default_page_size: int
    default_library_view: str
    scrobbles_view: str | None
    artists_view: str | None
    albums_view: str | None
    tracks_view: str | None
    show_artwork: bool
    show_source_badges: bool
    timestamp_mode: str
    jukebox_source: str = "spotify_saved"
    jukebox_archive_limit: int = 100
    notify_recaps: bool = True
    notify_milestones: bool = True
    notify_system: bool = False
    recap_frequency: str = "weekly"

    model_config = ConfigDict(from_attributes=True)


class UserPreferencesUpdate(BaseModel):
    default_date_range: str | None = None
    theme: str | None = None
    accent_color: str | None = None
    jukebox_source: str | None = None
    jukebox_archive_limit: int | None = None
    default_page_size: int | None = Field(default=None)
    default_library_view: str | None = None
    scrobbles_view: str | None = None
    artists_view: str | None = None
    albums_view: str | None = None
    tracks_view: str | None = None
    show_artwork: bool | None = None
    show_source_badges: bool | None = None
    timestamp_mode: str | None = None
    notify_recaps: bool | None = None
    notify_milestones: bool | None = None
    notify_system: bool | None = None
    recap_frequency: str | None = None
