from __future__ import annotations

from datetime import datetime
from typing import Any

import requests
from sqlalchemy.orm import Session

from ..config import settings
from ..models import LikedTrack, ListeningEvent, User
from ..security import decrypt_refresh_token, encrypt_refresh_token

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_SAVED_TRACKS_URL = "https://api.spotify.com/v1/me/tracks"
SPOTIFY_TRACKS_URL = "https://api.spotify.com/v1/tracks"


def _request(method: str, url: str, **kwargs: Any) -> requests.Response:
    response = requests.request(method, url, timeout=15, **kwargs)
    response.raise_for_status()
    return response


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


def _parse_added_at(value: Any) -> datetime:
    if not isinstance(value, str):
        return datetime.utcnow()
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def sync_liked_tracks(db: Session, user: User) -> dict[str, int]:
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}"}
    offset = 0
    fetched = 0
    inserted = 0
    updated = 0
    while True:
        response = _request(
            "GET",
            SPOTIFY_SAVED_TRACKS_URL,
            headers=headers,
            params={"limit": 50, "offset": offset},
        ).json()
        items = response.get("items", [])
        if not isinstance(items, list) or not items:
            break
        for item in items:
            track = item.get("track") if isinstance(item, dict) else None
            if not isinstance(track, dict) or not isinstance(track.get("id"), str):
                continue
            track_id = track["id"]
            artists = track.get("artists")
            artist_name = artists[0].get("name") if isinstance(artists, list) and artists and isinstance(artists[0], dict) else None
            album = track.get("album")
            album_name = album.get("name") if isinstance(album, dict) else None
            if not isinstance(track.get("name"), str) or not isinstance(artist_name, str):
                continue
            record = db.query(LikedTrack).filter_by(user_id=user.id, spotify_track_id=track_id).first()
            if record is None:
                record = LikedTrack(user_id=user.id, spotify_track_id=track_id, added_at=_parse_added_at(item.get("added_at")))
                db.add(record)
                inserted += 1
            else:
                updated += 1
            record.track_name = track["name"]
            record.artist_name = artist_name
            record.album_name = album_name if isinstance(album_name, str) else None
            record.artwork_url = _artwork_url(track)
            record.raw_metadata = item
            record.updated_at = datetime.utcnow()
            fetched += 1
        if len(items) < 50:
            break
        offset += 50
    db.commit()
    return {"fetched": fetched, "inserted": inserted, "updated": updated, "artwork_updated": 0}


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