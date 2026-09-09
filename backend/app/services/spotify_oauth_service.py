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
    token_response.raise_for_status()
    token_data = token_response.json()
    profile_response = requests.get(
        SPOTIFY_PROFILE_URL,
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
        timeout=10,
    )
    profile_response.raise_for_status()
    profile = profile_response.json()
    spotify_user_id = profile["id"]
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