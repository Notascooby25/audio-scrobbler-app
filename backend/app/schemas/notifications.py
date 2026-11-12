from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, field_validator


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    link: str | None = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str

    @field_validator("endpoint")
    @classmethod
    def validate_push_endpoint(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.scheme != "https":
            raise ValueError("Push endpoint must use HTTPS")
        hostname = (parsed.hostname or "").lower()
        allowed_suffixes = (
            "push.services.mozilla.com",
            "push.apple.com",
            "googleapis.com",
            "notify.windows.com",
            "web.push.apple.com",
            "push.opera.com",
        )
        if not any(hostname == s or hostname.endswith("." + s) for s in allowed_suffixes):
            raise ValueError("Push endpoint domain not recognized as an approved web push service")
        return v


class UnreadCountResponse(BaseModel):
    count: int
