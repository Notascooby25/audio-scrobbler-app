"""Tests added after the whole-branch review of Year Wrapped."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, BlockedItem, GenreCache, ListeningEvent, Notification, User, YearReview
from backend.app.services import wrapped_service
from backend.app.services.wrapped_gig_stats import build_gig_stats
from backend.app.services.wrapped_music_stats import build_music_stats
from backend.app.services.wrapped_service import is_eligible, run_due

START = datetime(2025, 12, 31, 0, 0)
END = datetime(2026, 12, 31, 0, 0)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


def _user(db, user_id):
    db.add(
        User(
            id=user_id,
            spotify_user_id=f"s{user_id}",
            username=f"u{user_id}",
            display_name=f"U{user_id}",
            refresh_token_cipher="x",
            is_active=True,
        )
    )
    db.commit()


def _plays(db, user_id=1, count=40, artist="Artist", start=datetime(2026, 3, 1, 12, 0), artist_id=None):
    for i in range(count):
        db.add(
            ListeningEvent(
                user_id=user_id,
                track_id=f"t{i}",
                track_name=f"Song {i % 5}",
                artist_name=artist,
                album_name="Album",
                played_at=start + timedelta(minutes=5 * i),
                duration_ms=180_000,
                source="spotify",
                play_id=uuid.uuid4().hex,
                raw_metadata={"track": {"artists": [{"id": artist_id, "name": artist}]}} if artist_id else None,
            )
        )
    db.commit()


def test_one_failing_user_does_not_stop_the_others(db_session):
    for user_id in (1, 2):
        _user(db_session, user_id)
        _plays(db_session, user_id=user_id)
    real = wrapped_service.build_music_stats

    def flaky(db, user_id, start, end):
        if user_id == 1:
            raise RuntimeError("boom")
        return real(db, user_id, start, end)

    with patch.object(wrapped_service, "build_music_stats", flaky), patch.object(wrapped_service, "queue_push"):
        counts = run_due(db_session, datetime(2026, 12, 31, 18, 0))
    assert counts == {"generated": 2, "failed": 2}  # user 2: preview and unlock; user 1: both failed
    assert {(r.user_id, r.stage) for r in db_session.query(YearReview)} == {(2, "preview"), (2, "unlock")}
    assert [n.user_id for n in db_session.query(Notification)] == [2]


def test_eligibility_ignores_blocked_plays(db_session):
    _user(db_session, 1)
    _plays(db_session, count=35, artist="Hidden")
    db_session.add(BlockedItem(user_id=1, entity_type="artist", name="hidden"))
    db_session.commit()
    assert is_eligible(db_session, 1, 2026, datetime(2026, 11, 28)) is False


def test_genres_exclude_blocked_artists(db_session):
    _plays(db_session, count=35, artist="Keep", artist_id="a1")
    _plays(db_session, count=20, artist="Hidden", artist_id="a2", start=datetime(2026, 5, 1, 9, 0))
    db_session.add_all(
        [GenreCache(artist_spotify_id="a1", genres=["indie"]), GenreCache(artist_spotify_id="a2", genres=["metal"])]
    )
    db_session.add(BlockedItem(user_id=1, entity_type="artist", name="Hidden"))
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert [g["name"] for g in stats["top_genres"]] == ["indie"]


def test_new_artists_not_claimed_when_history_starts_inside_the_year(db_session):
    _plays(db_session, start=datetime(2026, 5, 1, 9, 0))
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["new_artists"] is None


def test_most_seen_needs_at_least_two_nights(db_session):
    for day, artist in ((1, "ABBA"), (2, "Blur")):
        db_session.add(
            AttendedConcert(
                user_id=1,
                setlist_id=f"g{day}",
                artist_name=artist,
                venue_name=f"Venue {day}",
                city="Leeds",
                country="UK",
                event_date=datetime(2026, 3, day),
            )
        )
    db_session.commit()
    assert build_gig_stats(db_session, 1, 2026, today=datetime(2026, 12, 31).date())["most_seen"] is None


def test_catch_up_covers_january_and_february(db_session):
    assert wrapped_service._years_to_check(datetime(2027, 2, 20, 12, 0)) == [2026, 2027]
    assert wrapped_service._years_to_check(datetime(2027, 3, 2, 12, 0)) == [2027]
