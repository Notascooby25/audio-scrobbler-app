from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    spotify_user_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    refresh_token_cipher: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ListeningEvent(Base):
    __tablename__ = "listening_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    track_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    track_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False)
    played_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="spotify")
    payload: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
