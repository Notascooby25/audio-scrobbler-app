from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import AttendedConcert, GigCompanion, ListeningEvent
from .setlist_artwork_service import existing_gig_artwork, local_live_artwork
from .setlist_service import SetlistService
from .setlist_stats_service import _venue_key

logger = logging.getLogger(__name__)


class DuplicateGigError(Exception):
    """Raised when a gig the user is logging looks like one they've already logged."""

    def __init__(self, existing: AttendedConcert, same_show: bool) -> None:
        super().__init__("Gig already logged.")
        self.existing = existing
        self.same_show = same_show


def festival_name_for(is_festival: bool, name: str | None) -> str | None:
    """A festival's name, kept only for festival gigs and trimmed; blank means no name."""
    cleaned = " ".join(name.split()) if name else ""
    return cleaned[:255] if is_festival and cleaned else None


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

    def find_existing_gig(
        self,
        user_id: int,
        setlist_id: str | None,
        artist_name: str,
        event_date: datetime,
        exclude_id: int | None = None,
    ) -> AttendedConcert | None:
        """The same Setlist.fm show, or the same artist (any spelling case) on the same day."""
        if setlist_id:
            same_show = self.db.query(AttendedConcert).filter_by(user_id=user_id, setlist_id=setlist_id).first()
            if same_show:
                return same_show
        day_start = datetime.combine(event_date.date(), datetime.min.time())
        query = self.db.query(AttendedConcert).filter(
            AttendedConcert.user_id == user_id,
            func.lower(AttendedConcert.artist_name) == artist_name.strip().lower(),
            AttendedConcert.event_date >= day_start,
            AttendedConcert.event_date < day_start + timedelta(days=1),
        )
        if exclude_id is not None:
            query = query.filter(AttendedConcert.id != exclude_id)
        return query.order_by(AttendedConcert.id).first()

    def log_concert_attendance(
        self,
        user_id: int,
        setlist_id: str,
        support_setlist_ids: list[str] | None = None,
        notes: str | None = None,
        allow_duplicate: bool = True,
    ) -> AttendedConcert:
        support_ids = support_setlist_ids or []

        # 1. Fetch headliner setlist data
        headliner_data = self.setlist_service.get_setlist(setlist_id)
        if not headliner_data:
            raise ValueError(f"Setlist with ID {setlist_id} could not be found.")

        if not allow_duplicate:
            existing = self.find_existing_gig(
                user_id=user_id,
                setlist_id=setlist_id,
                artist_name=headliner_data.get("artist", {}).get("name", ""),
                event_date=parse_event_date(headliner_data.get("eventDate")),
            )
            if existing:
                raise DuplicateGigError(existing, same_show=existing.setlist_id == setlist_id)

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
                notes=notes.strip() if notes else None,
            )
            self.db.add(hl_concert)
        else:
            hl_concert.raw_data = headliner_data
            hl_concert.song_count = len(hl_songs)
            if notes is not None:
                hl_concert.notes = notes.strip() if notes else None

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

    def log_bill_act(self, user_id: int, gig: AttendedConcert, setlist_id: str) -> AttendedConcert:
        """Logs another act from the same venue and night as `gig`.

        From a headliner's page the act becomes that gig's support act. From a support
        act's page it's logged as a normal gig (usually the headliner) and linked as the
        support act's parent if it had none.
        """
        data = self.setlist_service.get_setlist(setlist_id)
        if not data:
            raise ValueError(f"Setlist with ID {setlist_id} could not be found.")

        venue = data.get("venue", {}) if isinstance(data.get("venue"), dict) else {}
        city = venue.get("city", {}) if isinstance(venue.get("city"), dict) else {}
        event_dt = parse_event_date(data.get("eventDate"))
        gig_raw = gig.raw_data if isinstance(gig.raw_data, dict) else {}
        gig_venue_id = (gig_raw.get("venue") or {}).get("id") if isinstance(gig_raw.get("venue"), dict) else None
        same_venue = (
            str(venue.get("id")) == str(gig_venue_id)
            if gig_venue_id
            else _venue_key(venue.get("name"), city.get("name")) == _venue_key(gig.venue_name, gig.city)
        )
        if not same_venue or not gig.event_date or event_dt.date() != gig.event_date.date():
            raise ValueError("That act isn't on this gig's bill (different venue or night).")

        artist_name = data.get("artist", {}).get("name", "Unknown Artist")
        existing = self.find_existing_gig(user_id, setlist_id, artist_name, event_dt)
        if existing:
            raise DuplicateGigError(existing, same_show=existing.setlist_id == setlist_id)

        as_support = not gig.is_support_act
        day = datetime.combine(event_dt.date(), datetime.min.time())
        if as_support:
            earlier_supports = (
                self.db.query(AttendedConcert)
                .filter_by(user_id=user_id, parent_setlist_id=gig.setlist_id, is_support_act=True)
                .count()
            )
            start_time = day + timedelta(hours=18, minutes=45 + earlier_supports * 45)
        else:
            start_time = day + timedelta(hours=20, minutes=45)
            if not gig.parent_setlist_id:
                gig.parent_setlist_id = setlist_id

        songs = extract_songs_from_setlist_data(data)
        concert = AttendedConcert(
            user_id=user_id,
            setlist_id=setlist_id,
            artist_name=artist_name,
            artist_mbid=data.get("artist", {}).get("mbid"),
            venue_name=venue.get("name") or gig.venue_name,
            city=city.get("name") or gig.city,
            country=(city.get("country") or {}).get("name") or gig.country,
            event_date=event_dt,
            tour_name=(data.get("tour") or {}).get("name"),
            setlist_url=data.get("url"),
            is_support_act=as_support,
            parent_setlist_id=gig.setlist_id if as_support else None,
            raw_data=data,
            song_count=len(songs),
        )
        self.db.add(concert)
        self._create_scrobbles_for_setlist(
            user_id=user_id,
            setlist_id=setlist_id,
            artist_name=artist_name,
            venue_name=concert.venue_name,
            tour_name=concert.tour_name,
            songs=songs,
            start_time=start_time,
        )
        self.db.commit()
        self.db.refresh(concert)
        return concert

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
        # Keep artwork the old scrobbles had, then fill gaps from the user's own plays
        kept = existing_gig_artwork(self.db, user_id, setlist_id)
        local_tracks, artist_image = local_live_artwork(self.db, user_id, artist_name) if songs else ({}, None)

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
            kept_art, kept_artist_art = kept.get(song_title.lower(), (None, None))
            event = ListeningEvent(
                user_id=user_id,
                track_id=f"setlistfm:{setlist_id}:{idx}",
                track_name=song_title,
                artist_name=artist_name,
                album_name=f"Live at {venue_name}" if venue_name else None,
                artwork_url=kept_art if kept_art is not None else local_tracks.get(song_title.lower()),
                artist_artwork_url=kept_artist_art if kept_artist_art is not None else artist_image,
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

        # 2. Withdraw invites to these gigs (gigs friends already added stay theirs)
        removed_ids = [
            gig_id
            for (gig_id,) in self.db.query(AttendedConcert.id).filter(
                AttendedConcert.user_id == user_id, AttendedConcert.setlist_id.in_(setlist_ids_to_remove)
            )
        ]
        if removed_ids:
            self.db.query(GigCompanion).filter(GigCompanion.concert_id.in_(removed_ids)).delete(
                synchronize_session=False
            )

        # 3. Delete attended concert records
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

        # Always ask Setlist.fm: the cached copy may predate corrections made there
        data = self.setlist_service.get_setlist(concert.setlist_id, force_refresh=True)
        if not data:
            return concert

        songs = extract_songs_from_setlist_data(data)
        concert.raw_data = data
        concert.song_count = len(songs)

        # Re-scrobble on the gig's saved night (the user may have corrected it), keeping
        # the start time the scrobbles already had
        first_play = self.db.execute(
            select(func.min(ListeningEvent.played_at)).where(*self._gig_events(user_id, concert.setlist_id))
        ).scalar()
        if first_play is not None and first_play.date() == concert.event_date.date():
            start_time = first_play
        else:
            start = timedelta(hours=18, minutes=45) if concert.is_support_act else timedelta(hours=20)
            start_time = datetime.combine(concert.event_date.date(), datetime.min.time()) + start

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

    @staticmethod
    def _gig_events(user_id: int, setlist_id: str) -> tuple[Any, ...]:
        return (
            ListeningEvent.user_id == user_id,
            ListeningEvent.source == "setlistfm",
            ListeningEvent.play_id.like(f"setlistfm_{setlist_id}_%"),
        )

    def update_concert_details(
        self,
        user_id: int,
        concert_id: int,
        artist_name: str,
        venue_name: str,
        city: str,
        country: str,
        event_date_str: str,
        tour_name: str | None = None,
        allow_duplicate: bool = False,
        is_festival: bool | None = None,
        festival_name: str | None = None,
    ) -> AttendedConcert:
        """Corrects a gig's details. Its scrobbles, and support acts logged under it, move
        with it. Setlist.fm's copy (raw_data) is left alone, so Refresh only updates songs."""
        concert = self.db.query(AttendedConcert).filter_by(id=concert_id, user_id=user_id).first()
        if not concert:
            raise LookupError(f"Concert {concert_id} not found.")
        try:
            new_day = datetime.strptime(event_date_str, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("Enter the date as YYYY-MM-DD.") from exc

        artist, venue, city, country = (v.strip() for v in (artist_name, venue_name, city, country))
        if not artist or not venue:
            raise ValueError("Artist and venue are required.")
        if not allow_duplicate:
            existing = self.find_existing_gig(user_id, None, artist, new_day, exclude_id=concert.id)
            if existing:
                raise DuplicateGigError(existing, same_show=False)

        old_day = datetime.combine(concert.event_date.date(), datetime.min.time())
        shift = new_day - old_day
        venue_moved = (venue, city, country) != (concert.venue_name, concert.city, concert.country)
        supports = (
            self.db.query(AttendedConcert)
            .filter_by(user_id=user_id, parent_setlist_id=concert.setlist_id, is_support_act=True)
            .filter(AttendedConcert.id != concert.id)
            .all()
            if not concert.is_support_act
            else []
        )

        tour = tour_name.strip() if tour_name and tour_name.strip() else None
        concert.artist_name, concert.tour_name = artist, tour
        if is_festival is not None:
            concert.is_festival = is_festival
        if is_festival is not None or festival_name is not None:
            concert.festival_name = festival_name_for(concert.is_festival, festival_name)
        for gig in [concert, *supports]:
            gig.event_date = gig.event_date + shift
            if venue_moved:
                gig.venue_name, gig.city, gig.country = venue, city, country
            for event in self.db.query(ListeningEvent).filter(*self._gig_events(user_id, gig.setlist_id)):
                event.played_at = event.played_at + shift
                event.album_name = f"Live at {gig.venue_name}"
                if gig is concert:
                    event.artist_name = artist
                event.raw_metadata = {
                    **(event.raw_metadata or {}),
                    "venue": gig.venue_name,
                    **({"tour": tour} if gig is concert else {}),
                }

        self.db.commit()
        self.db.refresh(concert)
        return concert

    def update_concert_notes(self, user_id: int, concert_id: int, notes: str | None) -> AttendedConcert:
        concert = self.db.query(AttendedConcert).filter_by(id=concert_id, user_id=user_id).first()
        if not concert:
            raise ValueError(f"Concert {concert_id} not found.")

        concert.notes = notes.strip() if notes and notes.strip() else None
        self.db.commit()
        self.db.refresh(concert)
        return concert

    def log_manual_concert(
        self,
        user_id: int,
        artist_name: str,
        venue_name: str,
        city: str,
        country: str,
        event_date_str: str,
        notes: str | None = None,
        setlist_url: str | None = None,
        allow_duplicate: bool = True,
        is_festival: bool = False,
        festival_name: str | None = None,
    ) -> AttendedConcert:
        try:
            event_dt = datetime.strptime(event_date_str, "%Y-%m-%d")
        except ValueError:
            event_dt = parse_event_date(event_date_str)

        if not allow_duplicate:
            existing = self.find_existing_gig(
                user_id=user_id, setlist_id=None, artist_name=artist_name, event_date=event_dt
            )
            if existing:
                raise DuplicateGigError(existing, same_show=False)

        setlist_id = f"manual-{uuid.uuid4().hex[:12]}"
        clean_artist = artist_name.strip()
        clean_venue = venue_name.strip()
        clean_city = city.strip()
        clean_country = country.strip()
        clean_notes = notes.strip() if notes and notes.strip() else None
        clean_url = setlist_url.strip() if setlist_url and setlist_url.strip() else None

        raw_data = {
            "id": setlist_id,
            "eventDate": event_dt.strftime("%d-%m-%Y"),
            "artist": {"name": clean_artist},
            "venue": {
                "name": clean_venue,
                "city": {"name": clean_city, "country": {"name": clean_country}},
            },
            "sets": {"set": []},
            "url": clean_url or "",
            "is_manual": True,
        }

        concert = AttendedConcert(
            user_id=user_id,
            setlist_id=setlist_id,
            artist_name=clean_artist,
            venue_name=clean_venue,
            city=clean_city,
            country=clean_country,
            event_date=event_dt,
            setlist_url=clean_url,
            is_support_act=False,
            is_festival=is_festival,
            festival_name=festival_name_for(is_festival, festival_name),
            raw_data=raw_data,
            song_count=0,
            notes=clean_notes,
        )
        self.db.add(concert)
        self.db.commit()
        self.db.refresh(concert)
        return concert
