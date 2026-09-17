from __future__ import annotations

import base64
import hashlib
import time
from datetime import datetime, timedelta, timezone

import requests
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Boolean, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, sessionmaker

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played"
SPOTIFY_SAVED_TRACKS_URL = "https://api.spotify.com/v1/me/tracks"
SPOTIFY_SAVED_TRACKS_LIMIT = 40
Base = declarative_base()

# Spotify's quota is per-app (client_id), not per-user, so this is process-wide
# state shared by every SpotifyClient instance and every poll cycle.
_spotify_blocked_until: datetime | None = None
# Spotify doesn't always send Retry-After on a quota (as opposed to per-second
# rate-limit) rejection; fall back to a conservative pause rather than retrying
# again next poll cycle.
DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 1800.0


class SpotifyRateLimitedError(Exception):
    """Raised instead of contacting Spotify while the app-wide quota block is active."""

    def __init__(self, blocked_until: datetime):
        self.blocked_until = blocked_until
        super().__init__(f"Spotify quota exhausted; paused until {blocked_until.isoformat()}")


def spotify_rate_limit_blocked_until() -> datetime | None:
    """Returns when the current quota block expires, or None if we're clear to call Spotify."""
    global _spotify_blocked_until
    if _spotify_blocked_until and datetime.now(timezone.utc) < _spotify_blocked_until:
        return _spotify_blocked_until
    _spotify_blocked_until = None
    return None


def _mark_spotify_rate_limited(retry_after_header: str | None) -> datetime:
    global _spotify_blocked_until
    try:
        seconds = float(retry_after_header) if retry_after_header else DEFAULT_RATE_LIMIT_BACKOFF_SECONDS
    except ValueError:
        seconds = DEFAULT_RATE_LIMIT_BACKOFF_SECONDS
    seconds = max(seconds, 60.0)
    _spotify_blocked_until = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    return _spotify_blocked_until


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
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class ScrobbleSettingsRecord(Base):
    __tablename__ = "user_scrobble_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer)
    poll_interval_minutes: Mapped[int] = mapped_column(Integer)
    liked_tracks_sync_enabled: Mapped[bool] = mapped_column(Boolean)
    liked_tracks_backfill_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    liked_tracks_watermark: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    liked_tracks_catch_up_floor: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    liked_tracks_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


def decrypt_refresh_token(ciphertext: str, refresh_token_key: str) -> str:
    key = base64.urlsafe_b64encode(hashlib.sha256(refresh_token_key.encode()).digest())
    return Fernet(key).decrypt(ciphertext.encode()).decode()


def encrypt_refresh_token(token: str, refresh_token_key: str) -> str:
    key = base64.urlsafe_b64encode(hashlib.sha256(refresh_token_key.encode()).digest())
    return Fernet(key).encrypt(token.encode()).decode()


def submit_event_with_retries(backend_url: str, worker_token: str, event: dict[str, object]):
    for attempt in range(3):
        response = requests.post(
            f"{backend_url}/ingestion/internal/events",
            json=event,
            headers={"X-Worker-Token": worker_token},
            timeout=10,
        )
        if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            retry_after = min(float(response.headers.get("Retry-After", "1")), 30) if response.status_code == 429 else 2 ** attempt
            time.sleep(retry_after)
            continue
        response.raise_for_status()
        return response
    raise requests.HTTPError("Backend ingestion failed after retries")


def submit_liked_tracks_with_retries(backend_url: str, worker_token: str, user_id: int, tracks: list[dict[str, object]]):
    payload = {"user_id": user_id, "tracks": tracks}
    for attempt in range(3):
        response = requests.post(
            f"{backend_url}/spotify/internal/liked-tracks",
            json=payload,
            headers={"X-Worker-Token": worker_token},
            timeout=15,
        )
        if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            retry_after = min(float(response.headers.get("Retry-After", "1")), 30) if response.status_code == 429 else 2 ** attempt
            time.sleep(retry_after)
            continue
        response.raise_for_status()
        return response
    raise requests.HTTPError("Backend liked-tracks sync failed after retries")


