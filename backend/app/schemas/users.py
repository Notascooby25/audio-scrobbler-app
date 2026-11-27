from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer, model_validator


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
    artwork_color: str | None = None

    @field_serializer("played_at")
    def serialize_played_at(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

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


class FollowerSummary(BaseModel):
    """A follower as seen by the person they follow. Deliberately has no listening data."""

    id: int
    username: str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class FollowersListResponse(BaseModel):
    results: list[FollowerSummary]


class RemoveFollowerResponse(BaseModel):
    follower_count: int


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
    artwork_color: str | None = None
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

class CopyScrobblesRequest(BaseModel):
    start_date: datetime
    end_date: datetime


class CopyScrobblesResponse(BaseModel):
    copied_count: int


class ShareScrobblesRequest(BaseModel):
    start_date: datetime
    end_date: datetime

    @model_validator(mode="after")
    def _end_not_before_start(self) -> "ShareScrobblesRequest":
        # Comparing an aware and a naive time raises TypeError, so strip the zone from both.
        if _naive_utc(self.end_date) < _naive_utc(self.start_date):
            raise ValueError("end_date must not be before start_date")
        return self


class ShareScrobblesResponse(BaseModel):
    shared_count: int


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)

