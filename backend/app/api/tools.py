from __future__ import annotations
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import ArtworkCache, FollowedShow, FollowedYouTubeChannel, ListeningEvent, User
from ..schemas.ingestion import ListeningEventCreate
from ..services.bbc_sounds_service import (
    fetch_bbc_playlist,
    fetch_brand_episodes,
    resolve_brand_info,
    search_bbc_shows,
)
from ..services.ingestion_service import ingest_listening_event
from ..services.processed_import_service import deezer_artwork, deezer_search, itunes_artwork
from ..services.spotify_playlist_service import add_tracks_to_playlist, create_playlist, get_user_playlists
from ..services.youtube_service import (
    fetch_youtube_video_details,
    get_channel_recent_videos,
    resolve_channel_info,
    search_youtube_videos,
)

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

class ScopeCreepBrandInfo(BaseModel):
    brand_id: str
    title: str
    synopsis: str | None = None
    image_url: str | None = None
    is_followed: bool = False

class ScopeCreepFetchResponse(BaseModel):
    play_id: str
    title: str
    tracks: list[ScopeCreepTrackItem]
    brand_info: ScopeCreepBrandInfo | None = None

class FollowedShowItem(BaseModel):
    id: int
    brand_id: str
    title: str
    synopsis: str | None = None
    image_url: str | None = None
    created_at: datetime

class FollowShowRequest(BaseModel):
    url_or_id: str

class FollowedShowsListResponse(BaseModel):
    shows: list[FollowedShowItem]

class ShowEpisodeItem(BaseModel):
    play_id: str
    title: str
    synopsis: str | None = None
    release_date: str | None = None
    availability: str | None = None
    duration: str | None = None
    image_url: str | None = None
    url: str

class ShowEpisodesResponse(BaseModel):
    brand_id: str
    episodes: list[ShowEpisodeItem]

class ShowSearchResultItem(BaseModel):
    brand_id: str
    title: str
    synopsis: str | None = None
    image_url: str | None = None
    is_followed: bool = False

class ShowSearchResponse(BaseModel):
    results: list[ShowSearchResultItem]

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

    brand_info = None
    if bbc_data.get("brand_info"):
        b_info = bbc_data["brand_info"]
        is_followed = db.query(FollowedShow).filter(
            FollowedShow.user_id == current_user.id,
            FollowedShow.brand_id == b_info["brand_id"]
        ).first() is not None
        brand_info = ScopeCreepBrandInfo(
            brand_id=b_info["brand_id"],
            title=b_info["title"],
            synopsis=b_info.get("synopsis"),
            image_url=b_info.get("image_url"),
            is_followed=is_followed,
        )

    return ScopeCreepFetchResponse(
        play_id=play_id,
        title=bbc_data["title"],
        tracks=resolved_tracks,
        brand_info=brand_info,
    )

@router.get("/scope-creep/followed-shows", response_model=FollowedShowsListResponse)
def get_followed_shows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shows = (
        db.query(FollowedShow)
        .filter(FollowedShow.user_id == current_user.id)
        .order_by(FollowedShow.title.asc())
        .all()
    )
    return FollowedShowsListResponse(
        shows=[
            FollowedShowItem(
                id=s.id,
                brand_id=s.brand_id,
                title=s.title,
                synopsis=s.synopsis,
                image_url=s.image_url,
                created_at=s.created_at,
            )
            for s in shows
        ]
    )

