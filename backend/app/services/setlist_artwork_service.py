from __future__ import annotations

import hashlib
import json
import logging
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..models import ArtworkCache, ListeningEvent, User
from .processed_import_service import deezer_artwork, deezer_search, is_artist_match, itunes_artwork

logger = logging.getLogger(__name__)

LIVE_SOURCE = "setlistfm"
# Songs with no artwork anywhere are retried after this (a lookup that failed for a
# moment looks the same as a real miss, so this is kept short)
MISS_RETRY_AFTER = timedelta(days=7)
# Gig songs considered per worker run (sampled at random so long-standing misses can't block the rest)
PENDING_SCAN_LIMIT = 500


def _usable(url: str | None) -> bool:
    return isinstance(url, str) and url.startswith(("https://", "http://"))


def existing_gig_artwork(db: Session, user_id: int, setlist_id: str) -> dict[str, tuple[str | None, str | None]]:
    """Artwork already on a gig's scrobbles, by lowercased song title, so re-scrobbling keeps it.

    An empty string means the user cleared it on purpose and is kept as is."""
    rows = db.execute(
        select(ListeningEvent.track_name, ListeningEvent.artwork_url, ListeningEvent.artist_artwork_url).where(
            ListeningEvent.user_id == user_id,
            ListeningEvent.source == LIVE_SOURCE,
            ListeningEvent.play_id.like(f"setlistfm_{setlist_id}_%"),
        )
    ).all()
    return {
        row.track_name.lower(): (row.artwork_url, row.artist_artwork_url)
        for row in rows
        if row.artwork_url is not None or row.artist_artwork_url is not None
    }


def local_live_artwork(db: Session, user_id: int, artist_name: str) -> tuple[dict[str, str], str | None]:
    """Artwork from the user's own plays of this artist: track artwork by lowercased title
    (from non-gig plays only, so it's real release artwork) and the artist's image, if any."""
    same_artist = (
        ListeningEvent.user_id == user_id,
        func.lower(ListeningEvent.artist_name) == func.lower(artist_name.strip()),
    )
    rows = db.execute(
        select(ListeningEvent.track_name, func.max(ListeningEvent.artwork_url))
        .where(*same_artist, ListeningEvent.source != LIVE_SOURCE, ListeningEvent.artwork_url.like("http%"))
        .group_by(ListeningEvent.track_name)
    ).all()
    tracks: dict[str, str] = {}
    for title, url in rows:
        if _usable(url):
            tracks.setdefault(title.lower(), url)

    artist_image = db.execute(
        select(func.max(ListeningEvent.artist_artwork_url)).where(
            *same_artist, ListeningEvent.artist_artwork_url.like("http%")
        )
    ).scalar()
    return tracks, artist_image if _usable(artist_image) else None


def _cache_key(kind: str, *parts: str) -> str:
    normalised = "|".join(part.strip().lower() for part in parts)
    return f"{kind}:{hashlib.sha1(normalised.encode()).hexdigest()}"


def _cached(db: Session, key: str) -> tuple[bool, str | None]:
    """(known, url). Not known: never looked up, or a miss old enough to try again."""
    entry = db.get(ArtworkCache, key)
    if entry is None:
        return False, None
    if _usable(entry.artwork_url):
        return True, entry.artwork_url
    return entry.cached_at > datetime.utcnow() - MISS_RETRY_AFTER, None


def _remember(db: Session, key: str, url: str | None) -> None:
    db.merge(ArtworkCache(track_id=key, artwork_url=url or "", cached_at=datetime.utcnow()))


def deezer_artist_picture(artist: str, timeout: float = 3.0) -> str | None:
    """The artist's photo from Deezer, only when the returned name matches."""
    url = f"https://api.deezer.com/search/artist?q={urllib.parse.quote(artist)}&limit=5"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            results = json.loads(resp.read().decode("utf-8")).get("data", [])
    except Exception as exc:  # noqa: BLE001 - a failed lookup is just a miss
        logger.debug("Deezer artist lookup failed for %s: %s", artist, exc)
        return None
    for item in results if isinstance(results, list) else []:
        if isinstance(item, dict) and is_artist_match(artist, str(item.get("name", ""))):
            picture = item.get("picture_big") or item.get("picture_medium")
            # Deezer's placeholder for artists without a photo has an empty id in the path
            if _usable(picture) and "/artist//" not in picture:
                return picture
    return None


def _lookup_track_artwork(artist: str, title: str) -> str | None:
    art = None
    if settings.enable_deezer_artwork_lookup:
        track = deezer_search(artist, title, timeout=3.0)
        art = deezer_artwork(track) if track else None
    if not _usable(art):
        art = itunes_artwork(artist, title)
    return art if _usable(art) else None


def backfill_live_artwork(db: Session, max_lookups: int = 60, pause_seconds: float = 0.5) -> dict[str, int]:
    """Fills in artwork for gig scrobbles that have none. Called by the worker.

    For each song: the user's own plays, then the shared cache, then Deezer and iTunes,
    then the artist's photo. At most `max_lookups` outside requests per run; the rest wait
    for the next run. Rows the user cleared ("") are left alone."""
    pending = db.execute(
        select(ListeningEvent.user_id, ListeningEvent.artist_name, ListeningEvent.track_name)
        .join(User, User.id == ListeningEvent.user_id)
        .where(
            ListeningEvent.source == LIVE_SOURCE,
            ListeningEvent.artwork_url.is_(None),
            User.is_active.is_(True),
        )
        .group_by(ListeningEvent.user_id, ListeningEvent.artist_name, ListeningEvent.track_name)
        .order_by(func.random())
        .limit(PENDING_SCAN_LIMIT)
    ).all()

    counts = {"checked": 0, "updated": 0, "missed": 0, "lookups": 0}
    local: dict[tuple[int, str], tuple[dict[str, str], str | None]] = {}

    def outside(lookup, *args: str) -> str | None:
        counts["lookups"] += 1
        time.sleep(pause_seconds)
        return lookup(*args)

    def from_cache_or(key: str, lookup, *args: str) -> tuple[bool, str | None]:
        """(answered, url): answered is False when the per-run budget ran out first."""
        known, url = _cached(db, key)
        if known:
            return True, url
        if counts["lookups"] >= max_lookups:
            return False, None
        url = outside(lookup, *args)
        _remember(db, key, url)
        return True, url

    for user_id, artist, title in pending:
        local_key = (user_id, artist.lower())
        if local_key not in local:
            local[local_key] = local_live_artwork(db, user_id, artist)
        own_tracks, own_artist_image = local[local_key]

        url = own_tracks.get(title.lower())
        if not url:
            answered, url = from_cache_or(_cache_key("live", artist, title), _lookup_track_artwork, artist, title)
            if not answered:
                continue
        if not url:
            url = own_artist_image
        if not url:
            answered, url = from_cache_or(_cache_key("live-artist", artist), deezer_artist_picture, artist)
            if not answered:
                continue

        counts["checked"] += 1
        if not url:
            counts["missed"] += 1
            continue
        result = db.execute(
            update(ListeningEvent)
            .where(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source == LIVE_SOURCE,
                ListeningEvent.artist_name == artist,
                ListeningEvent.track_name == title,
                ListeningEvent.artwork_url.is_(None),
            )
            .values(artwork_url=url)
            .execution_options(synchronize_session=False)
        )
        counts["updated"] += int(result.rowcount or 0)
        db.commit()

    db.commit()
    return counts
