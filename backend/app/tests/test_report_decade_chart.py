from __future__ import annotations

import os
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import analytics as analytics_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import ListeningEvent, User
from backend.app.queries.analytics_queries import build_report_decade_query

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class DemoUser:
    id = 1


def _event(track, source, played_at, raw_metadata):
    return ListeningEvent(
        user_id=1, track_id=track, track_name="T", artist_name="A", played_at=played_at,
        source=source, play_id=track, raw_metadata=raw_metadata,
    )


def _spotify_meta(release_date):
    return {"track": {"album": {"release_date": release_date}}}


@pytest.fixture(autouse=True)
def override_dependencies():
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()
    db.add(User(id=1, spotify_user_id="demo", username="demo", display_name="Demo", refresh_token_cipher="c", is_active=True))
    db.commit()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: DemoUser()
    yield db
    app.dependency_overrides.clear()
    db.close()


def _decade_counts(db, user_id=1, days_back=3650):
    now = datetime.utcnow()
    rows = db.execute(build_report_decade_query(user_id, now - timedelta(days=days_back), now + timedelta(days=1))).all()
    return {f"{int(r.label)}s": int(r.count) for r in rows}


def test_music_by_decade_buckets_by_release_date_and_ignores_undated_history(override_dependencies):
    # Calls build_report_decade_query directly rather than through /reports/charts:
    # the charts endpoint also builds a weekly-scrobbles chart via date_trunc(), a
    # real Postgres function SQLite doesn't implement at all -- unrelated to (and
    # unaffected by) the decade fix under test here, so it would only get in the way.
    db = override_dependencies
    now = datetime.utcnow()
    db.add(_event("s1", "spotify", now - timedelta(days=1), _spotify_meta("1994-03-14")))
    db.add(_event("s2", "spotify", now - timedelta(days=2), _spotify_meta("1999-11-02")))  # same decade as s1
    db.add(_event("s3", "spotify", now - timedelta(days=3), _spotify_meta("2021-06-01")))
    db.add(_event("s4", "spotify", now - timedelta(days=4), _spotify_meta("1965")))  # year-only precision
    # Imported/other-source history with no release_date at all: excluded, not crashed on.
    db.add(_event("yt1", "youtube", now - timedelta(days=5), {"source": "YouTube Music", "artist": "X", "song": "Y"}))
    db.add(_event("sp5", "spotify", now - timedelta(days=6), None))
    db.commit()

    by_decade = _decade_counts(db)

    assert by_decade == {"1990s": 2, "2020s": 1, "1960s": 1}
    assert sum(by_decade.values()) == 4  # the two undated plays never show up anywhere


def test_music_by_decade_is_empty_not_broken_when_nothing_has_a_release_date(override_dependencies):
    db = override_dependencies
    db.add(_event("yt1", "youtube", datetime.utcnow(), {"source": "YouTube Music"}))
    db.commit()

    assert _decade_counts(db) == {}


# --- Regression: a malformed release_date must not crash the whole chart on real Postgres ---
#
# SQLite's substr()+cast() silently coerces a non-numeric string to 0 (filtered out by
# the `> 0` guard), so the case above can never exercise what Postgres actually does:
# cast('' as integer) raises "invalid input syntax for type integer", taking the whole
# query down. This only runs against a real Postgres (CI provisions one on
# localhost:5432 for this job; skipped elsewhere it isn't available).

PG_URL = os.environ.get("REPORTS_TEST_PG_URL", "postgresql+psycopg://scrobbler:scrobbler@localhost:5432/scrobbler")


def _pg_engine():
    eng = create_engine(PG_URL)
    with eng.connect() as conn:
        conn.execute(text("SELECT 1"))
    return eng


@pytest.fixture
def pg_session():
    try:
        eng = _pg_engine()
    except Exception:
        pytest.skip(f"no reachable Postgres at {PG_URL} (set REPORTS_TEST_PG_URL to override)")
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng)
    db = Session()
    db.execute(text("TRUNCATE listening_events, users RESTART IDENTITY CASCADE"))
    db.add(User(id=1, spotify_user_id="demo", username="demo", display_name="Demo", refresh_token_cipher="c", is_active=True))
    db.commit()
    yield db
    db.rollback()
    db.execute(text("TRUNCATE listening_events, users RESTART IDENTITY CASCADE"))
    db.commit()
    db.close()
    eng.dispose()


def test_decade_query_survives_an_empty_release_date_on_real_postgres(pg_session):
    from backend.app.queries.analytics_queries import build_report_decade_query
    db = pg_session
    now = datetime.utcnow()
    db.add(_event("good", "spotify", now - timedelta(days=1), _spotify_meta("1994-03-14")))
    db.add(_event("empty", "spotify", now - timedelta(days=2), _spotify_meta("")))  # the crashing case
    db.commit()

    rows = db.execute(build_report_decade_query(1, now - timedelta(days=365), now + timedelta(days=1))).all()

    assert {(int(r.label), int(r.count)) for r in rows} == {(1990, 1)}


def test_decade_query_survives_junk_that_isnt_a_date_at_all_on_real_postgres(pg_session):
    from backend.app.queries.analytics_queries import build_report_decade_query
    db = pg_session
    now = datetime.utcnow()
    db.add(_event("good", "spotify", now - timedelta(days=1), _spotify_meta("1994-03-14")))
    db.add(_event("junk", "spotify", now - timedelta(days=2), _spotify_meta("not-a-date")))
    db.commit()

    rows = db.execute(build_report_decade_query(1, now - timedelta(days=365), now + timedelta(days=1))).all()

    assert {(int(r.label), int(r.count)) for r in rows} == {(1990, 1)}
