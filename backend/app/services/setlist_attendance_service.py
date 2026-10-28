from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete
from sqlalchemy.orm import Session

from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.setlist_service import SetlistService

logger = logging.getLogger(__name__)


def extract_songs_from_setlist_data(data: dict[str, Any]) -> list[str]:
    sets_data = data.get("sets", {})
    if not isinstance(sets_data, dict):
        return []
    sets = sets_data.get("set", [])
    if isinstance(sets, dict):
        sets = [sets]
    if not isinstance(sets, list):
        return []

    song_names = []
    for s in sets:
        if not isinstance(s, dict):
            continue
        songs = s.get("song", [])
        if isinstance(songs, dict):
            songs = [songs]
        if isinstance(songs, list):
            for song in songs:
                if isinstance(song, dict):
                    name = song.get("name")
                    if name and isinstance(name, str) and name.strip():
                        song_names.append(name.strip())
    return song_names


def parse_event_date(date_str: str | None) -> datetime:
    if not date_str:
        return datetime.utcnow()
    # Setlist.fm format is typically "dd-MM-yyyy" (e.g., "27-06-2026")
    try:
        return datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        try:
            return datetime.fromisoformat(date_str)
        except ValueError:
            return datetime.utcnow()


class SetlistAttendanceService:
    def __init__(self, db: Session, setlist_service: SetlistService) -> None:
        self.db = db
        self.setlist_service = setlist_service

    def log_concert_attendance(
        self,
        user_id: int,
        setlist_id: str,
        support_setlist_ids: list[str] | None = None,
    ) -> AttendedConcert:
        support_ids = support_setlist_ids or []

        # 1. Fetch headliner setlist data
        headliner_data = self.setlist_service.get_setlist(setlist_id)
        if not headliner_data:
            raise ValueError(f"Setlist with ID {setlist_id} could not be found.")

        # 2. Fetch support act data
        support_data_list = []
        for supp_id in support_ids:
            supp_data = self.setlist_service.get_setlist(supp_id)
            if supp_data:
                support_data_list.append((supp_id, supp_data))

        # 3. Determine start times to ensure zero overlap:
        # Base event date at midnight
        event_dt = parse_event_date(headliner_data.get("eventDate"))
        base_date = event_dt.date()

        # If support acts exist:
        # support acts start at 18:45, 19:30...; headliner starts at 20:45
        # If no support acts: headliner starts at 20:00
        if support_data_list:
            headliner_start = datetime.combine(base_date, datetime.min.time()) + timedelta(hours=20, minutes=45)
        else:
            headliner_start = datetime.combine(base_date, datetime.min.time()) + timedelta(hours=20, minutes=0)

        # 4. Save and scrobble support acts
        for idx, (supp_id, supp_data) in enumerate(support_data_list):
            supp_artist = supp_data.get("artist", {}).get("name", "Unknown Artist")
            supp_mbid = supp_data.get("artist", {}).get("mbid")
            supp_venue = supp_data.get("venue", {}).get("name", "Unknown Venue")
            city = supp_data.get("venue", {}).get("city", {}).get("name", "")
            country = supp_data.get("venue", {}).get("city", {}).get("country", {}).get("name", "")
            tour_name = supp_data.get("tour", {}).get("name")
            supp_url = supp_data.get("url")
            supp_songs = extract_songs_from_setlist_data(supp_data)

            supp_start = datetime.combine(base_date, datetime.min.time()) + timedelta(hours=18, minutes=45 + (idx * 45))

            # Insert/update AttendedConcert for support act
            supp_concert = self.db.query(AttendedConcert).filter_by(user_id=user_id, setlist_id=supp_id).first()
            if not supp_concert:
                supp_concert = AttendedConcert(
                    user_id=user_id,
                    setlist_id=supp_id,
                    artist_name=supp_artist,
                    artist_mbid=supp_mbid,
                    venue_name=supp_venue,
                    city=city,
                    country=country,
                    event_date=event_dt,
                    tour_name=tour_name,
                    setlist_url=supp_url,
                    is_support_act=True,
                    parent_setlist_id=setlist_id,
                    raw_data=supp_data,
                    song_count=len(supp_songs),
                )
                self.db.add(supp_concert)
            else:
                supp_concert.is_support_act = True
                supp_concert.parent_setlist_id = setlist_id
                supp_concert.raw_data = supp_data
                supp_concert.song_count = len(supp_songs)

            # Scrobble support act songs
            self._create_scrobbles_for_setlist(
                user_id=user_id,
                setlist_id=supp_id,
                artist_name=supp_artist,
                venue_name=supp_venue,
                tour_name=tour_name,
                songs=supp_songs,
                start_time=supp_start,
            )

        # 5. Save and scrobble headliner
        hl_artist = headliner_data.get("artist", {}).get("name", "Unknown Artist")
        hl_mbid = headliner_data.get("artist", {}).get("mbid")
        hl_venue = headliner_data.get("venue", {}).get("name", "Unknown Venue")
        hl_city = headliner_data.get("venue", {}).get("city", {}).get("name", "")
        hl_country = headliner_data.get("venue", {}).get("city", {}).get("country", {}).get("name", "")
        hl_tour = headliner_data.get("tour", {}).get("name")
        hl_url = headliner_data.get("url")
        hl_songs = extract_songs_from_setlist_data(headliner_data)

        hl_concert = self.db.query(AttendedConcert).filter_by(user_id=user_id, setlist_id=setlist_id).first()
        if not hl_concert:
            hl_concert = AttendedConcert(
                user_id=user_id,
                setlist_id=setlist_id,
                artist_name=hl_artist,
                artist_mbid=hl_mbid,
                venue_name=hl_venue,
                city=hl_city,
                country=hl_country,
                event_date=event_dt,
                tour_name=hl_tour,
                setlist_url=hl_url,
                is_support_act=False,
                parent_setlist_id=None,
                raw_data=headliner_data,
                song_count=len(hl_songs),
            )
            self.db.add(hl_concert)
        else:
            hl_concert.raw_data = headliner_data
            hl_concert.song_count = len(hl_songs)

        self._create_scrobbles_for_setlist(
            user_id=user_id,
            setlist_id=setlist_id,
            artist_name=hl_artist,
            venue_name=hl_venue,
            tour_name=hl_tour,
            songs=hl_songs,
            start_time=headliner_start,
        )

        self.db.commit()
        return hl_concert

    def _create_scrobbles_for_setlist(
        self,
        user_id: int,
        setlist_id: str,
        artist_name: str,
        venue_name: str,
        tour_name: str | None,
        songs: list[str],
        start_time: datetime,
    ) -> None:
        # First delete existing scrobbles for this setlist to ensure clean replacement
        self.db.execute(
            delete(ListeningEvent).where(
                ListeningEvent.user_id == user_id,
                ListeningEvent.source == "setlistfm",
                ListeningEvent.play_id.like(f"setlistfm_{setlist_id}_%"),
            )
        )

        for idx, song_title in enumerate(songs):
            played_at = start_time + timedelta(seconds=idx * 210)
            event = ListeningEvent(
                user_id=user_id,
                track_id=f"setlistfm:{setlist_id}:{idx}",
                track_name=song_title,
                artist_name=artist_name,
                album_name=f"Live at {venue_name}" if venue_name else None,
                played_at=played_at,
                duration_ms=210000,
                source="setlistfm",
                play_id=f"setlistfm_{setlist_id}_{idx}",
                raw_metadata={
                    "setlist_id": setlist_id,
                    "venue": venue_name,
                    "is_live": True,
                    "tour": tour_name,
                },
            )
            self.db.add(event)

    def delete_concert_attendance(
        self,
        user_id: int,
        concert_id: int,
        include_support_acts: bool = True,
    ) -> int:
        concert = self.db.query(AttendedConcert).filter_by(id=concert_id, user_id=user_id).first()
        if not concert:
            return 0

        setlist_ids_to_remove = [concert.setlist_id]
        if include_support_acts:
            linked_supports = (
                self.db.query(AttendedConcert).filter_by(user_id=user_id, parent_setlist_id=concert.setlist_id).all()
            )
            setlist_ids_to_remove.extend(s.setlist_id for s in linked_supports)

        # 1. Purge all scrobbles for these setlists
        for sid in setlist_ids_to_remove:
            self.db.execute(
                delete(ListeningEvent).where(
                    ListeningEvent.user_id == user_id,
                    ListeningEvent.source == "setlistfm",
                    ListeningEvent.play_id.like(f"setlistfm_{sid}_%"),
                )
            )

        # 2. Delete attended concert records
        deleted_count = (
            self.db.query(AttendedConcert)
            .filter(
                AttendedConcert.user_id == user_id,
                AttendedConcert.setlist_id.in_(setlist_ids_to_remove),
            )
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return deleted_count

    def refresh_concert_setlist(self, user_id: int, concert_id: int) -> AttendedConcert:
        concert = self.db.query(AttendedConcert).filter_by(id=concert_id, user_id=user_id).first()
        if not concert:
            raise ValueError(f"Concert {concert_id} not found.")

        # Re-fetch from Setlist.fm (bypassing old cache or fresh)
        data = self.setlist_service.get_setlist(concert.setlist_id)
        if not data:
            return concert

        songs = extract_songs_from_setlist_data(data)
        concert.raw_data = data
        concert.song_count = len(songs)

        # Re-scrobble
        event_dt = parse_event_date(data.get("eventDate"))
        base_date = event_dt.date()
        start_time = datetime.combine(base_date, datetime.min.time()) + timedelta(hours=20, minutes=0)

        self._create_scrobbles_for_setlist(
            user_id=user_id,
            setlist_id=concert.setlist_id,
            artist_name=concert.artist_name,
            venue_name=concert.venue_name,
            tour_name=concert.tour_name,
            songs=songs,
            start_time=start_time,
        )

        self.db.commit()
        return concert
