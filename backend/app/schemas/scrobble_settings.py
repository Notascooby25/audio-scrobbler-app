from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


POLL_INTERVAL_OPTIONS = {5, 10, 15, 30, 60}


class UserScrobbleSettingsResponse(BaseModel):
    user_id: int
    strip_remaster_tags: bool
    poll_interval_minutes: int
    liked_tracks_sync_enabled: bool
    liked_tracks_backfill_in_progress: bool
    liked_tracks_last_synced_at: datetime | None
    realtime_sync_enabled: bool
    scrobble_threshold_percent: int

    @classmethod
    def from_model(cls, settings: object) -> "UserScrobbleSettingsResponse":
        return cls(
            user_id=settings.user_id,
            strip_remaster_tags=settings.strip_remaster_tags,
            poll_interval_minutes=settings.poll_interval_minutes,
            liked_tracks_sync_enabled=settings.liked_tracks_sync_enabled,
            liked_tracks_backfill_in_progress=settings.liked_tracks_backfill_offset is not None,
            liked_tracks_last_synced_at=settings.liked_tracks_last_synced_at,
            realtime_sync_enabled=settings.realtime_sync_enabled,
            scrobble_threshold_percent=settings.scrobble_threshold_percent,
        )


class UserScrobbleSettingsUpdate(BaseModel):
    strip_remaster_tags: bool | None = None
    poll_interval_minutes: int | None = None
    realtime_sync_enabled: bool | None = None
    scrobble_threshold_percent: int | None = None
