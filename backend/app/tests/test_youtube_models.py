from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import FollowedYouTubeChannel, User


def test_followed_youtube_channel_model():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    db = TestingSession()
    try:
        user = User(
            id=1,
            spotify_user_id="testuser",
            username="testuser",
            display_name="Test User",
            refresh_token_cipher="cipher",
            is_active=True,
        )
        db.add(user)
        db.commit()

        channel = FollowedYouTubeChannel(
            user_id=1,
            channel_id="UC4eYXhJI4-7wSWc8UNUu4HA",
            channel_handle="@nprmusic",
            title="NPR Music",
            image_url="https://example.com/avatar.jpg",
        )
        db.add(channel)
        db.commit()

        retrieved = db.query(FollowedYouTubeChannel).filter_by(user_id=1, channel_id="UC4eYXhJI4-7wSWc8UNUu4HA").first()
        assert retrieved is not None
        assert retrieved.title == "NPR Music"
        assert retrieved.channel_handle == "@nprmusic"
        assert retrieved.image_url == "https://example.com/avatar.jpg"
        assert retrieved.created_at is not None
    finally:
        db.close()
