from __future__ import annotations

from collections import defaultdict

from ..datetime_utils import utc_now
from functools import lru_cache
import json
from pathlib import Path
import re
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import ListeningEvent, User1001AlbumCompletion, User1001PendingConfirmation
from .text_cleaning import clean_title

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "1001_albums.json"

AVAILABLE_PARENT_GENRES: list[str] = [
    "Rock",
    "Pop",
    "Electronic",
    "Soul",
    "Jazz",
    "Punk",
    "Hip Hop",
    "Folk",
    "Metal",
    "Funk",
]


@lru_cache(maxsize=1)
def get_canonical_1001_albums() -> list[dict[str, Any]]:
    """Loads and returns the in-memory cached canonical 1001 albums list."""
    if not _DATA_PATH.exists():
        return []
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_1001_album_by_id(album_id: int) -> dict[str, Any] | None:
    """Finds a 1001 album by its 1-based integer id."""
    albums = get_canonical_1001_albums()
    if 1 <= album_id <= len(albums):
        candidate = albums[album_id - 1]
        if candidate.get("id") == album_id:
            return candidate
    for a in albums:
        if a.get("id") == album_id:
            return a
    return None


def normalize_match_str(val: str | None) -> str:
    """Normalizes an artist or album string for robust threshold matching."""
    if not val:
        return ""
    cleaned = clean_title(val).lower()
    return re.sub(r"[^\w\s]", "", cleaned).strip()


def get_user_1001_catalog(db: Session, user_id: int) -> dict[str, Any]:
    """Returns the full 1001 albums catalog enriched with user completion state,

    auto-seeds any album meeting the >=90% track scrobble threshold,
    and includes decade breakdown and pending confirmations.
    """
    albums = get_canonical_1001_albums()
    completions = db.query(User1001AlbumCompletion).filter_by(user_id=user_id).all()
    completions_map: dict[int, User1001AlbumCompletion] = {c.album_id: c for c in completions}

    # Query distinct user scrobbles
    scrobbles = (
        db.query(
            ListeningEvent.artist_name,
            ListeningEvent.album_name,
            func.lower(ListeningEvent.track_name),
        )
        .filter(
            ListeningEvent.user_id == user_id,
            ListeningEvent.album_name.isnot(None),
            ListeningEvent.album_name != "",
        )
        .distinct()
        .all()
    )

    user_tracks: dict[tuple[str, str], set[str]] = defaultdict(set)
    for art, alb, trk in scrobbles:
        if art and alb and trk:
            key = (normalize_match_str(art), normalize_match_str(alb))
            user_tracks[key].add(trk.strip())

    # Check 85% threshold for unrecorded albums
    newly_seeded: list[User1001AlbumCompletion] = []
    for album in albums:
        aid = album["id"]
        if aid in completions_map:
            continue
        key = (
            normalize_match_str(album.get("artist_name")),
            normalize_match_str(album.get("album_name")),
        )
        played_tracks = user_tracks.get(key, set())
        track_count = album.get("track_count") or 10
        if len(played_tracks) > 0 and (len(played_tracks) / track_count) >= 0.85:
            rec = User1001AlbumCompletion(
                user_id=user_id,
                album_id=aid,
                is_completed=True,
                source="scrobble_85pct",
                completed_at=utc_now(),
            )
            db.add(rec)
            completions_map[aid] = rec
            newly_seeded.append(rec)

    if newly_seeded:
        db.commit()

    # Calculate decade stats
    decades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]
    decade_stats: dict[str, dict[str, Any]] = {}
    for dec in decades:
        dec_albums = [a for a in albums if a.get("decade") == dec]
        tot = len(dec_albums)
        comp = sum(1 for a in dec_albums if completions_map.get(a["id"]) and completions_map[a["id"]].is_completed)
        pct = round((comp / tot * 100), 1) if tot > 0 else 0.0
        stat_obj = {"completed": comp, "total": tot, "pct": pct}
        decade_stats[f"{dec}s"] = stat_obj
        decade_stats[str(dec)] = stat_obj

    # Check pending confirmations
    pending = (
        db.query(User1001PendingConfirmation)
        .filter_by(user_id=user_id, dismissed=False)
        .order_by(User1001PendingConfirmation.opened_at.desc())
        .first()
    )
    pending_data = None
    if pending:
        palbum = get_1001_album_by_id(pending.album_id)
        if palbum:
            pending_data = {
                "album_id": pending.album_id,
                "album_name": palbum["album_name"],
                "artist_name": palbum["artist_name"],
                "artwork_url": palbum.get("artwork_url", ""),
                "opened_at": pending.opened_at.isoformat(),
            }

    enriched_albums: list[dict[str, Any]] = []
    completed_count = 0
    for album in albums:
        c = completions_map.get(album["id"])
        is_comp = bool(c.is_completed) if c else False
        if is_comp:
            completed_count += 1
        enriched_albums.append(
            {
                **album,
                "is_completed": is_comp,
                "completed_at": c.completed_at.isoformat() if (c and c.completed_at) else None,
                "source": c.source if c else None,
            }
        )

    return {
        "albums": enriched_albums,
        "total_albums": len(albums),
        "completed_count": completed_count,
        "decade_stats": decade_stats,
        "pending_confirmation": pending_data,
        "available_genres": AVAILABLE_PARENT_GENRES,
    }


def toggle_user_1001_album_completion(
    db: Session,
    user_id: int,
    album_id: int,
    is_completed: bool,
    source: str = "manual",
) -> dict[str, Any]:
    """Sets or updates the completion status for a 1001 album."""
    record = db.query(User1001AlbumCompletion).filter_by(user_id=user_id, album_id=album_id).first()
    if not record:
        record = User1001AlbumCompletion(
            user_id=user_id,
            album_id=album_id,
            is_completed=is_completed,
            source=source,
            completed_at=utc_now() if is_completed else None,
        )
        db.add(record)
    else:
        record.is_completed = is_completed
        record.source = source
        if is_completed:
            if not record.completed_at:
                record.completed_at = utc_now()
        else:
            record.completed_at = None

    # Clear pending confirmation for this album
    db.query(User1001PendingConfirmation).filter_by(user_id=user_id, album_id=album_id).update({"dismissed": True})
    db.commit()

    count = db.query(User1001AlbumCompletion).filter_by(user_id=user_id, is_completed=True).count()
    return {"album_id": album_id, "is_completed": is_completed, "completed_count": count}


def record_user_1001_pending_play(db: Session, user_id: int, album_id: int) -> dict[str, Any]:
    """Records an album opened in Spotify to prompt confirmation on next visit."""
    record = db.query(User1001PendingConfirmation).filter_by(user_id=user_id, album_id=album_id).first()
    if not record:
        record = User1001PendingConfirmation(
            user_id=user_id,
            album_id=album_id,
            opened_at=utc_now(),
            dismissed=False,
        )
        db.add(record)
    else:
        record.opened_at = utc_now()
        record.dismissed = False
    db.commit()
    return {"status": "ok", "album_id": album_id}


def dismiss_user_1001_pending(db: Session, user_id: int, album_id: int | None = None) -> dict[str, Any]:
    """Dismisses pending album confirmation without marking as completed."""
    query = db.query(User1001PendingConfirmation).filter_by(user_id=user_id)
    if album_id is not None:
        query = query.filter_by(album_id=album_id)
    else:
        query = query.filter_by(dismissed=False)
    query.update({"dismissed": True})
    db.commit()
    return {"status": "ok"}
