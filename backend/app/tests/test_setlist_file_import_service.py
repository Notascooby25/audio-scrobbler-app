from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.setlist_file_import_service import (
    MAX_ROWS,
    FileImportError,
    import_gigs_from_file,
)
from backend.app.services.setlist_service import SetlistRateLimitError
from backend.app.services.setlist_stats_service import SetlistStatsService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _gig(user_id: int, setlist_id: str, artist: str, when: datetime, songs: list[str]) -> AttendedConcert:
    return AttendedConcert(
        user_id=user_id,
        setlist_id=setlist_id,
        artist_name=artist,
        venue_name="O2 Institute",
        city="Birmingham",
        country="United Kingdom",
        event_date=when,
        tour_name="UK Tour 2026",
        setlist_url=f"https://www.setlist.fm/setlist/x/2026/o2-institute-birmingham-england-{setlist_id}.html",
        raw_data={"id": setlist_id, "sets": {"set": [{"song": [{"name": s} for s in songs]}]}},
        song_count=len(songs),
    )


def _no_api() -> MagicMock:
    service = MagicMock()
    service.get_setlist.side_effect = AssertionError("Setlist.fm should not be called")
    return service


def test_json_export_round_trips_into_another_account_without_api_calls(db_session: Session):
    db_session.add_all(
        [
            _gig(1, "63de4613", "Red Rum Club", datetime(2026, 10, 16), ["Eleanor", "Kids Addicted"]),
            _gig(1, "manual-abc123def456", "Shed Seven", datetime(2026, 11, 14), []),
        ]
    )
    db_session.commit()
    content, _ = SetlistStatsService(db=db_session).export_attended_gigs(user_id=1, format="json")

    result = import_gigs_from_file(2, "json", content, db_session, _no_api())

    assert result["imported"] == 2
    assert result["invalid_count"] == 0
    imported = {c.artist_name: c for c in db_session.query(AttendedConcert).filter_by(user_id=2)}
    assert imported["Red Rum Club"].song_count == 2
    assert imported["Shed Seven"].setlist_id == "manual-abc123def456"
    plays = db_session.query(ListeningEvent).filter_by(user_id=2, source="setlistfm").all()
    assert sorted(p.track_name for p in plays) == ["Eleanor", "Kids Addicted"]
    assert all(p.played_at.hour == 20 for p in plays)


def test_csv_export_round_trips_and_fetches_songs_from_the_setlist_link(db_session: Session):
    db_session.add(_gig(1, "63de4613", "=Formula Band", datetime(2026, 10, 16), ["Eleanor"]))
    db_session.commit()
    content, _ = SetlistStatsService(db=db_session).export_attended_gigs(user_id=1, format="csv")
    service = MagicMock()
    service.get_setlist.return_value = {"id": "63de4613", "sets": {"set": [{"song": [{"name": "Eleanor"}]}]}}

    result = import_gigs_from_file(2, "csv", content, db_session, service)

    assert result["imported"] == 1
    service.get_setlist.assert_called_once_with("63de4613")
    gig = db_session.query(AttendedConcert).filter_by(user_id=2).one()
    # The export's formula-protection quote is removed again
    assert gig.artist_name == "=Formula Band"
    assert gig.setlist_id == "63de4613"
    assert gig.song_count == 1


def test_gigs_already_logged_are_skipped_including_repeats_in_the_file(db_session: Session):
    db_session.add(_gig(2, "63de4613", "Red Rum Club", datetime(2026, 10, 16), ["Eleanor"]))
    db_session.commit()
    rows = [
        {"setlist_id": "63de4613", "artist_name": "Red Rum Club", "venue_name": "O2", "event_date": "2026-10-16"},
        # Same artist and day under another id counts as already logged
        {"artist_name": "red rum club", "venue_name": "O2", "event_date": "2026-10-16T19:00:00"},
        {"artist_name": "Doves", "venue_name": "Rock City", "event_date": "2025-05-01"},
        {"artist_name": "Doves", "venue_name": "Rock City", "event_date": "2025-05-01"},
    ]

    result = import_gigs_from_file(2, "json", json.dumps(rows), db_session, _no_api())

    assert (result["imported"], result["skipped_existing"]) == (1, 3)
    assert db_session.query(AttendedConcert).filter_by(user_id=2).count() == 2


def test_invalid_rows_are_reported_with_line_numbers(db_session: Session):
    content = (
        "artist_name,venue_name,city,country,event_date,tour_name,is_support_act,song_count,setlist_url\n"
        "Doves,Rock City,Nottingham,UK,2025-05-01,,False,0,\n"
        ",Rock City,Nottingham,UK,2025-05-02,,False,0,\n"
        "Elbow,Apollo,Manchester,UK,not-a-date,,False,0,\n"
        "Elbow,Apollo,Manchester,UK,2025-05-03,,False,0,javascript:alert(1)\n"
    )

    result = import_gigs_from_file(2, "csv", content, db_session, _no_api())

    assert result["imported"] == 1
    assert [row["line"] for row in result["invalid"]] == [3, 4, 5]
    assert result["invalid"][0]["error"].startswith("artist_name")
    assert "http" in result["invalid"][2]["error"]
    gig = db_session.query(AttendedConcert).filter_by(user_id=2).one()
    assert gig.setlist_id.startswith("manual-")


def test_quota_reached_imports_the_rest_without_songs(db_session: Session):
    rows = [
        {
            "setlist_url": f"https://www.setlist.fm/setlist/b/2025/v-{sid}.html",
            "artist_name": f"Band {sid}",
            "venue_name": "Rock City",
            "event_date": "2025-05-01",
        }
        for sid in ("1a2b3c4d", "5e6f7a8b")
    ]
    service = MagicMock()
    service.get_setlist.side_effect = SetlistRateLimitError("quota")

    result = import_gigs_from_file(2, "json", json.dumps(rows), db_session, service)

    assert result["imported"] == 2
    assert result["quota_reached"] is True
    assert result["without_songs"] == 2
    # Stops asking Setlist.fm once the daily quota is used up
    assert service.get_setlist.call_count == 1


@pytest.mark.parametrize(
    ("file_format", "content", "message"),
    [
        ("json", "{not json", "valid JSON"),
        ("json", '{"artist_name": "Doves"}', "list of gigs"),
        ("csv", "name,date\nDoves,2025-05-01\n", "artist_name column"),
        ("json", json.dumps([{}] * (MAX_ROWS + 1)), "limit"),
    ],
)
def test_unusable_files_are_rejected(db_session: Session, file_format: str, content: str, message: str):
    with pytest.raises(FileImportError, match=message):
        import_gigs_from_file(2, file_format, content, db_session, _no_api())


def test_long_song_names_are_truncated_to_fit_the_column(db_session: Session):
    rows = [
        {
            "setlist_id": "9f9f9f9f",
            "artist_name": "Long Song Band",
            "venue_name": "Rock City",
            "event_date": "2025-05-01",
            "raw_data": {"sets": {"set": [{"song": [{"name": "x" * 400}]}]}},
        }
    ]

    import_gigs_from_file(2, "json", json.dumps(rows), db_session, _no_api())

    play = db_session.query(ListeningEvent).filter_by(user_id=2).one()
    assert len(play.track_name) == 255
