from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import ArtworkCache, ListeningEvent, User
from backend.app.services import blocks_service
from backend.app.services import setlist_artwork_service as artwork
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


# --- Background lookup -------------------------------------------------------------

DEEZER_ART = "https://deezer.example/cover.jpg"
ITUNES_ART = "https://itunes.example/600x600bb.jpg"
PHOTO = "https://deezer.example/artist.jpg"


def _add_user(db: Session, user_id: int, active: bool = True) -> None:
    db.add(
        User(
            id=user_id,
            spotify_user_id=f"sp{user_id}",
            username=f"user{user_id}",
            display_name=f"User {user_id}",
            refresh_token_cipher="c",
            is_active=active,
        )
    )
    db.commit()


def _log(db: Session, user_id: int, songs: list[str], setlist_id: str = "gig1") -> None:
    data = {**_gig(songs), "id": setlist_id}
    _service(db, data).log_concert_attendance(user_id=user_id, setlist_id=setlist_id)


@pytest.fixture
def lookups():
    """Fake outside lookups: Everlong is on Deezer, Times Like These only on iTunes."""
    with (
        patch.object(artwork, "deezer_search", side_effect=lambda a, t, timeout: {"t": t} if t == "Everlong" else None),
        patch.object(artwork, "deezer_artwork", return_value=DEEZER_ART),
        patch.object(
            artwork, "itunes_artwork", side_effect=lambda a, t: ITUNES_ART if t == "Times Like These" else None
        ),
        patch.object(artwork, "deezer_artist_picture", return_value=PHOTO) as photo,
    ):
        yield photo


def _backfill(db: Session, **kwargs) -> dict[str, int]:
    return artwork.backfill_live_artwork(db, pause_seconds=0, **kwargs)


def test_backfill_tries_deezer_then_itunes_then_the_artist_photo(db_session: Session, lookups):
    _add_user(db_session, 1)
    _log(db_session, 1, ["Everlong", "Times Like These", "Intro"])

    counts = _backfill(db_session)

    assert {k: v[0] for k, v in _gig_art(db_session).items()} == {
        "Everlong": DEEZER_ART,
        "Times Like These": ITUNES_ART,
        "Intro": PHOTO,
    }
    assert counts["updated"] == 3
    # Nothing left to do on the next run
    assert _backfill(db_session)["checked"] == 0


def test_backfill_uses_your_own_plays_before_looking_anything_up(db_session: Session, lookups):
    _add_user(db_session, 1)
    _log(db_session, 1, ["Everlong"])  # logged before the Spotify play existed
    _spotify_play(db_session, 1, "Everlong", artwork_url=ART)

    counts = _backfill(db_session)

    assert _gig_art(db_session)["Everlong"][0] == ART
    assert counts["lookups"] == 0


def test_cached_answers_are_shared_without_new_lookups(db_session: Session, lookups):
    _add_user(db_session, 1)
    _add_user(db_session, 2)
    _log(db_session, 1, ["Everlong"])
    _backfill(db_session)
    _log(db_session, 2, ["Everlong"])

    with patch.object(artwork, "_lookup_track_artwork") as track_lookup:
        counts = _backfill(db_session)

    track_lookup.assert_not_called()
    assert counts["lookups"] == 0
    assert _gig_art(db_session, user_id=2)["Everlong"][0] == DEEZER_ART


def test_misses_are_retried_only_after_a_while(db_session: Session, lookups):
    _add_user(db_session, 1)
    _log(db_session, 1, ["Unknown Song"])
    lookups.return_value = None

    first = _backfill(db_session)
    assert (first["missed"], first["lookups"]) == (1, 2)  # track, then artist photo
    assert _backfill(db_session)["lookups"] == 0

    for entry in db_session.query(ArtworkCache):
        entry.cached_at = datetime.utcnow() - artwork.MISS_RETRY_AFTER - timedelta(minutes=1)
    db_session.commit()
    assert _backfill(db_session)["lookups"] == 2


def test_backfill_respects_the_per_run_budget(db_session: Session, lookups):
    _add_user(db_session, 1)
    _log(db_session, 1, ["Everlong", "Times Like These", "Intro"])

    first = _backfill(db_session, max_lookups=1)

    assert first["lookups"] == 1
    # Songs are sampled in random order; one lookup fills at most one of them
    assert sum(1 for art, _ in _gig_art(db_session).values() if art) <= 1
    _backfill(db_session)
    assert all(art for art, _ in _gig_art(db_session).values())


def test_backfill_skips_inactive_users_and_cleared_artwork(db_session: Session, lookups):
    _add_user(db_session, 1, active=False)
    _add_user(db_session, 2)
    _log(db_session, 1, ["Everlong"])
    _log(db_session, 2, ["Everlong"])
    db_session.query(ListeningEvent).filter_by(user_id=2).update({"artwork_url": ""})
    db_session.commit()

    assert _backfill(db_session)["checked"] == 0
    assert _gig_art(db_session, 1)["Everlong"][0] is None
    assert _gig_art(db_session, 2)["Everlong"][0] == ""


def test_deezer_artist_picture_checks_the_name_and_skips_placeholders():
    def deezer(payload):
        resp = MagicMock()
        resp.__enter__.return_value.read.return_value = json.dumps(payload).encode()
        return resp

    hit = {
        "data": [
            {"name": "Foo Fighterz", "picture_big": "https://x/a.jpg"},
            {"name": "Foo Fighters", "picture_big": PHOTO},
        ]
    }
    with patch.object(artwork.urllib.request, "urlopen", return_value=deezer(hit)):
        assert artwork.deezer_artist_picture("Foo Fighters") == PHOTO

    placeholder = {"data": [{"name": "Foo Fighters", "picture_big": "https://cdn/images/artist//500x500.jpg"}]}
    with patch.object(artwork.urllib.request, "urlopen", return_value=deezer(placeholder)):
        assert artwork.deezer_artist_picture("Foo Fighters") is None
