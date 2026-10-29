from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import ListeningEvent

LIVE_SOURCE = "setlistfm"


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
