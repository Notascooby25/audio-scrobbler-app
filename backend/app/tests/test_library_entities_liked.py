from __future__ import annotations

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import LikedTrack, ListeningEvent
from backend.app.services.analytics_service import (
    get_library_entities,
    get_library_scrobbles,
    get_recent_scrobbles,
    get_user_charts,
)

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def _make_event(db, user_id, track_id, track_name, artist_name, source="spotify", played_at=None):
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=track_id,
            track_name=track_name,
            artist_name=artist_name,
            played_at=played_at or datetime(2026, 1, 1, 12, 0, 0),
            source=source,
            play_id=f"{source}:{track_id}",
        )
    )


def test_library_tracks_entity_marks_liked_tracks():
    db = TestingSession()
    try:
        _make_event(db, user_id=1, track_id="track-liked", track_name="Slow Show", artist_name="The National")
        _make_event(db, user_id=1, track_id="track-not-liked", track_name="Fake Empire", artist_name="The National")
        db.add(
            LikedTrack(
                user_id=1,
                spotify_track_id="track-liked",
                track_name="Slow Show",
                artist_name="The National",
                added_at=datetime(2026, 1, 1, 0, 0, 0),
            )
        )
        db.commit()

        response = get_library_entities(db, user_id=1, entity="tracks", limit=10, offset=0)

        by_label = {entry.label: entry for entry in response.entries}
        assert by_label["Slow Show"].is_liked is True
        assert by_label["Slow Show"].spotify_track_id == "track-liked"
        assert by_label["Fake Empire"].is_liked is False
    finally:
        db.close()


def test_library_artists_entity_has_no_liked_fields():
    db = TestingSession()
    try:
        _make_event(db, user_id=2, track_id="track-x", track_name="Song", artist_name="Some Artist")
        db.commit()

        response = get_library_entities(db, user_id=2, entity="artists", limit=10, offset=0)

        assert response.entries[0].is_liked is False
        assert response.entries[0].spotify_track_id is None
    finally:
        db.close()


def test_multi_source_track_prefers_spotify_track_id_over_youtube_uuid():
    db = TestingSession()
    try:
        _make_event(
            db,
            user_id=3,
            track_id="zzzz-youtube-uuid-9999",
            track_name="Getting Started",
            artist_name="Sam Fender",
            source="youtube",
            played_at=datetime(2023, 5, 1, 12, 0, 0),
        )
        _make_event(
            db,
            user_id=3,
            track_id="4jzK6Ey84SAexMK5C2JWKx",
            track_name="Getting Started",
            artist_name="Sam Fender",
            source="spotify",
            played_at=datetime(2026, 1, 2, 12, 0, 0),
        )
        db.add(
            LikedTrack(
                user_id=3,
                spotify_track_id="4jzK6Ey84SAexMK5C2JWKx",
                track_name="Getting Started",
                artist_name="Sam Fender",
                added_at=datetime(2026, 1, 2, 0, 0, 0),
            )
        )
        db.commit()

        lib_res = get_library_entities(db, user_id=3, entity="tracks", limit=10, offset=0)
        assert len(lib_res.entries) == 1
        assert lib_res.entries[0].spotify_track_id == "4jzK6Ey84SAexMK5C2JWKx"
        assert lib_res.entries[0].is_liked is True

        chart_res = get_user_charts(db, user_id=3, entity="tracks", range_key="overall", limit=10)
        assert len(chart_res.entries) == 1
        assert chart_res.entries[0].spotify_track_id == "4jzK6Ey84SAexMK5C2JWKx"
        assert chart_res.entries[0].is_liked is True
    finally:
        db.close()


def test_scrobble_list_transfers_spotify_track_id_to_older_youtube_scrobble():
    db = TestingSession()
    try:
        _make_event(
            db,
            user_id=4,
            track_id="zzzz-youtube-uuid-9999",
            track_name="Glass Towns",
            artist_name="The K's",
            source="youtube",
            played_at=datetime(2023, 5, 1, 12, 0, 0),
        )
        _make_event(
            db,
            user_id=4,
            track_id="0XnhTgURxJoXS2SYsc74V7",
            track_name="Glass Towns",
            artist_name="The K's",
            source="spotify_realtime",
            played_at=datetime(2026, 1, 2, 12, 0, 0),
        )
        _make_event(
            db,
            user_id=4,
            track_id="youtube-only-uuid",
            track_name="Pure YouTube Track",
            artist_name="Indie Band",
            source="youtube",
            played_at=datetime(2024, 1, 1, 12, 0, 0),
        )
        db.commit()

        scrobbles_res = get_library_scrobbles(db, user_id=4, limit=10, offset=0)
        by_source_and_name = {(s.track_name, s.source): s for s in scrobbles_res.scrobbles}
        assert by_source_and_name[("Glass Towns", "spotify_realtime")].spotify_track_id == "0XnhTgURxJoXS2SYsc74V7"
        assert by_source_and_name[("Glass Towns", "youtube")].spotify_track_id == "0XnhTgURxJoXS2SYsc74V7"
        assert by_source_and_name[("Pure YouTube Track", "youtube")].spotify_track_id is None

        recent_res = get_recent_scrobbles(db, user_id=4, limit=10, offset=0)
        recent_by_source = {(s.track_name, s.source): s for s in recent_res.scrobbles}
        assert recent_by_source[("Glass Towns", "youtube")].spotify_track_id == "0XnhTgURxJoXS2SYsc74V7"
        assert recent_by_source[("Pure YouTube Track", "youtube")].spotify_track_id is None
    finally:
        db.close()


def test_youtube_only_track_resolves_spotify_track_id_and_is_liked_from_liked_tracks():
    db = TestingSession()
    try:
        _make_event(
            db,
            user_id=5,
            track_id="yt-uuid-only-123",
            track_name="Hypersonic Missiles",
            artist_name="Sam Fender",
            source="youtube",
            played_at=datetime(2025, 6, 15, 12, 0, 0),
        )
        db.add(
            LikedTrack(
                user_id=5,
                spotify_track_id="6rqhFgbbKwnb9MLmUQDhG6",
                track_name="  hypersonic missiles ",
                artist_name="SAM FENDER",
                added_at=datetime(2025, 6, 15, 0, 0, 0),
            )
        )
        db.commit()

        lib_res = get_library_entities(db, user_id=5, entity="tracks", limit=10, offset=0)
        assert len(lib_res.entries) == 1
        assert lib_res.entries[0].spotify_track_id == "6rqhFgbbKwnb9MLmUQDhG6"
        assert lib_res.entries[0].is_liked is True

        chart_res = get_user_charts(db, user_id=5, entity="tracks", range_key="overall", limit=10)
        assert len(chart_res.entries) == 1
        assert chart_res.entries[0].spotify_track_id == "6rqhFgbbKwnb9MLmUQDhG6"
        assert chart_res.entries[0].is_liked is True

        scrobble_res = get_library_scrobbles(db, user_id=5, limit=10, offset=0)
        assert len(scrobble_res.scrobbles) == 1
        assert scrobble_res.scrobbles[0].spotify_track_id == "6rqhFgbbKwnb9MLmUQDhG6"
        assert scrobble_res.scrobbles[0].is_liked is True

        recent_res = get_recent_scrobbles(db, user_id=5, limit=10, offset=0)
        assert len(recent_res.scrobbles) == 1
        assert recent_res.scrobbles[0].spotify_track_id == "6rqhFgbbKwnb9MLmUQDhG6"
        assert recent_res.scrobbles[0].is_liked is True
    finally:
        db.close()
