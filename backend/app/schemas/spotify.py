from __future__ import annotations

from pydantic import BaseModel


class SpotifyAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str


class SpotifyStatusResponse(BaseModel):
    rate_limited: bool
    retry_after: str | None = None


class SpotifyCallbackResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int