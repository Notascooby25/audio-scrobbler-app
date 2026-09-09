from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..models import ListeningEvent
from .canonical_scrobble import canonicalize_scrobble


def import_spotify_history(db: Session, user_id: int, entries: list[dict[str, Any]]) -> dict[str, int]:
    inserted = 0
    skipped = 0

    for entry in entries:
        if not isinstance(entry, dict):
            skipped += 1
            continue
        track_name = entry.get("trackName")
        artist_name = entry.get("artistName")
        end_time = entry.get("endTime")
        track_uri = entry.get("trackUri")
        if not isinstance(track_name, str) or not isinstance(artist_name, str) or not isinstance(end_time, str) or not isinstance(track_uri, str):
            skipped += 1
            continue
        if not track_name.strip() or not artist_name.strip() or not track_uri.strip() or not end_time.strip():
            skipped += 1
            continue

        raw_item = {
            "played_at": end_time,
            "track": {
                "id": track_uri,
                "name": track_name,
                "artists": [{"name": artist_name}],
                "album": {"name": entry.get("albumName") if isinstance(entry.get("albumName"), str) else None},
                "duration_ms": entry.get("msPlayed") if isinstance(entry.get("msPlayed"), int) else None,
            },
            "context": {
                "platform": "spotify",
                "country": "US",
            },
        }

        try:
            canonical = canonicalize_scrobble(user_id=user_id, source="spotify", raw_item=raw_item)
        except ValueError:
            skipped += 1
            continue

        duplicate = (
            db.query(ListeningEvent)
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source == "spotify",
                ListeningEvent.play_id == canonical["play_id"],
            )
            .first()
        )
        if duplicate is not None:
            skipped += 1
            continue

        record = ListeningEvent(
            user_id=user_id,
            track_id=track_uri,
            track_name=canonical["track_name"],
            artist_name=canonical["artist_name"],
            played_at=canonical["played_at"],
            duration_ms=canonical["duration_ms"],
            source="spotify",
            play_id=canonical["play_id"],
            payload="",
            raw_metadata=canonical["context"]["raw"],
        )
        db.add(record)
        inserted += 1

    db.commit()
    return {"inserted": inserted, "skipped": skipped}
