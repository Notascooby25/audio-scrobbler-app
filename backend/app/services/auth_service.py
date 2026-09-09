from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from ..config import settings


def create_access_token(user_id: int, expires_in: int | None = None) -> str:
    lifetime = expires_in if expires_in is not None else settings.access_token_ttl_seconds
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=lifetime)
    return jwt.encode({"sub": str(user_id), "exp": expires_at}, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> int:
    claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.isdigit():
        raise ValueError("Invalid access token subject")
    return int(subject)