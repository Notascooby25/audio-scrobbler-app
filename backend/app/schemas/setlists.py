from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class LogAttendanceRequest(BaseModel):
    setlist_id: str = Field(..., min_length=1, max_length=64)
    support_setlist_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(None, max_length=2000)
    # False: answer 409 if this gig looks already logged, so the app can ask first
    allow_duplicate: bool = False


class UpdateConcertNotesRequest(BaseModel):
    notes: str | None = Field(None, max_length=2000)


class LogManualConcertRequest(BaseModel):
    artist_name: str = Field(..., min_length=1, max_length=255)
    venue_name: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=128)
    country: str = Field(..., min_length=1, max_length=128)
    event_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    notes: str | None = Field(None, max_length=2000)
    setlist_url: str | None = Field(None, max_length=500)
    allow_duplicate: bool = False


class AttendedConcertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    setlist_id: str
    artist_name: str
    artist_mbid: str | None = None
    venue_name: str
    city: str
    country: str
    event_date: datetime | None = None
    tour_name: str | None = None
    setlist_url: str | None = None
    is_support_act: bool = False
    parent_setlist_id: str | None = None
    song_count: int = 0
    raw_data: dict[str, Any] | None = None
    notes: str | None = None


class DeleteConcertResponse(BaseModel):
    deleted_count: int


class ArtistGigItem(BaseModel):
    id: int
    setlist_id: str
    date: str
    event_date: str | None = None
    venue: str
    city: str
    country: str
    is_support: bool
    song_count: int
    notes: str | None = None
    raw_data: dict[str, Any] | None = None


class ArtistLeaderboardItem(BaseModel):
    artist_name: str
    count: int
    gigs: list[ArtistGigItem] = Field(default_factory=list)


class ConcertRefItem(BaseModel):
    id: int
    setlist_id: str
    artist_name: str
    venue_name: str
    city: str
    country: str
    event_date: str | None = None
    date: str
    is_support: bool = False


class SongLeaderboardItem(BaseModel):
    track_name: str
    artist_name: str
    count: int
    gigs: list[ConcertRefItem] = Field(default_factory=list)


class VenueLeaderboardItem(BaseModel):
    venue_name: str
    city: str
    country: str
    count: int
    gigs: list[ConcertRefItem] = Field(default_factory=list)


class GigBillAct(BaseModel):
    setlist_id: str
    artist_name: str
    logged: bool
    concert_id: int | None = None
    role: Literal["support", "headliner"] | None = None
    song_count: int | None = None


class LogBillActRequest(BaseModel):
    # Setlist.fm ids are short alphanumerics; anything else never reaches the API path
    setlist_id: str = Field(..., min_length=1, max_length=32, pattern=r"^[0-9A-Za-z_-]+$")


class GigBillResponse(BaseModel):
    acts: list[GigBillAct]
    # False when Setlist.fm couldn't be checked, so only logged acts are listed
    complete: bool
    capped: bool


class FileImportRequest(BaseModel):
    format: Literal["csv", "json"]
    # The browser sends the file's text; 2 MB cap matches the service limit
    content: str = Field(..., min_length=1, max_length=2_000_000)


class FileImportInvalidRow(BaseModel):
    line: int
    error: str


class FileImportResponse(BaseModel):
    imported: int
    skipped_existing: int
    without_songs: int
    quota_reached: bool
    invalid: list[FileImportInvalidRow]
    invalid_count: int


class SetlistPreviewItem(BaseModel):
    setlist_id: str
    artist_name: str
    venue_name: str
    city: str
    country: str
    event_date: str
    tour_name: str | None = None
    setlist_url: str | None = None
    song_count: int = 0
    already_logged: bool = False


class SetlistPreviewResponse(BaseModel):
    items: list[SetlistPreviewItem]
    page: int
    items_per_page: int
    total: int
    total_pages: int


class SetlistImportRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    setlist_ids: list[str] | None = None
