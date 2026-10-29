from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.setlist_service import SetlistRateLimitError
from backend.app.services.setlist_stats_service import SetlistStatsService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_stats_leaderboards_and_gigs(db_session: Session):
    # Populate attended concerts
    c1 = AttendedConcert(
        user_id=1,
        setlist_id="psb_1",
        artist_name="Public Service Broadcasting",
        venue_name="Alexandra Palace",
        city="London",
        country="United Kingdom",
        event_date=datetime(2026, 9, 26),
        song_count=2,
    )
    c2 = AttendedConcert(
        user_id=1,
        setlist_id="psb_2",
        artist_name="Public Service Broadcasting",
        venue_name="Barbican Centre",
        city="London",
        country="United Kingdom",
        event_date=datetime(2025, 11, 1),
        song_count=2,
    )
    c3 = AttendedConcert(
        user_id=1,
        setlist_id="oasis_1",
        artist_name="Oasis",
        venue_name="Wembley Stadium",
        city="London",
        country="United Kingdom",
        event_date=datetime(2025, 7, 26),
        song_count=1,
    )
    db_session.add_all([c1, c2, c3])

    # Populate live listening events (source="setlistfm")
    e1 = ListeningEvent(
        user_id=1,
        track_id="psb:gagarin:1",
        track_name="Gagarin",
        artist_name="Public Service Broadcasting",
        played_at=datetime(2026, 9, 26, 21, 0),
        source="setlistfm",
        play_id="setlistfm_psb_1_0",
    )
    e2 = ListeningEvent(
        user_id=1,
        track_id="psb:gagarin:2",
        track_name="Gagarin",
        artist_name="Public Service Broadcasting",
        played_at=datetime(2025, 11, 1, 21, 0),
        source="setlistfm",
        play_id="setlistfm_psb_2_0",
    )
    e3 = ListeningEvent(
        user_id=1,
        track_id="psb:go:1",
        track_name="Go!",
        artist_name="Public Service Broadcasting",
        played_at=datetime(2026, 9, 26, 21, 5),
        source="setlistfm",
        play_id="setlistfm_psb_1_1",
    )
    e4 = ListeningEvent(
        user_id=1,
        track_id="oasis:liveforever:1",
        track_name="Live Forever",
        artist_name="Oasis",
        played_at=datetime(2025, 7, 26, 21, 0),
        source="setlistfm",
        play_id="setlistfm_oasis_1_0",
    )
    db_session.add_all([e1, e2, e3, e4])
    db_session.commit()

    service = SetlistStatsService(db=db_session)

    # 1. My Gigs timeline
    gigs = service.get_my_gigs(user_id=1)
    assert len(gigs) == 3
    # Sorted most recent first
    assert gigs[0]["artist_name"] == "Public Service Broadcasting"
    assert gigs[0]["venue_name"] == "Alexandra Palace"

    # 2. Artists Seen leaderboard
    artists_leaderboard = service.get_artists_seen_leaderboard(user_id=1)
    assert len(artists_leaderboard) == 2
    # PSB should be #1 with count 2
    assert artists_leaderboard[0]["artist_name"] == "Public Service Broadcasting"
    assert artists_leaderboard[0]["count"] == 2
    assert len(artists_leaderboard[0]["gigs"]) == 2
    # Oasis #2 with count 1
    assert artists_leaderboard[1]["artist_name"] == "Oasis"
    assert artists_leaderboard[1]["count"] == 1

    # 3. Songs Heard Live leaderboard
    songs_leaderboard = service.get_songs_heard_leaderboard(user_id=1)
    # Gagarin (2), Go! (1), Live Forever (1)
    assert songs_leaderboard[0]["track_name"] == "Gagarin"
    assert songs_leaderboard[0]["count"] == 2
    assert songs_leaderboard[0]["artist_name"] == "Public Service Broadcasting"
    # Each song lists the gigs it was heard at, most recent first
    assert [g["venue_name"] for g in songs_leaderboard[0]["gigs"]] == ["Alexandra Palace", "Barbican Centre"]
    assert songs_leaderboard[0]["gigs"][0]["date"] == "26 Sep 2026"

    # 4. Venues visited
    venues_leaderboard = service.get_venues_visited_leaderboard(user_id=1)
    assert len(venues_leaderboard) == 3
    venue_names = {v["venue_name"] for v in venues_leaderboard}
    assert "Alexandra Palace" in venue_names
    assert "Wembley Stadium" in venue_names
    wembley = next(v for v in venues_leaderboard if v["venue_name"] == "Wembley Stadium")
    assert [g["artist_name"] for g in wembley["gigs"]] == ["Oasis"]


