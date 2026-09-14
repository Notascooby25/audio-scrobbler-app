from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ImportScrobbleRequest(BaseModel):
    source: str = Field(..., min_length=1, max_length=32)
    entries: list[dict[str, Any]] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class ImportScrobbleSummary(BaseModel):
    inserted: int = 0
    skipped: int = 0
    duplicate: int = 0


class ImportScrobbleResponse(BaseModel):
    source: str
    status: str = "ok"
    summary: ImportScrobbleSummary

    model_config = ConfigDict(from_attributes=True)


class DeleteImportResponse(BaseModel):
    source: str
    deleted: int


class WorkerImportScrobbleRequest(BaseModel):
    user_id: int = Field(..., ge=1)
    source: str = Field(..., min_length=1, max_length=32)
    entries: list[dict[str, Any]] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class UnifiedImportRecord(BaseModel):
    artist_name: str
    song_name: str
    album_name: str | None = None
    artwork_url: str | None = None
    played_at: str
    track_id: str
    source: Literal["spotify", "youtube"]

    model_config = ConfigDict(extra="ignore")


class UnifiedImportRequest(BaseModel):
    source: str | None = None
    entries: list[dict[str, Any]] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class WorkerUnifiedImportRequest(BaseModel):
    user_id: int = Field(..., ge=1)
    source: str | None = None
    entries: list[dict[str, Any]] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class UnifiedImportProgressEvent(BaseModel):
    stage: str
    percent: int = Field(ge=0, le=100)
    message: str
    current: int = 0
    total: int = 0
    summary: ImportScrobbleSummary | None = None
    errors: list[str] = Field(default_factory=list)
    updated_tracks: list[str] = Field(default_factory=list)


class UnifiedImportResponse(BaseModel):
    status: str = "ok"
    source: str
    summary: ImportScrobbleSummary
    errors: list[str] = Field(default_factory=list)
    updated_tracks: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class ImportBatch(BaseModel):
    batch_time: str
    source: str
    count: int
    min_played_at: str | None = None
    max_played_at: str | None = None

class ImportBatchesResponse(BaseModel):
    batches: list[ImportBatch]

class AdvancedDeleteRequest(BaseModel):
    source: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    batch_time: str | None = None
