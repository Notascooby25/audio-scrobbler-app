from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import ListeningEvent
from .canonical_scrobble import canonicalize_scrobble


def replace_youtube_history(
    db: Session,
    user_id: int,
    entries: list[dict[str, Any]],
) -> dict[str, int]:
    canonical_entries: list[dict[str, Any]] = []
    skipped = 0
    seen_play_ids: set[str] = set()

    for entry in entries:
        if not isinstance(entry, dict):
            skipped += 1
            continue
        try:
            canonical = canonicalize_scrobble(user_id=user_id, source="youtube", raw_item=entry)
        except ValueError:
            skipped += 1
            continue
        if canonical["play_id"] in seen_play_ids:
            skipped += 1
            continue
        seen_play_ids.add(canonical["play_id"])
        canonical_entries.append(canonical)

    if not canonical_entries:
        raise ValueError("Replacement file contains no valid YouTube entries")

    deleted = db.query(ListeningEvent).filter(
        ListeningEvent.user_id == user_id,
        ListeningEvent.source == "youtube",
    ).delete(synchronize_session=False)

    for canonical in canonical_entries:
        db.add(ListeningEvent(
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
        ))

    db.commit()
    return {
        "deleted": int(deleted),
        "inserted": len(canonical_entries),
        "skipped": skipped,
        "artwork": sum(1 for item in canonical_entries if item["artwork_url"]),
    }