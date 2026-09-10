from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LikedTrackResponse(BaseModel):
    id: int
    spotify_track_id: str
    track_name: str
    artist_name: str
    album_name: str | None
    artwork_url: str | None
    added_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LikedTracksResponse(BaseModel):
    user_id: int
    tracks: list[LikedTrackResponse]
    total_count: int


class SpotifySyncResponse(BaseModel):
    fetched: int
    inserted: int
    updated: int
    artwork_updated: int
