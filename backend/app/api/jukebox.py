from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import ListeningEvent, SavedAlbum, User, UserPreferences

router = APIRouter(prefix="/api/jukebox", tags=["jukebox"])


class JukeboxAlbumItem(BaseModel):
    id: int
    spotify_album_id: str
    album_name: str
    artist_name: str
    release_date: str | None = None
    release_year: int | None = None
    genres: list[str] | None = None
    duration_ms: int | None = None
    label: str | None = None
    artwork_url: str | None = None
    spotify_url: str | None = None
    added_at: str
    last_picked_at: str | None = None
    play_count: int = 0


class JukeboxAlbumsResponse(BaseModel):
    albums: list[JukeboxAlbumItem]
    source: str


class RecordPickRequest(BaseModel):
    album_id: int
    mode: str = "any"


def _hash_seed(seed_str: str) -> int:
    h = 2166136261
    for char in seed_str:
        h ^= ord(char)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


@router.get("/albums", response_model=JukeboxAlbumsResponse)
def get_jukebox_albums(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JukeboxAlbumsResponse:
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    source = prefs.jukebox_source if prefs else "spotify_saved"

    saved_albums = db.query(SavedAlbum).filter(SavedAlbum.user_id == current_user.id).all()

    # If library_archive chosen or user has 0 saved albums, fallback to top scrobbled albums
    if source == "library_archive" or not saved_albums:
        scrobble_albums = (
            db.query(
                ListeningEvent.album_name,
                ListeningEvent.artist_name,
                func.count().label("plays"),
                func.max(ListeningEvent.artwork_url).label("artwork_url"),
                func.min(ListeningEvent.played_at).label("first_played"),
            )
            .filter(
                ListeningEvent.user_id == current_user.id,
                ListeningEvent.album_name.isnot(None),
                ListeningEvent.album_name != "",
            )
            .group_by(ListeningEvent.album_name, ListeningEvent.artist_name)
            .order_by(func.count().desc())
            .limit(100)
            .all()
        )
        items = []
        for idx, row in enumerate(scrobble_albums):
            items.append(
                JukeboxAlbumItem(
                    id=idx + 1,
                    spotify_album_id=f"archive-{idx + 1}",
                    album_name=row.album_name,
                    artist_name=row.artist_name,
                    artwork_url=row.artwork_url,
                    added_at=row.first_played.isoformat()
                    if row.first_played
                    else datetime.now(timezone.utc).isoformat(),
                    play_count=row.plays,
                    genres=[],
                )
            )
        return JukeboxAlbumsResponse(albums=items, source="library_archive")

    # Aggregate play counts for saved albums from listening_events
    album_names = {a.album_name for a in saved_albums if a.album_name}
    counts_map = {}
    if album_names:
        counts = (
            db.query(ListeningEvent.album_name, ListeningEvent.artist_name, func.count().label("plays"))
            .filter(
                ListeningEvent.user_id == current_user.id,
                ListeningEvent.album_name.in_(album_names),
            )
            .group_by(ListeningEvent.album_name, ListeningEvent.artist_name)
            .all()
        )
        for c in counts:
            counts_map[(c.album_name.lower(), c.artist_name.lower())] = c.plays

    items = []
    for a in saved_albums:
        plays = counts_map.get((a.album_name.lower(), a.artist_name.lower()), 0)
        items.append(
            JukeboxAlbumItem(
                id=a.id,
                spotify_album_id=a.spotify_album_id,
                album_name=a.album_name,
                artist_name=a.artist_name,
                release_date=a.release_date,
                release_year=a.release_year,
                genres=a.genres or [],
                duration_ms=a.duration_ms,
                label=a.label,
                artwork_url=a.artwork_url,
                spotify_url=a.spotify_url,
                added_at=a.added_at.isoformat(),
                last_picked_at=a.last_picked_at.isoformat() if a.last_picked_at else None,
                play_count=plays,
            )
        )
    return JukeboxAlbumsResponse(albums=items, source="spotify_saved")


@router.post("/record-pick")
def record_pick(
    payload: RecordPickRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    album = (
        db.query(SavedAlbum).filter(SavedAlbum.id == payload.album_id, SavedAlbum.user_id == current_user.id).first()
    )
    if album:
        album.last_picked_at = datetime.now(timezone.utc)
        db.commit()
    return {"status": "ok"}


@router.get("/daily", response_model=JukeboxAlbumItem)
def get_daily_album(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JukeboxAlbumItem:
    res = get_jukebox_albums(db, current_user)
    if not res.albums:
        raise HTTPException(status_code=404, detail="No albums available for daily pick")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    seed = _hash_seed(today_str)
    sorted_albums = sorted(res.albums, key=lambda a: a.id)
    daily = sorted_albums[seed % len(sorted_albums)]
    return daily
