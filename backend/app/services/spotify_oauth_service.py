from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import requests
from sqlalchemy.orm import Session

from ..config import settings
from ..models import User
from ..security import encrypt_refresh_token
from .auth_service import create_access_token
from .username_service import generate_unique_username

SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_PROFILE_URL = "https://api.spotify.com/v1/me"

# Spotify's quota is per-app (client_id), not per-user, so this is process-wide
# state shared by every request the backend makes, independent of the worker's
# own copy of this same tracking for its background polling.
_spotify_blocked_until: datetime | None = None
# Spotify doesn't always send Retry-After on a quota (as opposed to per-second
# rate-limit) rejection; fall back to a conservative pause rather than letting
# every subsequent Connect attempt hit Spotify again immediately.
DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 1800.0


class SpotifyAccessDeniedError(Exception):
    """Raised when a Spotify account is not on the allowlist, if one is configured."""


class SpotifyRateLimitedError(Exception):
    """Raised instead of contacting Spotify while the app-wide quota block is active."""

    def __init__(self, blocked_until: datetime):
        self.blocked_until = blocked_until
        super().__init__(f"Spotify quota exhausted; paused until {blocked_until.isoformat()}")


def spotify_rate_limit_blocked_until() -> datetime | None:
    """Returns when the current quota block expires, or None if we're clear to call Spotify."""
    global _spotify_blocked_until
    if _spotify_blocked_until and datetime.now(timezone.utc) < _spotify_blocked_until:
        return _spotify_blocked_until
    _spotify_blocked_until = None
    return None


def _mark_spotify_rate_limited(retry_after_header: str | None) -> datetime:
    global _spotify_blocked_until
    try:
        seconds = float(retry_after_header) if retry_after_header else DEFAULT_RATE_LIMIT_BACKOFF_SECONDS
    except ValueError:
        seconds = DEFAULT_RATE_LIMIT_BACKOFF_SECONDS
    seconds = max(seconds, 60.0)
    _spotify_blocked_until = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    return _spotify_blocked_until


def create_oauth_state() -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    return jwt.encode({"purpose": "spotify-oauth", "exp": expires_at}, settings.jwt_secret, algorithm="HS256")


def validate_oauth_state(state: str) -> None:
    claims = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
    if claims.get("purpose") != "spotify-oauth":
        raise ValueError("Invalid OAuth state")


def build_authorization_url(state: str) -> str:
    params = {
        "client_id": settings.spotify_client_id,
        "response_type": "code",
        "redirect_uri": settings.spotify_redirect_uri,
        "scope": settings.spotify_scopes,
        "state": state,
    }
    return f"{SPOTIFY_AUTHORIZE_URL}?{urlencode(params)}"


def complete_spotify_callback(db: Session, code: str, state: str) -> tuple[str, int]:
    validate_oauth_state(state)
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        raise SpotifyRateLimitedError(blocked_until)
    token_response = requests.post(
        SPOTIFY_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.spotify_redirect_uri,
        },
        auth=(settings.spotify_client_id, settings.spotify_client_secret),
        timeout=10,
    )
    if token_response.status_code == 429:
        raise SpotifyRateLimitedError(_mark_spotify_rate_limited(token_response.headers.get("Retry-After")))
    token_response.raise_for_status()
    token_data = token_response.json()
    profile_response = requests.get(
        SPOTIFY_PROFILE_URL,
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
        timeout=10,
    )
    if profile_response.status_code == 429:
        raise SpotifyRateLimitedError(_mark_spotify_rate_limited(profile_response.headers.get("Retry-After")))
    profile_response.raise_for_status()
    profile = profile_response.json()
    spotify_user_id = profile["id"]
    allowed_ids = settings.allowed_spotify_ids()
    if allowed_ids and spotify_user_id not in allowed_ids:
        raise SpotifyAccessDeniedError(spotify_user_id)
    user = db.query(User).filter(User.spotify_user_id == spotify_user_id).first()
    if user is None:
        user = User(
            spotify_user_id=spotify_user_id,
            username=generate_unique_username(db, profile.get("display_name") or spotify_user_id),
            display_name=profile.get("display_name") or spotify_user_id,
            refresh_token_cipher=encrypt_refresh_token(token_data["refresh_token"]),
            is_active=True,
        )
        db.add(user)
    else:
        user.refresh_token_cipher = encrypt_refresh_token(token_data["refresh_token"])
        user.is_active = True
    db.commit()
    db.refresh(user)
    return create_access_token(user.id), user.id