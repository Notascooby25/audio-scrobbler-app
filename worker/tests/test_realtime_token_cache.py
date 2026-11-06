from __future__ import annotations

from unittest.mock import MagicMock
import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from worker.spotify_ingestion import (
    Base,
    UserRecord,
    ScrobbleSettingsRecord,
    SpotifyClient,
    sync_currently_playing,
    _REALTIME_ACCESS_TOKENS,
)

engine = create_engine("sqlite://")
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def test_realtime_sync_reuses_cached_access_token(monkeypatch):
    session = TestingSession()
    user = UserRecord(
        id=201,
        spotify_user_id="user-201",
        display_name="User 201",
        refresh_token_cipher="valid-cipher",
        is_active=True,
    )
    settings = ScrobbleSettingsRecord(
        user_id=201,
        poll_interval_minutes=5,
        liked_tracks_sync_enabled=False,
        saved_albums_sync_enabled=False,
        realtime_sync_enabled=True,
        scrobble_threshold_percent=50,
    )
    session.add(user)
    session.add(settings)
    session.commit()

    _REALTIME_ACCESS_TOKENS.clear()

    client = MagicMock(spec=SpotifyClient)
    client.refresh_token_key = "test-key"
    client.refresh_access_token.return_value = ("access-token-abc", None)
    client.currently_playing.return_value = None

    monkeypatch.setattr(
        "worker.spotify_ingestion.decrypt_refresh_token",
        lambda cipher, key: "plain-refresh-token",
    )

    # First call: must call refresh_access_token
    res1 = sync_currently_playing(session, user, settings, client, "http://backend:8000", "token")
    assert res1 is True
    assert client.refresh_access_token.call_count == 1

    # Second call immediately after: should reuse cached token and NOT call refresh_access_token again
    res2 = sync_currently_playing(session, user, settings, client, "http://backend:8000", "token")
    assert res2 is True
    assert client.refresh_access_token.call_count == 1, (
        "Expected access token to be cached in memory, but refresh_access_token was called again"
    )

    session.close()


def test_realtime_sync_refreshes_on_401(monkeypatch):
    session = TestingSession()
    user = UserRecord(
        id=202,
        spotify_user_id="user-202",
        display_name="User 202",
        refresh_token_cipher="valid-cipher-2",
        is_active=True,
    )
    settings = ScrobbleSettingsRecord(
        user_id=202,
        poll_interval_minutes=5,
        liked_tracks_sync_enabled=False,
        saved_albums_sync_enabled=False,
        realtime_sync_enabled=True,
        scrobble_threshold_percent=50,
    )
    session.add(user)
    session.add(settings)
    session.commit()

    _REALTIME_ACCESS_TOKENS.clear()

    client = MagicMock(spec=SpotifyClient)
    client.refresh_token_key = "test-key"
    client.refresh_access_token.return_value = ("access-token-new", None)

    # First call to currently_playing raises 401, second succeeds
    err_resp = MagicMock()
    err_resp.status_code = 401
    http_error_401 = requests.HTTPError("401 Unauthorized", response=err_resp)

    client.currently_playing.side_effect = [http_error_401, None]

    monkeypatch.setattr(
        "worker.spotify_ingestion.decrypt_refresh_token",
        lambda cipher, key: "plain-refresh-token",
    )

    res = sync_currently_playing(session, user, settings, client, "http://backend:8000", "token")
    assert res is True
    assert client.refresh_access_token.call_count == 2
    session.close()
