from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ListeningEventCreate(BaseModel):
    track_id: str = Field(min_length=1, max_length=255)
    track_name: str = Field(min_length=1, max_length=255)
    artist_name: str = Field(min_length=1, max_length=255)
    played_at: datetime
    duration_ms: int | None = Field(default=None, ge=0)
    source: str = Field(default="spotify", min_length=1, max_length=64)
    payload: dict[str, object] | None = None


class ListeningEventResponse(BaseModel):
    event_id: int
    duplicate: bool

    model_config = ConfigDict(from_attributes=True)