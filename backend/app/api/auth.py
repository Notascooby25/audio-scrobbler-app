from __future__ import annotations

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas.auth import AccessTokenResponse, DevTokenRequest
from ..schemas.spotify import SpotifyAuthorizeResponse, SpotifyCallbackResponse
from ..services.auth_service import create_access_token
from ..services.spotify_oauth_service import build_authorization_url, complete_spotify_callback, create_oauth_state

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/spotify/authorize", response_model=SpotifyAuthorizeResponse)
def spotify_authorize() -> SpotifyAuthorizeResponse:
    if not settings.spotify_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Spotify OAuth is not configured")
    state = create_oauth_state()
    return SpotifyAuthorizeResponse(authorization_url=build_authorization_url(state), state=state)


@router.get("/spotify/callback", response_model=None)
def spotify_callback(
    code: str = Query(min_length=1),
    state: str = Query(min_length=1),
    db: Session = Depends(get_db),
) -> SpotifyCallbackResponse | RedirectResponse:
    try:
        access_token, user_id = complete_spotify_callback(db, code, state)
    except (ValueError, jwt.InvalidTokenError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Spotify OAuth request failed") from exc
    response = SpotifyCallbackResponse(access_token=access_token, expires_in=settings.access_token_ttl_seconds, user_id=user_id)
    if settings.frontend_auth_callback_url:
        callback_fragment = f"access_token={response.access_token}&expires_in={response.expires_in}&user_id={response.user_id}"
        return RedirectResponse(f"{settings.frontend_auth_callback_url}#{callback_fragment}")
    return response


@router.post("/dev-token", response_model=AccessTokenResponse)
def create_dev_token(request: DevTokenRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    if settings.environment.lower() != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    user = db.query(User).filter(User.id == request.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")
    return AccessTokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_ttl_seconds,
    )