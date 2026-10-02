from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnreadCountResponse(BaseModel):
    count: int
