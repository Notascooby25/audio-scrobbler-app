from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import BlockedItem, GenreCache, ListeningEvent
from backend.app.services.wrapped_music_stats import build_music_stats

START = datetime(2025, 12, 31, 0, 0)  # naive UTC; London is GMT in winter
END = datetime(2026, 12, 31, 0, 0)


@pytest.fixture
def db_session():
    # Non-autoflush, like backend/app/db.py.
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


def _play(db, played_at, track="Song", artist="Artist", album="Album", duration_ms=180_000, user_id=1, artist_id=None):
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=f"t-{uuid.uuid4().hex[:8]}",
            track_name=track,
            artist_name=artist,
            album_name=album,
            artwork_url=f"https://img/{album}.jpg" if album else None,
            played_at=played_at,
            duration_ms=duration_ms,
            source="spotify",
            play_id=uuid.uuid4().hex,
            raw_metadata={"track": {"artists": [{"id": artist_id, "name": artist}]}} if artist_id else None,
        )
    )


def _fill(db, count=40, start=datetime(2026, 3, 1, 12, 0), **kwargs):
    for i in range(count):
        _play(db, start + timedelta(minutes=5 * i), **kwargs)
    db.commit()


def test_returns_none_under_30_plays(db_session):
    _fill(db_session, count=29)
    assert build_music_stats(db_session, 1, START, END) is None


def test_minutes_use_duration_ms(db_session):
    _fill(db_session, count=40, duration_ms=180_000)  # 40 x 3 min
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["total_plays"] == 40
    assert stats["estimated_minutes"] == 120


def test_missing_duration_uses_the_average_of_known_plays(db_session):
    # YouTube imports have no track length. They count at the person's own average, not as zero minutes.
    _fill(db_session, count=20, duration_ms=180_000)
    _fill(db_session, count=20, duration_ms=None, start=datetime(2026, 5, 1, 9, 0))
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["estimated_minutes"] == 120  # 40 plays x 3 minutes


def test_no_known_durations_count_as_three_and_a_half_minutes(db_session):
    _fill(db_session, count=40, duration_ms=None)
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["estimated_minutes"] == 140
    assert stats["biggest_day"]["minutes"] == 140


def test_london_time_grouping_across_bst(db_session):
    _fill(db_session, count=30)
    # 23:30 UTC on 30 June is 00:30 BST on 1 July.
    _play(db_session, datetime(2026, 6, 30, 23, 30))
    # 23:30 UTC on 31 Dec 2025 is 23:30 GMT on 31 Dec 2025: inside the window start (00:00 UTC 31 Dec 2025)
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["months"][5] == 0  # June
    assert stats["months"][6] == 1  # July
    assert stats["months"][2] == 30  # March


def test_busiest_hour_is_london_hour(db_session):
    for i in range(35):
        _play(db_session, datetime(2026, 7, 1 + i % 20, 22, 30))  # 23:30 BST
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["busiest_hour"] == 23
    assert stats["listener_label"] == "Night owl"


def test_album_needs_three_distinct_tracks(db_session):
    _fill(db_session, count=30, track="Hit", album="Single Album")
    for i, name in enumerate(["A", "B", "C"]):
        _play(db_session, datetime(2026, 4, 1, 10, i), track=name, album="Full Album", artist="Other")
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    names = [a["name"] for a in stats["top_albums"]]
    assert "Single Album" not in names
    assert "Full Album" in names


def test_top_artists_and_songs_ranked_by_plays(db_session):
    _fill(db_session, count=20, artist="Big", track="One")
    _fill(db_session, count=10, artist="Small", track="Two", start=datetime(2026, 5, 1, 9, 0))
    stats = build_music_stats(db_session, 1, START, END)
    assert [a["name"] for a in stats["top_artists"]] == ["Big", "Small"]
    assert stats["top_artists"][0]["plays"] == 20
    assert stats["top_songs"][0]["name"] == "One"
    assert stats["top_songs"][0]["artist"] == "Big"


def test_artist_rows_prefer_the_artist_picture_over_album_art(db_session):
    _fill(db_session, count=35, artist="Big", album="Some Album")
    for event in db_session.query(ListeningEvent).all():
        event.artist_artwork_url = "https://img/big-artist.jpg"
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["top_artists"][0]["artwork_url"] == "https://img/big-artist.jpg"
    assert stats["top_songs"][0]["artwork_url"] == "https://img/Some Album.jpg"


def test_artist_casing_is_one_artist(db_session):
    _fill(db_session, count=20, artist="Big Band")
    _fill(db_session, count=15, artist="big band", start=datetime(2026, 5, 1, 9, 0))
    stats = build_music_stats(db_session, 1, START, END)
    assert len(stats["top_artists"]) == 1
    assert stats["top_artists"][0]["plays"] == 35


def test_new_artists_use_full_history(db_session):
    _play(db_session, datetime(2024, 1, 1, 10, 0), artist="Old")
    _fill(db_session, count=20, artist="Old")
    _fill(db_session, count=20, artist="Fresh", start=datetime(2026, 8, 1, 10, 0))
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["new_artists"] == 1
    assert stats["history_starts_at"].startswith("2024-01-01")


def test_blocked_items_excluded(db_session):
    _fill(db_session, count=40, artist="Keep")
    _fill(db_session, count=10, artist="Hidden", start=datetime(2026, 5, 1, 9, 0))
    db_session.add(BlockedItem(user_id=1, entity_type="artist", name="hidden"))
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["total_plays"] == 40
    assert [a["name"] for a in stats["top_artists"]] == ["Keep"]


def test_only_this_user_and_window(db_session):
    _fill(db_session, count=40, user_id=2)
    _fill(db_session, count=31)
    _play(db_session, datetime(2027, 1, 5, 10, 0))
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["total_plays"] == 31


def test_biggest_day(db_session):
    for day in range(30):
        _play(db_session, datetime(2026, 3, 1 + day % 28, 8, day))
    for i in range(12):
        _play(db_session, datetime(2026, 9, 9, 8, i))
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert stats["biggest_day"]["date"] == "2026-09-09"
    assert stats["biggest_day"]["plays"] == 12


def test_genres_from_cache(db_session):
    _fill(db_session, count=40, artist="Rocker", artist_id="a1")
    db_session.add(GenreCache(artist_spotify_id="a1", genres=["rock", "indie"]))
    db_session.commit()
    stats = build_music_stats(db_session, 1, START, END)
    assert [g["name"] for g in stats["top_genres"]] == ["rock", "indie"]
    assert stats["top_genres"][0]["share"] == 0.5
