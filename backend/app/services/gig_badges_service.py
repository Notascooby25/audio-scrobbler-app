from __future__ import annotations

from datetime import timedelta
from typing import Any
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import AttendedConcert, GigCompanion, UserPreferences
from .gig_distance_service import _place, _queries, haversine_km
from .gig_reports_service import artist_key


class GigBadgesService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def evaluate_badges(self, user_id: int) -> list[dict[str, Any]]:
        """Evaluates live music milestone badges for a user."""
        concerts = (
            self.db.query(AttendedConcert)
            .filter(AttendedConcert.user_id == user_id)
            .order_by(AttendedConcert.event_date.asc())
            .all()
        )

        preferences = self.db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        home = (
            (preferences.home_lat, preferences.home_lng)
            if preferences and preferences.home_lat and preferences.home_lng
            else None
        )

        # Pre-fetch companion concert IDs for this user
        companion_concert_ids = {
            c_id
            for (c_id,) in self.db.query(GigCompanion.concert_id).filter(
                GigCompanion.owner_id == user_id,
                GigCompanion.status == "added",
            )
        }

        # 1. Total Concerts & Century Club
        total_concerts = len(concerts)

        # 2. Solo Explorer (headline show without accepted companion)
        solo_gigs = 0
        # 3. Festival count (deduplicated by festival_name/year)
        festivals_seen: set[tuple[str, int]] = set()
        # 4. Support acts seen
        support_count = 0
        # 5. Distinct countries
        countries_seen: set[str] = set()
        # 6. Consecutive day double headers
        dates_sorted = sorted({c.event_date.date() for c in concerts if c.event_date})
        double_headers = 0
        for i in range(len(dates_sorted) - 1):
            if dates_sorted[i + 1] - dates_sorted[i] == timedelta(days=1):
                double_headers += 1

        # 7. Artists seen count for Diehard Fan
        artist_counts: dict[str, int] = {}
        # 8. Years active for Decade of Live
        years_seen = {c.event_date.year for c in concerts if c.event_date}
        # 9. Months in any single year for Golden Year
        year_months: dict[int, set[int]] = {}
        # 10. Longest consecutive months streak
        month_keys = sorted({(c.event_date.year, c.event_date.month) for c in concerts if c.event_date})
        longest_streak = 0
        current_streak = 0
        prev_m: tuple[int, int] | None = None
        for y, m in month_keys:
            if prev_m is None:
                current_streak = 1
            else:
                py, pm = prev_m
                expected_m = pm + 1 if pm < 12 else 1
                expected_y = py if pm < 12 else py + 1
                if (y, m) == (expected_y, expected_m):
                    current_streak += 1
                else:
                    current_streak = 1
            if current_streak > longest_streak:
                longest_streak = current_streak
            prev_m = (y, m)

        # 11. Road Warrior distance check (> 322 km / 200 mi)
        max_distance_km = 0.0

        for c in concerts:
            if not c.is_support_act and c.id not in companion_concert_ids:
                solo_gigs += 1

            if c.is_support_act:
                support_count += 1

            if c.is_festival and c.event_date:
                fest_name = (c.festival_name or c.venue_name).strip().casefold()
                festivals_seen.add((fest_name, c.event_date.year))

            if c.country:
                countries_seen.add(c.country.strip().casefold())

            a_key = artist_key(c.artist_name)
            artist_counts[a_key] = artist_counts.get(a_key, 0) + 1

            if c.event_date:
                year_months.setdefault(c.event_date.year, set()).add(c.event_date.month)

            if home and not c.is_support_act:
                venue_q, city_q = _queries(c.venue_name, c.city, c.country)
                known, point, _ = _place(self.db, venue_q, city_q)
                if known and point:
                    dist = haversine_km(home, point)
                    if dist > max_distance_km:
                        max_distance_km = dist

        # 12. Distinct companions count
        distinct_friends = (
            self.db.query(func.count(func.distinct(GigCompanion.friend_id)))
            .filter(
                GigCompanion.owner_id == user_id,
                GigCompanion.status == "added",
            )
            .scalar()
            or 0
        )

        max_artist_repeat = max(artist_counts.values()) if artist_counts else 0
        golden_year_max = max(len(months) for months in year_months.values()) if year_months else 0

        badges = [
            {
                "id": "solo_explorer",
                "name": "Solo Explorer",
                "emoji": "🧭",
                "description": "Attended a headline concert on your own",
                "unlocked": solo_gigs >= 1,
                "progress": solo_gigs,
                "target": 1,
            },
            {
                "id": "opening_act",
                "name": "First Through the Doors",
                "emoji": "🚪",
                "description": "Arrived early and logged seeing a support band",
                "unlocked": support_count >= 1,
                "progress": min(support_count, 1),
                "target": 1,
            },
            {
                "id": "diehard_fan",
                "name": "Diehard Fan",
                "emoji": "👑",
                "description": "Saw the same artist 3 or more times live",
                "unlocked": max_artist_repeat >= 3,
                "progress": min(max_artist_repeat, 3),
                "target": 3,
            },
            {
                "id": "mud_survivor",
                "name": "Mud Survivor",
                "emoji": "🎪",
                "description": "Attended 3 or more music festivals",
                "unlocked": len(festivals_seen) >= 3,
                "progress": min(len(festivals_seen), 3),
                "target": 3,
            },
            {
                "id": "road_warrior",
                "name": "Road Warrior",
                "emoji": "🛣️",
                "description": "Travelled >200 miles (>322 km) from home for a gig",
                "unlocked": max_distance_km >= 322,
                "progress": round(max_distance_km),
                "target": 322,
            },
            {
                "id": "double_header",
                "name": "Double Header",
                "emoji": "⚡",
                "description": "Attended concerts on 2 consecutive days",
                "unlocked": double_headers >= 1,
                "progress": double_headers,
                "target": 1,
            },
            {
                "id": "half_year_run",
                "name": "Half-Year Run",
                "emoji": "🔥",
                "description": "Concerts in 6 consecutive calendar months",
                "unlocked": longest_streak >= 6,
                "progress": min(longest_streak, 6),
                "target": 6,
            },
            {
                "id": "golden_year",
                "name": "Golden Year",
                "emoji": "🌟",
                "description": "Attended a concert in all 12 calendar months of a year",
                "unlocked": golden_year_max >= 12,
                "progress": golden_year_max,
                "target": 12,
            },
            {
                "id": "crew_love",
                "name": "Crew Love",
                "emoji": "🤝",
                "description": "Logged concerts with 3 or more companions",
                "unlocked": distinct_friends >= 3,
                "progress": min(distinct_friends, 3),
                "target": 3,
            },
            {
                "id": "support_supporter",
                "name": "Support Supporter",
                "emoji": "🔍",
                "description": "Logged seeing 10 or more support acts",
                "unlocked": support_count >= 10,
                "progress": min(support_count, 10),
                "target": 10,
            },
            {
                "id": "globe_trotter",
                "name": "Globe Trotter",
                "emoji": "✈️",
                "description": "Attended concerts in 3 or more different countries",
                "unlocked": len(countries_seen) >= 3,
                "progress": min(len(countries_seen), 3),
                "target": 3,
            },
            {
                "id": "century_club",
                "name": "Century Club",
                "emoji": "💯",
                "description": "Reach 100 total logged concerts",
                "unlocked": total_concerts >= 100,
                "progress": min(total_concerts, 100),
                "target": 100,
            },
            {
                "id": "decade_of_live",
                "name": "Decade of Live",
                "emoji": "💎",
                "description": "Concert attendance spanning 10 or more years",
                "unlocked": len(years_seen) >= 10,
                "progress": min(len(years_seen), 10),
                "target": 10,
            },
        ]
        return badges
