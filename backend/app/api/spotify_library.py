from __future__ import annotations

import logging

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..api.ingestion import require_worker_token
from ..db import get_db
from ..models import User
from ..schemas.scrobble_settings import UserScrobbleSettingsResponse
from ..schemas.spotify_library import (
    GenreCachePendingItem,
    GenreCachePendingResponse,
    GenreCacheUpsertResponse,
    LikeAlbumPayload,
    LikeAlbumResponse,
    LikeTrackPayload,
    LikeTrackResponse,
    LikedTracksUpsertResponse,
    SavedAlbumsUpsertResponse,
    SpotifySyncResponse,
    WorkerBackfillArtworkRequest,
    WorkerGenreCacheUpsertRequest,
    WorkerLikedTracksSyncRequest,
    WorkerSavedAlbumsSyncRequest,
)
from ..services import scrobble_settings_service
from ..services.spotify_library_service import (
    backfill_scrobble_artwork,
    find_pending_genre_artist_ids,
    toggle_like_album,
    toggle_like_track,
    upsert_genre_cache,
    upsert_liked_tracks,
    upsert_saved_albums,
)

router = APIRouter(prefix="/spotify", tags=["spotify-library"])
logger = logging.getLogger("audio-scrobbler-api")


@router.put("/like-track/{track_id}", response_model=LikeTrackResponse)
def like_track_route(
    track_id: str,
    payload: LikeTrackPayload | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LikeTrackResponse:
    is_liked, spotify_track_id = toggle_like_track(db, current_user, track_id, payload, like=True)
    return LikeTrackResponse(success=True, is_liked=is_liked, spotify_track_id=spotify_track_id)


@router.delete("/like-track/{track_id}", response_model=LikeTrackResponse)
def unlike_track_route(
    track_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LikeTrackResponse:
    is_liked, spotify_track_id = toggle_like_track(db, current_user, track_id, like=False)
    return LikeTrackResponse(success=True, is_liked=is_liked, spotify_track_id=spotify_track_id)


@router.put("/like-album/{album_id_or_name}", response_model=LikeAlbumResponse)
def like_album_route(
    album_id_or_name: str,
    payload: LikeAlbumPayload | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LikeAlbumResponse:
    is_liked, spotify_album_id = toggle_like_album(db, current_user, album_id_or_name, payload, like=True)
    return LikeAlbumResponse(success=True, is_liked=is_liked, spotify_album_id=spotify_album_id)


@router.delete("/like-album/{album_id}", response_model=LikeAlbumResponse)
def unlike_album_route(
    album_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LikeAlbumResponse:
    is_liked, spotify_album_id = toggle_like_album(db, current_user, album_id, like=False)
    return LikeAlbumResponse(success=True, is_liked=is_liked, spotify_album_id=spotify_album_id)


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


@router.post("/internal/saved-albums", response_model=SavedAlbumsUpsertResponse)
def sync_saved_albums_internal(
    payload: WorkerSavedAlbumsSyncRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> SavedAlbumsUpsertResponse:
    user = db.query(User).filter(User.id == payload.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Active user not found")
    return SavedAlbumsUpsertResponse(**upsert_saved_albums(db, user.id, payload.albums))


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


@router.get("/internal/genre-cache/pending", response_model=GenreCachePendingResponse)
def genre_cache_pending(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> GenreCachePendingResponse:
    artists = find_pending_genre_artist_ids(db, limit=limit)
    return GenreCachePendingResponse(
        items=[GenreCachePendingItem(artist_spotify_id=a["artist_id"], artist_name=a["artist_name"]) for a in artists]
    )


@router.post("/internal/genre-cache", response_model=GenreCacheUpsertResponse)
def genre_cache_upsert(
    payload: WorkerGenreCacheUpsertRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> GenreCacheUpsertResponse:
    upserted = upsert_genre_cache(db, [item.model_dump() for item in payload.items])
    return GenreCacheUpsertResponse(upserted=upserted)
