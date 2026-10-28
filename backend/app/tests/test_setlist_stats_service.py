from __future__ import annotations

import csv
import io
import json
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
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
        play_id="psb_1_0",
    )
    e2 = ListeningEvent(
        user_id=1,
        track_id="psb:gagarin:2",
        track_name="Gagarin",
        artist_name="Public Service Broadcasting",
        played_at=datetime(2025, 11, 1, 21, 0),
        source="setlistfm",
        play_id="psb_2_0",
    )
    e3 = ListeningEvent(
        user_id=1,
        track_id="psb:go:1",
        track_name="Go!",
        artist_name="Public Service Broadcasting",
        played_at=datetime(2026, 9, 26, 21, 5),
        source="setlistfm",
        play_id="psb_1_1",
    )
    e4 = ListeningEvent(
        user_id=1,
        track_id="oasis:liveforever:1",
        track_name="Live Forever",
        artist_name="Oasis",
        played_at=datetime(2025, 7, 26, 21, 0),
        source="setlistfm",
        play_id="oasis_1_0",
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

    # 4. Venues visited
    venues_leaderboard = service.get_venues_visited_leaderboard(user_id=1)
    assert len(venues_leaderboard) == 3
    venue_names = {v["venue_name"] for v in venues_leaderboard}
    assert "Alexandra Palace" in venue_names
    assert "Wembley Stadium" in venue_names


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
