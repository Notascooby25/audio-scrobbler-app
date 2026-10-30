from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    spotify_user_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    refresh_token_cipher: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class UserPreferences(Base):
    __tablename__ = "user_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
        CheckConstraint("default_page_size IN (10, 25, 50, 100, 150, 200, 250)", name="ck_user_preferences_page_size"),
        CheckConstraint("default_library_view IN ('list', 'grid')", name="ck_user_preferences_library_view"),
        CheckConstraint("theme IN ('light', 'dark', 'system')", name="ck_user_preferences_theme"),
        CheckConstraint(
            "accent_color IN ('blue_monday', 'spotify_green', 'red_red_wine', 'purple_rain', "
            "'fools_gold', 'paint_it_black', 'pretty_in_pink', 'orange_crush')",
            name="ck_user_preferences_accent_color",
        ),
        CheckConstraint(
            "jukebox_source IN ('spotify_saved', 'library_archive')",
            name="ck_user_preferences_jukebox_source",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    default_date_range: Mapped[str] = mapped_column(String(32), nullable=False, default="last.week")
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="system")
    accent_color: Mapped[str] = mapped_column(String(24), nullable=False, default="blue_monday")
    jukebox_source: Mapped[str] = mapped_column(String(32), nullable=False, default="spotify_saved")
    default_page_size: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    default_library_view: Mapped[str] = mapped_column(String(16), nullable=False, default="list")
    scrobbles_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    artists_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    albums_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tracks_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    show_artwork: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_source_badges: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    timestamp_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="relative")
    notify_recaps: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_milestones: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    home_city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    home_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    notify_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recap_frequency: Mapped[str] = mapped_column(String(16), nullable=False, default="weekly")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class ListeningEvent(Base):
    __tablename__ = "listening_events"
    __table_args__ = (
        UniqueConstraint("user_id", "track_id", "played_at", name="uq_listening_event_identity"),
        UniqueConstraint("user_id", "source", "play_id", name="uq_listening_event_source_identity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    track_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    track_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False)
    album_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    artist_artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    played_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="spotify", nullable=False)
    play_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False, default="")
    payload: Mapped[str] = mapped_column(Text, nullable=True)
    raw_metadata: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class BlockedItem(Base):
    __tablename__ = "blocked_items"
    __table_args__ = (
        CheckConstraint("entity_type IN ('artist', 'album', 'track')", name="ck_blocked_items_entity_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "followee_id", name="uq_follow_identity"),
        CheckConstraint("follower_id != followee_id", name="ck_follow_no_self_follow"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    follower_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    followee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class IngestionCheckpoint(Base):
    __tablename__ = "ingestion_checkpoints"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class RealtimePlaybackState(Base):
    __tablename__ = "realtime_playback_state"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    track_id: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_progress_ms: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    scrobbled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    raw_metadata: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    is_playing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class UserScrobbleSettings(Base):
    __tablename__ = "user_scrobble_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_scrobble_settings_user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    strip_remaster_tags: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    poll_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    liked_tracks_sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    liked_tracks_backfill_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    liked_tracks_watermark: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    liked_tracks_catch_up_floor: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    liked_tracks_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    saved_albums_sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    saved_albums_backfill_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saved_albums_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    realtime_sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scrobble_threshold_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class LikedTrack(Base):
    __tablename__ = "liked_tracks"
    __table_args__ = (UniqueConstraint("user_id", "spotify_track_id", name="uq_liked_track_user_spotify_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    spotify_track_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    track_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False)
    album_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    artist_artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    raw_metadata: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class SavedAlbum(Base):
    __tablename__ = "saved_albums"
    __table_args__ = (
        UniqueConstraint("user_id", "spotify_album_id", name="uq_saved_album_user_spotify_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    spotify_album_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    album_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False)
    release_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    spotify_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_picked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ArtworkCache(Base):
    __tablename__ = "artwork_cache"

    track_id: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    artwork_url: Mapped[str] = mapped_column(Text, nullable=False)
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


# Kept intentionally, unreferenced, for reversibility
class PlaylistCache(Base):
    __tablename__ = "playlist_cache"

    playlist_uri: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class GenreCache(Base):
    __tablename__ = "genre_cache"
    artist_spotify_id: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    genres: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class FollowedShow(Base):
    __tablename__ = "followed_shows"
    __table_args__ = (UniqueConstraint("user_id", "brand_id", name="uq_followed_show_user_brand"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    brand_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    synopsis: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="general")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (UniqueConstraint("user_id", "endpoint", name="uq_push_subscription_user_endpoint"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class FollowedYouTubeChannel(Base):
    __tablename__ = "followed_youtube_channels"
    __table_args__ = (UniqueConstraint("user_id", "channel_id", name="uq_followed_youtube_channel_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    channel_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    channel_handle: Mapped[str | None] = mapped_column(String(128), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class GeoCache(Base):
    """A place looked up on the map service. Found places are kept for months; misses for an hour,
    so a typo or a venue the map doesn't know gets retried later."""

    __tablename__ = "geo_cache"

    cache_key: Mapped[str] = mapped_column(String(255), primary_key=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)


class AttendedConcert(Base):
    __tablename__ = "attended_concerts"
    __table_args__ = (UniqueConstraint("user_id", "setlist_id", name="uq_user_attended_setlist"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    setlist_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    artist_mbid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    venue_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    country: Mapped[str] = mapped_column(String(128), nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    tour_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    setlist_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_support_act: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_festival: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    festival_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_setlist_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    raw_data: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    song_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SetlistCache(Base):
    __tablename__ = "setlist_cache"

    cache_key: Mapped[str] = mapped_column(String(255), primary_key=True)
    response_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SetlistImportJob(Base):
    """A Setlist.fm import that stopped at the daily quota, resumed later by the worker."""

    __tablename__ = "setlist_import_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    # "profile" (attended pages), "selected" (chosen ids) or "file_songs" (fetch songs for gigs)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    setlist_username: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Remaining setlist ids ("selected") or concert ids ("file_songs")
    payload: Mapped[list[object] | None] = mapped_column(JSON, nullable=True)
    next_page: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="paused", index=True, nullable=False)
    imported_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_after: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class GigCompanion(Base):
    """Someone the gig's owner went with. The friend adds the gig to their own account
    (status "added") or dismisses it; nothing is written to their account until then."""

    __tablename__ = "gig_companions"
    __table_args__ = (UniqueConstraint("concert_id", "friend_id", name="uq_gig_companion"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    concert_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    friend_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    # "pending", "added" or "dismissed"
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True, nullable=False)
    friend_concert_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class SetlistApiUsage(Base):
    __tablename__ = "setlist_api_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_call_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    daily_date: Mapped[str] = mapped_column(String(10), nullable=False)  # 'YYYY-MM-DD'
    daily_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
