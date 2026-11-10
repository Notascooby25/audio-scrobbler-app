from __future__ import annotations

import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from ..datetime_utils import utc_now

from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

from ..models import AttendedConcert, ListeningEvent, UserPreferences
from ..queries.analytics_queries import not_blocked_clause
from .geocoding_service import find_cached
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

    def get_gigs_by_period(self, user_id: int, now: datetime | None = None) -> dict[str, list[dict[str, Any]]]:
        today = (now or utc_now()).date()
        rows = (
            self.db.query(AttendedConcert.event_date, AttendedConcert.venue_name, AttendedConcert.is_festival)
            .filter(AttendedConcert.user_id == user_id)
            .all()
        )
        # Only count events whose date has passed
        past_rows = [r for r in rows if r[0] and r[0].date() < today]
        if not past_rows:
            return {"by_year": [], "by_month": []}

        # Deduplicate multiple acts on the same day at the same venue/festival into 1 gig visit
        visits: dict[tuple[str, str], bool] = {}
        for event_date, venue_name, is_festival in past_rows:
            day_str = event_date.strftime("%Y-%m-%d")
            v_norm = (venue_name or "").strip().casefold()
            visit_key = (day_str, v_norm)
            # If any band logged at this visit was marked as a festival, mark the visit as festival
            visits[visit_key] = visits.get(visit_key, False) or bool(is_festival)

        gigs_by_month: Counter[str] = Counter()
        festivals_by_month: Counter[str] = Counter()
        gigs_by_year: Counter[str] = Counter()
        festivals_by_year: Counter[str] = Counter()
        for (day_str, _venue), is_festival in visits.items():
            month = day_str[:7]
            year = day_str[:4]
            gigs_by_month[month] += 1
            gigs_by_year[year] += 1
            if is_festival:
                festivals_by_month[month] += 1
                festivals_by_year[year] += 1

        first = min(event_date for event_date, _, _ in past_rows)
        last = max(event_date for event_date, _, _ in past_rows)
        by_month = [
            {"period": key, "gigs": gigs_by_month[key], "festivals": festivals_by_month[key]}
            for key in _month_keys(first, last)
        ]
        by_year = [
            {"period": key, "gigs": gigs_by_year[key], "festivals": festivals_by_year[key]}
            for key in sorted(gigs_by_year)
        ]
        return {"by_year": by_year, "by_month": by_month}

    def get_live_gap(self, user_id: int, limit: int = 20, now: datetime | None = None) -> list[dict[str, Any]]:
        """Artists you play a lot on Spotify but have never logged a gig for."""
        today = (now or utc_now()).date()
        seen_live = {
            artist_key(name)
            for (name, event_date) in self.db.query(AttendedConcert.artist_name, AttendedConcert.event_date).filter(
                AttendedConcert.user_id == user_id
            )
            if event_date and event_date.date() < today
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

        if not gig_days:
            return {
                "window_days": GIG_WINDOW_DAYS,
                "gigs_analysed": 0,
                "average_plays_before": 0.0,
                "average_plays_after": 0.0,
                "change_percent": None,
            }

        # Build list of (before_start, before_end, after_start, after_end) date windows
        windows = []
        for day in gig_days:
            day_start = datetime.combine(day.date(), datetime.min.time())
            windows.append(
                (
                    day_start - window,
                    day_start,
                    day_start + one_day,
                    day_start + one_day + window,
                )
            )

        # Single batched query over the combined date ranges using CASE WHEN
        overall_min = min(w[0] for w in windows)
        overall_max = max(w[3] for w in windows)

        before_conditions = [
            case(
                (
                    (ListeningEvent.played_at >= b_start) & (ListeningEvent.played_at < b_end),
                    1,
                ),
                else_=0,
            )
            for b_start, b_end, _, _ in windows
        ]
        after_conditions = [
            case(
                (
                    (ListeningEvent.played_at >= a_start) & (ListeningEvent.played_at < a_end),
                    1,
                ),
                else_=0,
            )
            for _, _, a_start, a_end in windows
        ]

        row = (
            self.db.query(
                func.sum(sum(before_conditions)).label("before_sum"),
                func.sum(sum(after_conditions)).label("after_sum"),
            )
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source != LIVE_SOURCE,
                ListeningEvent.played_at >= overall_min,
                ListeningEvent.played_at < overall_max,
                not_blocked_clause(user_id),
            )
            .first()
        )

        before_total = int(row.before_sum or 0) if row else 0
        after_total = int(row.after_sum or 0) if row else 0

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
        today = now.date()
        preferences = self.db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        home = (
            (preferences.home_lat, preferences.home_lng)
            if preferences and preferences.home_lat and preferences.home_lng
            else None
        )

        all_concerts = (
            self.db.query(AttendedConcert)
            .filter(AttendedConcert.user_id == user_id)
            .order_by(desc(AttendedConcert.event_date))
            .all()
        )
        concerts = [c for c in all_concerts if c.event_date and c.event_date.date() < today]

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
                    "distinct_festival_dates": set(),
                    "artists": set(),
                },
            )
            if c.event_date:
                v_info["distinct_dates"].add(c.event_date.strftime("%Y-%m-%d"))
                if c.is_festival:
                    v_info["distinct_festival_dates"].add(c.event_date.strftime("%Y-%m-%d"))
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
                    "festivals": len(v["distinct_festival_dates"]),
                    "distinct_artists": len(v["artists"]),
                }
            )
        royalty.sort(key=lambda item: (item["gig_count"], item["distinct_artists"]), reverse=True)

        return {
            "home_set": home is not None,
            "home_city": preferences.home_city if preferences else None,
            "home_lat": preferences.home_lat if preferences else None,
            "home_lng": preferences.home_lng if preferences else None,
            "total_distance_km": round(total_distance_km),
            "located_events": located_events,
            "pending_events": pending_events,
            "active_streak_months": active_streak,
            "venue_royalty": royalty[:10],
        }

    def get_live_first_discoveries(
        self, user_id: int, limit: int = 20, now: datetime | None = None
    ) -> list[dict[str, Any]]:
        """Artists you experienced in person before ever scrobbling their music."""
        today = (now or utc_now()).date()
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
            if a_key not in earliest_gigs and g.event_date and g.event_date.date() < today:
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

        if not gigs:
            return []

        # Deduplicate to unique artists (keeping their earliest or most recent qualifying gig)
        unique_gigs: dict[str, tuple[str, datetime, str]] = {}
        for artist, gig_date, venue in gigs:
            a_key = artist_key(artist)
            if a_key not in unique_gigs:
                unique_gigs[a_key] = (artist, gig_date, venue)

        # Batch load scrobbles in the earliest to latest overall window
        earliest_window_start = min(
            datetime.combine(item[1].date(), datetime.min.time()) - window for item in unique_gigs.values()
        )
        latest_window_end = max(
            datetime.combine(item[1].date(), datetime.min.time()) + one_day + window for item in unique_gigs.values()
        )

        scrobbles = (
            self.db.query(ListeningEvent.artist_name, ListeningEvent.played_at)
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source != LIVE_SOURCE,
                ListeningEvent.played_at >= earliest_window_start,
                ListeningEvent.played_at < latest_window_end,
                not_blocked_clause(user_id),
            )
            .all()
        )

        # Group timestamps by normalized artist key
        scrobbles_by_artist: dict[str, list[datetime]] = {}
        for a_name, played_at in scrobbles:
            if a_name and played_at:
                scrobbles_by_artist.setdefault(artist_key(a_name), []).append(played_at)

        artist_surges: dict[str, dict[str, Any]] = {}
        for a_key, (artist, gig_date, venue) in unique_gigs.items():
            day_start = datetime.combine(gig_date.date(), datetime.min.time())
            before_start = day_start - window
            after_start = day_start + one_day
            after_end = after_start + window

            plays = scrobbles_by_artist.get(a_key, [])
            before_count = sum(1 for p in plays if before_start <= p < day_start)
            after_count = sum(1 for p in plays if after_start <= p < after_end)

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

    def get_gigs_day_of_week(self, user_id: int, now: datetime | None = None) -> list[dict[str, Any]]:
        """Returns distribution of concert dates by day of the week (0=Mon .. 6=Sun), counting distinct dates."""
        today = (now or utc_now()).date()
        concerts = self.db.query(AttendedConcert.event_date).filter(AttendedConcert.user_id == user_id).all()
        # Deduplicate to unique calendar dates so multiple acts on the same night count as 1 gig (strictly past dates)
        distinct_dates = {event_date.date() for (event_date,) in concerts if event_date and event_date.date() < today}
        counts = [0] * 7
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for d in distinct_dates:
            counts[d.weekday()] += 1

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

    def get_gig_map_pins(self, user_id: int, now: datetime | None = None) -> list[dict[str, Any]]:
        """Returns geocoded map pins for all attended concerts with coordinates from GeoCache."""
        today = (now or utc_now()).date()
        concerts = (
            self.db.query(AttendedConcert)
            .filter(AttendedConcert.user_id == user_id)
            .order_by(desc(AttendedConcert.event_date))
            .all()
        )
        pins_map: dict[str, dict[str, Any]] = {}
        for c in concerts:
            if not c.event_date or c.event_date.date() >= today:
                continue
            venue_q, city_q = _queries(c.venue_name, c.city, c.country)
            known, point, approx = _place(self.db, venue_q, city_q)
            if not known or point is None:
                # If venue lookup failed or is pending, fallback to city if cached
                if city_q:
                    city_known, city_point = find_cached(self.db, city_q)
                    if city_known and city_point is not None:
                        point = city_point
                        approx = True
                if point is None:
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
                    "is_festival": False,
                    "festival_count": 0,
                    "artists": [],
                    "_distinct_dates": set(),
                    "_distinct_festival_dates": set(),
                },
            )
            day_str = c.event_date.strftime("%Y-%m-%d")
            pin["_distinct_dates"].add(day_str)
            if c.is_festival:
                pin["is_festival"] = True
                pin["_distinct_festival_dates"].add(day_str)
            if len(pin["artists"]) < 5 and c.artist_name not in pin["artists"]:
                pin["artists"].append(c.artist_name)

        # Set final deduplicated counts
        for pin in pins_map.values():
            pin["gig_count"] = len(pin.pop("_distinct_dates"))
            pin["festival_count"] = len(pin.pop("_distinct_festival_dates"))

        return list(pins_map.values())

    def get_gig_cadence_matrix(self, user_id: int, now: datetime | None = None) -> dict[str, Any]:
        """Returns annual day-by-day gig counts so frontend can render an activity heatmap matrix."""
        today = (now or utc_now()).date()
        concerts = (
            self.db.query(AttendedConcert.event_date)
            .filter(AttendedConcert.user_id == user_id, AttendedConcert.event_date.isnot(None))
            .order_by(AttendedConcert.event_date.asc())
            .all()
        )
        if not concerts:
            return {"years": [], "daily_counts": {}}

        # Count unique gig outings per calendar date so multiple acts on the same date count as 1 gig
        distinct_dates = {event_date.date() for (event_date,) in concerts if event_date and event_date.date() < today}
        daily: dict[str, int] = {}
        years_seen: set[int] = set()
        for d in sorted(distinct_dates):
            day_str = d.strftime("%Y-%m-%d")
            daily[day_str] = 1
            years_seen.add(d.year)

        return {
            "years": sorted(years_seen, reverse=True),
            "daily_counts": daily,
        }
