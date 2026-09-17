from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import UserScrobbleSettings
from ..schemas.scrobble_settings import POLL_INTERVAL_OPTIONS


DEFAULTS = {
    "strip_remaster_tags": True,
    "poll_interval_minutes": 5,
}


def get_or_create(db: Session, user_id: int) -> UserScrobbleSettings:
    settings = db.query(UserScrobbleSettings).filter(UserScrobbleSettings.user_id == user_id).first()
    if settings is None:
        settings = UserScrobbleSettings(user_id=user_id, **DEFAULTS)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def get_strip_remaster_tags(db: Session, user_id: int) -> bool:
    settings = db.query(UserScrobbleSettings).filter(UserScrobbleSettings.user_id == user_id).first()
    return settings.strip_remaster_tags if settings is not None else DEFAULTS["strip_remaster_tags"]


def update(db: Session, user_id: int, changes: dict[str, object]) -> UserScrobbleSettings:
    settings = get_or_create(db, user_id)
    for key, value in changes.items():
        if key == "poll_interval_minutes" and value not in POLL_INTERVAL_OPTIONS:
            raise ValueError("Unsupported poll interval")
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


def enable_liked_tracks_sync(db: Session, user_id: int) -> UserScrobbleSettings:
    """Turns on liked-songs sync and kicks off the one-time historical backfill.

    Idempotent: once enabled, pressing the button again is a no-op, since the
    worker keeps syncing (backfill, then daily) on its own from here on.
    """
    settings = get_or_create(db, user_id)
    if settings.liked_tracks_sync_enabled:
        return settings
    settings.liked_tracks_sync_enabled = True
    settings.liked_tracks_backfill_offset = 0
    db.commit()
    db.refresh(settings)
    return settings
