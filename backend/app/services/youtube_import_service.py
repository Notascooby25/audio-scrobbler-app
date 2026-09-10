from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import ListeningEvent
from .canonical_scrobble import canonicalize_scrobble


def import_youtube_history(db: Session, user_id: int, entries: list[dict[str, Any]]) -> dict[str, int]:
    inserted = 0
    skipped = 0
    duplicate = 0

    for entry in entries:
        if not isinstance(entry, dict):
            skipped += 1
            continue

        title = entry.get("title") or entry.get("song")
        artist = entry.get("artist")
        time_value = entry.get("time")
        if not isinstance(title, str) or not isinstance(artist, str) or not isinstance(time_value, str):
            skipped += 1
            continue
        if not title.strip() or not artist.strip() or not time_value.strip():
            skipped += 1
            continue

        raw_item = {
            "title": title,
            "artist": artist,
            "album": entry.get("album") if isinstance(entry.get("album"), str) else None,
            "time": time_value,
            "duration_ms": entry.get("duration_ms") if isinstance(entry.get("duration_ms"), int) else None,
            "context": entry.get("context") if isinstance(entry.get("context"), dict) else {"platform": "youtube"},
        }

        try:
            canonical = canonicalize_scrobble(user_id=user_id, source="youtube", raw_item=raw_item)
        except ValueError:
            skipped += 1
            continue

        existing = (
            db.query(ListeningEvent)
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source == "youtube",
                ListeningEvent.play_id == canonical["play_id"],
            )
            .first()
        )
        if existing is not None:
            duplicate += 1
            continue

        record = ListeningEvent(
            user_id=user_id,
            track_id=canonical["play_id"],
            track_name=canonical["track_name"],
            artist_name=canonical["artist_name"],
            album_name=canonical["album_name"],
            artwork_url=canonical["artwork_url"],
            played_at=canonical["played_at"],
            duration_ms=canonical["duration_ms"],
            source="youtube",
            play_id=canonical["play_id"],
            payload="",
            raw_metadata=canonical["context"]["raw"],
        )
        db.add(record)
        inserted += 1

    db.commit()
    return {"inserted": inserted, "skipped": skipped, "duplicate": duplicate}
