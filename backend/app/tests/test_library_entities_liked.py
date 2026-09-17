from __future__ import annotations

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import LikedTrack, ListeningEvent
from backend.app.services.analytics_service import get_library_entities

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def _make_event(db, user_id, track_id, track_name, artist_name):
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=track_id,
            track_name=track_name,
            artist_name=artist_name,
            played_at=datetime(2026, 1, 1, 12, 0, 0),
            source="spotify",
            play_id=track_id,
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
