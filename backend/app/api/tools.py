from __future__ import annotations
import re
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.ingestion import ListeningEventCreate
from ..services.bbc_sounds_service import fetch_bbc_playlist
from ..services.ingestion_service import ingest_listening_event
from ..services.spotify_playlist_service import create_playlist

router = APIRouter(prefix="/tools", tags=["tools"])

def _extract_play_id(url: str) -> str:
    match = re.search(r'/play/([a-zA-Z0-9]+)', url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid BBC Sounds URL. Make sure it contains /play/<id>")
    return match.group(1)

class ScopeCreepRequest(BaseModel):
    url: str

class ScopeCreepResponse(BaseModel):
    message: str
    playlist_url: str

class ScopeCreepTrackItem(BaseModel):
    segment_id: str
    artist: str
    title: str
    offset_seconds: int = 0
    duration_seconds: int | None = None
    spotify_uri: str | None = None
    image_url: str | None = None

class ScopeCreepFetchResponse(BaseModel):
    play_id: str
    title: str
    tracks: list[ScopeCreepTrackItem]

class ScopeCreepPlaylistCreateRequest(BaseModel):
    url: str
    title: str
    spotify_uris: list[str]

class ScopeCreepScrobbleTrack(BaseModel):
    segment_id: str
    artist: str
    title: str
    offset_seconds: int = 0
    duration_seconds: int | None = None
    spotify_uri: str | None = None

class ScopeCreepScrobbleRequest(BaseModel):
    play_id: str
    listened_at: datetime | None = None
    tracks: list[ScopeCreepScrobbleTrack]

class ScopeCreepScrobbleResponse(BaseModel):
    message: str
    scrobbled_count: int
    duplicate_count: int

@router.post("/scope-creep/fetch", response_model=ScopeCreepFetchResponse)
def scope_creep_fetch(
    req: ScopeCreepRequest,
    current_user: User = Depends(get_current_user),
):
    play_id = _extract_play_id(req.url)
    try:
        bbc_data = fetch_bbc_playlist(play_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch BBC Sounds data: {str(e)}")

    return ScopeCreepFetchResponse(
        play_id=play_id,
        title=bbc_data["title"],
        tracks=[ScopeCreepTrackItem(**t) for t in bbc_data["tracks"]]
    )

@router.post("/scope-creep/playlist", response_model=ScopeCreepResponse)
def scope_creep_playlist(
    req: ScopeCreepPlaylistCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.spotify_uris:
        raise HTTPException(status_code=400, detail="No Spotify tracks selected to create playlist.")

    try:
        playlist_url = create_playlist(
            db,
            current_user,
            req.title,
            f"Generated from {req.url} via Audio Scrobbler App Scope Creep",
            req.spotify_uris
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create Spotify playlist: {str(e)}")

    return ScopeCreepResponse(
        message=f"Created playlist '{req.title}' with {len(req.spotify_uris)} tracks.",
        playlist_url=playlist_url
    )

@router.post("/scope-creep/scrobble", response_model=ScopeCreepScrobbleResponse)
def scope_creep_scrobble(
    req: ScopeCreepScrobbleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.tracks:
        raise HTTPException(status_code=400, detail="No tracks provided to scrobble.")

    base_time = req.listened_at or datetime.now(timezone.utc)
    scrobbled_count = 0
    duplicate_count = 0

    for track in req.tracks:
        played_at = base_time + timedelta(seconds=track.offset_seconds)
        canonical_play_id = f"bbc_{req.play_id}_{track.segment_id}"
        track_id = track.spotify_uri or f"bbc:{track.segment_id}"
        duration_ms = (track.duration_seconds * 1000) if track.duration_seconds else None

        event_create = ListeningEventCreate(
            track_id=track_id,
            track_name=track.title,
            artist_name=track.artist,
            played_at=played_at,
            duration_ms=duration_ms,
            source="bbc_sounds",
            play_id=canonical_play_id,
        )

        res = ingest_listening_event(db, current_user.id, event_create)
        if res.duplicate:
            duplicate_count += 1
        else:
            scrobbled_count += 1

    return ScopeCreepScrobbleResponse(
        message=f"Scrobbled {scrobbled_count} tracks ({duplicate_count} duplicates skipped).",
        scrobbled_count=scrobbled_count,
        duplicate_count=duplicate_count
    )

@router.post("/scope-creep", response_model=ScopeCreepResponse)
def scope_creep(
    req: ScopeCreepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    play_id = _extract_play_id(req.url)
    
    try:
        bbc_data = fetch_bbc_playlist(play_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch BBC Sounds data: {str(e)}")
        
    if not bbc_data["spotify_uris"]:
        raise HTTPException(status_code=400, detail="No Spotify tracks found for this BBC Sounds episode.")
        
    try:
        playlist_url = create_playlist(
            db, 
            current_user, 
            bbc_data["title"], 
            f"Generated from {req.url} via Audio Scrobbler App Scope Creep",
            bbc_data["spotify_uris"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create Spotify playlist: {str(e)}")
        
    return ScopeCreepResponse(
        message=f"Created playlist '{bbc_data['title']}' with {len(bbc_data['spotify_uris'])} tracks.",
        playlist_url=playlist_url
    )
