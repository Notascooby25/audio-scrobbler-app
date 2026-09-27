from __future__ import annotations
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import ArtworkCache, ListeningEvent, User
from ..schemas.ingestion import ListeningEventCreate
from ..services.bbc_sounds_service import fetch_bbc_playlist
from ..services.ingestion_service import ingest_listening_event
from ..services.processed_import_service import deezer_artwork, deezer_search, itunes_artwork
from ..services.spotify_playlist_service import add_tracks_to_playlist, create_playlist, get_user_playlists

router = APIRouter(prefix="/tools", tags=["tools"])

def _extract_play_id(url: str) -> str:
    match = re.search(r'/play/([a-zA-Z0-9]+)', url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid BBC Sounds URL. Make sure it contains /play/<id>")
    return match.group(1)

def fetch_external_artwork(artist: str, title: str) -> str | None:
    try:
        art = itunes_artwork(artist, title)
        if not art:
            dz = deezer_search(artist, title)
            if dz:
                art = deezer_artwork(dz)
        return art
    except Exception:
        return None

def resolve_artwork(artist: str, title: str, db: Session | None = None, track_id: str | None = None) -> str | None:
    if db and track_id:
        cached = db.query(ArtworkCache).filter(ArtworkCache.track_id == track_id).first()
        if cached and cached.artwork_url:
            return cached.artwork_url

    art = fetch_external_artwork(artist, title)

    if art and db and track_id:
        try:
            db.merge(ArtworkCache(track_id=track_id, artwork_url=art))
            db.commit()
        except Exception:
            db.rollback()

    return art

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

class ScopeCreepPlaylistItem(BaseModel):
    id: str
    name: str
    url: str

class ScopeCreepPlaylistsResponse(BaseModel):
    playlists: list[ScopeCreepPlaylistItem]
    needs_scope: bool = False

class ScopeCreepPlaylistCreateRequest(BaseModel):
    url: str = ""
    title: str | None = None
    mode: str = "create"  # "create" or "existing"
    playlist_id: str | None = None
    spotify_uris: list[str]

class ScopeCreepScrobbleTrack(BaseModel):
    segment_id: str
    artist: str
    title: str
    offset_seconds: int = 0
    duration_seconds: int | None = None
    spotify_uri: str | None = None
    artwork_url: str | None = None

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    play_id = _extract_play_id(req.url)
    try:
        bbc_data = fetch_bbc_playlist(play_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch BBC Sounds data: {str(e)}")

    track_ids = [t.get("spotify_uri") or f"bbc:{t.get('segment_id')}" for t in bbc_data["tracks"]]
    cached_records = db.query(ArtworkCache).filter(ArtworkCache.track_id.in_(track_ids)).all()
    cache_map = {c.track_id: c.artwork_url for c in cached_records if c.artwork_url}

    def _lookup(t: dict) -> tuple[str, str | None]:
        t_id = t.get("spotify_uri") or f"bbc:{t.get('segment_id')}"
        if t_id in cache_map:
            return t_id, cache_map[t_id]
        if t.get("image_url"):
            return t_id, t["image_url"]
        return t_id, fetch_external_artwork(t["artist"], t["title"])

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(_lookup, bbc_data["tracks"]))

    resolved_map = dict(results)

    new_entries = [
        ArtworkCache(track_id=t_id, artwork_url=art)
        for t_id, art in resolved_map.items()
        if art and t_id not in cache_map
    ]
    if new_entries:
        try:
            for entry in new_entries:
                db.merge(entry)
            db.commit()
        except Exception:
            db.rollback()

    resolved_tracks = [
        ScopeCreepTrackItem(
            segment_id=t["segment_id"],
            artist=t["artist"],
            title=t["title"],
            offset_seconds=t.get("offset_seconds", 0),
            duration_seconds=t.get("duration_seconds"),
            spotify_uri=t.get("spotify_uri"),
            image_url=resolved_map.get(t.get("spotify_uri") or f"bbc:{t.get('segment_id')}"),
        )
        for t in bbc_data["tracks"]
    ]

    return ScopeCreepFetchResponse(
        play_id=play_id,
        title=bbc_data["title"],
        tracks=resolved_tracks
    )

@router.get("/scope-creep/playlists", response_model=ScopeCreepPlaylistsResponse)
def scope_creep_playlists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        data = get_user_playlists(db, current_user)
        return ScopeCreepPlaylistsResponse(
            playlists=[
                ScopeCreepPlaylistItem(id=p["id"], name=p["name"], url=p["url"])
                for p in data.get("playlists", [])
            ],
            needs_scope=data.get("needs_scope", False),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch user playlists: {str(e)}")

@router.post("/scope-creep/playlist", response_model=ScopeCreepResponse)
def scope_creep_playlist(
    req: ScopeCreepPlaylistCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.spotify_uris:
        raise HTTPException(status_code=400, detail="No Spotify tracks selected to create playlist.")

    try:
        if req.mode == "existing":
            if not req.playlist_id or not req.playlist_id.strip():
                raise HTTPException(status_code=400, detail="Please select or provide a Spotify playlist ID or URL.")
            playlist_name, playlist_url, count = add_tracks_to_playlist(
                db,
                current_user,
                req.playlist_id,
                req.spotify_uris,
            )
            message = f"Added {count} tracks to playlist '{playlist_name}'."
        else:
            playlist_title = req.title.strip() if req.title and req.title.strip() else "BBC Sounds Playlist"
            description = (
                f"Generated from {req.url} via Audio Scrobbler App Scope Creep"
                if req.url
                else "Generated via Audio Scrobbler App Scope Creep"
            )
            playlist_name, playlist_url, count = create_playlist(
                db,
                current_user,
                playlist_title,
                description,
                req.spotify_uris,
            )
            message = f"Created playlist '{playlist_name}' with {count} tracks."
    except HTTPException:
        raise
    except Exception as e:
        action = "add tracks to" if req.mode == "existing" else "create"
        raise HTTPException(status_code=400, detail=f"Failed to {action} Spotify playlist: {str(e)}")

    return ScopeCreepResponse(
        message=message,
        playlist_url=playlist_url,
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
        artwork = track.artwork_url or resolve_artwork(track.artist, track.title, db, track_id)

        event_create = ListeningEventCreate(
            track_id=track_id,
            track_name=track.title,
            artist_name=track.artist,
            artwork_url=artwork,
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

        if artwork:
            try:
                db.query(ListeningEvent).filter(
                    ListeningEvent.user_id == current_user.id,
                    ListeningEvent.source == "bbc_sounds",
                    ListeningEvent.track_id == track_id,
                    ListeningEvent.artwork_url.is_(None),
                ).update({"artwork_url": artwork}, synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()

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
        playlist_name, playlist_url, count = create_playlist(
            db, 
            current_user, 
            bbc_data["title"], 
            f"Generated from {req.url} via Audio Scrobbler App Scope Creep",
            bbc_data["spotify_uris"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create Spotify playlist: {str(e)}")
        
    return ScopeCreepResponse(
        message=f"Created playlist '{playlist_name}' with {count} tracks.",
        playlist_url=playlist_url
    )
