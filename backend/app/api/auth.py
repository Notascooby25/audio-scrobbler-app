from __future__ import annotations

import logging
from datetime import datetime, timezone

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas.auth import AccessTokenResponse, DevTokenRequest
from ..schemas.spotify import SpotifyAuthorizeResponse, SpotifyCallbackResponse, SpotifyStatusResponse
from ..services.auth_service import create_access_token
from ..services.spotify_oauth_service import (
    SpotifyAccessDeniedError,
    SpotifyRateLimitedError,
    build_authorization_url,
    complete_spotify_callback,
    create_oauth_state,
    spotify_rate_limit_blocked_until,
)

logger = logging.getLogger("audio-scrobbler-api")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/spotify/status", response_model=SpotifyStatusResponse)
def spotify_status() -> SpotifyStatusResponse:
    blocked_until = spotify_rate_limit_blocked_until()
    return SpotifyStatusResponse(rate_limited=blocked_until is not None, retry_after=blocked_until.isoformat() if blocked_until else None)


@router.get("/spotify/authorize", response_model=SpotifyAuthorizeResponse)
def spotify_authorize(force_dialog: bool = Query(default=False)) -> SpotifyAuthorizeResponse:
    if not settings.spotify_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Spotify OAuth is not configured")
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Spotify is rate-limiting this app until {blocked_until.isoformat()}",
            headers={"Retry-After": str(int((blocked_until - datetime.now(timezone.utc)).total_seconds()))},
        )
    state = create_oauth_state()
    return SpotifyAuthorizeResponse(authorization_url=build_authorization_url(state, force_dialog=force_dialog), state=state)


@router.get("/spotify/callback", response_model=None)
def spotify_callback(
    code: str | None = Query(default=None),
    state: str = Query(min_length=1),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> SpotifyCallbackResponse | RedirectResponse:
    if error:
        if settings.frontend_auth_callback_url:
            return RedirectResponse(f"{settings.frontend_auth_callback_url}#auth_error=spotify_authorization_denied")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Spotify authorization was not completed")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Spotify authorization code is missing")
    try:
        access_token, user_id = complete_spotify_callback(db, code, state)
    except SpotifyAccessDeniedError as exc:
        if settings.frontend_auth_callback_url:
            return RedirectResponse(f"{settings.frontend_auth_callback_url}#auth_error=account_not_allowed")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This Spotify account is not authorized to use this app") from exc
    except (ValueError, jwt.InvalidTokenError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state") from exc
    except SpotifyRateLimitedError as exc:
        retry_after_seconds = int((exc.blocked_until - datetime.now(timezone.utc)).total_seconds())
        if settings.frontend_auth_callback_url:
            return RedirectResponse(f"{settings.frontend_auth_callback_url}#auth_error=spotify_rate_limited")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Spotify is rate-limiting this app until {exc.blocked_until.isoformat()}",
            headers={"Retry-After": str(max(retry_after_seconds, 0))},
        ) from exc
    except requests.RequestException as exc:
        # Spotify's error body (invalid_grant, invalid_client, ...) is the only way to tell
        # a reused/expired code apart from bad credentials, so surface it in the logs.
        spotify_response = getattr(exc, "response", None)
        if spotify_response is not None:
            logger.warning(
                "Spotify OAuth token exchange failed: HTTP %s %s",
                spotify_response.status_code,
                spotify_response.text[:500],
            )
        else:
            logger.warning("Spotify OAuth token exchange failed: %s: %s", type(exc).__name__, exc)
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