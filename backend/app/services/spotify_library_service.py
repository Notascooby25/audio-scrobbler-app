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
SPOTIFY_ARTISTS_URL = "https://api.spotify.com/v1/artists"
SPOTIFY_SAVED_TRACK_URL = "https://api.spotify.com/v1/me/tracks"


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


def _artist_artwork_url(artist: dict[str, Any]) -> str | None:
    images = artist.get("images")
    if not isinstance(images, list):
        return None
    for image in images:
        if isinstance(image, dict) and isinstance(image.get("url"), str):
            return image["url"]
    return None


def _spotify_track_id(value: str) -> str:
    return value.rsplit(":", 1)[-1]


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
    artist_ids: dict[str, str] = {}
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
            artist_id = artists[0].get("id") if isinstance(artists, list) and artists and isinstance(artists[0], dict) else None
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
            if isinstance(artist_id, str):
                artist_ids[artist_name] = artist_id
            record.raw_metadata = item
            record.updated_at = datetime.utcnow()
            fetched += 1
        if len(items) < 50:
            break
        offset += 50

    artist_artwork: dict[str, str] = {}
    ids = list(artist_ids.values())
    for start in range(0, len(ids), 50):
        artists = _request(
            "GET",
            SPOTIFY_ARTISTS_URL,
            headers=headers,
            params={"ids": ",".join(ids[start:start + 50])},
        ).json().get("artists", [])
        for artist in artists:
            if not isinstance(artist, dict) or not isinstance(artist.get("name"), str):
                continue
            artwork = _artist_artwork_url(artist)
            if artwork:
                artist_artwork[artist["name"]] = artwork

    artwork_updated = 0
    for artist_name, artwork in artist_artwork.items():
        liked_records = db.query(LikedTrack).filter_by(user_id=user.id, artist_name=artist_name).all()
        for record in liked_records:
            record.artist_artwork_url = artwork
            artwork_updated += 1
        events = db.query(ListeningEvent).filter(
            ListeningEvent.user_id == user.id,
            ListeningEvent.artist_name == artist_name,
        ).all()
        for event in events:
            event.artist_artwork_url = artwork
    db.commit()
    return {"fetched": fetched, "inserted": inserted, "updated": updated, "artwork_updated": artwork_updated}


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


def set_track_liked(db: Session, user: User, track_id: str, liked: bool) -> dict[str, object]:
    spotify_track_id = _spotify_track_id(track_id)
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"ids": spotify_track_id}
    method = "PUT" if liked else "DELETE"
    _request(method, SPOTIFY_SAVED_TRACK_URL, headers=headers, params=params)

    record = db.query(LikedTrack).filter_by(user_id=user.id, spotify_track_id=spotify_track_id).first()
    if liked and record is None:
        event = db.query(ListeningEvent).filter(
            ListeningEvent.user_id == user.id,
            ListeningEvent.track_id.in_((spotify_track_id, f"spotify:track:{spotify_track_id}")),
        ).order_by(ListeningEvent.played_at.desc()).first()
        if event is not None:
            record = LikedTrack(
                user_id=user.id,
                spotify_track_id=spotify_track_id,
                track_name=event.track_name,
                artist_name=event.artist_name,
                album_name=event.album_name,
                artwork_url=event.artwork_url,
                added_at=datetime.utcnow(),
                raw_metadata={"source": "library-toggle"},
            )
            db.add(record)
    elif not liked and record is not None:
        db.delete(record)
    db.commit()
    return {"spotify_track_id": spotify_track_id, "is_liked": liked}