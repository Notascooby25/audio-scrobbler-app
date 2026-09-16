from __future__ import annotations

import time
from typing import Any

import requests
from sqlalchemy.orm import Session

from ..config import settings
from ..models import ListeningEvent, User
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