def _parse_added_at(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        return None


def normalize_saved_track_item(item: dict[str, object]) -> dict[str, object] | None:
    track = item.get("track")
    added_at = _parse_added_at(item.get("added_at"))
    if not isinstance(track, dict) or added_at is None:
        return None
    track_id = track.get("id")
    track_name = track.get("name")
    artists = track.get("artists")
    if not isinstance(track_id, str) or not isinstance(track_name, str) or not isinstance(artists, list) or not artists:
        return None
    artist = artists[0]
    if not isinstance(artist, dict) or not isinstance(artist.get("name"), str):
        return None
    album = track.get("album")
    album_name = album.get("name") if isinstance(album, dict) else None
    images = album.get("images") if isinstance(album, dict) else None
    artwork_url = images[0].get("url") if isinstance(images, list) and images and isinstance(images[0], dict) else None
    return {
        "spotify_track_id": track_id,
        "track_name": track_name,
        "artist_name": artist["name"],
        "album_name": album_name if isinstance(album_name, str) else None,
        "artwork_url": artwork_url if isinstance(artwork_url, str) else None,
        "artist_artwork_url": None,
        "added_at": added_at.isoformat(),
        "raw_metadata": item,
    }


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
    album = track.get("album")
    album_name = album.get("name") if isinstance(album, dict) else None
    images = album.get("images") if isinstance(album, dict) else None
    artwork_url = images[0].get("url") if isinstance(images, list) and images and isinstance(images[0], dict) else None
    timestamp = datetime.fromisoformat(played_at.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    return {
        "user_id": user_id,
        "track_id": track_id,
        "track_name": track_name,
        "artist_name": artist["name"],
        "album_name": album_name if isinstance(album_name, str) else None,
        "artwork_url": artwork_url if isinstance(artwork_url, str) else None,
        "played_at": timestamp.isoformat(),
        "duration_ms": track.get("duration_ms") if isinstance(track.get("duration_ms"), int) else None,
        "source": "spotify",
        "play_id": f"{track_id}:{played_at}",
        "payload": item,
        "raw_metadata": item,
    }


class SpotifyClient:
    def __init__(self, client_id: str, client_secret: str, refresh_token_key: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token_key = refresh_token_key

    def refresh_access_token(self, refresh_token: str) -> tuple[str, str | None]:
        response = self._request("post", SPOTIFY_TOKEN_URL, data={"grant_type": "refresh_token", "refresh_token": refresh_token}, auth=(self.client_id, self.client_secret))
        response.raise_for_status()
        data = response.json()
        return data["access_token"], data.get("refresh_token")

    def recently_played(self, access_token: str, after: datetime | None = None) -> list[dict[str, object]]:
        params = {"limit": 50}
        if after is not None:
            params["after"] = int(after.replace(tzinfo=timezone.utc).timestamp() * 1000)
        response = self._request("get", SPOTIFY_RECENT_URL, headers={"Authorization": f"Bearer {access_token}"}, params=params)
        response.raise_for_status()
        items = response.json().get("items", [])
        return [event for event in items if isinstance(event, dict)]

    def saved_tracks(self, access_token: str, *, offset: int = 0, limit: int = SPOTIFY_SAVED_TRACKS_LIMIT) -> list[dict[str, object]]:
        # One page per call, capped at `limit` (40) — the caller (sync_liked_tracks_for_user)
        # is responsible for spreading a large backlog across multiple scheduler ticks
        # rather than looping pages here, which is what caused the previous rate-limit failures.
        params = {"limit": limit, "offset": offset}
        response = self._request("get", SPOTIFY_SAVED_TRACKS_URL, headers={"Authorization": f"Bearer {access_token}"}, params=params)
        response.raise_for_status()
        items = response.json().get("items", [])
        return [item for item in items if isinstance(item, dict)]

    @staticmethod
    def _request(method: str, url: str, **kwargs):
        blocked_until = spotify_rate_limit_blocked_until()
        if blocked_until:
            raise SpotifyRateLimitedError(blocked_until)
        for attempt in range(3):
            response = getattr(requests, method)(url, timeout=10, **kwargs)
            if response.status_code == 429:
                if attempt < 2:
                    retry_after = min(float(response.headers.get("Retry-After", "1")), 30)
                    time.sleep(retry_after)
                    continue
                raise SpotifyRateLimitedError(_mark_spotify_rate_limited(response.headers.get("Retry-After")))
            if response.status_code >= 500 and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            response.raise_for_status()
            return response
        raise requests.HTTPError(f"Spotify request failed after retries: {url}")


def sync_user(session, user: UserRecord, client: SpotifyClient, backend_url: str, worker_token: str) -> int:
    try:
        refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
    except InvalidToken:
        return 0
    checkpoint = session.get(CheckpointRecord, user.id)
    after = checkpoint.last_played_at - timedelta(seconds=60) if checkpoint and checkpoint.last_played_at else None
    access_token, rotated_refresh_token = client.refresh_access_token(refresh_token)
    items = client.recently_played(access_token, after)
    events = []
    for item in items:
        try:
            event = normalize_recent_item(item, user.id)
        except (TypeError, ValueError):
            continue
        if event is not None:
            events.append(event)
    for event in events:
        submit_event_with_retries(backend_url, worker_token, event)
    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
    newest = max((datetime.fromisoformat(event["played_at"]) for event in events), default=None)
    now = datetime.utcnow()
    if checkpoint is None:
        checkpoint = CheckpointRecord(user_id=user.id, last_played_at=newest, last_polled_at=now, updated_at=now)
        session.add(checkpoint)
    else:
        checkpoint.last_polled_at = now
        if newest is not None:
            checkpoint.last_played_at = newest
            checkpoint.updated_at = now
    session.commit()
    return len(events)


def sync_liked_tracks_for_user(
    session,
    user: UserRecord,
    liked_settings: ScrobbleSettingsRecord,
    client: SpotifyClient,
    backend_url: str,
    worker_token: str,
) -> int:
    """Syncs at most one page (<=40 items) of liked songs per call.

    A large existing library is never paginated through in a single run —
    `liked_tracks_backfill_offset` tracks progress across many scheduler
    ticks instead, so this never issues a burst of sequential Spotify calls.

    Two pieces of state track an in-progress walk across ticks:
    - `liked_tracks_watermark`: the confirmed newest-synced timestamp.
      Updated once, from the walk's very first page (offset 0) — Spotify
      returns saved tracks newest-added-first, so page 0 always contains
      the globally newest items regardless of how many further pages the
      walk ends up needing.
    - `liked_tracks_catch_up_floor`: a snapshot of the *previous* watermark,
      frozen for the whole walk. Every page is trimmed against this same
      frozen value, so a walk that needs several ticks (more than 40 tracks
      liked since the last check) never loses track of where it can stop,
      and never mistakes its own just-updated watermark for the stopping
      point.
    """
    starting_new_walk = liked_settings.liked_tracks_backfill_offset is None
    if starting_new_walk and liked_settings.liked_tracks_last_synced_at is not None:
        last_synced = liked_settings.liked_tracks_last_synced_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - last_synced < timedelta(hours=24):
            return 0

    try:
        refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
    except InvalidToken:
        return 0
    access_token, rotated_refresh_token = client.refresh_access_token(refresh_token)

    if starting_new_walk:
        liked_settings.liked_tracks_catch_up_floor = liked_settings.liked_tracks_watermark
    floor = liked_settings.liked_tracks_catch_up_floor

    offset = liked_settings.liked_tracks_backfill_offset or 0
    raw_items = client.saved_tracks(access_token, offset=offset)
    normalized = [track for track in (normalize_saved_track_item(item) for item in raw_items) if track is not None]
    page_is_full = len(raw_items) == SPOTIFY_SAVED_TRACKS_LIMIT

    if offset == 0 and normalized:
        liked_settings.liked_tracks_watermark = datetime.fromisoformat(normalized[0]["added_at"])

    reached_floor = False
    if floor is not None:
        kept = []
        for track in normalized:
            if datetime.fromisoformat(track["added_at"]) <= floor:
                reached_floor = True
                break
            kept.append(track)
        normalized = kept

    if normalized:
        submit_liked_tracks_with_retries(backend_url, worker_token, user.id, normalized)

    # Still more to walk if the page was full and we haven't yet reached
    # either previously-synced territory (the floor) or the very end of the
    # user's library (true initial backfill, no floor set at all).
    still_more = page_is_full and not reached_floor
    if still_more:
        liked_settings.liked_tracks_backfill_offset = offset + len(raw_items)
    else:
        liked_settings.liked_tracks_backfill_offset = None
        liked_settings.liked_tracks_catch_up_floor = None
        liked_settings.liked_tracks_last_synced_at = datetime.utcnow()

    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
    session.commit()
    return len(normalized)