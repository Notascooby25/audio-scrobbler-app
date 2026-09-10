from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MonthlySummaryEntry(BaseModel):
    month: str
    total_plays: int
    unique_tracks: int
    total_listening_minutes: int

    model_config = ConfigDict(from_attributes=True)


class MonthlySummaryResponse(BaseModel):
    user_id: int
    summary: list[MonthlySummaryEntry]
    total_months: int

    model_config = ConfigDict(from_attributes=True)


class ScrobbleListEntry(BaseModel):
    id: int
    track_name: str
    artist_name: str
    source: str
    played_at: datetime
    artwork_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ScrobbleListResponse(BaseModel):
    user_id: int
    scrobbles: list[ScrobbleListEntry]
    limit: int
    offset: int

    model_config = ConfigDict(from_attributes=True)


class ChartEntry(BaseModel):
    label: str
    secondary: str | None = None
    play_count: int
    artwork_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ChartResponse(BaseModel):
    user_id: int
    entity: str
    range: str
    entries: list[ChartEntry]

    model_config = ConfigDict(from_attributes=True)

    model_config = ConfigDict(from_attributes=True)


class LegacyChartEntry(BaseModel):
    label: str
    secondary: str | None = None
    play_count: int


class LegacyChartResponse(BaseModel):
    user_id: int
    entity: str
    range: str
    entries: list[LegacyChartEntry]


class StatsResponse(BaseModel):
    user_id: int
    total_scrobbles: int
    unique_artists: int
    loved_tracks: int


class LibraryEntry(BaseModel):
    label: str
    secondary: str | None = None
    play_count: int
    artwork_url: str | None = None


class LibraryResponse(BaseModel):
    user_id: int
    entries: list[LibraryEntry]
    limit: int
    offset: int
    total_count: int


class LibraryScrobbleEntry(ScrobbleListEntry):
    pass


class LibraryScrobbleResponse(BaseModel):
    user_id: int
    scrobbles: list[LibraryScrobbleEntry]
    limit: int
    offset: int
    total_count: int


class TimelineEntry(BaseModel):
    period: str
    count: int


class TimelineResponse(BaseModel):
    user_id: int
    entries: list[TimelineEntry]


class ReportSummaryResponse(BaseModel):
    user_id: int
    total_scrobbles: int
    period_scrobbles: int
    previous_period_scrobbles: int
    comparison_percent: float
    listening_minutes: int
    average_per_day: float


class ReportPoint(BaseModel):
    label: str
    count: int


class ReportChartsResponse(BaseModel):
    user_id: int
    weekly_scrobbles: list[ReportPoint]
    listening_clock: list[ReportPoint]
    music_by_decade: list[ReportPoint]
