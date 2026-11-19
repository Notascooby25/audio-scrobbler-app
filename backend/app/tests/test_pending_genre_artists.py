"""Which artists still need genres looked up (build_pending_genre_artist_ids_query).

Runs on real Postgres, because the query reads artist IDs out of JSON with Postgres
operators and orders with NULLS FIRST. It skips when no Postgres is reachable, and it
creates (and always drops) its own uniquely named database, never the shared one."""

from __future__ import annotations

import os
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.models import GenreCache, ListeningEvent, User
from backend.app.queries.analytics_queries import GENRE_EMPTY_RECHECK_DAYS, build_pending_genre_artist_ids_query

ADMIN_PG_URL = os.environ.get(
    "REPORTS_TEST_ADMIN_PG_URL", "postgresql+psycopg://scrobbler:scrobbler@localhost:5432/scrobbler"
)


@pytest.fixture
def pg_session():
    try:
        admin_engine = create_engine(ADMIN_PG_URL, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        pytest.skip(f"no reachable Postgres at {ADMIN_PG_URL} (set REPORTS_TEST_ADMIN_PG_URL to override)")

    db_name = f"pending_genres_test_{uuid.uuid4().hex[:12]}"
    with admin_engine.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))

    test_engine = create_engine(ADMIN_PG_URL.rsplit("/", 1)[0] + f"/{db_name}")
    try:
        Base.metadata.create_all(test_engine)
        db = sessionmaker(bind=test_engine)()
        db.add(User(id=1, spotify_user_id="demo", username="demo", display_name="Demo", refresh_token_cipher="c", is_active=True))
        db.commit()
        yield db
        db.close()
    finally:
        test_engine.dispose()
        with admin_engine.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)'))
        admin_engine.dispose()


def _play(db, artist_id: str, name: str, source: str = "spotify", shape: str = "track") -> None:
    metadata = {shape: {"artists": [{"id": artist_id, "name": name}]}}
    db.add(
        ListeningEvent(
            user_id=1,
            track_id=f"t-{artist_id}-{uuid.uuid4().hex[:6]}",
            track_name="Song",
            artist_name=name,
            played_at=utc_now(),
            source=source,
            play_id=uuid.uuid4().hex,
            raw_metadata=metadata,
        )
    )


def _cache(db, artist_id: str, genres: list[str], age_days: float) -> None:
    db.add(GenreCache(artist_spotify_id=artist_id, genres=genres, cached_at=utc_now() - timedelta(days=age_days)))


def _pending(db, limit: int = 50) -> list[str]:
    rows = db.execute(build_pending_genre_artist_ids_query(limit)).all()
    return [row.artist_id for row in rows]


def test_never_checked_artists_are_pending_and_artists_with_genres_are_not(pg_session):
    db = pg_session
    _play(db, "new", "New Artist")
    _play(db, "known", "Known Artist")
    _cache(db, "known", ["rock"], age_days=400)
    db.commit()

    assert _pending(db) == ["new"]


def test_an_artist_saved_with_no_genres_waits_for_the_recheck_period(pg_session):
    db = pg_session
    _play(db, "recent_empty", "Recently Empty")
    _play(db, "old_empty", "Long Empty")
    _cache(db, "recent_empty", [], age_days=GENRE_EMPTY_RECHECK_DAYS - 1)
    _cache(db, "old_empty", [], age_days=GENRE_EMPTY_RECHECK_DAYS + 1)
    db.commit()

    assert _pending(db) == ["old_empty"]


def test_never_checked_artists_come_first_then_the_longest_waiting(pg_session):
    db = pg_session
    for artist_id, age_days in (("empty_60", 60), ("empty_90", 90), ("empty_45", 45)):
        _play(db, artist_id, artist_id)
        _cache(db, artist_id, [], age_days=age_days)
    _play(db, "brand_new", "Brand New")
    db.commit()

    assert _pending(db) == ["brand_new", "empty_90", "empty_60", "empty_45"]


def test_a_small_limit_cannot_be_filled_by_the_same_empty_artists_every_run(pg_session):
    db = pg_session
    # Before the cooldown, artists saved with no genres were re-selected on every run and,
    # with no ordering, could take every slot so that newer artists were never looked up.
    for number in range(5):
        _play(db, f"empty_{number}", f"Empty {number}")
        _cache(db, f"empty_{number}", [], age_days=1)
    _play(db, "fresh", "Fresh")
    db.commit()

    assert _pending(db, limit=2) == ["fresh"]


def test_only_spotify_plays_count_and_both_metadata_shapes_are_read(pg_session):
    db = pg_session
    _play(db, "from_history", "History", source="spotify", shape="track")
    _play(db, "from_realtime", "Realtime", source="spotify_realtime", shape="item")
    _play(db, "from_youtube", "YouTube", source="youtube", shape="track")
    db.commit()

    assert sorted(_pending(db)) == ["from_history", "from_realtime"]


def test_an_artist_played_many_times_is_listed_once(pg_session):
    db = pg_session
    for _ in range(3):
        _play(db, "repeat", "Repeat")
    db.commit()

    assert _pending(db) == ["repeat"]
