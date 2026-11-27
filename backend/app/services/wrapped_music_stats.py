"""Music numbers for a person's Wrapped.

Everything is worked out in Python from the stored scrobbles, so the London-time grouping is the same
on every database. The caller passes the window as naive UTC datetimes.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import GenreCache, ListeningEvent
from ..queries.analytics_queries import build_report_genre_artist_counts_query, not_blocked_clause

LONDON = ZoneInfo("Europe/London")
MIN_PLAYS = 30
MIN_ALBUM_TRACKS = 3
TOP_LIMIT = 5
DEFAULT_DURATION_MS = 210_000  # 3.5 minutes, when none of a person's plays has a known length


def to_london(moment: datetime) -> datetime:
    """A naive UTC time as an aware London time."""
    return moment.replace(tzinfo=timezone.utc).astimezone(LONDON)


def _listener_label(hour: int) -> str:
    if hour >= 21 or hour < 4:
        return "Night owl"
    if hour < 9:
        return "Early bird"
    return "Daytime listener"


def _top(counter: Counter[str], names: dict[str, dict[str, Any]], limit: int = TOP_LIMIT) -> list[dict[str, Any]]:
    return [{**names[key], "plays": plays} for key, plays in counter.most_common(limit)]


def build_music_stats(db: Session, user_id: int, start: datetime, end: datetime) -> dict[str, Any] | None:
    """The music half of a Wrapped, or None when the person has too few plays in the window."""
    rows = db.execute(
        select(
            ListeningEvent.track_name,
            ListeningEvent.artist_name,
            ListeningEvent.album_name,
            ListeningEvent.artwork_url,
            ListeningEvent.artist_artwork_url,
            ListeningEvent.played_at,
            ListeningEvent.duration_ms,
            ListeningEvent.source,
        )
        .where(
            ListeningEvent.user_id == user_id,
            ListeningEvent.played_at >= start,
            ListeningEvent.played_at < end,
            not_blocked_clause(user_id),
        )
        .order_by(ListeningEvent.played_at)
    ).all()
    if len(rows) < MIN_PLAYS:
        return None

    artist_plays: Counter[str] = Counter()
    song_plays: Counter[str] = Counter()
    album_plays: Counter[str] = Counter()
    album_tracks: dict[str, set[str]] = defaultdict(set)
    artist_names: dict[str, dict[str, Any]] = {}
    artist_pictures: dict[str, bool] = {}
    song_names: dict[str, dict[str, Any]] = {}
    album_names: dict[str, dict[str, Any]] = {}
    months = [0] * 12
    hours: Counter[int] = Counter()
    weekdays: Counter[int] = Counter()
    day_plays: Counter[str] = Counter()
    day_ms: Counter[str] = Counter()
    total_ms = 0
    # Some sources (YouTube imports) have no track length. Those plays count at the person's own average
    # known length rather than as zero minutes, so the minutes total stays a fair estimate.
    known = [row.duration_ms for row in rows if row.duration_ms]
    fallback_ms = round(sum(known) / len(known)) if known else DEFAULT_DURATION_MS

    for row in rows:
        local = to_london(row.played_at)
        duration = int(row.duration_ms or fallback_ms)
        total_ms += duration
        months[local.month - 1] += 1
        hours[local.hour] += 1
        weekdays[local.weekday()] += 1
        day = local.date().isoformat()
        day_plays[day] += 1
        day_ms[day] += duration

        artist_key = row.artist_name.casefold()
        artist_plays[artist_key] += 1
        # An artist's own picture if we have one, otherwise the cover of something they played.
        picture = row.artist_artwork_url or row.artwork_url
        artist_names.setdefault(artist_key, {"name": row.artist_name, "artwork_url": picture})
        if row.artist_artwork_url and not artist_pictures.get(artist_key):
            artist_pictures[artist_key] = True
            artist_names[artist_key]["artwork_url"] = row.artist_artwork_url
        elif not artist_names[artist_key]["artwork_url"] and picture:
            artist_names[artist_key]["artwork_url"] = picture

        song_key = f"{row.track_name.casefold()}\u0000{artist_key}"
        song_plays[song_key] += 1
        song_names.setdefault(
            song_key, {"name": row.track_name, "artist": row.artist_name, "artwork_url": row.artwork_url}
        )

        is_synthetic_live_album = (
            row.source == "setlistfm"
            and row.album_name is not None
            and row.album_name.lower().startswith("live at ")
        )
        if row.album_name and not is_synthetic_live_album:
            album_key = f"{row.album_name.casefold()}\u0000{artist_key}"
            album_plays[album_key] += 1
            album_tracks[album_key].add(row.track_name.casefold())
            album_names.setdefault(
                album_key, {"name": row.album_name, "artist": row.artist_name, "artwork_url": row.artwork_url}
            )

    qualifying_albums: Counter[str] = Counter(
        {key: plays for key, plays in album_plays.items() if len(album_tracks[key]) >= MIN_ALBUM_TRACKS}
    )

    busiest_hour = hours.most_common(1)[0][0]
    biggest_day_key = day_plays.most_common(1)[0][0]
    busiest_month = max(range(12), key=lambda index: months[index]) + 1
    first = rows[0]

    seen_before = {
        name
        for (name,) in db.execute(
            select(func.lower(ListeningEvent.artist_name))
            .where(ListeningEvent.user_id == user_id, ListeningEvent.played_at < start)
            .distinct()
        )
    }
    history_starts_at = db.execute(
        select(func.min(ListeningEvent.played_at)).where(ListeningEvent.user_id == user_id)
    ).scalar_one()
    # Only claim "new" artists when we hold history from before the year; otherwise every artist would look new.
    history_known = history_starts_at is not None and history_starts_at < start
    new_artists: Counter[str] = Counter()
    if history_known:
        new_artists = Counter({key: plays for key, plays in artist_plays.items() if key not in seen_before})

    return {
        "total_plays": len(rows),
        "estimated_minutes": round(total_ms / 60000),
        "history_starts_at": history_starts_at.isoformat() if history_starts_at else None,
        "months": months,
        "busiest_month": busiest_month,
        "top_artists": _top(artist_plays, artist_names),
        "top_songs": _top(song_plays, song_names),
        "top_albums": _top(qualifying_albums, album_names),
        "top_genres": _top_genres(db, user_id, start, end),
        "busiest_hour": busiest_hour,
        "busiest_weekday": weekdays.most_common(1)[0][0],
        "listener_label": _listener_label(busiest_hour),
        "biggest_day": {
            "date": biggest_day_key,
            "plays": day_plays[biggest_day_key],
            "minutes": round(day_ms[biggest_day_key] / 60000),
        },
        # If their history starts inside the year, every artist would look new, so don't claim it.
        "new_artists": len(new_artists) if history_known else None,
        "new_artists_top": _top(new_artists, artist_names, 3) if history_known else [],
        "first_song": {
            "name": first.track_name,
            "artist": first.artist_name,
            "played_at": first.played_at.isoformat(),
        },
    }


def _top_genres(db: Session, user_id: int, start: datetime, end: datetime) -> list[dict[str, Any]]:
    """Top five genres by share of plays, from the same Spotify and MusicBrainz cache Reports uses."""
    statement = build_report_genre_artist_counts_query(user_id=user_id, start=start, end=end).where(
        not_blocked_clause(user_id)
    )
    counts = db.execute(statement).all()
    artist_ids = {row.artist_id for row in counts if row.artist_id}
    if not artist_ids:
        return []
    cached = {
        row.artist_spotify_id: row.genres
        for row in db.query(GenreCache).filter(GenreCache.artist_spotify_id.in_(artist_ids)).all()
    }
    counter: Counter[str] = Counter()
    for row in counts:
        for genre in cached.get(row.artist_id) or []:
            counter[genre] += row.play_count
    total = sum(counter.values())
    if not total:
        return []
    return [{"name": genre, "share": round(plays / total, 4)} for genre, plays in counter.most_common(TOP_LIMIT)]
