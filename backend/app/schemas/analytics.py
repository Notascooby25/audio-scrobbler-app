from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MonthlySummaryEntry(BaseModel):
    month: str
    total_plays: int
    unique_tracks: int
    total_listening_minutes: int

    model_config = ConfigDict(from_attributes=True)


class MonthlySummaryResponse(BaseModel):
    user_id: UUID
    summary: list[MonthlySummaryEntry]
    total_months: int

    model_config = ConfigDict(from_attributes=True)
