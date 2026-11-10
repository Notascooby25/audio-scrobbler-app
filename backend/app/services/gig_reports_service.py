from __future__ import annotations

import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from ..datetime_utils import utc_now

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..models import AttendedConcert, ListeningEvent, UserPreferences
from ..queries.analytics_queries import not_blocked_clause
from .gig_distance_service import _place, _queries, haversine_km

_APOSTROPHES = re.compile(r"[\u2018\u2019\u02bc\u0060\u00b4]")


def artist_key(name: str) -> str:
    """Matches artist names across Spotify and Setlist.fm: ignores case, accents, apostrophe
    style and extra spaces, so "Maxïmo Park" and "Maximo Park" are the same artist."""
    decomposed = unicodedata.normalize("NFKD", name)
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(_APOSTROPHES.sub("'", without_accents).casefold().split())


# Plays counted on each side of a gig. Same-day plays are left out of both sides.
GIG_WINDOW_DAYS = 14
# Gig bump looks at the most recent gigs only, to keep the number of queries bounded
GIG_BUMP_MAX_GIGS = 50
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
            artist_key(name)
            for (name,) in self.db.query(AttendedConcert.artist_name).filter(AttendedConcert.user_id == user_id)
        }
        # Spotify and Setlist.fm spell names differently (accents, curly apostrophes), so the
        # rows are grouped by a normalised key in Python, not by SQL lower()
        spellings = (
            self.db.query(
                ListeningEvent.artist_name,
                func.count(ListeningEvent.id).label("plays"),
            )
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source != LIVE_SOURCE,
                ListeningEvent.artist_name.isnot(None),
                not_blocked_clause(user_id),
            )
            .group_by(ListeningEvent.artist_name)
            .all()
        )
        plays_by_artist: dict[str, int] = Counter()
        spelling_plays: dict[str, Counter[str]] = {}
        for name, plays in spellings:
            key = artist_key(name)
            plays_by_artist[key] += int(plays)
            spelling_plays.setdefault(key, Counter())[name] += int(plays)

        gap = [
            {"artist_name": spelling_plays[key].most_common(1)[0][0], "plays": plays}
            for key, plays in sorted(plays_by_artist.items(), key=lambda item: (-item[1], item[0]))
            if key not in seen_live
        ]
        return gap[:limit]

    def get_gig_bump(self, user_id: int, now: datetime | None = None) -> dict[str, Any]:
        """Average plays in the two weeks before and after each past gig."""
        now = now or utc_now()
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

    def get_gig_travel_and_venues(self, user_id: int, now: datetime | None = None) -> dict[str, Any]:
        """Calculates total round-trip travel distance (deduplicated by event date + venue),
        active monthly streak, and top venue royalty."""
        now = now or utc_now()
        preferences = self.db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        home = (
            (preferences.home_lat, preferences.home_lng)
            if preferences and preferences.home_lat and preferences.home_lng
            else None
        )

        concerts = (
            self.db.query(AttendedConcert)
            .filter(AttendedConcert.user_id == user_id)
            .order_by(desc(AttendedConcert.event_date))
            .all()
        )

        # 1. Deduplicate visits by (date, venue, city) so multi-act festivals aren't multiplied
        distinct_visits: dict[tuple[str, str, str], list[AttendedConcert]] = {}
        # 2. Group by venue for Venue Royalty
        venue_groups: dict[str, dict[str, Any]] = {}
        # 3. Collect active months for streak
        attended_months: set[tuple[int, int]] = set()

        for c in concerts:
            if c.event_date:
                attended_months.add((c.event_date.year, c.event_date.month))
                visit_key = (
                    c.event_date.strftime("%Y-%m-%d"),
                    c.venue_name.strip().casefold(),
                    c.city.strip().casefold(),
                )
                distinct_visits.setdefault(visit_key, []).append(c)

            v_key = f"{c.venue_name.strip()}|{c.city.strip()}|{c.country.strip()}".casefold()
            v_info = venue_groups.setdefault(
                v_key,
                {
                    "venue_name": c.venue_name.strip(),
                    "city": c.city.strip(),
                    "country": c.country.strip(),
                    "distinct_dates": set(),
                    "festivals": 0,
                    "artists": set(),
                },
            )
            if c.event_date:
                v_info["distinct_dates"].add(c.event_date.strftime("%Y-%m-%d"))
            if c.is_festival:
                v_info["festivals"] += 1
            v_info["artists"].add(c.artist_name.strip())

        # Calculate travel distance
        total_distance_km = 0.0
        located_events = 0
        pending_events = 0

        if home:
            for (_day, _v, _c), _gigs in distinct_visits.items():
                first_gig = _gigs[0]
                venue_q, city_q = _queries(first_gig.venue_name, first_gig.city, first_gig.country)
                known, point, _approx = _place(self.db, venue_q, city_q)
                if not known:
                    pending_events += 1
                    continue
                if point is not None:
                    # Round trip = 2 * distance
                    one_way = haversine_km(home, point)
                    total_distance_km += 2 * one_way
                    located_events += 1

        # Calculate active streak (consecutive months with a gig up to current or latest month)
        active_streak = 0
        cur_year, cur_month = now.year, now.month
        # Check current month, if no gig yet check if previous month had a gig to continue streak
        if (cur_year, cur_month) not in attended_months:
            cur_month -= 1
            if cur_month < 1:
                cur_year, cur_month = cur_year - 1, 12

        while (cur_year, cur_month) in attended_months:
            active_streak += 1
            cur_month -= 1
            if cur_month < 1:
                cur_year, cur_month = cur_year - 1, 12

        # Format venue royalty
        royalty = []
        for v in venue_groups.values():
            royalty.append(
                {
                    "venue_name": v["venue_name"],
                    "city": v["city"],
                    "country": v["country"],
                    "gig_count": len(v["distinct_dates"]),
                    "festivals": v["festivals"],
                    "distinct_artists": len(v["artists"]),
                }
            )
        royalty.sort(key=lambda item: (item["gig_count"], item["distinct_artists"]), reverse=True)

        return {
            "home_set": home is not None,
            "total_distance_km": round(total_distance_km),
            "located_events": located_events,
            "pending_events": pending_events,
            "active_streak_months": active_streak,
            "venue_royalty": royalty[:10],
        }

    def get_live_first_discoveries(self, user_id: int, limit: int = 20) -> list[dict[str, Any]]:
        """Artists you experienced in person before ever scrobbling their music."""
        # Find earliest gig date per artist
        gigs = (
            self.db.query(
                AttendedConcert.artist_name,
                AttendedConcert.venue_name,
                AttendedConcert.city,
                AttendedConcert.country,
                AttendedConcert.event_date,
            )
            .filter(AttendedConcert.user_id == user_id)
            .order_by(AttendedConcert.event_date.asc())
            .all()
        )
        earliest_gigs: dict[str, dict[str, Any]] = {}
        for g in gigs:
            a_key = artist_key(g.artist_name)
            if a_key not in earliest_gigs and g.event_date:
                earliest_gigs[a_key] = {
                    "artist_name": g.artist_name,
                    "venue_name": g.venue_name,
                    "city": g.city,
                    "country": g.country,
                    "gig_date": g.event_date,
                }

        # Query listening scrobbles
        scrobbles = (
            self.db.query(
                ListeningEvent.artist_name,
                func.min(ListeningEvent.played_at).label("first_played"),
                func.count(ListeningEvent.id).label("total_plays"),
            )
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source != LIVE_SOURCE,
                not_blocked_clause(user_id),
            )
            .group_by(ListeningEvent.artist_name)
            .all()
        )

        discoveries = []
        for row in scrobbles:
            a_key = artist_key(row.artist_name)
            if a_key in earliest_gigs:
                gig_info = earliest_gigs[a_key]
                if gig_info["gig_date"] <= row.first_played:
                    discoveries.append(
                        {
                            "artist_name": gig_info["artist_name"],
                            "venue_name": gig_info["venue_name"],
                            "city": gig_info["city"],
                            "country": gig_info["country"],
                            "gig_date": gig_info["gig_date"].strftime("%d %b %Y"),
                            "first_scrobble_date": row.first_played.strftime("%d %b %Y"),
                            "lifetime_plays": row.total_plays,
                        }
                    )

        discoveries.sort(key=lambda d: d["lifetime_plays"], reverse=True)
        return discoveries[:limit]

    def get_gig_surge_leaderboard(
        self, user_id: int, limit: int = 5, now: datetime | None = None
    ) -> list[dict[str, Any]]:
        """Finds individual artists with the largest play surge in the 14 days following a concert,
        requiring at least 5 plays in the 28-day combined window to eliminate statistical noise."""
        now = now or utc_now()
        window = timedelta(days=GIG_WINDOW_DAYS)
        one_day = timedelta(days=1)
        latest_gig_day = now - window - one_day

        gigs = (
            self.db.query(AttendedConcert.artist_name, AttendedConcert.event_date, AttendedConcert.venue_name)
            .filter(
                AttendedConcert.user_id == user_id,
                AttendedConcert.is_support_act.is_(False),
                AttendedConcert.event_date <= latest_gig_day,
            )
            .order_by(desc(AttendedConcert.event_date))
            .limit(GIG_BUMP_MAX_GIGS)
            .all()
        )

        artist_surges: dict[str, dict[str, Any]] = {}
        for artist, gig_date, venue in gigs:
            a_key = artist_key(artist)
            if a_key in artist_surges:
                continue

            day_start = datetime.combine(gig_date.date(), datetime.min.time())
            before_start = day_start - window
            after_start = day_start + one_day
            after_end = after_start + window

            before_count = (
                self.db.query(func.count(ListeningEvent.id))
                .filter(
                    ListeningEvent.user_id == user_id,
                    ListeningEvent.source != LIVE_SOURCE,
                    ListeningEvent.played_at >= before_start,
                    ListeningEvent.played_at < day_start,
                    ListeningEvent.artist_name.ilike(artist),
                    not_blocked_clause(user_id),
                )
                .scalar()
                or 0
            )

            after_count = (
                self.db.query(func.count(ListeningEvent.id))
                .filter(
                    ListeningEvent.user_id == user_id,
                    ListeningEvent.source != LIVE_SOURCE,
                    ListeningEvent.played_at >= after_start,
                    ListeningEvent.played_at < after_end,
                    ListeningEvent.artist_name.ilike(artist),
                    not_blocked_clause(user_id),
                )
                .scalar()
                or 0
            )

            # Minimum 5 total plays threshold
            if (before_count + after_count) >= 5 and after_count > before_count:
                change = round((after_count - before_count) / before_count * 100, 1) if before_count else 100.0
                artist_surges[a_key] = {
                    "artist_name": artist,
                    "venue_name": venue,
                    "gig_date": gig_date.strftime("%d %b %Y"),
                    "plays_before": before_count,
                    "plays_after": after_count,
                    "change_percent": change,
                    "absolute_gain": after_count - before_count,
                }

        results = list(artist_surges.values())
        results.sort(key=lambda s: (s["absolute_gain"], s["change_percent"]), reverse=True)
        return results[:limit]

    def get_gigs_day_of_week(self, user_id: int) -> list[dict[str, Any]]:
        """Returns distribution of concert dates by day of the week (0=Mon .. 6=Sun)."""
        concerts = self.db.query(AttendedConcert.event_date).filter(AttendedConcert.user_id == user_id).all()
        counts = [0] * 7
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for (event_date,) in concerts:
            if event_date:
                counts[event_date.weekday()] += 1

        total = sum(counts)
        return [
            {
                "day_index": i,
                "day_name": day_names[i],
                "count": counts[i],
                "percent": round(counts[i] / total * 100, 1) if total > 0 else 0.0,
            }
            for i in range(7)
        ]

    def get_gig_map_pins(self, user_id: int) -> list[dict[str, Any]]:
        """Returns geocoded map pins for all attended concerts with coordinates from GeoCache."""
        concerts = (
            self.db.query(AttendedConcert)
            .filter(AttendedConcert.user_id == user_id)
            .order_by(desc(AttendedConcert.event_date))
            .all()
        )
        pins_map: dict[str, dict[str, Any]] = {}
        for c in concerts:
            venue_q, city_q = _queries(c.venue_name, c.city, c.country)
            known, point, approx = _place(self.db, venue_q, city_q)
            if not known or point is None:
                continue

            pin_key = f"{round(point[0], 4)},{round(point[1], 4)}"
            pin = pins_map.setdefault(
                pin_key,
                {
                    "lat": point[0],
                    "lng": point[1],
                    "venue_name": c.venue_name,
                    "city": c.city,
                    "country": c.country,
                    "approximate": approx,
                    "gig_count": 0,
                    "artists": [],
                },
            )
            pin["gig_count"] += 1
            if len(pin["artists"]) < 5 and c.artist_name not in pin["artists"]:
                pin["artists"].append(c.artist_name)

        return list(pins_map.values())

    def get_gig_cadence_matrix(self, user_id: int) -> dict[str, Any]:
        """Returns annual day-by-day gig counts so frontend can render an activity heatmap matrix."""
        concerts = (
            self.db.query(AttendedConcert.event_date)
            .filter(AttendedConcert.user_id == user_id, AttendedConcert.event_date.isnot(None))
            .order_by(AttendedConcert.event_date.asc())
            .all()
        )
        if not concerts:
            return {"years": [], "daily_counts": {}}

        # Count unique gigs per calendar date
        daily: Counter[str] = Counter()
        years_seen: set[int] = set()
        for (event_date,) in concerts:
            if event_date:
                day_str = event_date.strftime("%Y-%m-%d")
                daily[day_str] += 1
                years_seen.add(event_date.year)

        return {
            "years": sorted(years_seen, reverse=True),
            "daily_counts": dict(daily),
        }
