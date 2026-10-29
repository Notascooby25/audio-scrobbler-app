from __future__ import annotations

import os
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import ListeningEvent
from backend.app.services import blocks_service
from backend.app.services.setlist_attendance_service import SetlistAttendanceService

ART = "https://img.example/everlong.jpg"
ARTIST_ART = "https://img.example/foo.jpg"


# Title/artist matching uses lower() and LIKE, so the suite also runs on a real Postgres
# (CI provides one on localhost:5432) in its own throwaway database; skipped elsewhere.
ADMIN_PG_URL = os.environ.get(
    "REPORTS_TEST_ADMIN_PG_URL", "postgresql+psycopg://scrobbler:scrobbler@localhost:5432/scrobbler"
)
PG_TEST_DB = "setlist_artwork_test"


def _postgres_admin():
    try:
        admin = create_engine(ADMIN_PG_URL, isolation_level="AUTOCOMMIT")
        with admin.connect() as conn:
            conn.execute(text("SELECT 1"))
        return admin
    except Exception:
        pytest.skip(f"no reachable Postgres at {ADMIN_PG_URL}")


@pytest.fixture(params=["sqlite", "postgres"])
def db_session(request):
    if request.param == "sqlite":
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        with Session(engine) as session:
            yield session
        return

    admin = _postgres_admin()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{PG_TEST_DB}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{PG_TEST_DB}"'))
    engine = create_engine(ADMIN_PG_URL.rsplit("/", 1)[0] + f"/{PG_TEST_DB}")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session
    engine.dispose()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{PG_TEST_DB}" WITH (FORCE)'))
    admin.dispose()


def _gig(songs: list[str], date: str = "27-06-2026") -> dict:
    return {
        "id": "gig1",
        "artist": {"name": "Foo Fighters"},
        "venue": {"name": "Anfield", "city": {"name": "Liverpool", "country": {"name": "UK"}}},
        "eventDate": date,
        "sets": {"set": [{"song": [{"name": s} for s in songs]}]},
    }


def _service(db: Session, data: dict) -> SetlistAttendanceService:
    setlists = MagicMock()
    setlists.get_setlist.side_effect = lambda sid, force_refresh=False: data
    return SetlistAttendanceService(db=db, setlist_service=setlists)


def _spotify_play(db: Session, user_id: int, track: str, artist: str = "Foo Fighters", **art) -> None:
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=f"spotify:track:{track}",
            track_name=track,
            artist_name=artist,
            played_at=datetime(2025, 1, 1, len(track) % 24),
            source="spotify",
            play_id=f"sp-{user_id}-{track}",
            **art,
        )
    )
    db.commit()


def _gig_art(db: Session, user_id: int = 1) -> dict[str, tuple[str | None, str | None]]:
    rows = db.query(ListeningEvent).filter_by(user_id=user_id, source="setlistfm").all()
    return {e.track_name: (e.artwork_url, e.artist_artwork_url) for e in rows}


def test_gig_scrobbles_reuse_artwork_from_your_own_plays(db_session: Session):
    _spotify_play(db_session, 1, "EVERLONG", artist="foo fighters", artwork_url=ART, artist_artwork_url=ARTIST_ART)

    _service(db_session, _gig(["Everlong", "Intro"])).log_concert_attendance(user_id=1, setlist_id="gig1")

    art = _gig_art(db_session)
    # Title and artist match regardless of case
    assert art["Everlong"] == (ART, ARTIST_ART)
    # No track match: left for the background lookup, but the artist image is used
    assert art["Intro"] == (None, ARTIST_ART)


def test_another_users_plays_are_never_used(db_session: Session):
    _spotify_play(db_session, 2, "Everlong", artwork_url=ART, artist_artwork_url=ARTIST_ART)

    _service(db_session, _gig(["Everlong"])).log_concert_attendance(user_id=1, setlist_id="gig1")

    assert _gig_art(db_session) == {"Everlong": (None, None)}


def test_refresh_keeps_artwork_including_cleared(db_session: Session):
    service = _service(db_session, _gig(["Everlong", "Monkey Wrench", "New Song"]))
    gig = service.log_concert_attendance(user_id=1, setlist_id="gig1")
    events = {e.track_name: e for e in db_session.query(ListeningEvent).filter_by(source="setlistfm")}
    events["Everlong"].artwork_url = ART
    events["Monkey Wrench"].artwork_url = ""  # cleared by the user
    db_session.commit()

    service.refresh_concert_setlist(user_id=1, concert_id=gig.id)

    art = _gig_art(db_session)
    assert art["Everlong"][0] == ART
    assert art["Monkey Wrench"][0] == ""
    assert art["New Song"][0] is None


def test_clear_artwork_marks_gig_scrobbles_so_they_are_not_refilled(db_session: Session):
    _spotify_play(db_session, 1, "Everlong", artwork_url=ART)
    _service(db_session, _gig(["Everlong"])).log_concert_attendance(user_id=1, setlist_id="gig1")

    blocks_service.clear_artwork(db_session, 1, "track", "Everlong", "Foo Fighters")

    by_source = {e.source: e.artwork_url for e in db_session.query(ListeningEvent).filter_by(user_id=1)}
    assert by_source == {"spotify": None, "setlistfm": ""}
