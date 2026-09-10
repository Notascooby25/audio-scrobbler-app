from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import UserPreferences
from ..schemas.preferences import DATE_RANGES, PAGE_SIZES, VIEWS


DEFAULTS = {
    "default_date_range": "last.week",
    "default_page_size": 50,
    "default_library_view": "list",
    "scrobbles_view": None,
    "artists_view": None,
    "albums_view": None,
    "tracks_view": None,
    "liked_tracks_view": None,
    "show_artwork": True,
    "show_source_badges": True,
    "timestamp_mode": "relative",
}


def get_or_create(db: Session, user_id: int) -> UserPreferences:
    preferences = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if preferences is None:
        preferences = UserPreferences(user_id=user_id, **DEFAULTS)
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    return preferences


def update(db: Session, user_id: int, changes: dict[str, object]) -> UserPreferences:
    preferences = get_or_create(db, user_id)
    for key, value in changes.items():
        if key == "default_date_range" and value not in DATE_RANGES:
            raise ValueError("Unsupported default date range")
        if key == "default_page_size" and value not in PAGE_SIZES:
            raise ValueError("Unsupported default page size")
        if key.endswith("_view") and value is not None and value not in VIEWS:
            raise ValueError("Unsupported Library view")
        if key == "timestamp_mode" and value not in {"relative", "absolute"}:
            raise ValueError("Unsupported timestamp mode")
        setattr(preferences, key, value)
    db.commit()
    db.refresh(preferences)
    return preferences