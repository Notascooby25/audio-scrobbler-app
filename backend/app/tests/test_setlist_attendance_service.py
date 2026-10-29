from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.setlist_attendance_service import SetlistAttendanceService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_attendance_scrobble_sequencing_non_overlapping(db_session: Session):
    """Review Focus 2: Headliner and support acts are sequenced chronologically without overlapping."""
    mock_setlist_service = MagicMock()

    # Mock headliner (Foo Fighters)
    mock_setlist_service.get_setlist.side_effect = lambda sid: {
        "headliner_1": {
            "id": "headliner_1",
            "artist": {"name": "Foo Fighters", "mbid": "foo-mbid"},
            "venue": {"name": "Anfield", "city": {"name": "Liverpool", "country": {"name": "United Kingdom"}}},
            "eventDate": "27-06-2026",
            "tour": {"name": "Take Cover"},
            "url": "https://setlist.fm/1",
            "sets": {"set": [{"song": [{"name": "All My Life"}, {"name": "Everlong"}]}]},
        },
        "support_1": {
            "id": "support_1",
            "artist": {"name": "Die Spitz"},
            "venue": {"name": "Anfield", "city": {"name": "Liverpool", "country": {"name": "United Kingdom"}}},
            "eventDate": "27-06-2026",
            "url": "https://setlist.fm/2",
            "sets": {"set": [{"song": [{"name": "Hair of Dog"}]}]},
        },
        "support_2": {
            "id": "support_2",
            "artist": {"name": "Royel Otis"},
            "venue": {"name": "Anfield", "city": {"name": "Liverpool", "country": {"name": "United Kingdom"}}},
            "eventDate": "27-06-2026",
            "url": "https://setlist.fm/3",
            "sets": {"set": [{"song": [{"name": "Oyster"}]}]},
        },
    }[sid]

    service = SetlistAttendanceService(db=db_session, setlist_service=mock_setlist_service)
    concert = service.log_concert_attendance(
        user_id=1,
        setlist_id="headliner_1",
        support_setlist_ids=["support_1", "support_2"],
    )

    assert concert.artist_name == "Foo Fighters"
    assert concert.song_count == 2

    # Verify support concerts were created and linked
    support_concerts = db_session.query(AttendedConcert).filter_by(parent_setlist_id="headliner_1").all()
    assert len(support_concerts) == 2
    assert {s.artist_name for s in support_concerts} == {"Die Spitz", "Royel Otis"}

    # Verify listening events were created
    events = (
        db_session.query(ListeningEvent)
        .filter_by(user_id=1, source="setlistfm")
        .order_by(ListeningEvent.played_at.asc())
        .all()
    )
    assert len(events) == 4  # 1 (Die Spitz) + 1 (Royel Otis) + 2 (Foo Fighters)

    # Check timestamps are strictly chronological with NO duplicates
    timestamps = [e.played_at for e in events]
    assert len(timestamps) == len(set(timestamps)), "Timestamps must be unique and non-overlapping"
    assert sorted(timestamps) == timestamps

    # Verify support bands play before headliner
    artists_sequence = [e.artist_name for e in events]
    assert artists_sequence == ["Die Spitz", "Royel Otis", "Foo Fighters", "Foo Fighters"]


