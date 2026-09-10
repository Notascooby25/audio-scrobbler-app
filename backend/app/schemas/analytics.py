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

    model_config = ConfigDict(from_attributes=True)


class ChartResponse(BaseModel):
    user_id: int
    entity: str
    range: str
    entries: list[ChartEntry]

    model_config = ConfigDict(from_attributes=True)

    model_config = ConfigDict(from_attributes=True)
