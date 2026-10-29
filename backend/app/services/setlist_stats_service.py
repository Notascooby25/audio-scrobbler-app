from __future__ import annotations

import csv
import io
import json
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..models import AttendedConcert, ListeningEvent


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

    def get_artists_seen_leaderboard(self, user_id: int) -> list[dict[str, Any]]:
        # Count concerts per artist
        counts = (
            self.db.query(
                AttendedConcert.artist_name,
                func.count(AttendedConcert.id).label("total_gigs"),
            )
            .filter_by(user_id=user_id)
            .group_by(AttendedConcert.artist_name)
            .order_by(desc("total_gigs"), AttendedConcert.artist_name.asc())
            .all()
        )

        all_concerts = (
            self.db.query(AttendedConcert).filter_by(user_id=user_id).order_by(desc(AttendedConcert.event_date)).all()
        )

        gigs_by_artist: dict[str, list[dict[str, Any]]] = {}
        for c in all_concerts:
            if c.artist_name not in gigs_by_artist:
                gigs_by_artist[c.artist_name] = []
            gigs_by_artist[c.artist_name].append(
                {
                    "id": c.id,
                    "setlist_id": c.setlist_id,
                    "date": c.event_date.strftime("%d %b %Y") if c.event_date else "",
                    "venue": c.venue_name,
                    "city": c.city,
                    "country": c.country,
                    "is_support": c.is_support_act,
                    "song_count": c.song_count,
                    "notes": c.notes,
                    "raw_data": c.raw_data,
                }
            )

        leaderboard = []
        for artist_name, count in counts:
            leaderboard.append(
                {
                    "artist_name": artist_name,
                    "count": count,
                    "gigs": gigs_by_artist.get(artist_name, []),
                }
            )
        return leaderboard

    def get_songs_heard_leaderboard(self, user_id: int, limit: int = 100) -> list[dict[str, Any]]:
        results = (
            self.db.query(
                ListeningEvent.track_name,
                ListeningEvent.artist_name,
                func.count(ListeningEvent.id).label("live_count"),
            )
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source == "setlistfm",
            )
            .group_by(ListeningEvent.track_name, ListeningEvent.artist_name)
            .order_by(desc("live_count"), ListeningEvent.track_name.asc())
            .limit(limit)
            .all()
        )

        return [
            {
                "track_name": track_name,
                "artist_name": artist_name,
                "count": live_count,
            }
            for track_name, artist_name, live_count in results
        ]

    def get_venues_visited_leaderboard(self, user_id: int) -> list[dict[str, Any]]:
        # Count unique dates visited per venue (to avoid counting support acts as extra venue visits)
        subq = (
            self.db.query(
                AttendedConcert.venue_name,
                AttendedConcert.city,
                AttendedConcert.country,
                func.date(AttendedConcert.event_date).label("visit_date"),
            )
            .filter_by(user_id=user_id)
            .distinct()
            .subquery()
        )

        counts = (
            self.db.query(
                subq.c.venue_name,
                subq.c.city,
                subq.c.country,
                func.count().label("visit_count"),
            )
            .group_by(subq.c.venue_name, subq.c.city, subq.c.country)
            .order_by(desc("visit_count"), subq.c.venue_name.asc())
            .all()
        )

        return [
            {
                "venue_name": row[0],
                "city": row[1],
                "country": row[2],
                "count": row[3],
            }
            for row in counts
        ]

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
