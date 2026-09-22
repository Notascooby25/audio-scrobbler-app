from __future__ import annotations

import time
from datetime import datetime
from typing import Any

import requests
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import LikedTrack, ListeningEvent, PlaylistCache, User
from ..queries.analytics_queries import extract_playlist_uri
from ..schemas.spotify_library import WorkerLikedTrackItem
from ..security import decrypt_refresh_token, encrypt_refresh_token

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_TRACKS_URL = "https://api.spotify.com/v1/tracks"


def _request(method: str, url: str, **kwargs: Any) -> requests.Response:
    # backfill_scrobble_artwork batches /v1/tracks lookups 50 at a time — a
    # large batch of missing artwork means many sequential calls with no gap
    # between them, which Spotify's rate limiter (HTTP 429) is happy to
    # interrupt partway through. Mirrors the worker's SpotifyClient._request
    # retry/backoff (spotify_ingestion.py), which this service never had
    # despite making the same kind of calls.
    for attempt in range(3):
        response = requests.request(method, url, timeout=15, **kwargs)
        if response.status_code == 429 and attempt < 2:
            retry_after = min(float(response.headers.get("Retry-After", "1")), 30)
            time.sleep(retry_after)
            continue
        if response.status_code >= 500 and attempt < 2:
            time.sleep(2 ** attempt)
            continue
        response.raise_for_status()
        return response
    raise requests.HTTPError(f"Spotify request failed after retries: {url}")


def _refresh_access_token(db: Session, user: User) -> str:
    refresh_token = decrypt_refresh_token(user.refresh_token_cipher)
    response = _request(
        "POST",
        SPOTIFY_TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        auth=(settings.spotify_client_id, settings.spotify_client_secret),
    )
    token_data = response.json()
    rotated_token = token_data.get("refresh_token")
    if isinstance(rotated_token, str) and rotated_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_token)
        db.flush()
    return token_data["access_token"]


def _artwork_url(track: dict[str, Any]) -> str | None:
    album = track.get("album")
    images = album.get("images") if isinstance(album, dict) else None
    if not isinstance(images, list):
        return None
    for image in images:
        if isinstance(image, dict) and isinstance(image.get("url"), str):
            return image["url"]
    return None


def backfill_scrobble_artwork(db: Session, user: User) -> dict[str, int]:
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}"}
    missing = db.query(ListeningEvent).filter(
        ListeningEvent.user_id == user.id,
        ListeningEvent.source == "spotify",
        ListeningEvent.artwork_url.is_(None),
    ).all()
    track_ids = {}
    for event in missing:
        track_id = event.track_id.rsplit(":", 1)[-1]
        if track_id:
            track_ids.setdefault(track_id, []).append(event)
    updated = 0
    ids = list(track_ids)
    for start in range(0, len(ids), 50):
        batch = ids[start:start + 50]
        tracks = _request("GET", SPOTIFY_TRACKS_URL, headers=headers, params={"ids": ",".join(batch)}).json().get("tracks", [])
        for track in tracks:
            if not isinstance(track, dict) or not isinstance(track.get("id"), str):
                continue
            artwork = _artwork_url(track)
            if not artwork:
                continue
            for event in track_ids.get(track["id"], []):
                event.artwork_url = artwork
                updated += 1
    db.commit()
    return {"fetched": len(missing), "inserted": 0, "updated": 0, "artwork_updated": updated}








def upsert_liked_tracks(db: Session, user_id: int, tracks: list[WorkerLikedTrackItem]) -> dict[str, int]:
    """Persists a batch of liked tracks the worker already fetched from Spotify.

    Pure persistence only — this never calls Spotify itself. All outbound
    Spotify calls for liked-songs sync live in the worker's rate-limit-aware
    SpotifyClient (see worker/spotify_ingestion.py).
    """
    if not tracks:
        return {"inserted": 0, "updated": 0}

    inserted = 0
    updated = 0
    existing_by_track_id = {
        record.spotify_track_id: record
        for record in db.query(LikedTrack).filter(
            LikedTrack.user_id == user_id,
            LikedTrack.spotify_track_id.in_([track.spotify_track_id for track in tracks]),
        ).all()
    }
    for track in tracks:
        existing = existing_by_track_id.get(track.spotify_track_id)
        if existing is None:
            db.add(
                LikedTrack(
                    user_id=user_id,
                    spotify_track_id=track.spotify_track_id,
                    track_name=track.track_name,
                    artist_name=track.artist_name,
                    album_name=track.album_name,
                    artwork_url=track.artwork_url,
                    artist_artwork_url=track.artist_artwork_url,
                    added_at=track.added_at,
                    raw_metadata=track.raw_metadata,
                )
            )
            inserted += 1
        else:
            existing.track_name = track.track_name
            existing.artist_name = track.artist_name
            existing.album_name = track.album_name
            existing.artwork_url = track.artwork_url
            existing.artist_artwork_url = track.artist_artwork_url
            existing.added_at = track.added_at
            existing.raw_metadata = track.raw_metadata
            updated += 1
    db.commit()
    return {"inserted": inserted, "updated": updated}
def find_pending_genre_artist_ids(db: Session, limit: int = 10) -> list[str]:
    from ..queries.analytics_queries import build_pending_genre_artist_ids_query
    rows = db.execute(build_pending_genre_artist_ids_query(limit)).all()
    return [row.artist_id for row in rows if row.artist_id]

def upsert_genre_cache(db: Session, items: list[dict[str, object]]) -> int:
    from ..models import GenreCache
    from datetime import datetime
    if not items:
        return 0
    artist_ids = {item["artist_spotify_id"] for item in items}
    existing_rows = db.query(GenreCache).filter(GenreCache.artist_spotify_id.in_(artist_ids)).all()
    existing_by_id = {row.artist_spotify_id: row for row in existing_rows}
    for item in items:
        artist_id = item["artist_spotify_id"]
        genres = item.get("genres", [])
        row = existing_by_id.get(artist_id)
        if row:
            row.genres = genres
            row.cached_at = datetime.utcnow()
        else:
            db.add(GenreCache(artist_spotify_id=artist_id, genres=genres, cached_at=datetime.utcnow()))
    db.commit()
    return len(items)
