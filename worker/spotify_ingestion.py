from __future__ import annotations

import base64
import hashlib
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Boolean, DateTime, Integer, String, Text, JSON, BigInteger
from sqlalchemy.orm import Mapped, declarative_base, mapped_column

from musicbrainz import MusicBrainzClient, MusicBrainzUnavailableError

# app.py's logging.basicConfig() runs at process start (before the scheduler ever
# calls into this module), so this propagates to the root logger it configures —
# see e3767c2 "configure logging so sync progress actually reaches the logs".
logger = logging.getLogger(__name__)

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played"
SPOTIFY_SAVED_TRACKS_URL = "https://api.spotify.com/v1/me/tracks"
SPOTIFY_SAVED_TRACKS_LIMIT = 40
SPOTIFY_SAVED_ALBUMS_URL = "https://api.spotify.com/v1/me/albums"
SPOTIFY_SAVED_ALBUMS_LIMIT = 50
# Genre lookups are one request per artist, so a run is capped and spaced out.
# A large backlog is spread across many 5-minute runs rather than bursting Spotify.
MAX_GENRE_LOOKUPS_PER_RUN = 20
GENRE_LOOKUP_SPACING_SECONDS = 0.3
# MusicBrainz allows about one request a second and each artist can take up to three
# (Spotify link, name search, genres), so only a few artists are sent its way per run.
MAX_MUSICBRAINZ_LOOKUPS_PER_RUN = 6
Base = declarative_base()


