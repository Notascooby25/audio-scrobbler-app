from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class FriendContribution(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    scrobbles: int


class SharedEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    artist_name: str | None = None
    total_scrobbles: int
    contributions: list[FriendContribution]


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    is_current_user: bool
    minutes_listened: int
    scrobbles: int
    rank: int


class FriendsComparisonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    has_friends: bool
    top_artists: list[SharedEntity]
    top_tracks: list[SharedEntity]
    leaderboard: list[LeaderboardEntry]
