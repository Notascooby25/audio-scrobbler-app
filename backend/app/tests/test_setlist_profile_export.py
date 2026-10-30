from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert
from backend.app.services.setlist_file_import_service import MAX_FILE_CHARS, import_gigs_from_file
from backend.app.services.setlist_profile_export_service import (
    MAX_EXPORT_PAGES,
    ProfileExportTooLargeError,
    build_profile_export,
)
from backend.app.services.setlist_service import SetlistService

PAGE_SIZE = 20


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _show(index: int, songs: int = 3) -> dict[str, Any]:
    return {
        "id": f"show{index:05d}",
        "eventDate": "02-05-2026",
        "artist": {"name": f"Band {index}"},
        "venue": {"name": "Venue", "city": {"name": "Leeds", "country": {"name": "United Kingdom"}}},
        "tour": {"name": "Spring Tour"},
        "url": f"https://www.setlist.fm/setlist/band-{index}.html",
        "sets": {"set": [{"song": [{"name": f"Song {n}"} for n in range(songs)]}]} if songs else {"set": []},
    }


def _profile(total: int, songs: int = 3) -> MagicMock:
    """A fake Setlist.fm service whose profile has `total` shows, served 20 a page."""
    shows = [_show(i, songs) for i in range(total)]

    def attended(username: str, p: int = 1) -> dict[str, Any]:
        page = shows[(p - 1) * PAGE_SIZE : p * PAGE_SIZE]
        return {"total": total, "itemsPerPage": PAGE_SIZE, "page": p, "setlist": page}

    service = MagicMock()
    service.get_user_attended.side_effect = attended
    return service


def test_profile_pages_are_fetched_once_a_day(db_session: Session):
    service = SetlistService(db=db_session)
    page = {"total": 1, "itemsPerPage": PAGE_SIZE, "setlist": [_show(1)]}
    with patch.object(service, "_request", return_value=page) as request:
        service.get_user_attended("crispylettuce", p=1)
        service.get_user_attended("crispylettuce", p=1)

    assert request.call_count == 1


def test_empty_profile_pages_are_not_cached(db_session: Session):
    service = SetlistService(db=db_session)
    empty = {"total": 0, "itemsPerPage": PAGE_SIZE, "setlist": []}
    with patch.object(service, "_request", return_value=empty) as request:
        service.get_user_attended("crispylettuce", p=1)
        first = request.call_count
        service.get_user_attended("crispylettuce", p=1)

    # Two username casings are tried each time (the exact and Capitalized spellings), so nothing was served from cache
    assert first == 2
    assert request.call_count == 4


def test_export_then_import_makes_no_setlistfm_calls(db_session: Session):
    content, exported, skipped = build_profile_export(_profile(total=25), "crispylettuce")
    assert (exported, skipped) == (25, 0)

    setlist_service = MagicMock()
    result = import_gigs_from_file(1, "json", content, db_session, setlist_service)

    assert result["imported"] == 25
    assert result["invalid_count"] == 0
    setlist_service.get_setlist.assert_not_called()
    concert = db_session.query(AttendedConcert).filter_by(setlist_id="show00007").one()
    assert concert.song_count == 3
    assert concert.setlist_url == "https://www.setlist.fm/setlist/band-7.html"
    assert concert.event_date.strftime("%Y-%m-%d") == "2026-05-02"


def test_gigs_without_songs_are_exported_and_imported_without_calls(db_session: Session):
    service = _profile(total=1, songs=0)
    content, exported, _ = build_profile_export(service, "crispylettuce")
    assert exported == 1

    setlist_service = MagicMock()
    result = import_gigs_from_file(1, "json", content, db_session, setlist_service)

    assert result["imported"] == 1
    assert result["awaiting_songs_ids"] == []
    setlist_service.get_setlist.assert_not_called()
    assert db_session.query(AttendedConcert).one().song_count == 0


def test_shows_missing_a_name_venue_or_date_are_skipped(db_session: Session):
    service = _profile(total=2)
    broken = _show(99)
    broken["venue"] = {"name": ""}
    shows = [_show(0), broken]
    service.get_user_attended.side_effect = None
    service.get_user_attended.return_value = {"total": 2, "itemsPerPage": PAGE_SIZE, "setlist": shows}

    content, exported, skipped = build_profile_export(service, "crispylettuce")

    assert (exported, skipped) == (1, 1)
    assert [row["setlist_id"] for row in json.loads(content)] == ["show00000"]


def test_a_long_history_fits_in_one_file():
    # 300 gigs with 25 songs each, the size of a busy gig-goer's profile
    content, exported, _ = build_profile_export(_profile(total=300, songs=25), "crispylettuce")

    assert exported == 300
    assert len(content) < MAX_FILE_CHARS


def test_a_profile_too_big_for_one_file_is_refused():
    service = _profile(total=MAX_EXPORT_PAGES * PAGE_SIZE, songs=60)

    with pytest.raises(ProfileExportTooLargeError):
        build_profile_export(service, "crispylettuce")