def test_log_attendance_with_empty_setlist_and_refresh(db_session: Session):
    """Review Focus 3: Shows logged on the day with empty setlist can be refreshed later."""
    mock_setlist_service = MagicMock()

    # Initial state: empty setlist
    mock_setlist_service.get_setlist.return_value = {
        "id": "empty_show_1",
        "artist": {"name": "Elbow"},
        "venue": {"name": "Co-op Live", "city": {"name": "Manchester", "country": {"name": "United Kingdom"}}},
        "eventDate": "15-11-2026",
        "sets": {"set": []},
    }

    service = SetlistAttendanceService(db=db_session, setlist_service=mock_setlist_service)
    concert = service.log_concert_attendance(user_id=1, setlist_id="empty_show_1", support_setlist_ids=[])
    assert concert.song_count == 0

    events_before = db_session.query(ListeningEvent).filter_by(user_id=1, source="setlistfm").count()
    assert events_before == 0

    # Later: setlist updated on Setlist.fm with songs
    mock_setlist_service.get_setlist.return_value = {
        "id": "empty_show_1",
        "artist": {"name": "Elbow"},
        "venue": {"name": "Co-op Live", "city": {"name": "Manchester", "country": {"name": "United Kingdom"}}},
        "eventDate": "15-11-2026",
        "sets": {"set": [{"song": [{"name": "Grounds for Divorce"}, {"name": "One Day Like This"}]}]},
    }

    refreshed = service.refresh_concert_setlist(user_id=1, concert_id=concert.id)
    assert refreshed.song_count == 2
    # Refresh must ask Setlist.fm, not a cached copy from before the update
    mock_setlist_service.get_setlist.assert_called_with("empty_show_1", force_refresh=True)

    events_after = db_session.query(ListeningEvent).filter_by(user_id=1, source="setlistfm").all()
    assert len(events_after) == 2
    assert [e.track_name for e in events_after] == ["Grounds for Divorce", "One Day Like This"]


def test_delete_attended_concert_cascade_purges_scrobbles(db_session: Session):
    """Review Focus 5: Deleting concert cascades to support acts and purges all related listening events."""
    mock_setlist_service = MagicMock()
    mock_setlist_service.get_setlist.side_effect = lambda sid: {
        "main_gig": {
            "id": "main_gig",
            "artist": {"name": "Oasis"},
            "venue": {"name": "Wembley Stadium", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
            "eventDate": "26-07-2025",
            "sets": {"set": [{"song": [{"name": "Live Forever"}, {"name": "Wonderwall"}]}]},
        },
        "supp_gig": {
            "id": "supp_gig",
            "artist": {"name": "Cast"},
            "venue": {"name": "Wembley Stadium", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
            "eventDate": "26-07-2025",
            "sets": {"set": [{"song": [{"name": "Fine Time"}]}]},
        },
    }[sid]

    service = SetlistAttendanceService(db=db_session, setlist_service=mock_setlist_service)
    concert = service.log_concert_attendance(user_id=1, setlist_id="main_gig", support_setlist_ids=["supp_gig"])

    # 2 concerts in DB (Oasis + Cast)
    assert db_session.query(AttendedConcert).filter_by(user_id=1).count() == 2
    # 3 scrobbles in DB
    assert db_session.query(ListeningEvent).filter_by(user_id=1, source="setlistfm").count() == 3

    # Delete with include_support_acts=True
    deleted_count = service.delete_concert_attendance(user_id=1, concert_id=concert.id, include_support_acts=True)
    assert deleted_count == 2

    # Both concerts and all 3 scrobbles should be gone
    assert db_session.query(AttendedConcert).filter_by(user_id=1).count() == 0
    assert db_session.query(ListeningEvent).filter_by(user_id=1, source="setlistfm").count() == 0


def test_log_and_update_concert_notes(db_session: Session):
    mock_setlist_service = MagicMock()
    mock_setlist_service.get_setlist.return_value = {
        "id": "gig_with_notes",
        "artist": {"name": "Blur"},
        "venue": {"name": "Wembley", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
        "eventDate": "08-07-2023",
        "sets": {"set": [{"song": [{"name": "Song 2"}]}]},
    }
    service = SetlistAttendanceService(db=db_session, setlist_service=mock_setlist_service)

    # Log with initial notes
    concert = service.log_concert_attendance(
        user_id=1,
        setlist_id="gig_with_notes",
        notes="  Incredible energy, packed crowd!  ",
    )
    assert concert.notes == "Incredible energy, packed crowd!"

    # Update notes
    updated = service.update_concert_notes(
        user_id=1, concert_id=concert.id, notes="Updated: Lost my phone but worth it"
    )
    assert updated.notes == "Updated: Lost my phone but worth it"

    # Clear notes with empty string
    cleared = service.update_concert_notes(user_id=1, concert_id=concert.id, notes="")
    assert cleared.notes is None
