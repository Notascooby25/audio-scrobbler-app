from __future__ import annotations

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import ListeningEvent
from backend.app.services.youtube_replace_service import replace_youtube_history


def test_replace_youtube_history_deletes_only_youtube_rows():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db_session = sessionmaker(bind=engine)()
    db_session.add_all([
        ListeningEvent(user_id=1, track_id="youtube-old", track_name="Old", artist_name="Artist", played_at=datetime(2026, 1, 1), source="youtube", play_id="youtube-old"),
        ListeningEvent(user_id=1, track_id="spotify-keep", track_name="Keep", artist_name="Artist", played_at=datetime(2026, 1, 1), source="spotify", play_id="spotify-keep"),
    ])
    db_session.commit()

    result = replace_youtube_history(db_session, 1, [{
        "artist": "Sam Fender",
        "song": "Something Heavy",
        "album": "People Watching",
        "artwork": "https://example.com/art.jpg",
        "time": "2026-02-11T10:20:01.839Z",
    }])

    assert result == {"deleted": 1, "inserted": 1, "skipped": 0, "artwork": 1}
    assert db_session.query(ListeningEvent).filter_by(source="spotify").count() == 1
    assert db_session.query(ListeningEvent).filter_by(source="youtube").one().artwork_url == "https://example.com/art.jpg"
    db_session.close()