@router.post("/scope-creep/followed-shows", response_model=FollowedShowItem)
def follow_show(
    req: FollowShowRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        info = resolve_brand_info(req.url_or_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = (
        db.query(FollowedShow)
        .filter(
            FollowedShow.user_id == current_user.id,
            FollowedShow.brand_id == info["brand_id"],
        )
        .first()
    )

    if existing:
        return FollowedShowItem(
            id=existing.id,
            brand_id=existing.brand_id,
            title=existing.title,
            synopsis=existing.synopsis,
            image_url=existing.image_url,
            created_at=existing.created_at,
        )

    show = FollowedShow(
        user_id=current_user.id,
        brand_id=info["brand_id"],
        title=info["title"],
        synopsis=info.get("synopsis"),
        image_url=info.get("image_url"),
    )
    db.add(show)
    db.commit()
    db.refresh(show)
    return FollowedShowItem(
        id=show.id,
        brand_id=show.brand_id,
        title=show.title,
        synopsis=show.synopsis,
        image_url=show.image_url,
        created_at=show.created_at,
    )

@router.delete("/scope-creep/followed-shows/{brand_id}")
def unfollow_show(
    brand_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    show = (
        db.query(FollowedShow)
        .filter(
            FollowedShow.user_id == current_user.id,
            FollowedShow.brand_id == brand_id,
        )
        .first()
    )
    if not show:
        raise HTTPException(status_code=404, detail="Followed show not found")

    db.delete(show)
    db.commit()
    return {"message": "Show unfollowed successfully", "brand_id": brand_id}

@router.get("/scope-creep/followed-shows/{brand_id}/episodes", response_model=ShowEpisodesResponse)
def get_show_episodes(
    brand_id: str,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        episodes_data = fetch_brand_episodes(brand_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch episodes from BBC Sounds: {str(e)}")

    return ShowEpisodesResponse(
        brand_id=brand_id,
        episodes=[
            ShowEpisodeItem(
                play_id=ep["play_id"],
                title=ep["title"],
                synopsis=ep.get("synopsis"),
                release_date=ep.get("release_date"),
                availability=ep.get("availability"),
                duration=ep.get("duration"),
                image_url=ep.get("image_url"),
                url=ep["url"],
            )
            for ep in episodes_data
        ],
    )

@router.get("/scope-creep/search-shows", response_model=ShowSearchResponse)
def search_shows(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = q.strip()
    if not query:
        return ShowSearchResponse(results=[])

    try:
        results = search_bbc_shows(query)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to search BBC Sounds: {str(e)}")

    followed_brands = {
        s.brand_id
        for s in db.query(FollowedShow.brand_id).filter(FollowedShow.user_id == current_user.id).all()
    }

    return ShowSearchResponse(
        results=[
            ShowSearchResultItem(
                brand_id=r["brand_id"],
                title=r["title"],
                synopsis=r.get("synopsis"),
                image_url=r.get("image_url"),
                is_followed=r["brand_id"] in followed_brands,
            )
            for r in results
        ]
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


# ---------------------------------------------------------------------------
# YouTube Tools Endpoints
# ---------------------------------------------------------------------------

class FollowedYouTubeChannelItem(BaseModel):
    id: int
    channel_id: str
    channel_handle: str | None = None
    title: str
    image_url: str | None = None
    created_at: datetime


class FollowYouTubeChannelRequest(BaseModel):
    url_or_handle: str


class FollowedYouTubeChannelsResponse(BaseModel):
    channels: list[FollowedYouTubeChannelItem]


class YouTubeRecentVideoItem(BaseModel):
    video_id: str
    title: str
    published_at: str | None = None
    thumbnail_url: str | None = None
    url: str


class YouTubeRecentVideosResponse(BaseModel):
    channel_id: str
    videos: list[YouTubeRecentVideoItem]


class YouTubeSearchResultItem(BaseModel):
    video_id: str
    title: str
    channel_title: str | None = None
    duration: str | None = None
    thumbnail_url: str | None = None
    url: str


class YouTubeSearchResponse(BaseModel):
    results: list[YouTubeSearchResultItem]


class YouTubeTrackItem(BaseModel):
    segment_id: str
    artist: str
    title: str
    offset_seconds: int = 0
    duration_seconds: int | None = None
    spotify_uri: str | None = None
    image_url: str | None = None


class YouTubeFetchRequest(BaseModel):
    url: str


class YouTubeFetchResponse(BaseModel):
    video_id: str
    title: str
    author: str
    artist: str
    duration_seconds: int | None = None
    thumbnail_url: str | None = None
    url: str
    tracks: list[YouTubeTrackItem]


class YouTubeScrobbleTrack(BaseModel):
    segment_id: str
    artist: str
    title: str
    offset_seconds: int = 0
    duration_seconds: int | None = None
    spotify_uri: str | None = None
    artwork_url: str | None = None


class YouTubeScrobbleRequest(BaseModel):
    video_id: str
    listened_at: datetime | None = None
    tracks: list[YouTubeScrobbleTrack]


class YouTubeScrobbleResponse(BaseModel):
    message: str
    scrobbled_count: int
    duplicate_count: int


@router.get("/youtube/followed-channels", response_model=FollowedYouTubeChannelsResponse)
def get_followed_youtube_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channels = (
        db.query(FollowedYouTubeChannel)
        .filter(FollowedYouTubeChannel.user_id == current_user.id)
        .order_by(FollowedYouTubeChannel.title.asc())
        .all()
    )
    return FollowedYouTubeChannelsResponse(
        channels=[
            FollowedYouTubeChannelItem(
                id=c.id,
                channel_id=c.channel_id,
                channel_handle=c.channel_handle,
                title=c.title,
                image_url=c.image_url,
                created_at=c.created_at,
            )
            for c in channels
        ]
    )


@router.post("/youtube/followed-channels", response_model=FollowedYouTubeChannelItem)
def follow_youtube_channel(
    req: FollowYouTubeChannelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        info = resolve_channel_info(req.url_or_handle)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to resolve channel info: {str(e)}")

    existing = (
        db.query(FollowedYouTubeChannel)
        .filter(
            FollowedYouTubeChannel.user_id == current_user.id,
            FollowedYouTubeChannel.channel_id == info["channel_id"],
        )
        .first()
    )

    if existing:
        return FollowedYouTubeChannelItem(
            id=existing.id,
            channel_id=existing.channel_id,
            channel_handle=existing.channel_handle,
            title=existing.title,
            image_url=existing.image_url,
            created_at=existing.created_at,
        )

    channel = FollowedYouTubeChannel(
        user_id=current_user.id,
        channel_id=info["channel_id"],
        channel_handle=info.get("channel_handle"),
        title=info.get("title") or info["channel_id"],
        image_url=info.get("image_url"),
    )
    db.add(channel)
    try:
        db.commit()
        db.refresh(channel)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to follow channel: {str(e)}")

    return FollowedYouTubeChannelItem(
        id=channel.id,
        channel_id=channel.channel_id,
        channel_handle=channel.channel_handle,
        title=channel.title,
        image_url=channel.image_url,
        created_at=channel.created_at,
    )


@router.delete("/youtube/followed-channels/{channel_id}")
def unfollow_youtube_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    show = (
        db.query(FollowedYouTubeChannel)
        .filter(
            FollowedYouTubeChannel.user_id == current_user.id,
            FollowedYouTubeChannel.channel_id == channel_id,
        )
        .first()
    )
    if show:
        db.delete(show)
        db.commit()
    return {"success": True}


@router.get("/youtube/followed-channels/{channel_id}/videos", response_model=YouTubeRecentVideosResponse)
def get_channel_videos(
    channel_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        videos = get_channel_recent_videos(channel_id)
        return YouTubeRecentVideosResponse(
            channel_id=channel_id,
            videos=[
                YouTubeRecentVideoItem(
                    video_id=v["video_id"],
                    title=v["title"],
                    published_at=v.get("published_at"),
                    thumbnail_url=v.get("thumbnail_url"),
                    url=v["url"],
                )
                for v in videos
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch channel videos: {str(e)}")


@router.get("/youtube/search", response_model=YouTubeSearchResponse)
def search_youtube(
    q: str = "",
    channel: str | None = None,
    current_user: User = Depends(get_current_user),
):
    if not q.strip() and not (channel and channel.strip()):
        return YouTubeSearchResponse(results=[])

    try:
        results = search_youtube_videos(query=q, channel_title=channel)
        return YouTubeSearchResponse(
            results=[
                YouTubeSearchResultItem(
                    video_id=r["video_id"],
                    title=r["title"],
                    channel_title=r.get("channel_title"),
                    duration=r.get("duration"),
                    thumbnail_url=r.get("thumbnail_url"),
                    url=r["url"],
                )
                for r in results
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to search YouTube: {str(e)}")


@router.post("/youtube/fetch", response_model=YouTubeFetchResponse)
def fetch_youtube_video(
    req: YouTubeFetchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        details = fetch_youtube_video_details(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load YouTube video: {str(e)}")

    track_ids = [f"yt:{details['video_id']}:{t['segment_id']}" for t in details["tracks"]]
    cached_records = db.query(ArtworkCache).filter(ArtworkCache.track_id.in_(track_ids)).all()
    cache_map = {c.track_id: c.artwork_url for c in cached_records if c.artwork_url}

    def _lookup(t: dict) -> tuple[str, str | None]:
        t_id = f"yt:{details['video_id']}:{t['segment_id']}"
        if t_id in cache_map:
            return t_id, cache_map[t_id]
        if t.get("image_url"):
            return t_id, t["image_url"]
        art = fetch_external_artwork(t["artist"], t["title"])
        return t_id, (art or details.get("thumbnail_url"))

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(_lookup, details["tracks"]))

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
        YouTubeTrackItem(
            segment_id=t["segment_id"],
            artist=t["artist"],
            title=t["title"],
            offset_seconds=t.get("offset_seconds", 0),
            duration_seconds=t.get("duration_seconds"),
            spotify_uri=t.get("spotify_uri"),
            image_url=resolved_map.get(f"yt:{details['video_id']}:{t['segment_id']}"),
        )
        for t in details["tracks"]
    ]

    return YouTubeFetchResponse(
        video_id=details["video_id"],
        title=details["title"],
        author=details["author"],
        artist=details["artist"],
        duration_seconds=details["duration_seconds"],
        thumbnail_url=details["thumbnail_url"],
        url=details["url"],
        tracks=resolved_tracks,
    )


@router.post("/youtube/scrobble", response_model=YouTubeScrobbleResponse)
def scrobble_youtube_tracks(
    req: YouTubeScrobbleRequest,
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
        # Embed session timestamp in play_id so repeat listens over time are fully supported
        canonical_play_id = f"yt_{req.video_id}_{track.segment_id}_{int(played_at.timestamp())}"
        clean_artist = track.artist.strip().lower()
        clean_title = track.title.strip().lower()
        track_id = track.spotify_uri or f"youtube:{clean_artist}:{clean_title}"
        duration_ms = (track.duration_seconds * 1000) if track.duration_seconds else None
        artwork = track.artwork_url or resolve_artwork(track.artist, track.title, db, track_id)

        event_create = ListeningEventCreate(
            track_id=track_id,
            track_name=track.title,
            artist_name=track.artist,
            artwork_url=artwork,
            played_at=played_at,
            duration_ms=duration_ms,
            source="youtube",
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
                    ListeningEvent.source == "youtube",
                    ListeningEvent.track_id == track_id,
                    ListeningEvent.artwork_url.is_(None),
                ).update({"artwork_url": artwork}, synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()

    return YouTubeScrobbleResponse(
        message=f"Scrobbled {scrobbled_count} tracks ({duplicate_count} duplicates skipped).",
        scrobbled_count=scrobbled_count,
        duplicate_count=duplicate_count,
    )