def _utc_now() -> datetime:
    """Returns the current UTC datetime without tzinfo for database compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


class RealtimePlaybackStateRecord(Base):
    __tablename__ = "realtime_playback_state"
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    track_id: Mapped[str] = mapped_column(String(255))
    duration_ms: Mapped[int] = mapped_column(BigInteger)
    max_progress_ms: Mapped[int] = mapped_column(BigInteger)
    scrobbled: Mapped[bool] = mapped_column(Boolean)
    raw_metadata: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    is_playing: Mapped[bool] = mapped_column(Boolean)
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
    saved_albums_sync_enabled: Mapped[bool] = mapped_column(Boolean)
    saved_albums_backfill_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saved_albums_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    realtime_sync_enabled: Mapped[bool] = mapped_column(Boolean)
    scrobble_threshold_percent: Mapped[int] = mapped_column(Integer)


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


def submit_saved_albums_with_retries(backend_url: str, worker_token: str, user_id: int, albums: list[dict[str, object]]):
    payload = {"user_id": user_id, "albums": albums}
    for attempt in range(3):
        response = requests.post(
            f"{backend_url}/spotify/internal/saved-albums",
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
    raise requests.HTTPError("Backend saved-albums sync failed after retries")


def normalize_saved_album_item(
    item: dict[str, object],
    user_id: int,
    artist_genres_map: dict[str, list[str]] | None = None,
) -> dict[str, object] | None:
    album = item.get("album")
    added_at = _parse_added_at(item.get("added_at"))
    if not isinstance(album, dict) or added_at is None:
        return None
    album_id = album.get("id")
    album_name = album.get("name")
    artists = album.get("artists")
    if not isinstance(album_id, str) or not isinstance(album_name, str) or not isinstance(artists, list) or not artists:
        return None
    primary_artist = artists[0]
    if not isinstance(primary_artist, dict) or not isinstance(primary_artist.get("name"), str):
        return None
    artist_id = primary_artist.get("id")
    genres = (artist_genres_map or {}).get(artist_id, []) if isinstance(artist_id, str) else []
    
    release_date = album.get("release_date")
    release_year = None
    if isinstance(release_date, str) and len(release_date) >= 4 and release_date[:4].isdigit():
        release_year = int(release_date[:4])

    duration_ms = 0
    tracks_obj = album.get("tracks")
    if isinstance(tracks_obj, dict) and isinstance(tracks_obj.get("items"), list):
        for track_item in tracks_obj["items"]:
            if isinstance(track_item, dict) and isinstance(track_item.get("duration_ms"), int):
                duration_ms += track_item["duration_ms"]

    images = album.get("images")
    artwork_url = images[0].get("url") if isinstance(images, list) and images and isinstance(images[0], dict) else None
    external_urls = album.get("external_urls")
    spotify_url = external_urls.get("spotify") if isinstance(external_urls, dict) and isinstance(external_urls.get("spotify"), str) else None
    label = album.get("label") if isinstance(album.get("label"), str) else None

    return {
        "user_id": user_id,
        "spotify_album_id": album_id,
        "album_name": album_name,
        "artist_name": primary_artist["name"],
        "release_date": release_date if isinstance(release_date, str) else None,
        "release_year": release_year,
        "genres": genres,
        "duration_ms": duration_ms if duration_ms > 0 else None,
        "label": label,
        "artwork_url": artwork_url,
        "spotify_url": spotify_url,
        "added_at": added_at.isoformat(),
    }








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


    def get_client_credentials_token(self) -> str:
        response = self._request("post", SPOTIFY_TOKEN_URL, data={"grant_type": "client_credentials"}, auth=(self.client_id, self.client_secret))
        response.raise_for_status()
        return response.json()["access_token"]

    def artists(self, access_token: str, artist_ids: list[str]) -> list[dict[str, object]]:
        if not artist_ids:
            return []
        url = "https://api.spotify.com/v1/artists"
        params = {"ids": ",".join(artist_ids)}
        response = self._request("get", url, headers={"Authorization": f"Bearer {access_token}"}, params=params)
        response.raise_for_status()
        return [artist for artist in response.json().get("artists", []) if artist is not None]

    def artist(self, access_token: str, artist_id: str) -> dict[str, object]:
        """One artist record. Replaces the batch call, which Development Mode apps no longer have."""
        url = f"https://api.spotify.com/v1/artists/{quote(artist_id, safe='')}"
        response = self._request("get", url, headers={"Authorization": f"Bearer {access_token}"})
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, dict) else {}

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

    def saved_albums(self, access_token: str, *, offset: int = 0, limit: int = SPOTIFY_SAVED_ALBUMS_LIMIT) -> list[dict[str, object]]:
        params = {"limit": limit, "offset": offset}
        response = self._request("get", SPOTIFY_SAVED_ALBUMS_URL, headers={"Authorization": f"Bearer {access_token}"}, params=params)
        response.raise_for_status()
        items = response.json().get("items", [])
        return [item for item in items if isinstance(item, dict)]

    def currently_playing(self, access_token: str) -> dict[str, object] | None:
        response = self._request("get", "https://api.spotify.com/v1/me/player/currently-playing", headers={"Authorization": f"Bearer {access_token}"})
        if response.status_code == 204:
            return None
        response.raise_for_status()
        return response.json()

    def playlist(self, access_token: str, playlist_id: str) -> dict[str, object]:
        response = self._request(
            "get",
            f"https://api.spotify.com/v1/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"fields": "name"},
        )
        response.raise_for_status()
        return response.json()

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


_REALTIME_ACCESS_TOKENS: dict[int, tuple[str, datetime]] = {}


def get_cached_or_refreshed_token(
    user: UserRecord,
    client: SpotifyClient,
    session,
    force_refresh: bool = False,
) -> str | None:
    now = _utc_now()
    if not force_refresh and user.id in _REALTIME_ACCESS_TOKENS:
        token, expires_at = _REALTIME_ACCESS_TOKENS[user.id]
        if expires_at > now + timedelta(minutes=5):
            return token

    try:
        refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
    except InvalidToken:
        _REALTIME_ACCESS_TOKENS.pop(user.id, None)
        return None

    access_token, rotated_refresh_token = client.refresh_access_token(refresh_token)
    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
        session.commit()

    # Spotify access tokens are valid for 1 hour (3600s)
    _REALTIME_ACCESS_TOKENS[user.id] = (access_token, now + timedelta(seconds=3600))
    return access_token


def sync_currently_playing(
    session,
    user: UserRecord,
    settings: ScrobbleSettingsRecord,
    client: SpotifyClient,
    backend_url: str,
    worker_token: str,
) -> bool:
    access_token = get_cached_or_refreshed_token(user, client, session)
    if not access_token:
        return False

    try:
        current = client.currently_playing(access_token)
    except Exception as e:
        status_code = getattr(getattr(e, "response", None), "status_code", None)
        if status_code == 401:
            access_token = get_cached_or_refreshed_token(user, client, session, force_refresh=True)
            if not access_token:
                return False
            current = client.currently_playing(access_token)
        else:
            raise

    now = _utc_now()
    
    state = session.query(RealtimePlaybackStateRecord).filter(RealtimePlaybackStateRecord.user_id == user.id).first()
    if not state:
        state = RealtimePlaybackStateRecord(user_id=user.id, track_id="", duration_ms=0, max_progress_ms=0, scrobbled=False)
        session.add(state)
        
    if not current or not current.get("is_playing") or not current.get("item"):
        state.is_playing = False
        state.updated_at = now
    else:
        item = current["item"]
        track_id = item.get("id") or item.get("uri")
        progress_ms = current.get("progress_ms", 0)
        duration_ms = item.get("duration_ms", 0)
        
        if track_id != state.track_id:
            state.track_id = track_id
            state.duration_ms = duration_ms
            state.max_progress_ms = progress_ms
            state.scrobbled = False
            state.raw_metadata = current
        else:
            if progress_ms > state.max_progress_ms:
                state.max_progress_ms = progress_ms
            state.raw_metadata = current
            
        state.is_playing = True
        state.updated_at = now
        
        # Check if we should scrobble
        threshold = settings.scrobble_threshold_percent
        if not state.scrobbled and duration_ms > 0 and (state.max_progress_ms / duration_ms) >= (threshold / 100.0):
            # scrobble it
            played_at = (now - timedelta(milliseconds=state.max_progress_ms)).replace(microsecond=0)
            
            # extract artists/name
            track_name = item.get("name")
            artists = item.get("artists", [])
            artist_name = artists[0].get("name") if artists else "Unknown Artist"
            album_name = item.get("album", {}).get("name") if item.get("album") else None
            
            images = item.get("album", {}).get("images") if item.get("album") else None
            artwork_url = images[0].get("url") if isinstance(images, list) and images and isinstance(images[0], dict) else None

            event = {
                "user_id": user.id,
                "track_id": track_id,
                "track_name": track_name,
                "artist_name": artist_name,
                "album_name": album_name,
                "artwork_url": artwork_url,
                "played_at": played_at.isoformat() + "Z",
                "duration_ms": duration_ms,
                "source": "spotify",
                "play_id": f"{track_id}:{played_at.isoformat()}",
                "payload": current,
                "raw_metadata": current,
            }
            try:
                submit_event_with_retries(backend_url, worker_token, event)
                state.scrobbled = True
            except Exception:
                pass # will retry next tick if not skipped
                
    session.commit()
    return True


def sync_user(session, user: UserRecord, client: SpotifyClient, backend_url: str, worker_token: str) -> int:
    try:
        refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
    except InvalidToken:
        return 0
    checkpoint = session.get(CheckpointRecord, user.id)
    after = checkpoint.last_played_at - timedelta(seconds=60) if checkpoint and checkpoint.last_played_at else None
    access_token, rotated_refresh_token = client.refresh_access_token(refresh_token)
    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
        session.commit()
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
    newest = max((datetime.fromisoformat(event["played_at"]) for event in events), default=None)
    now = _utc_now()
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
    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
        session.commit()

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
        liked_settings.liked_tracks_last_synced_at = _utc_now()

    session.commit()
    return len(normalized)


def sync_saved_albums_for_user(
    session,
    user: UserRecord,
    settings: ScrobbleSettingsRecord,
    client: SpotifyClient,
    backend_url: str,
    worker_token: str,
) -> int:
    """Syncs at most one page (<=50 items) of saved albums per call."""
    starting_new_walk = settings.saved_albums_backfill_offset is None
    if starting_new_walk and settings.saved_albums_last_synced_at is not None:
        last_synced = settings.saved_albums_last_synced_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - last_synced < timedelta(hours=24):
            return 0

    try:
        refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
    except InvalidToken:
        return 0
    access_token, rotated_refresh_token = client.refresh_access_token(refresh_token)
    if rotated_refresh_token:
        user.refresh_token_cipher = encrypt_refresh_token(rotated_refresh_token, client.refresh_token_key)
        session.commit()

    offset = settings.saved_albums_backfill_offset or 0
    raw_items = client.saved_albums(access_token, offset=offset)
    
    # Collect primary artist IDs to map genres if possible
    artist_ids = []
    for item in raw_items:
        album = item.get("album")
        if isinstance(album, dict) and isinstance(album.get("artists"), list) and album["artists"]:
            aid = album["artists"][0].get("id")
            if isinstance(aid, str) and aid not in artist_ids:
                artist_ids.append(aid)

    # Batch artist lookup for genres (up to 50)
    artist_genres_map = {}
    if artist_ids:
        try:
            artists_data = client.artists(access_token, artist_ids[:50])
            for a in artists_data:
                if isinstance(a, dict) and isinstance(a.get("id"), str) and isinstance(a.get("genres"), list):
                    artist_genres_map[a["id"]] = a["genres"]
        except Exception:
            logger.warning("Could not resolve artist genres during album sync", exc_info=True)

    normalized = [
        album
        for album in (
            normalize_saved_album_item(item, user.id, artist_genres_map)
            for item in raw_items
        )
        if album is not None
    ]
    page_is_full = len(raw_items) == SPOTIFY_SAVED_ALBUMS_LIMIT

    if normalized:
        submit_saved_albums_with_retries(backend_url, worker_token, user.id, normalized)

    if page_is_full:
        settings.saved_albums_backfill_offset = offset + len(raw_items)
    else:
        settings.saved_albums_backfill_offset = None
        settings.saved_albums_last_synced_at = _utc_now()

    session.commit()
    return len(normalized)


def fetch_pending_genre_artist_ids(backend_url: str, worker_token: str, limit: int) -> list[dict[str, object]]:
    response = requests.get(
        f"{backend_url.rstrip('/')}/spotify/internal/genre-cache/pending",
        headers={"X-Worker-Token": worker_token},
        params={"limit": limit},
        timeout=10,
    )
    response.raise_for_status()
    return response.json().get("items", [])


def submit_genre_cache_with_retries(backend_url: str, worker_token: str, items: list[dict[str, object]]):
    if not items:
        return
    url = f"{backend_url.rstrip('/')}/spotify/internal/genre-cache"
    headers = {"X-Worker-Token": worker_token}
    for attempt in range(3):
        response = requests.post(
            url,
            headers=headers,
            json={"items": items},
            timeout=10,
        )
        if response.status_code in (500, 502, 503, 504) and attempt < 2:
            time.sleep(2 ** attempt)
            continue
        response.raise_for_status()
        return




def _clean_genres(raw: object) -> list[str]:
    """Keeps only non-blank strings from a genre list, without repeats."""
    if not isinstance(raw, list):
        return []
    cleaned: list[str] = []
    for genre in raw:
        if isinstance(genre, str) and genre.strip() and genre.strip() not in cleaned:
            cleaned.append(genre.strip())
    return cleaned


def _lookup_spotify_genres(client: SpotifyClient, access_token: str, artist_id: str) -> tuple[str, list[str]]:
    """Asks Spotify for one artist's genres.

    Returns ("answered", genres) when Spotify replied (genres may be empty, and an artist
    Spotify no longer has counts as answered), ("rate_limited", []) when Spotify is
    blocking the app, or ("unavailable", []) for any other error."""
    try:
        artist = client.artist(access_token, artist_id)
    except SpotifyRateLimitedError:
        return "rate_limited", []
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 404:
            return "answered", []
        return "unavailable", []
    except requests.RequestException:
        return "unavailable", []
    return "answered", _clean_genres(artist.get("genres"))


def backfill_artist_genres(
    client: SpotifyClient,
    backend_url: str,
    worker_token: str,
    access_token: str | None,
    musicbrainz: MusicBrainzClient | None = None,
    max_items: int = MAX_GENRE_LOOKUPS_PER_RUN,
    sleep=time.sleep,
) -> dict[str, int]:
    """Fills genre_cache: Spotify first, MusicBrainz for artists Spotify has no genres for.

    Spotify's Development Mode removed the batch artist call, so each artist is a
    separate request. The run is capped and spaced out. A rate-limit response ends the
    Spotify lookups for the run (MusicBrainz carries on), and so does having no Spotify
    token (access_token None). MusicBrainz is capped much lower, because it allows
    about one request a second, and an outage stops it for the rest of the run.

    An artist is only saved as "no genres" once every source that is switched on has
    given a real answer. If a source was down, the artist is left to be tried again."""
    stats = {"processed": 0, "resolved": 0, "failures": 0, "from_spotify": 0, "from_musicbrainz": 0}
    spotify_usable = access_token is not None
    musicbrainz_usable = musicbrainz is not None
    spotify_calls = 0
    musicbrainz_lookups = 0
    try:
        pending = fetch_pending_genre_artist_ids(
            backend_url, worker_token, limit=min(max_items, MAX_GENRE_LOOKUPS_PER_RUN)
        )
        if not pending:
            return stats

        resolved_items = []

        for item in pending:
            artist_id = item["artist_spotify_id"]
            artist_name = item.get("artist_name")
            spotify_status, genres = "skipped", []

            if spotify_usable:
                if spotify_calls:
                    sleep(GENRE_LOOKUP_SPACING_SECONDS)
                spotify_calls += 1
                spotify_status, genres = _lookup_spotify_genres(client, access_token, artist_id)
                if spotify_status == "rate_limited":
                    spotify_usable = False
                    logger.warning("Genre cache backfill: Spotify is rate-limiting this app, using MusicBrainz only")
                    if musicbrainz is None:
                        break

            musicbrainz_answered = False
            if genres:
                stats["from_spotify"] += 1
            elif musicbrainz_usable:
                if musicbrainz_lookups >= MAX_MUSICBRAINZ_LOOKUPS_PER_RUN:
                    # Out of MusicBrainz requests for this run: leave this artist and the rest for the next one.
                    break
                musicbrainz_lookups += 1
                try:
                    genres = musicbrainz.lookup_genres(artist_id, artist_name)
                    musicbrainz_answered = True
                except MusicBrainzUnavailableError as exc:
                    musicbrainz_usable = False
                    logger.warning("Genre cache backfill: MusicBrainz unavailable (%s), skipping it for this run", exc)
                if genres:
                    stats["from_musicbrainz"] += 1
            elif not spotify_usable:
                # Neither source can be asked any more this run.
                break

            stats["processed"] += 1
            if genres:
                resolved_items.append({"artist_spotify_id": artist_id, "genres": genres})
            elif spotify_status == "answered" and (musicbrainz is None or musicbrainz_answered):
                # Every source switched on has answered and none has genres: record that, so the
                # artist isn't asked about again straight away.
                resolved_items.append({"artist_spotify_id": artist_id, "genres": []})
            elif spotify_status not in ("rate_limited", "skipped"):
                # Spotify (or MusicBrainz) had an error, so this artist is tried again next run.
                stats["failures"] += 1

        # Only write artists we successfully resolved — do NOT write a fallback
        # genres=[] for artists where the API call failed.
        if resolved_items:
            submit_genre_cache_with_retries(backend_url, worker_token, resolved_items)
        stats["resolved"] = len(resolved_items)
    except Exception:
        logger.exception("Genre cache backfill failed unexpectedly")
        stats["failures"] += 1
    return stats

