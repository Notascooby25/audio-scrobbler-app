from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import (
    AttendedConcert,
    ListeningEvent,
    User,
    User1001AlbumCompletion,
    UserRoughTradeAlbumCompletion,
)
from backend.app.services.analytics_service import get_report_summary
from backend.app.services.catalog_1001_service import get_1001_album_by_id
from backend.app.services.catalog_rough_trade_service import get_rough_trade_album_by_id


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


def test_report_1001_milestone_shows_album_titles_not_ids(db_session: Session):
    """Issue #102: the 1001 chips showed "Album #581" instead of the title."""
    user = User(
        spotify_user_id="user_1001_titles",
        username="titles_tester",
        display_name="Titles Tester",
        refresh_token_cipher="cipher",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    completed_at = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc).replace(tzinfo=None)
    for album_id in (581, 223):
        db_session.add(
            User1001AlbumCompletion(
                user_id=user.id,
                album_id=album_id,
                is_completed=True,
                source="manual",
                completed_at=completed_at,
            )
        )
    db_session.commit()

    summary = get_report_summary(
        db=db_session,
        user_id=user.id,
        range_key="custom",
        start_date="2026-10-01",
        end_date="2026-10-31",
        compare_to_previous=False,
    )

    names = summary.challenge_1001.recent_albums
    assert sorted(names) == [
        "Marvin Gaye – What's Going On",
        "The Smiths – The Queen is Dead",
    ]
    assert not any(name.startswith("Album #") for name in names)


def _make_user(db: Session, key: str) -> User:
    user = User(
        spotify_user_id=f"user_{key}",
        username=f"{key}_tester",
        display_name=f"{key} Tester",
        refresh_token_cipher="cipher",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _october_summary(db: Session, user: User):
    return get_report_summary(
        db=db,
        user_id=user.id,
        range_key="custom",
        start_date="2026-10-01",
        end_date="2026-10-31",
        compare_to_previous=False,
    )


def _label(meta: dict) -> str:
    return f"{meta['artist_name']} – {meta['album_name']}"


def _oct(day: int) -> datetime:
    return datetime(2026, 10, day, 12, 0)


def test_report_1001_lists_every_album_newest_first(db_session: Session):
    user = _make_user(db_session, "all1001")
    for album_id in range(1, 8):
        db_session.add(
            User1001AlbumCompletion(
                user_id=user.id,
                album_id=album_id,
                is_completed=True,
                source="manual",
                completed_at=_oct(album_id),
            )
        )
    db_session.commit()

    entry = _october_summary(db_session, user).challenge_1001

    assert entry.completed_in_period == 7
    assert len(entry.recent_albums) == 5
    assert len(entry.all_albums) == 7
    assert entry.all_albums[:5] == entry.recent_albums
    assert entry.all_albums[0] == _label(get_1001_album_by_id(7))
    assert entry.all_albums[-1] == _label(get_1001_album_by_id(1))


def test_report_rough_trade_milestone(db_session: Session):
    user = _make_user(db_session, "rt")
    db_session.add_all(
        [
            UserRoughTradeAlbumCompletion(
                user_id=user.id, album_id=1, is_completed=True, source="manual", completed_at=_oct(10)
            ),
            UserRoughTradeAlbumCompletion(
                user_id=user.id, album_id=2, is_completed=True, source="manual", completed_at=_oct(20)
            ),
            # un-marked: must not count or be listed
            UserRoughTradeAlbumCompletion(
                user_id=user.id, album_id=3, is_completed=False, source="manual_unmark", completed_at=_oct(15)
            ),
            # completed before the period: counts towards the total only
            UserRoughTradeAlbumCompletion(
                user_id=user.id,
                album_id=4,
                is_completed=True,
                source="manual",
                completed_at=datetime(2026, 9, 5, 12, 0),
            ),
        ]
    )
    db_session.commit()

    entry = _october_summary(db_session, user).challenge_rough_trade

    assert entry.completed_in_period == 2
    assert entry.total_completed == 3
    assert entry.all_albums == [
        _label(get_rough_trade_album_by_id(2)),
        _label(get_rough_trade_album_by_id(1)),
    ]
    assert entry.recent_albums == entry.all_albums
    assert _label(get_rough_trade_album_by_id(3)) not in entry.all_albums


def test_report_rough_trade_unknown_album_id_falls_back(db_session: Session):
    user = _make_user(db_session, "rtunknown")
    db_session.add(
        UserRoughTradeAlbumCompletion(
            user_id=user.id, album_id=999999, is_completed=True, source="manual", completed_at=_oct(5)
        )
    )
    db_session.commit()

    entry = _october_summary(db_session, user).challenge_rough_trade

    assert entry.all_albums == ["Album #999999"]


def test_report_rough_trade_empty_for_new_user(db_session: Session):
    user = _make_user(db_session, "rtempty")

    entry = _october_summary(db_session, user).challenge_rough_trade

    assert entry.completed_in_period == 0
    assert entry.total_completed == 0
    assert entry.recent_albums == []
    assert entry.all_albums == []


def test_report_live_artists_lists_all_and_caps_top_five(db_session: Session):
    user = _make_user(db_session, "liveall")
    names = [f"Live Band {letter}" for letter in "ABCDEFG"]
    for index, name in enumerate(names):
        db_session.add(
            AttendedConcert(
                user_id=user.id,
                setlist_id=f"live_{index}",
                artist_name=name,
                venue_name="Venue",
                city="London",
                country="United Kingdom",
                event_date=datetime(2025, 5, 1, 20, 0),
                song_count=10,
            )
        )
        for play in range(len(names) - index):  # A=7 plays ... G=1 play
            db_session.add(
                ListeningEvent(
                    user_id=user.id,
                    track_id=f"t_{index}_{play}",
                    track_name=f"Song {play}",
                    artist_name=name,
                    album_name="Album",
                    played_at=datetime(2026, 10, 10, 10, play),
                    duration_ms=200000,
                    source="spotify",
                    play_id=f"live_play_{index}_{play}",
                )
            )
    db_session.commit()

    entry = _october_summary(db_session, user).live_artists

    assert entry.attended_artists_played == 7
    assert len(entry.top_artists) == 5
    assert len(entry.all_artists) == 7
    counts = [item.count for item in entry.all_artists]
    assert counts == sorted(counts, reverse=True)
    assert entry.top_artists == entry.all_artists[:5]
