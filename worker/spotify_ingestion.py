from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timedelta, timezone

import requests
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Boolean, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, sessionmaker

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played"
Base = declarative_base()


class UserRecord(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spotify_user_id: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    refresh_token_cipher: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean)


class CheckpointRecord(Base):
    __tablename__ = "ingestion_checkpoints"
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


def decrypt_refresh_token(ciphertext: str, refresh_token_key: str) -> str:
    key = base64.urlsafe_b64encode(hashlib.sha256(refresh_token_key.encode()).digest())
    return Fernet(key).decrypt(ciphertext.encode()).decode()


def encrypt_refresh_token(token: str, refresh_token_key: str) -> str:
    key = base64.urlsafe_b64encode(hashlib.sha256(refresh_token_key.encode()).digest())
    return Fernet(key).encrypt(token.encode()).decode()


def normalize_recent_item(item: dict[str, object], user_id: int) -> dict[str, object] | None:
    track = item.get("track")
    played_at = item.get("played_at")
    if not isinstance(track, dict) or not isinstance(played_at, str):
        return None
    track_id = track.get("id")
    track_name = track.get("name")
    artists = track.get("artists")
    if not isinstance(track_id, str) or not isinstance(track_name, str) or not isinstance(artists, list) or not artists:
        return None
    artist = artists[0]
    if not isinstance(artist, dict) or not isinstance(artist.get("name"), str):
        return None
    timestamp = datetime.fromisoformat(played_at.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    return {
        "user_id": user_id,
        "track_id": track_id,
        "track_name": track_name,
        "artist_name": artist["name"],
        "played_at": timestamp.isoformat(),
        "duration_ms": track.get("duration_ms") if isinstance(track.get("duration_ms"), int) else None,
        "source": "spotify",
        "payload": item,
    }


class SpotifyClient:
    def __init__(self, client_id: str, client_secret: str, refresh_token_key: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token_key = refresh_token_key

    def refresh_access_token(self, refresh_token: str) -> tuple[str, str | None]:
        response = requests.post(
            SPOTIFY_TOKEN_URL,
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            auth=(self.client_id, self.client_secret),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data["access_token"], data.get("refresh_token")

    def recently_played(self, access_token: str, after: datetime | None = None) -> list[dict[str, object]]:
        params = {"limit": 50}
        if after is not None:
            params["after"] = int(after.replace(tzinfo=timezone.utc).timestamp() * 1000)
        response = requests.get(
            SPOTIFY_RECENT_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=10,
        )
        response.raise_for_status()
        items = response.json().get("items", [])
        return [event for event in items if isinstance(event, dict)]


def sync_user(session, user: UserRecord, client: SpotifyClient, backend_url: str, worker_token: str) -> int:
    try:
        refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
    except InvalidToken:
        return 0
    checkpoint = session.get(CheckpointRecord, user.id)
    after = checkpoint.last_played_at - timedelta(seconds=60) if checkpoint and checkpoint.last_played_at else None
    access_token, rotated_refresh_token = client.refresh_access_token(refresh_token)
    items = client.recently_played(access_token, after)
    events = [normalize_recent_item(item, user.id) for item in items]
    events = [event for event in events if event is not None]
    for event in events:
        response = requests.post(
            f"{backend_url}/ingestion/internal/events",
            json=event,
            headers={"X-Worker-Token": worker_token},
            timeout=10,
        )
        response.raise_for_status()
    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
    newest = max((datetime.fromisoformat(event["played_at"]) for event in events), default=None)
    if newest is not None:
        if checkpoint is None:
            checkpoint = CheckpointRecord(user_id=user.id, last_played_at=newest, updated_at=datetime.utcnow())
            session.add(checkpoint)
        else:
            checkpoint.last_played_at = newest
            checkpoint.updated_at = datetime.utcnow()
    session.commit()
    return len(events)