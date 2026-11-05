from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import User, User1001AlbumCompletion, User1001PendingConfirmation


def test_user_1001_album_completion_uniqueness():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    with Session(engine) as session:
        user = User(
            spotify_user_id="user_1001",
            username="user_1001",
            display_name="User 1001",
            refresh_token_cipher="cipher",
            is_active=True,
        )
        session.add(user)
        session.commit()

        c1 = User1001AlbumCompletion(
            user_id=user.id,
            album_id=42,
            is_completed=True,
            source="manual",
            completed_at=datetime.now(timezone.utc),
        )
        session.add(c1)
        session.commit()

        c2 = User1001AlbumCompletion(
            user_id=user.id,
            album_id=42,
            is_completed=False,
            source="manual_unmark",
            completed_at=datetime.now(timezone.utc),
        )
        session.add(c2)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_user_1001_pending_confirmation_lifecycle():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    with Session(engine) as session:
        user = User(
            spotify_user_id="user_1001_pending",
            username="user_1001_pending",
            display_name="Pending User",
            refresh_token_cipher="cipher",
            is_active=True,
        )
        session.add(user)
        session.commit()

        p = User1001PendingConfirmation(
            user_id=user.id,
            album_id=10,
            opened_at=datetime.now(timezone.utc),
            dismissed=False,
        )
        session.add(p)
        session.commit()

        saved = session.query(User1001PendingConfirmation).filter_by(user_id=user.id, album_id=10).first()
        assert saved is not None
        assert saved.dismissed is False
