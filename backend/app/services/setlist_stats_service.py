from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import AttendedConcert, ListeningEvent


def _display_date(value: datetime | None) -> str:
    return value.strftime("%d %b %Y") if value else ""


def _concert_ref(c: AttendedConcert) -> dict[str, Any]:
    """Compact gig reference used to list the concerts behind a song or venue count."""
    return {
        "id": c.id,
        "setlist_id": c.setlist_id,
        "artist_name": c.artist_name,
        "venue_name": c.venue_name,
        "city": c.city,
        "country": c.country,
        "event_date": c.event_date.isoformat() if c.event_date else None,
        "date": _display_date(c.event_date),
        "is_support": c.is_support_act,
    }


def _event_setlist_id(play_id: str | None, raw_metadata: dict[str, object] | None) -> str | None:
    """Recover the setlist a live scrobble came from (play_id is setlistfm_{setlist_id}_{n})."""
    if isinstance(raw_metadata, dict) and isinstance(raw_metadata.get("setlist_id"), str):
        return raw_metadata["setlist_id"]
    if play_id and play_id.startswith("setlistfm_") and "_" in play_id[len("setlistfm_") :]:
        return play_id[len("setlistfm_") :].rsplit("_", 1)[0]
    return None


def _sanitize_csv_cell(val: object) -> object:
    if isinstance(val, str) and val and val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{val}"
    return val


class SetlistStatsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_my_gigs(self, user_id: int, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        query = (
            self.db.query(AttendedConcert)
            .filter_by(user_id=user_id)
            .order_by(desc(AttendedConcert.event_date), desc(AttendedConcert.id))
            .offset(offset)
            .limit(limit)
        )
        results = []
        for c in query.all():
            results.append(
                {
                    "id": c.id,
                    "setlist_id": c.setlist_id,
                    "artist_name": c.artist_name,
                    "artist_mbid": c.artist_mbid,
                    "venue_name": c.venue_name,
                    "city": c.city,
                    "country": c.country,
                    "event_date": c.event_date.isoformat() if c.event_date else None,
                    "tour_name": c.tour_name,
                    "setlist_url": c.setlist_url,
                    "is_support_act": c.is_support_act,
                    "parent_setlist_id": c.parent_setlist_id,
                    "song_count": c.song_count,
                    "raw_data": c.raw_data,
                    "notes": c.notes,
                }
            )
        return results

    def get_gig(self, user_id: int, concert_id: int) -> AttendedConcert | None:
        return self.db.query(AttendedConcert).filter_by(id=concert_id, user_id=user_id).first()

    def get_artists_seen_leaderboard(self, user_id: int) -> list[dict[str, Any]]:
        all_concerts = (
            self.db.query(AttendedConcert)
            .filter_by(user_id=user_id)
            .order_by(desc(AttendedConcert.event_date), desc(AttendedConcert.id))
            .all()
        )

        gigs_by_artist: dict[str, list[dict[str, Any]]] = {}
        last_seen: dict[str, datetime] = {}
        for c in all_concerts:
            if c.artist_name not in gigs_by_artist:
                gigs_by_artist[c.artist_name] = []
                last_seen[c.artist_name] = c.event_date or datetime.min
            gigs_by_artist[c.artist_name].append(
                {
                    "id": c.id,
                    "setlist_id": c.setlist_id,
                    "date": _display_date(c.event_date),
                    "event_date": c.event_date.isoformat() if c.event_date else None,
                    "venue": c.venue_name,
                    "city": c.city,
                    "country": c.country,
                    "is_support": c.is_support_act,
                    "song_count": c.song_count,
                    "notes": c.notes,
                    "raw_data": c.raw_data,
                }
            )

        # Times seen, then most recently seen, then name (matches the page description)
        names = sorted(gigs_by_artist, key=lambda n: n.lower())
        names.sort(key=lambda n: last_seen[n], reverse=True)
        names.sort(key=lambda n: len(gigs_by_artist[n]), reverse=True)
        return [
            {"artist_name": name, "count": len(gigs_by_artist[name]), "gigs": gigs_by_artist[name]} for name in names
        ]

    def get_songs_heard_leaderboard(self, user_id: int, limit: int = 1000) -> list[dict[str, Any]]:
        events = (
            self.db.query(
                ListeningEvent.track_name,
                ListeningEvent.artist_name,
                ListeningEvent.play_id,
                ListeningEvent.raw_metadata,
            )
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source == "setlistfm",
            )
            .all()
        )
        concerts = {
            c.setlist_id: c
            for c in self.db.query(AttendedConcert).filter_by(user_id=user_id).order_by(AttendedConcert.id).all()
        }

        counts: dict[tuple[str, str], int] = {}
        setlists_by_song: dict[tuple[str, str], list[str]] = {}
        for track_name, artist_name, play_id, raw_metadata in events:
            key = (track_name, artist_name)
            counts[key] = counts.get(key, 0) + 1
            setlist_id = _event_setlist_id(play_id, raw_metadata)
            seen = setlists_by_song.setdefault(key, [])
            if setlist_id in concerts and setlist_id not in seen:
                seen.append(setlist_id)

        ordered = sorted(counts, key=lambda k: (-counts[k], k[0], k[1]))[:limit]
        results = []
        for key in ordered:
            song_gigs = [concerts[sid] for sid in setlists_by_song.get(key, [])]
            song_gigs.sort(key=lambda c: c.event_date or datetime.min, reverse=True)
            results.append(
                {
                    "track_name": key[0],
                    "artist_name": key[1],
                    "count": counts[key],
                    "gigs": [_concert_ref(c) for c in song_gigs],
                }
            )
        return results

    def get_venues_visited_leaderboard(self, user_id: int) -> list[dict[str, Any]]:
        concerts = (
            self.db.query(AttendedConcert)
            .filter_by(user_id=user_id)
            .order_by(desc(AttendedConcert.event_date), desc(AttendedConcert.id))
            .all()
        )

        gigs_by_venue: dict[tuple[str, str, str], list[AttendedConcert]] = {}
        for c in concerts:
            gigs_by_venue.setdefault((c.venue_name, c.city, c.country), []).append(c)

        results = []
        for (venue_name, city, country), venue_gigs in gigs_by_venue.items():
            # Count unique dates so support acts on the same night aren't extra visits
            visit_count = len({c.event_date.date() if c.event_date else None for c in venue_gigs})
            results.append(
                {
                    "venue_name": venue_name,
                    "city": city,
                    "country": country,
                    "count": visit_count,
                    "gigs": [_concert_ref(c) for c in venue_gigs],
                }
            )
        results.sort(key=lambda v: (-v["count"], v["venue_name"]))
        return results

    def export_attended_gigs(self, user_id: int, format: str = "json") -> tuple[str, str]:
        gigs = (
            self.db.query(AttendedConcert).filter_by(user_id=user_id).order_by(desc(AttendedConcert.event_date)).all()
        )

        if format.lower() == "csv":
            output = io.StringIO()
            fieldnames = [
                "artist_name",
                "venue_name",
                "city",
                "country",
                "event_date",
                "tour_name",
                "is_support_act",
                "song_count",
                "setlist_url",
            ]
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for g in gigs:
                writer.writerow(
                    {
                        "artist_name": _sanitize_csv_cell(g.artist_name),
                        "venue_name": _sanitize_csv_cell(g.venue_name),
                        "city": _sanitize_csv_cell(g.city),
                        "country": _sanitize_csv_cell(g.country),
                        "event_date": g.event_date.strftime("%Y-%m-%d") if g.event_date else "",
                        "tour_name": _sanitize_csv_cell(g.tour_name or ""),
                        "is_support_act": g.is_support_act,
                        "song_count": g.song_count,
                        "setlist_url": _sanitize_csv_cell(g.setlist_url or ""),
                    }
                )
            return output.getvalue(), "text/csv"

        # Default JSON
        data = [
            {
                "setlist_id": g.setlist_id,
                "artist_name": g.artist_name,
                "artist_mbid": g.artist_mbid,
                "venue_name": g.venue_name,
                "city": g.city,
                "country": g.country,
                "event_date": g.event_date.isoformat() if g.event_date else None,
                "tour_name": g.tour_name,
                "is_support_act": g.is_support_act,
                "parent_setlist_id": g.parent_setlist_id,
                "song_count": g.song_count,
                "setlist_url": g.setlist_url,
                "raw_data": g.raw_data,
            }
            for g in gigs
        ]
        return json.dumps(data, indent=2), "application/json"
