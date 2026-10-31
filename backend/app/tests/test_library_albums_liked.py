from __future__ import annotations

from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import ListeningEvent, SavedAlbum
from backend.app.services.analytics_service import get_library_entities

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def test_library_albums_entity_marks_saved_albums():
    db = TestingSession()
    try:
        # User 1 listens to Boxer and High Violet
        db.add(
            ListeningEvent(
                user_id=1,
                track_id="t1",
                track_name="Fake Empire",
                artist_name="The National",
                album_name="Boxer",
                played_at=datetime(2026, 1, 1, 12, 0),
                source="spotify",
                play_id="t1",
            )
        )
        db.add(
            ListeningEvent(
                user_id=1,
                track_id="t2",
                track_name="Terrible Love",
                artist_name="The National",
                album_name="High Violet",
                played_at=datetime(2026, 1, 1, 13, 0),
                source="spotify",
                play_id="t2",
            )
        )
        # Boxer is saved on Spotify for User 1
        db.add(
            SavedAlbum(
                user_id=1,
                spotify_album_id="boxer-album-id",
                album_name="Boxer",
                artist_name="The National",
                added_at=datetime(2026, 1, 1, 0, 0),
            )
        )
        # High Violet is saved on Spotify for User 2 (not user 1)
        db.add(
            SavedAlbum(
                user_id=2,
                spotify_album_id="high-violet-album-id",
                album_name="High Violet",
                artist_name="The National",
                added_at=datetime(2026, 1, 1, 0, 0),
            )
        )
        db.commit()

        response = get_library_entities(db, user_id=1, entity="albums", limit=10, offset=0)
        by_label = {entry.label: entry for entry in response.entries}

        assert by_label["Boxer"].is_liked is True
        assert by_label["Boxer"].spotify_album_id == "boxer-album-id"

        assert by_label["High Violet"].is_liked is False
        assert by_label["High Violet"].spotify_album_id is None
    finally:
        db.close()
