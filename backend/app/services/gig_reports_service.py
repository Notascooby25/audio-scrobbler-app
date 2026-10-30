from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..models import AttendedConcert, ListeningEvent
from ..queries.analytics_queries import not_blocked_clause

# Plays counted on each side of a gig. Same-day plays are left out of both sides.
GIG_WINDOW_DAYS = 14
# Gig bump looks at the most recent gigs only, to keep the number of queries bounded
GIG_BUMP_MAX_GIGS = 200
# Scrobbles written from a gig's own setlist are not listening, so they never count
LIVE_SOURCE = "setlistfm"


def _month_keys(first: datetime, last: datetime) -> list[str]:
    """Every YYYY-MM from first to last, so a chart has no gaps in its months."""
    keys: list[str] = []
    year, month = first.year, first.month
    while (year, month) <= (last.year, last.month):
        keys.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return keys


class GigReportsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_gigs_by_period(self, user_id: int) -> dict[str, list[dict[str, Any]]]:
        rows = (
            self.db.query(AttendedConcert.event_date, AttendedConcert.is_festival)
            .filter(AttendedConcert.user_id == user_id)
            .all()
        )
        if not rows:
            return {"by_year": [], "by_month": []}

        gigs_by_month: Counter[str] = Counter()
        festivals_by_month: Counter[str] = Counter()
        gigs_by_year: Counter[str] = Counter()
        festivals_by_year: Counter[str] = Counter()
        for event_date, is_festival in rows:
            month = event_date.strftime("%Y-%m")
            year = event_date.strftime("%Y")
            gigs_by_month[month] += 1
            gigs_by_year[year] += 1
            if is_festival:
                festivals_by_month[month] += 1
                festivals_by_year[year] += 1

        first = min(event_date for event_date, _ in rows)
        last = max(event_date for event_date, _ in rows)
        by_month = [
            {"period": key, "gigs": gigs_by_month[key], "festivals": festivals_by_month[key]}
            for key in _month_keys(first, last)
        ]
        by_year = [
            {"period": key, "gigs": gigs_by_year[key], "festivals": festivals_by_year[key]}
            for key in sorted(gigs_by_year)
        ]
        return {"by_year": by_year, "by_month": by_month}

    def get_live_gap(self, user_id: int, limit: int = 20) -> list[dict[str, Any]]:
        """Artists you play a lot on Spotify but have never logged a gig for."""
        seen_live = {
            name.casefold()
            for (name,) in self.db.query(AttendedConcert.artist_name).filter(AttendedConcert.user_id == user_id)
        }
        artist_key = func.lower(ListeningEvent.artist_name)
        top_plays = (
            self.db.query(
                func.max(ListeningEvent.artist_name).label("artist_name"),
                func.count(ListeningEvent.id).label("plays"),
            )
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source != LIVE_SOURCE,
                ListeningEvent.artist_name.isnot(None),
                not_blocked_clause(user_id),
            )
            .group_by(artist_key)
            .order_by(desc("plays"), artist_key)
            .limit(200)
            .all()
        )
        gap = [
            {"artist_name": row.artist_name, "plays": int(row.plays)}
            for row in top_plays
            if row.artist_name.casefold() not in seen_live
        ]
        return gap[:limit]

    def get_gig_bump(self, user_id: int, now: datetime | None = None) -> dict[str, Any]:
        """Average plays in the two weeks before and after each past gig."""
        now = now or datetime.utcnow()
        window = timedelta(days=GIG_WINDOW_DAYS)
        one_day = timedelta(days=1)
        # Only gigs whose full "after" window has already passed
        latest_gig_day = now - window - one_day
        gig_days = [
            event_date
            for (event_date,) in (
                self.db.query(AttendedConcert.event_date)
                .filter(
                    AttendedConcert.user_id == user_id,
                    AttendedConcert.is_support_act.is_(False),
                    AttendedConcert.event_date <= latest_gig_day,
                )
                .order_by(desc(AttendedConcert.event_date))
                .limit(GIG_BUMP_MAX_GIGS)
            )
        ]

        before_total = 0
        after_total = 0
        for day in gig_days:
            day_start = datetime.combine(day.date(), datetime.min.time())
            before_total += self._count_plays(user_id, day_start - window, day_start)
            after_total += self._count_plays(user_id, day_start + one_day, day_start + one_day + window)

        gigs = len(gig_days)
        average_before = round(before_total / gigs, 1) if gigs else 0.0
        average_after = round(after_total / gigs, 1) if gigs else 0.0
        change = round((average_after - average_before) / average_before * 100, 1) if average_before else None
        return {
            "window_days": GIG_WINDOW_DAYS,
            "gigs_analysed": gigs,
            "average_plays_before": average_before,
            "average_plays_after": average_after,
            "change_percent": change,
        }

    def _count_plays(self, user_id: int, start: datetime, end: datetime) -> int:
        return (
            self.db.query(func.count(ListeningEvent.id))
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source != LIVE_SOURCE,
                ListeningEvent.played_at >= start,
                ListeningEvent.played_at < end,
                not_blocked_clause(user_id),
            )
            .scalar()
            or 0
        )
