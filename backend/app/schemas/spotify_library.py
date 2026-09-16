from __future__ import annotations

from pydantic import BaseModel, Field


class SpotifySyncResponse(BaseModel):
    fetched: int
    inserted: int
    updated: int
    artwork_updated: int


class WorkerBackfillArtworkRequest(BaseModel):
    user_id: int = Field(gt=0)
