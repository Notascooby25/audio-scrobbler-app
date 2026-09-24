from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SpotifySyncResponse(BaseModel):
    fetched: int
    inserted: int
    updated: int
    artwork_updated: int


class WorkerBackfillArtworkRequest(BaseModel):
    user_id: int = Field(gt=0)


class WorkerLikedTrackItem(BaseModel):
    spotify_track_id: str
    track_name: str
    artist_name: str
    album_name: str | None = None
    artwork_url: str | None = None
    artist_artwork_url: str | None = None
    added_at: datetime
    raw_metadata: dict[str, object] | None = None


class WorkerLikedTracksSyncRequest(BaseModel):
    user_id: int = Field(gt=0)
    tracks: list[WorkerLikedTrackItem]


class LikedTracksUpsertResponse(BaseModel):
    inserted: int
    updated: int



class GenreCachePendingItem(BaseModel):
    artist_spotify_id: str
    artist_name: str

class GenreCachePendingResponse(BaseModel):
    items: list[GenreCachePendingItem]

class WorkerGenreCacheItem(BaseModel):
    artist_spotify_id: str
    genres: list[str]

class WorkerGenreCacheUpsertRequest(BaseModel):
    items: list[WorkerGenreCacheItem]

class GenreCacheUpsertResponse(BaseModel):
    upserted: int
