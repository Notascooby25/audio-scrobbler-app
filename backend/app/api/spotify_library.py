from __future__ import annotations

import logging

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..api.ingestion import require_worker_token
from ..db import get_db
from ..models import LikedTrack, User
from ..schemas.spotify_library import (
    LikedTracksResponse,
    SpotifySyncResponse,
    TrackLikeResponse,
    WorkerLikedTrackSyncRequest,
)
from ..services.spotify_library_service import backfill_scrobble_artwork, set_track_liked, sync_liked_tracks

router = APIRouter(prefix="/spotify", tags=["spotify-library"])
logger = logging.getLogger("audio-scrobbler-api")


@router.post("/sync-liked-tracks", response_model=SpotifySyncResponse)
def sync_spotify_liked_tracks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpotifySyncResponse:
    try:
        return SpotifySyncResponse(**sync_liked_tracks(db, current_user))
    except (KeyError, ValueError, requests.RequestException) as exc:
        # HTTPException is handled cleanly by FastAPI and normally logs no
        # traceback at all, so the *cause* of a 502 here was previously
        # unrecoverable from `docker logs` after the fact.
        logger.exception("Spotify liked-track sync failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="Spotify liked-track sync failed") from exc


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


@router.post("/internal/sync-liked-tracks", response_model=SpotifySyncResponse)
def sync_spotify_liked_tracks_internal(
    payload: WorkerLikedTrackSyncRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> SpotifySyncResponse:
    """Same as /sync-liked-tracks, worker-token gated so the scheduler can run
    this automatically alongside the recently-played sync, without a user's
    session token."""
    user = db.query(User).filter(User.id == payload.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Active user not found")
    try:
        return SpotifySyncResponse(**sync_liked_tracks(db, user))
    except (KeyError, ValueError, requests.RequestException) as exc:
        logger.exception("Spotify liked-track sync failed for user %s", user.id)
        raise HTTPException(status_code=502, detail="Spotify liked-track sync failed") from exc


@router.post("/internal/backfill-artwork", response_model=SpotifySyncResponse)
def backfill_artwork_internal(
    payload: WorkerLikedTrackSyncRequest,
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


@router.get("/liked-tracks", response_model=LikedTracksResponse)
def list_liked_tracks(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, description="Search query for track, artist, or album name."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LikedTracksResponse:
    query = db.query(LikedTrack).filter(LikedTrack.user_id == current_user.id)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                LikedTrack.track_name.ilike(search_term),
                LikedTrack.artist_name.ilike(search_term),
                LikedTrack.album_name.ilike(search_term)
            )
        )
    query = query.order_by(LikedTrack.added_at.desc())
    total_count = query.count()
    return LikedTracksResponse(user_id=current_user.id, tracks=query.limit(limit).offset(offset).all(), total_count=total_count)


@router.put("/tracks/{track_id}/like", response_model=TrackLikeResponse)
def like_track(
    track_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrackLikeResponse:
    try:
        return TrackLikeResponse(**set_track_liked(db, current_user, track_id, True))
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Spotify like request failed") from exc


@router.delete("/tracks/{track_id}/like", response_model=TrackLikeResponse)
def unlike_track(
    track_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrackLikeResponse:
    try:
        return TrackLikeResponse(**set_track_liked(db, current_user, track_id, False))
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Spotify unlike request failed") from exc