from __future__ import annotations

import os
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.app.db import Base
from backend.app.models import ListeningEvent, User
from backend.app.services.analytics_service import get_report_summary

ADMIN_PG_URL = os.environ.get("REPORTS_TEST_ADMIN_PG_URL", "postgresql+psycopg://scrobbler:scrobbler@localhost:5432/scrobbler")
TEST_DB_NAME = "reports_summary_ratios_test"

@pytest.fixture
def pg_session():
    try:
        admin_engine = create_engine(ADMIN_PG_URL, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        pytest.skip(f"no reachable Postgres at {ADMIN_PG_URL} (set REPORTS_TEST_ADMIN_PG_URL to override)")

    with admin_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))

    test_url = ADMIN_PG_URL.rsplit("/", 1)[0] + f"/{TEST_DB_NAME}"
    eng = create_engine(test_url)
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng)
    db = Session()
    db.add(User(id=1, spotify_user_id="demo", username="demo", display_name="Demo", refresh_token_cipher="c", is_active=True))
    db.commit()

    yield db

    db.close()
    eng.dispose()
    with admin_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))
    admin_engine.dispose()


def test_report_summary_exposes_unique_counts(pg_session):
    db = pg_session
    now = datetime.utcnow()
    
    # 4 scrobbles
    # 2 unique artists (A1, A2)
    # 2 unique albums (Al1, Al2)
    # 3 unique tracks (T1, T2, T3)
    db.add(ListeningEvent(user_id=1, track_id="1", track_name="T1", artist_name="A1", album_name="Al1", played_at=now - timedelta(days=1), source="spotify", play_id="p1"))
    db.add(ListeningEvent(user_id=1, track_id="2", track_name="T2", artist_name="A1", album_name="Al1", played_at=now - timedelta(days=1), source="spotify", play_id="p2"))
    db.add(ListeningEvent(user_id=1, track_id="3", track_name="T3", artist_name="A2", album_name="Al2", played_at=now - timedelta(days=2), source="spotify", play_id="p3"))
    db.add(ListeningEvent(user_id=1, track_id="1", track_name="T1", artist_name="A1", album_name="Al1", played_at=now - timedelta(days=3), source="spotify", play_id="p4"))
    db.commit()

    summary = get_report_summary(db, user_id=1, range_key="last.month")

    assert summary.period_scrobbles == 4
    assert summary.unique_artists == 2
    assert summary.unique_albums == 2
    assert summary.unique_tracks == 3
