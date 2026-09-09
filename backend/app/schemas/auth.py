from __future__ import annotations

from pydantic import BaseModel, Field


class DevTokenRequest(BaseModel):
    user_id: int = Field(gt=0)


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int