def _concert(setlist_id: str, artist: str, venue: str, when: datetime, **kwargs: object) -> AttendedConcert:
    return AttendedConcert(
        user_id=1,
        setlist_id=setlist_id,
        artist_name=artist,
        venue_name=venue,
        city="Birmingham",
        country="United Kingdom",
        event_date=when,
        **kwargs,
    )


def _live_play(setlist_id: str, idx: int, track: str, artist: str, *, with_metadata: bool = True) -> ListeningEvent:
    return ListeningEvent(
        user_id=1,
        track_id=f"setlistfm:{setlist_id}:{idx}",
        track_name=track,
        artist_name=artist,
        played_at=datetime(2026, 1, 1, 21, idx),
        source="setlistfm",
        play_id=f"setlistfm_{setlist_id}_{idx}",
        raw_metadata={"setlist_id": setlist_id} if with_metadata else None,
    )


def test_songs_leaderboard_counts_performances_but_lists_each_gig_once(db_session: Session):
    db_session.add_all(
        [
            _concert("rrc_a1", "Red Rum Club", "O2 Institute", datetime(2026, 10, 16)),
            _concert("rrc_b2", "Red Rum Club", "O2 Academy", datetime(2025, 3, 1)),
            # Played twice in one show (e.g. an encore reprise) counts as two performances
            _live_play("rrc_a1", 0, "Eleanor", "Red Rum Club"),
            _live_play("rrc_a1", 9, "Eleanor", "Red Rum Club"),
            # Older scrobble without raw_metadata falls back to the play_id
            _live_play("rrc_b2", 0, "Eleanor", "Red Rum Club", with_metadata=False),
            # Orphaned scrobble whose gig was removed still counts but has no gig link
            _live_play("deleted_gig", 0, "Afternoon", "Red Rum Club"),
        ]
    )
    db_session.commit()

    songs = SetlistStatsService(db=db_session).get_songs_heard_leaderboard(user_id=1)

    assert [(s["track_name"], s["count"]) for s in songs] == [("Eleanor", 3), ("Afternoon", 1)]
    assert [g["setlist_id"] for g in songs[0]["gigs"]] == ["rrc_a1", "rrc_b2"]
    assert songs[1]["gigs"] == []


def test_songs_leaderboard_is_scoped_to_the_user(db_session: Session):
    other_gig = _concert("x1", "Doves", "Rock City", datetime(2026, 1, 1))
    other_gig.user_id = 2
    other_play = _live_play("x1", 0, "There Goes the Fear", "Doves")
    other_play.user_id = 2
    db_session.add_all([other_gig, other_play])
    db_session.commit()

    assert SetlistStatsService(db=db_session).get_songs_heard_leaderboard(user_id=1) == []


def test_artists_ordered_by_times_seen_then_most_recent(db_session: Session):
    db_session.add_all(
        [
            _concert("a1", "Doves", "Rock City", datetime(2024, 5, 1)),
            _concert("b1", "The Black Keys", "Victorious", datetime(2026, 8, 29)),
            _concert("c1", "The Lottery Winners", "HMV Empire", datetime(2025, 11, 25)),
            _concert("c2", "The Lottery Winners", "Victorious", datetime(2026, 8, 29)),
        ]
    )
    db_session.commit()

    artists = SetlistStatsService(db=db_session).get_artists_seen_leaderboard(user_id=1)

    assert [a["artist_name"] for a in artists] == ["The Lottery Winners", "The Black Keys", "Doves"]
    assert artists[0]["gigs"][0]["event_date"] == "2026-08-29T00:00:00"


