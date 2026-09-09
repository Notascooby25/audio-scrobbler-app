from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ImportScrobbleRequest(BaseModel):
    source: str = Field(..., min_length=1, max_length=32)
    entries: list[dict[str, Any]] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class ImportScrobbleSummary(BaseModel):
    inserted: int
    skipped: int
    duplicate: int = 0


class ImportScrobbleResponse(BaseModel):
    source: str
    status: str = "ok"
    summary: ImportScrobbleSummary

    model_config = ConfigDict(from_attributes=True)
