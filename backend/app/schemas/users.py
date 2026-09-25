from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FollowActionResponse(BaseModel):
    following: bool
    follower_count: int

    model_config = ConfigDict(from_attributes=True)


class LastScrobble(BaseModel):
    track_name: str
    artist_name: str
    album_name: str | None
    source: str
    played_at: datetime
    track_id: str | None = None
    artwork_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserSearchResult(BaseModel):
    id: int
    username: str
    display_name: str
    last_scrobble: LastScrobble | None = None

    model_config = ConfigDict(from_attributes=True)


class UserSearchResponse(BaseModel):
    results: list[UserSearchResult]


class FollowingListResponse(BaseModel):
    results: list[UserSearchResult]


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


class NowPlayingResponse(BaseModel):
    is_playing: bool
    track_id: str | None = None
    track_name: str | None = None
    artist_name: str | None = None
    album_name: str | None = None
    artwork_url: str | None = None
    progress_ms: int | None = None
    duration_ms: int | None = None
    raw_metadata: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class LeaderboardItem(BaseModel):
    user: UserSearchResult
    scrobble_count: int
    unique_artists: int

    model_config = ConfigDict(from_attributes=True)


class LeaderboardResponse(BaseModel):
    results: list[LeaderboardItem]
