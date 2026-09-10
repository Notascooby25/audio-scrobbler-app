from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import LikedTrack, User
from ..schemas.spotify_library import LikedTracksResponse, SpotifySyncResponse
from ..services.spotify_library_service import backfill_scrobble_artwork, sync_liked_tracks

router = APIRouter(prefix="/spotify", tags=["spotify-library"])


@router.post("/sync-liked-tracks", response_model=SpotifySyncResponse)
def sync_spotify_liked_tracks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpotifySyncResponse:
    try:
        return SpotifySyncResponse(**sync_liked_tracks(db, current_user))
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Spotify liked-track sync failed") from exc


@router.post("/backfill-artwork", response_model=SpotifySyncResponse)
def backfill_artwork(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpotifySyncResponse:
    try:
        return SpotifySyncResponse(**backfill_scrobble_artwork(db, current_user))
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Spotify artwork backfill failed") from exc


@router.get("/liked-tracks", response_model=LikedTracksResponse)
def list_liked_tracks(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LikedTracksResponse:
    query = db.query(LikedTrack).filter(LikedTrack.user_id == current_user.id).order_by(LikedTrack.added_at.desc())
    total_count = query.count()
    return LikedTracksResponse(user_id=current_user.id, tracks=query.limit(limit).offset(offset).all(), total_count=total_count)