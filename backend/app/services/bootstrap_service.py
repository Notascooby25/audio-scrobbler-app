from __future__ import annotations

from sqlalchemy.orm import Session

from ..config import settings
from ..models import User
from .username_service import generate_unique_username


def bootstrap_development_user(db: Session) -> User | None:
    if settings.environment.lower() != "development":
        return None

    user = db.query(User).filter(User.id == settings.dev_user_id).first()
    if user is not None:
        return user

    user = User(
        id=settings.dev_user_id,
        spotify_user_id=settings.dev_user_spotify_id,
        username=generate_unique_username(db, settings.dev_user_spotify_id),
        display_name=settings.dev_user_display_name,
        refresh_token_cipher="development-placeholder",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user