def test_venue_counts_unique_nights_and_lists_every_act(db_session: Session):
    db_session.add_all(
        [
            _concert("h1", "Foo Fighters", "Anfield", datetime(2026, 6, 27, 20)),
            _concert("s1", "Royel Otis", "Anfield", datetime(2026, 6, 27, 19), is_support_act=True),
            _concert("h2", "Oasis", "Anfield", datetime(2025, 7, 1, 20)),
        ]
    )
    db_session.commit()

    venues = SetlistStatsService(db=db_session).get_venues_visited_leaderboard(user_id=1)

    assert len(venues) == 1
    assert venues[0]["count"] == 2
    assert [g["artist_name"] for g in venues[0]["gigs"]] == ["Foo Fighters", "Royel Otis", "Oasis"]
    assert venues[0]["gigs"][1]["is_support"] is True


def test_export_attended_gigs_json_and_csv(db_session: Session):
    c1 = AttendedConcert(
        user_id=1,
        setlist_id="psb_1",
        artist_name="Public Service Broadcasting",
        venue_name="Alexandra Palace",
        city="London",
        country="United Kingdom",
        event_date=datetime(2026, 9, 26),
        song_count=2,
        tour_name="Space Tour",
        raw_data={"songs": ["Gagarin", "Go!"]},
    )
    c2 = AttendedConcert(
        user_id=1,
        setlist_id="sec_show_999",
        artist_name="=HYPERLINK()",
        artist_mbid="sec_mbid",
        venue_name="+DangerousVenue",
        city="London",
        country="United Kingdom",
        event_date=datetime(2026, 9, 27),
        song_count=1,
        tour_name="@FormulaTour",
        raw_data={"songs": ["Payload"]},
    )
    db_session.add(c1)
    db_session.add(c2)
    db_session.commit()

    service = SetlistStatsService(db=db_session)

    # Test JSON export
    content_json, media_type_json = service.export_attended_gigs(user_id=1, format="json")
    assert media_type_json == "application/json"
    parsed_json = json.loads(content_json)
    assert len(parsed_json) == 2

    # Test CSV export
    content_csv, media_type_csv = service.export_attended_gigs(user_id=1, format="csv")
    assert media_type_csv == "text/csv"
    reader = csv.DictReader(io.StringIO(content_csv))
    rows = list(reader)
    assert len(rows) == 2
    # Verify formula injection sanitization (prefixed with ')
    sec_row = next(r for r in rows if "@" in r["tour_name"] or "'" in r["tour_name"])
    assert sec_row["artist_name"] == "'=HYPERLINK()"
    assert sec_row["venue_name"] == "'+DangerousVenue"
    assert sec_row["tour_name"] == "'@FormulaTour"


def test_venue_visits_merge_spelling_variants_on_the_same_night(db_session: Session):
    headliner = _concert("h1", "Shed Seven", "O2 Academy", datetime(2026, 11, 14, 20))
    support = _concert("s1", "The Clause", "o2  academy ", datetime(2026, 11, 14, 19), is_support_act=True)
    # Manual entries default to "United Kingdom" even where Setlist.fm says "England"
    support.country = "England"
    earlier = _concert("h2", "Shed Seven", "O2 Academy", datetime(2025, 4, 4, 20))
    elsewhere = _concert("h3", "Shed Seven", "O2 Academy", datetime(2025, 4, 5, 20))
    elsewhere.city = "Leeds"
    db_session.add_all([headliner, support, earlier, elsewhere])
    db_session.commit()

    venues = SetlistStatsService(db=db_session).get_venues_visited_leaderboard(user_id=1)

    by_city = {v["city"]: v for v in venues}
    assert set(by_city) == {"Birmingham", "Leeds"}
    birmingham = by_city["Birmingham"]
    assert birmingham["count"] == 2  # 14 Nov 2026 (headliner + support) and 4 Apr 2025
    assert birmingham["venue_name"] == "O2 Academy"
    assert len(birmingham["gigs"]) == 3
    assert by_city["Leeds"]["count"] == 1


