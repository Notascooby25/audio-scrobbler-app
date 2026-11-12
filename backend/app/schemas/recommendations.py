from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MusicRecommendationCreate(BaseModel):
    receiver_id: int
    item_type: str = Field(..., max_length=16)  # "track", "album", "artist"
    title: str = Field(..., max_length=255)
    artist_name: str = Field(..., max_length=255)
    album_name: str | None = Field(None, max_length=255)
    image_url: str | None = None
    spotify_uri: str | None = Field(None, max_length=255)
    spotify_url: str | None = None
    note: str | None = Field(None, max_length=280)


class MusicRecommendationStatusUpdate(BaseModel):
    status: str = Field(..., max_length=16)  # "listened", "dismissed"


class MusicRecommendationResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    sender_name: str | None = None
    item_type: str
    title: str
    artist_name: str
    album_name: str | None = None
    image_url: str | None = None
    spotify_uri: str | None = None
    spotify_url: str | None = None
    note: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
