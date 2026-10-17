from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import BlockedItem, Follow, ListeningEvent, User
from backend.app.queries.analytics_queries import get_friends_comparison_data


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    yield session
    session.close()


def test_get_friends_comparison_no_following(db_session):
    user = User(
        id=1, spotify_user_id="user1", username="alice", display_name="Alice", refresh_token_cipher="c", is_active=True
    )
    db_session.add(user)
    db_session.commit()

    now = datetime.utcnow()
    res = get_friends_comparison_data(
        db_session,
        user_id=1,
        start_date=now - timedelta(days=7),
        end_date=now,
    )

    assert res.has_friends is False
    assert res.top_artists == []
    assert res.top_tracks == []
    assert res.leaderboard == []


def test_get_friends_comparison_shared_overlap_and_leaderboard(db_session):
    alice = User(
        id=1, spotify_user_id="u1", username="alice", display_name="Alice", refresh_token_cipher="c", is_active=True
    )
    bob = User(id=2, spotify_user_id="u2", username="bob", display_name="Bob", refresh_token_cipher="c", is_active=True)
    charlie = User(
        id=3, spotify_user_id="u3", username="charlie", display_name="Charlie", refresh_token_cipher="c", is_active=True
    )
    db_session.add_all([alice, bob, charlie])
    db_session.commit()

    # Alice follows Bob and Charlie
    db_session.add_all(
        [
            Follow(follower_id=1, followee_id=2),
            Follow(follower_id=1, followee_id=3),
        ]
    )
    db_session.commit()

    now = datetime.utcnow()
    events = []

    # Shared Artist: Lime Garden (Alice 3 plays, Bob 2 plays, Charlie 1 play)
    for i in range(3):
        events.append(
            ListeningEvent(
                user_id=1,
                track_id=f"lg-{i}",
                track_name="Stain",
                artist_name="Lime Garden",
                played_at=now - timedelta(hours=i + 1),
                duration_ms=180000,
                source="spotify",
                play_id=f"a-lg-{i}",
            )
        )
    for i in range(2):
        events.append(
            ListeningEvent(
                user_id=2,
                track_id=f"lg-b-{i}",
                track_name="Stain",
                artist_name="Lime Garden",
                played_at=now - timedelta(hours=i + 1),
                duration_ms=180000,
                source="spotify",
                play_id=f"b-lg-{i}",
            )
        )
    events.append(
        ListeningEvent(
            user_id=3,
            track_id="lg-c-0",
            track_name="Clockwork",
            artist_name="Lime Garden",
            played_at=now - timedelta(hours=1),
            duration_ms=180000,
            source="spotify",
            play_id="c-lg-0",
        )
    )

    # Shared Artist: Yard Act (Alice 2 plays, Bob 1 play)
    for i in range(2):
        events.append(
            ListeningEvent(
                user_id=1,
                track_id=f"ya-{i}",
                track_name="Dream Job",
                artist_name="Yard Act",
                played_at=now - timedelta(hours=i + 5),
                duration_ms=120000,
                source="spotify",
                play_id=f"a-ya-{i}",
            )
        )
    events.append(
        ListeningEvent(
            user_id=2,
            track_id="ya-b-0",
            track_name="Dream Job",
            artist_name="Yard Act",
            played_at=now - timedelta(hours=6),
            duration_ms=120000,
            source="spotify",
            play_id="b-ya-0",
        )
    )

    # Unshared Artist: Solo Artist (only Bob listened 10 times)
    for i in range(10):
        events.append(
            ListeningEvent(
                user_id=2,
                track_id=f"solo-{i}",
                track_name="Solo Track",
                artist_name="Solo Artist",
                played_at=now - timedelta(hours=i + 10),
                duration_ms=60000,
                source="spotify",
                play_id=f"b-solo-{i}",
            )
        )

    db_session.add_all(events)
    db_session.commit()

    res = get_friends_comparison_data(
        db_session,
        user_id=1,
        start_date=now - timedelta(days=7),
        end_date=now,
    )

    assert res.has_friends is True

    # Check top artists: Lime Garden (6 total) > Yard Act (3 total); Solo Artist excluded because Alice didn't play it
    assert len(res.top_artists) == 2
    assert res.top_artists[0].name == "Lime Garden"
    assert res.top_artists[0].total_scrobbles == 6
    contrib_map_lg = {c.username: c.scrobbles for c in res.top_artists[0].contributions}
    assert contrib_map_lg["alice"] == 3
    assert contrib_map_lg["bob"] == 2
    assert contrib_map_lg["charlie"] == 1

    assert res.top_artists[1].name == "Yard Act"
    assert res.top_artists[1].total_scrobbles == 3

    # Check top tracks: Stain (5 total) > Dream Job (3 total)
    assert len(res.top_tracks) == 2
    assert res.top_tracks[0].name == "Stain"
    assert res.top_tracks[0].artist_name == "Lime Garden"
    assert res.top_tracks[0].total_scrobbles == 5

    # Check leaderboard:
    # Bob: (2 * 3 min) + (1 * 2 min) + (10 * 1 min) = 6 + 2 + 10 = 18 min
    # Alice: (3 * 3 min) + (2 * 2 min) = 9 + 4 = 13 min
    # Charlie: 1 * 3 min = 3 min
    assert len(res.leaderboard) == 3
    assert res.leaderboard[0].username == "bob"
    assert res.leaderboard[0].minutes_listened == 18
    assert res.leaderboard[0].rank == 1
    assert res.leaderboard[0].is_current_user is False

    assert res.leaderboard[1].username == "alice"
    assert res.leaderboard[1].minutes_listened == 13
    assert res.leaderboard[1].rank == 2
    assert res.leaderboard[1].is_current_user is True

    assert res.leaderboard[2].username == "charlie"
    assert res.leaderboard[2].minutes_listened == 3
    assert res.leaderboard[2].rank == 3


def test_get_friends_comparison_blocked_item(db_session):
    alice = User(
        id=1, spotify_user_id="u1", username="alice", display_name="Alice", refresh_token_cipher="c", is_active=True
    )
    bob = User(id=2, spotify_user_id="u2", username="bob", display_name="Bob", refresh_token_cipher="c", is_active=True)
    db_session.add_all([alice, bob])
    db_session.commit()
    db_session.add(Follow(follower_id=1, followee_id=2))
    # Alice blocked Lime Garden
    db_session.add(BlockedItem(user_id=1, entity_type="artist", name="Lime Garden"))
    db_session.commit()

    now = datetime.utcnow()
    # Both listened to Lime Garden and Yard Act
    for u in (1, 2):
        db_session.add(
            ListeningEvent(
                user_id=u,
                track_id=f"lg-{u}",
                track_name="Stain",
                artist_name="Lime Garden",
                played_at=now - timedelta(hours=1),
                duration_ms=180000,
                source="spotify",
                play_id=f"lg-{u}",
            )
        )
        db_session.add(
            ListeningEvent(
                user_id=u,
                track_id=f"ya-{u}",
                track_name="Dream Job",
                artist_name="Yard Act",
                played_at=now - timedelta(hours=2),
                duration_ms=180000,
                source="spotify",
                play_id=f"ya-{u}",
            )
        )
    db_session.commit()

    res = get_friends_comparison_data(
        db_session,
        user_id=1,
        start_date=now - timedelta(days=7),
        end_date=now,
    )

    # Lime Garden must be filtered out
    artist_names = [a.name for a in res.top_artists]
    assert "Lime Garden" not in artist_names
    assert "Yard Act" in artist_names
