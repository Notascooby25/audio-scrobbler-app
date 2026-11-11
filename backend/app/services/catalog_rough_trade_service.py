from __future__ import annotations

from collections import defaultdict
from functools import lru_cache
import json
from pathlib import Path
import re
from typing import Any

from sqlalchemy.orm import Session

from ..datetime_utils import utc_now
from ..models import ListeningEvent, UserRoughTradeAlbumCompletion, UserRoughTradePendingConfirmation
from .text_cleaning import clean_title

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "rough_trade_albums.json"

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
def get_canonical_rough_trade_albums() -> list[dict[str, Any]]:
    """Loads and returns the in-memory cached canonical Rough Trade albums list."""
    if not _DATA_PATH.exists():
        return []
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_rough_trade_album_by_id(album_id: int) -> dict[str, Any] | None:
    """Finds a Rough Trade album by its 1-based integer id."""
    albums = get_canonical_rough_trade_albums()
    if 1 <= album_id <= len(albums):
        candidate = albums[album_id - 1]
        if candidate.get("id") == album_id:
            return candidate
    for a in albums:
        if a.get("id") == album_id:
            return a
    return None


def normalize_match_str(s: str | None) -> str:
    """Helper to aggressively clean and normalize titles and artist names for scrobble matching."""
    if not s:
        return ""
    cleaned = clean_title(s).lower()
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def get_user_rough_trade_catalog(db: Session, user_id: int) -> dict[str, Any]:
    """Returns the complete Rough Trade albums catalog annotated with the user's completion status."""
    albums = get_canonical_rough_trade_albums()
    if not albums:
        return {
            "albums": [],
            "completed_count": 0,
            "total_albums": 0,
            "overall_completion_pct": 0.0,
            "year_stats": {},
            "pending_confirmation": None,
        }

    completions = db.query(UserRoughTradeAlbumCompletion).filter(UserRoughTradeAlbumCompletion.user_id == user_id).all()
    completions_map: dict[int, UserRoughTradeAlbumCompletion] = {c.album_id: c for c in completions}

    # Fetch user listening events (scrobbles) to compute track-level listening matches
    scrobbles = (
        db.query(ListeningEvent.artist_name, ListeningEvent.album_name, ListeningEvent.track_name)
        .filter(ListeningEvent.user_id == user_id)
        .distinct()
        .all()
    )

    user_tracks: dict[tuple[str, str], set[str]] = defaultdict(set)
    for art, alb, trk in scrobbles:
        if art and alb and trk:
            key = (normalize_match_str(art), normalize_match_str(alb))
            user_tracks[key].add(trk.strip())

    # Check 85% threshold for unrecorded albums
    newly_seeded: list[UserRoughTradeAlbumCompletion] = []
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
            rec = UserRoughTradeAlbumCompletion(
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

    # Calculate year stats (2020 through 2026)
    years = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
    year_stats: dict[str, dict[str, Any]] = {}
    for yr in years:
        yr_albums = [a for a in albums if a.get("year") == yr]
        tot = len(yr_albums)
        comp = sum(1 for a in yr_albums if completions_map.get(a["id"]) and completions_map[a["id"]].is_completed)
        pct = round((comp / tot * 100), 1) if tot > 0 else 0.0
        stat_obj = {"completed": comp, "total": tot, "pct": pct}
        year_stats[str(yr)] = stat_obj

    # Check pending confirmations
    pending = (
        db.query(UserRoughTradePendingConfirmation)
        .filter_by(user_id=user_id, dismissed=False)
        .order_by(UserRoughTradePendingConfirmation.opened_at.desc())
        .first()
    )
    pending_album_dict = None
    if pending:
        cand = get_rough_trade_album_by_id(pending.album_id)
        if cand:
            pending_album_dict = {
                "album_id": cand["id"],
                "album_name": cand["album_name"],
                "artist_name": cand["artist_name"],
                "year": cand.get("year"),
            }

    annotated_albums = []
    for a in albums:
        c = completions_map.get(a["id"])
        is_comp = bool(c.is_completed) if c else False
        annotated_albums.append(
            {
                **a,
                "is_completed": is_comp,
                "completed_source": c.source if c else None,
                "completed_at": c.completed_at.isoformat() if c and c.completed_at else None,
            }
        )

    total_completed = sum(1 for a in annotated_albums if a["is_completed"])
    total_albums = len(annotated_albums)
    overall_pct = round((total_completed / total_albums * 100), 1) if total_albums > 0 else 0.0

    return {
        "albums": annotated_albums,
        "completed_count": total_completed,
        "total_albums": total_albums,
        "overall_completion_pct": overall_pct,
        "year_stats": year_stats,
        "pending_confirmation": pending_album_dict,
        "available_genres": AVAILABLE_PARENT_GENRES,
    }


def toggle_user_rough_trade_album_completion(
    db: Session,
    user_id: int,
    album_id: int,
    is_completed: bool,
    source: str = "manual",
) -> dict[str, Any]:
    """Toggles or updates completion status for a specific user and Rough Trade album."""
    record = db.query(UserRoughTradeAlbumCompletion).filter_by(user_id=user_id, album_id=album_id).first()
    if not record:
        record = UserRoughTradeAlbumCompletion(
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
    db.query(UserRoughTradePendingConfirmation).filter_by(user_id=user_id, album_id=album_id).update(
        {"dismissed": True}
    )
    db.commit()

    count = db.query(UserRoughTradeAlbumCompletion).filter_by(user_id=user_id, is_completed=True).count()
    return {"album_id": album_id, "is_completed": is_completed, "completed_count": count}


def record_user_rough_trade_pending_play(db: Session, user_id: int, album_id: int) -> dict[str, Any]:
    """Records a Rough Trade album opened in Spotify to prompt confirmation on next visit."""
    record = db.query(UserRoughTradePendingConfirmation).filter_by(user_id=user_id, album_id=album_id).first()
    if not record:
        record = UserRoughTradePendingConfirmation(
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


def dismiss_user_rough_trade_pending(db: Session, user_id: int, album_id: int | None = None) -> dict[str, Any]:
    """Dismisses pending Rough Trade album confirmation without marking as completed."""
    query = db.query(UserRoughTradePendingConfirmation).filter_by(user_id=user_id)
    if album_id is not None:
        query = query.filter_by(album_id=album_id)
    else:
        query = query.filter_by(dismissed=False)
    query.update({"dismissed": True})
    db.commit()
    return {"status": "ok"}
