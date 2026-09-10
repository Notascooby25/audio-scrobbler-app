from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BlockedItemResponse(BaseModel):
    id: int
    entity_type: str
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BlockedItemsResponse(BaseModel):
    blocks: list[BlockedItemResponse]


class BlockCreateRequest(BaseModel):
    entity_type: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=255)


class BlockCreateResponse(BaseModel):
    block: BlockedItemResponse
    hidden_count: int


class DeleteEntriesRequest(BaseModel):
    entity_type: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=255)
    secondary: str | None = Field(default=None, max_length=255)


class DeleteEntriesResponse(BaseModel):
    deleted: int
