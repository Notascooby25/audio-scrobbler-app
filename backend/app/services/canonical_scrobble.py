from __future__ import annotations

from datetime import datetime
from typing import Any


def _normalize_timestamp(raw_value: Any) -> datetime | None:
    if isinstance(raw_value, datetime):
        return raw_value
    if not isinstance(raw_value, str):
        return None
    value = raw_value.strip()
    if not value:
        return None
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone().replace(tzinfo=None)
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def canonicalize_scrobble(user_id: int, source: str, raw_item: dict[str, Any]) -> dict[str, Any]:
    if source == "spotify":
        track = raw_item.get("track")
        played_at = raw_item.get("played_at")
        if not isinstance(track, dict):
            raise ValueError("Spotify scrobble is missing a track payload")
        track_id = track.get("id")
        track_name = track.get("name")
        artists = track.get("artists")
        if not isinstance(track_id, str) or not isinstance(track_name, str) or not isinstance(artists, list):
            raise ValueError("Spotify scrobble is missing required track fields")
        if not track_id.strip() or not track_name.strip():
            raise ValueError("Spotify scrobble contains blank identifiers")
        artist = artists[0] if artists else None
        if not isinstance(artist, dict) or not isinstance(artist.get("name"), str):
            raise ValueError("Spotify scrobble is missing an artist name")
        if not artist["name"].strip():
            raise ValueError("Spotify scrobble contains a blank artist name")
        album = track.get("album")
        album_name = album.get("name") if isinstance(album, dict) else None
        images = album.get("images") if isinstance(album, dict) else None
        artwork_url = images[0].get("url") if isinstance(images, list) and images and isinstance(images[0], dict) else None
        timestamp = _normalize_timestamp(played_at)
        if timestamp is None:
            raise ValueError("Spotify scrobble is missing a valid played_at timestamp")
        context = raw_item.get("context") if isinstance(raw_item.get("context"), dict) else {}
        return {
            "user_id": user_id,
            "source": "spotify",
            "play_id": track_id,
            "played_at": timestamp,
            "track_name": track_name,
            "artist_name": artist["name"],
            "album_name": album_name,
            "artwork_url": artwork_url if isinstance(artwork_url, str) else None,
            "duration_ms": track.get("duration_ms") if isinstance(track.get("duration_ms"), int) else None,
            "context": {
                "platform": context.get("platform", "spotify"),
                "country": context.get("country"),
                "raw": context,
            },
        }

    if source == "youtube":
        time_value = raw_item.get("time")
        timestamp = _normalize_timestamp(time_value)
        if timestamp is None:
            raise ValueError("YouTube scrobble is missing a valid time value")
        title = raw_item.get("title") or raw_item.get("song")
        artist = raw_item.get("artist")
        if not isinstance(title, str) or not isinstance(artist, str):
            raise ValueError("YouTube scrobble is missing required title or artist fields")
        if not title.strip() or not artist.strip():
            raise ValueError("YouTube scrobble contains blank title or artist")
        context = raw_item.get("context") if isinstance(raw_item.get("context"), dict) else {}
        play_id = f"youtube-{title.lower().replace(' ', '-')}-{time_value}"
        return {
            "user_id": user_id,
            "source": "youtube",
            "play_id": play_id,
            "played_at": timestamp,
            "track_name": title,
            "artist_name": artist,
            "album_name": raw_item.get("album") if isinstance(raw_item.get("album"), str) else None,
            "artwork_url": raw_item.get("artwork_url") if isinstance(raw_item.get("artwork_url"), str) else None,
            "duration_ms": raw_item.get("duration_ms") if isinstance(raw_item.get("duration_ms"), int) else None,
            "context": {
                "platform": context.get("platform", "youtube"),
                "country": context.get("country"),
                "raw": context,
            },
        }

    raise ValueError(f"Unsupported source: {source}")
