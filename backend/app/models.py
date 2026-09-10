from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
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
        CheckConstraint("default_page_size IN (10, 25, 50, 100)", name="ck_user_preferences_page_size"),
        CheckConstraint("default_library_view IN ('list', 'grid')", name="ck_user_preferences_library_view"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    default_date_range: Mapped[str] = mapped_column(String(32), nullable=False, default="last.week")
    default_page_size: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    default_library_view: Mapped[str] = mapped_column(String(16), nullable=False, default="list")
    scrobbles_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    artists_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    albums_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tracks_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    liked_tracks_view: Mapped[str | None] = mapped_column(String(16), nullable=True)
    show_artwork: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_source_badges: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    timestamp_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="relative")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


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


class LikedTrack(Base):
    __tablename__ = "liked_tracks"
    __table_args__ = (
        UniqueConstraint("user_id", "spotify_track_id", name="uq_liked_track_user_spotify_id"),
    )

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
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


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
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
