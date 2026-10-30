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
from backend.app.models import AttendedConcert
from backend.app.services.setlist_file_import_service import import_gigs_from_file
from backend.app.services.setlist_stats_service import SetlistStatsService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _setlist_service() -> MagicMock:
    service = MagicMock()
    service.get_setlist.return_value = {}
    return service


def _festival_gig(db: Session) -> AttendedConcert:
    concert = AttendedConcert(
        user_id=1,
        setlist_id="doves-1",
        artist_name="Doves",
        venue_name="Castle Stage",
        city="Portsmouth",
        country="United Kingdom",
        event_date=datetime(2026, 8, 29),
        is_festival=True,
        festival_name=None,
    )
    db.add(concert)
    db.commit()
    return concert


def test_csv_export_includes_the_festival_tick_and_name(db_session: Session):
    concert = _festival_gig(db_session)
    concert.festival_name = "Victorious Festival 2026"
    db_session.commit()

    content, _ = SetlistStatsService(db=db_session).export_attended_gigs(1, format="csv")
    row = next(csv.DictReader(io.StringIO(content)))

    assert row["is_festival"] == "True"
    assert row["festival_name"] == "Victorious Festival 2026"


def test_json_export_includes_the_festival_tick_and_name(db_session: Session):
    concert = _festival_gig(db_session)
    concert.festival_name = "Victorious Festival 2026"
    db_session.commit()

    content, _ = SetlistStatsService(db=db_session).export_attended_gigs(1, format="json")
    row = json.loads(content)[0]

    assert row["is_festival"] is True
    assert row["festival_name"] == "Victorious Festival 2026"


def _csv_for(rows: list[dict[str, str]]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "setlist_id",
            "artist_name",
            "venue_name",
            "city",
            "country",
            "event_date",
            "is_festival",
            "festival_name",
        ],
    )
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def _edited_row(**changes: str) -> dict[str, str]:
    row = {
        "setlist_id": "doves-1",
        "artist_name": "Doves",
        "venue_name": "Castle Stage",
        "city": "Portsmouth",
        "country": "United Kingdom",
        "event_date": "2026-08-29",
        "is_festival": "True",
        "festival_name": "",
    }
    row.update(changes)
    return row


def test_reimport_without_update_leaves_existing_gigs_alone(db_session: Session):
    concert = _festival_gig(db_session)

    result = import_gigs_from_file(
        1, "csv", _csv_for([_edited_row(festival_name="Victorious Festival 2026")]), db_session, _setlist_service()
    )

    assert result["skipped_existing"] == 1
    assert result["updated"] == 0
    assert concert.festival_name is None


def test_reimport_with_update_applies_the_edited_festival_name(db_session: Session):
    concert = _festival_gig(db_session)

    result = import_gigs_from_file(
        1,
        "csv",
        _csv_for([_edited_row(festival_name="  Victorious   Festival 2026 ")]),
        db_session,
        _setlist_service(),
        update_existing=True,
    )

    assert result["updated"] == 1
    assert concert.festival_name == "Victorious Festival 2026"


def test_update_clears_the_festival_when_the_file_unticks_it(db_session: Session):
    concert = _festival_gig(db_session)
    concert.festival_name = "Victorious Festival 2026"
    db_session.commit()

    import_gigs_from_file(
        1,
        "csv",
        _csv_for([_edited_row(is_festival="False")]),
        db_session,
        _setlist_service(),
        update_existing=True,
    )

    assert concert.is_festival is False
    assert concert.festival_name is None


def test_update_ignores_rows_without_festival_details(db_session: Session):
    concert = _festival_gig(db_session)
    concert.festival_name = "Victorious Festival 2026"
    db_session.commit()

    result = import_gigs_from_file(
        1,
        "csv",
        _csv_for([_edited_row(is_festival="", festival_name="")]),
        db_session,
        _setlist_service(),
        update_existing=True,
    )

    assert result["updated"] == 0
    assert result["skipped_existing"] == 1
    assert concert.festival_name == "Victorious Festival 2026"


def test_a_new_gig_in_the_file_keeps_its_festival_details(db_session: Session):
    result = import_gigs_from_file(
        1,
        "csv",
        _csv_for([_edited_row(setlist_id="doves-2", festival_name="Victorious Festival 2026")]),
        db_session,
        _setlist_service(),
    )

    assert result["imported"] == 1
    gig = db_session.query(AttendedConcert).filter_by(setlist_id="doves-2").one()
    assert gig.is_festival is True
    assert gig.festival_name == "Victorious Festival 2026"
