from __future__ import annotations

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
