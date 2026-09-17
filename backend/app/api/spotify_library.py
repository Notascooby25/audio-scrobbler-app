from __future__ import annotations

import logging

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..api.ingestion import require_worker_token
from ..db import get_db
from ..models import User
from ..schemas.scrobble_settings import UserScrobbleSettingsResponse
from ..schemas.spotify_library import (
    LikedTracksUpsertResponse,
    SpotifySyncResponse,
    WorkerBackfillArtworkRequest,
    WorkerLikedTracksSyncRequest,
)
from ..services import scrobble_settings_service
from ..services.spotify_library_service import backfill_scrobble_artwork, upsert_liked_tracks

router = APIRouter(prefix="/spotify", tags=["spotify-library"])
logger = logging.getLogger("audio-scrobbler-api")


@router.post("/sync-liked", response_model=UserScrobbleSettingsResponse)
def sync_liked_tracks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserScrobbleSettingsResponse:
    settings = scrobble_settings_service.enable_liked_tracks_sync(db, current_user.id)
    return UserScrobbleSettingsResponse.from_model(settings)


@router.post("/internal/liked-tracks", response_model=LikedTracksUpsertResponse)
def sync_liked_tracks_internal(
    payload: WorkerLikedTracksSyncRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> LikedTracksUpsertResponse:
    user = db.query(User).filter(User.id == payload.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Active user not found")
    return LikedTracksUpsertResponse(**upsert_liked_tracks(db, user.id, payload.tracks))


@router.post("/backfill-artwork", response_model=SpotifySyncResponse)
def backfill_artwork(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpotifySyncResponse:
    try:
        return SpotifySyncResponse(**backfill_scrobble_artwork(db, current_user))
    except (KeyError, ValueError, requests.RequestException) as exc:
        logger.exception("Spotify artwork backfill failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="Spotify artwork backfill failed") from exc


@router.post("/internal/backfill-artwork", response_model=SpotifySyncResponse)
def backfill_artwork_internal(
    payload: WorkerBackfillArtworkRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> SpotifySyncResponse:
    user = db.query(User).filter(User.id == payload.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Active user not found")
    try:
        return SpotifySyncResponse(**backfill_scrobble_artwork(db, user))
    except (KeyError, ValueError, requests.RequestException) as exc:
        logger.exception("Spotify artwork backfill failed for user %s", user.id)
        raise HTTPException(status_code=502, detail="Spotify artwork backfill failed") from exc