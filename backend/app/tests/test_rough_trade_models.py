from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.models import Base, User, UserRoughTradeAlbumCompletion


def test_user_rough_trade_album_completion_model():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    user = User(
        spotify_user_id="spotify_test_user",
        username="testuser",
        display_name="Test User",
        refresh_token_cipher="cipher",
    )
    db.add(user)
    db.commit()

    completion = UserRoughTradeAlbumCompletion(
        user_id=user.id,
        album_id=42,
        is_completed=True,
        source="scrobble_85pct",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(completion)
    db.commit()

    retrieved = db.query(UserRoughTradeAlbumCompletion).filter_by(user_id=user.id, album_id=42).first()
    assert retrieved is not None
    assert retrieved.is_completed is True
    assert retrieved.source == "scrobble_85pct"
    assert retrieved.completed_at is not None
    db.close()
