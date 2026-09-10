from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FollowActionResponse(BaseModel):
    following: bool
    follower_count: int

    model_config = ConfigDict(from_attributes=True)


class UserSearchResult(BaseModel):
    id: int
    username: str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class UserSearchResponse(BaseModel):
    results: list[UserSearchResult]


class LastScrobble(BaseModel):
    track_name: str
    artist_name: str
    album_name: str | None
    source: str
    played_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileResponse(BaseModel):
    id: int
    username: str
    display_name: str
    follower_count: int
    following_count: int
    is_self: bool
    is_following: bool
    can_view_details: bool
    last_scrobble: LastScrobble | None

    model_config = ConfigDict(from_attributes=True)