def _headliner_with_venue(setlist_id: str = "hl_1") -> AttendedConcert:
    gig = _concert(setlist_id, "Foo Fighters", "Anfield", datetime(2026, 6, 27, 20))
    gig.city = "Liverpool"
    gig.raw_data = {"id": setlist_id, "venue": {"id": "venue_anfield", "name": "Anfield"}}
    return gig


def test_gig_bill_marks_which_acts_were_logged(db_session: Session):
    headliner = _headliner_with_venue()
    support = _concert("sp_1", "Royel Otis", "Anfield", datetime(2026, 6, 27, 19), is_support_act=True)
    support.city = "Liverpool"
    support.parent_setlist_id = "hl_1"
    db_session.add_all([headliner, support])
    db_session.commit()
    setlist_service = MagicMock()
    setlist_service.get_venue_date_setlists.return_value = [
        {"id": "sp_2", "artist": {"name": "Die Spitz"}},
        {"id": "sp_1", "artist": {"name": "Royel Otis"}},
    ]

    bill = SetlistStatsService(db=db_session).get_gig_bill(1, headliner, setlist_service)

    setlist_service.get_venue_date_setlists.assert_called_once_with(
        venue_id="venue_anfield", event_date_str="27-06-2026", exclude_setlist_id="hl_1"
    )
    assert bill["complete"] is True
    assert [(a["artist_name"], a["logged"], a["role"]) for a in bill["acts"]] == [
        ("Royel Otis", True, "support"),
        ("Die Spitz", False, None),
    ]
    assert bill["acts"][0]["concert_id"] == support.id

    # From the support act's page, the headliner is labelled and listed first
    setlist_service.get_venue_date_setlists.return_value = [{"id": "hl_1", "artist": {"name": "Foo Fighters"}}]
    support.raw_data = {"venue": {"id": "venue_anfield"}}
    bill = SetlistStatsService(db=db_session).get_gig_bill(1, support, setlist_service)
    assert [(a["artist_name"], a["role"]) for a in bill["acts"]] == [("Foo Fighters", "headliner")]


def test_gig_bill_falls_back_to_logged_acts_when_setlist_fm_is_unavailable(db_session: Session):
    headliner = _headliner_with_venue()
    other = _concert("sp_1", "Royel Otis", "anfield ", datetime(2026, 6, 27, 19), is_support_act=True)
    other.city = "Liverpool"
    db_session.add_all([headliner, other])
    db_session.commit()
    setlist_service = MagicMock()
    setlist_service.get_venue_date_setlists.side_effect = SetlistRateLimitError("quota")

    bill = SetlistStatsService(db=db_session).get_gig_bill(1, headliner, setlist_service)

    assert bill["complete"] is False
    assert [a["artist_name"] for a in bill["acts"]] == ["Royel Otis"]


def test_gig_bill_for_manual_gig_uses_only_logged_acts(db_session: Session):
    manual = _concert("manual-aaa", "Shed Seven", "O2 Academy", datetime(2026, 11, 14, 20))
    other_night = _concert("x", "The Clause", "O2 Academy", datetime(2026, 11, 15, 20))
    other_user = _concert("y", "Doves", "O2 Academy", datetime(2026, 11, 14, 20))
    other_user.user_id = 2
    db_session.add_all([manual, other_night, other_user])
    db_session.commit()
    setlist_service = MagicMock()

    bill = SetlistStatsService(db=db_session).get_gig_bill(1, manual, setlist_service)

    setlist_service.get_venue_date_setlists.assert_not_called()
    assert bill == {"acts": [], "complete": True, "capped": False}


def test_gig_bill_skips_lookup_for_odd_venue_ids_from_imported_data(db_session: Session):
    gig = _headliner_with_venue()
    gig.raw_data = {"venue": {"id": "x" * 300 + "/../user"}}
    db_session.add(gig)
    db_session.commit()
    setlist_service = MagicMock()

    bill = SetlistStatsService(db=db_session).get_gig_bill(1, gig, setlist_service)

    setlist_service.get_venue_date_setlists.assert_not_called()
    assert bill["complete"] is False
