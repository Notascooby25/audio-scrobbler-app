from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, ListeningEvent, User, User1001AlbumCompletion
from backend.app.services.analytics_service import get_report_summary


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_report_summary_enhanced_fields(db_session: Session):
    user = User(
        spotify_user_id="user_reports_test",
        username="reports_tester",
        display_name="Reports Tester",
        refresh_token_cipher="cipher",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # 1. Add listening events
    event1 = ListeningEvent(
        user_id=user.id,
        track_id="t1",
        track_name="Common People",
        artist_name="Pulp",
        album_name="Different Class",
        played_at=datetime(2026, 10, 15, 23, 30, tzinfo=timezone.utc).replace(tzinfo=None),
        duration_ms=240000,
        source="spotify",
        play_id="p1",
    )
    event2 = ListeningEvent(
        user_id=user.id,
        track_id="t1",
        track_name="Common People",
        artist_name="Pulp",
        album_name="Different Class",
        played_at=datetime(2026, 10, 15, 23, 40, tzinfo=timezone.utc).replace(tzinfo=None),
        duration_ms=240000,
        source="spotify",
        play_id="p2",
    )
    event3 = ListeningEvent(
        user_id=user.id,
        track_id="t2",
        track_name="Lovesong",
        artist_name="The Cure",
        album_name="Disintegration",
        played_at=datetime(2026, 10, 16, 22, 10, tzinfo=timezone.utc).replace(tzinfo=None),
        duration_ms=210000,
        source="spotify",
        play_id="p3",
    )
    event4 = ListeningEvent(
        user_id=user.id,
        track_id="t3",
        track_name="Parklife",
        artist_name="Blur",
        album_name="Parklife",
        played_at=datetime(2026, 10, 17, 14, 0, tzinfo=timezone.utc).replace(tzinfo=None),
        duration_ms=180000,
        source="spotify",
        play_id="p4",
    )
    db_session.add_all([event1, event2, event3, event4])

    # 2. Add 1001 album completion
    comp = User1001AlbumCompletion(
        user_id=user.id,
        album_id=1,
        is_completed=True,
        source="manual",
        completed_at=datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc).replace(tzinfo=None),
    )
    db_session.add(comp)

    # 3. Add attended concert for Pulp (past) and Shed Seven (future upcoming)
    concert = AttendedConcert(
        user_id=user.id,
        setlist_id="c1",
        artist_name="Pulp",
        venue_name="Finsbury Park",
        city="London",
        country="United Kingdom",
        event_date=datetime(2023, 7, 1, 20, 0, tzinfo=timezone.utc).replace(tzinfo=None),
        song_count=18,
    )
    future_concert = AttendedConcert(
        user_id=user.id,
        setlist_id="c2_future",
        artist_name="Blur",
        venue_name="Wembley Stadium",
        city="London",
        country="United Kingdom",
        event_date=datetime(2028, 7, 1, 20, 0, tzinfo=timezone.utc).replace(tzinfo=None),
        song_count=20,
    )
    db_session.add_all([concert, future_concert])
    db_session.commit()

    # Call get_report_summary for custom range encompassing Oct 2026
    summary = get_report_summary(
        db=db_session,
        user_id=user.id,
        range_key="custom",
        start_date="2026-10-01",
        end_date="2026-10-31",
        compare_to_previous=False,
    )

    # Assert new fields exist on response
    assert hasattr(summary, "current_streak_days")
    assert hasattr(summary, "period_best_streak_days")
    assert summary.period_best_streak_days >= 2
    assert summary.peak_day is not None
    assert summary.peak_day.date == "2026-10-15"
    assert summary.peak_day.count == 2
    assert summary.heavy_rotation is not None
    assert summary.heavy_rotation.track_name == "Common People"
    assert summary.heavy_rotation.artist_name == "Pulp"
    assert summary.heavy_rotation.count == 2
    assert summary.persona == "Night Owl"
    assert summary.discovery_velocity is not None
    assert summary.discovery_velocity.total_artists == 3
    assert summary.challenge_1001 is not None
    assert summary.challenge_1001.completed_in_period == 1
    assert summary.challenge_1001.total_completed >= 1
    assert summary.live_artists is not None
    assert summary.live_artists.attended_artists_played == 1
    assert summary.live_artists.total_scrobbles == 2
    assert len(summary.live_artists.top_artists) == 1
    assert summary.live_artists.top_artists[0].artist_name == "Pulp"
    assert "Blur" not in [a.artist_name for a in summary.live_artists.top_artists]
