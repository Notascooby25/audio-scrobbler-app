from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DATE_RANGES = {"last.week", "last.month", "last.year", "all.time", "custom"}
VIEWS = {"list", "grid"}
PAGE_SIZES = {5, 10, 20, 25, 50, 100, 150, 200, 250}
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
SKINS = {"classic", "sleeve", "timeline"}


class HomeCityRequest(BaseModel):
    city: str = Field(..., min_length=1, max_length=128)


class UserPreferencesResponse(BaseModel):
    user_id: int
    home_city: str | None = None
    default_date_range: str
    theme: str
    skin: str = "classic"
    match_album_sleeve: bool = True
    accent_color: str = "blue_monday"
    default_page_size: int
    scrobbles_page_size: int | None = None
    artists_page_size: int | None = None
    albums_page_size: int | None = None
    tracks_page_size: int | None = None
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
    local_gig_radius_miles: int | None = 10
    gig_discovery_filters: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class GigDiscoveryFiltersUpdate(BaseModel):
    scope: Literal["my_artists", "local"] | None = None
    local_only_my_artists: bool | None = None
    date_window: Literal["all", "weekend", "7d", "30d", "newly_announced", "interested"] | None = None
    country_code: str | None = Field(default=None, max_length=8)
    my_artists_mode: Literal["top_n", "min_plays"] | None = None
    my_artists_limit: int | None = Field(default=None, ge=1, le=500)
    my_artists_min_plays: int | None = Field(default=None, ge=1, le=500)
    my_artists_months: int | None = Field(default=None, ge=0, le=120)
    include_seen_live: bool | None = None


class GigDiscoverySettingsUpdate(BaseModel):
    local_gig_radius_miles: int | None = Field(default=None, ge=1, le=100)
    gig_discovery_filters: GigDiscoveryFiltersUpdate | None = None


class UserPreferencesUpdate(BaseModel):
    default_date_range: str | None = None
    theme: str | None = None
    skin: str | None = None
    match_album_sleeve: bool | None = None
    accent_color: str | None = None
    jukebox_source: str | None = None
    jukebox_archive_limit: int | None = None
    default_page_size: int | None = Field(default=None)
    scrobbles_page_size: int | None = None
    artists_page_size: int | None = None
    albums_page_size: int | None = None
    tracks_page_size: int | None = None
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
