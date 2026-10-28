from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent
from backend.app.services.setlist_service import SetlistRateLimitError
from worker.setlist_import import sync_user_setlist_history


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_sync_user_setlist_history_paginated(db_session: Session):
    mock_service = MagicMock()

    # Mock page 1 of user attended
    mock_service.get_user_attended.side_effect = lambda username, p=1: {
        1: {
            "total": 2,
            "itemsPerPage": 1,
            "page": 1,
            "setlist": [
                {
                    "id": "show_page_1",
                    "artist": {"name": "Elbow"},
                    "venue": {"name": "Apollo", "city": {"name": "Manchester", "country": {"name": "United Kingdom"}}},
                    "eventDate": "10-10-2025",
                    "sets": {"set": [{"song": [{"name": "Grounds for Divorce"}]}]},
                }
            ],
        },
        2: {
            "total": 2,
            "itemsPerPage": 1,
            "page": 2,
            "setlist": [
                {
                    "id": "show_page_2",
                    "artist": {"name": "Fat Dog"},
                    "venue": {"name": "Windmill", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
                    "eventDate": "12-10-2025",
                    "sets": {"set": [{"song": [{"name": "King of the Slugs"}]}]},
                }
            ],
        },
    }.get(p, {"total": 2, "setlist": []})

    mock_service.get_setlist.side_effect = lambda sid: {
        "show_page_1": {
            "id": "show_page_1",
            "artist": {"name": "Elbow"},
            "venue": {"name": "Apollo", "city": {"name": "Manchester", "country": {"name": "United Kingdom"}}},
            "eventDate": "10-10-2025",
            "sets": {"set": [{"song": [{"name": "Grounds for Divorce"}]}]},
        },
        "show_page_2": {
            "id": "show_page_2",
            "artist": {"name": "Fat Dog"},
            "venue": {"name": "Windmill", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
            "eventDate": "12-10-2025",
            "sets": {"set": [{"song": [{"name": "King of the Slugs"}]}]},
        },
    }[sid]

    result = sync_user_setlist_history(
        user_id=1,
        setlist_username="crispylettuce",
        db=db_session,
        setlist_service=mock_service,
    )

    assert result["status"] == "completed"
    assert result["imported_count"] == 2

    # Check database attendances
    gigs = db_session.query(AttendedConcert).filter_by(user_id=1).all()
    assert len(gigs) == 2
    assert {g.artist_name for g in gigs} == {"Elbow", "Fat Dog"}

    # Check scrobbles backfilled
    scrobbles = db_session.query(ListeningEvent).filter_by(user_id=1, source="setlistfm").all()
    assert len(scrobbles) == 2


def test_setlist_import_worker_pauses_on_quota_limit(db_session: Session):
    """Review Focus 4: If Setlist.fm rate limit quota is reached, import pauses gracefully and saves progress."""
    mock_service = MagicMock()

    # First page succeeds, second page raises SetlistRateLimitError
    def mock_get_user_attended(username, p=1):
        if p == 1:
            return {
                "total": 50,
                "itemsPerPage": 1,
                "page": 1,
                "setlist": [
                    {
                        "id": "show_1",
                        "artist": {"name": "Embrace"},
                        "venue": {
                            "name": "Roundhouse",
                            "city": {"name": "London", "country": {"name": "United Kingdom"}},
                        },
                        "eventDate": "01-05-2025",
                        "sets": {"set": [{"song": [{"name": "All You Good Good People"}]}]},
                    }
                ],
            }
        raise SetlistRateLimitError("Daily Setlist.fm API quota reached (1400/1400).")

    mock_service.get_user_attended.side_effect = mock_get_user_attended
    mock_service.get_setlist.return_value = {
        "id": "show_1",
        "artist": {"name": "Embrace"},
        "venue": {"name": "Roundhouse", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
        "eventDate": "01-05-2025",
        "sets": {"set": [{"song": [{"name": "All You Good Good People"}]}]},
    }

    result = sync_user_setlist_history(
        user_id=1,
        setlist_username="crispylettuce",
        db=db_session,
        setlist_service=mock_service,
    )

    assert result["status"] == "paused_rate_limit"
    assert result["imported_count"] == 1
    assert "Daily Setlist.fm API quota reached" in result["message"]

    # Verify first show was successfully committed and saved in DB
    gig = db_session.query(AttendedConcert).filter_by(user_id=1, setlist_id="show_1").first()
    assert gig is not None
    assert gig.artist_name == "Embrace"
