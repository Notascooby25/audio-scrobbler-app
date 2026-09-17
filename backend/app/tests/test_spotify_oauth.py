from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import jwt
import pytest

from backend.app.config import settings
from backend.app.models import User
from backend.app.security import decrypt_refresh_token
from backend.app.services import spotify_oauth_service


@pytest.fixture(autouse=True)
def _reset_spotify_rate_limit(monkeypatch):
    monkeypatch.setattr(spotify_oauth_service, "_spotify_blocked_until", None)


class Query:
    def __init__(self, user=None):
        self.user = user

    def filter(self, *args):
        return self

    def first(self):
        return self.user


class FakeDB:
    def __init__(self):
        self.user = None
        self.commits = 0

    def query(self, *args):
        return Query(self.user)

    def add(self, user):
        self.user = user

    def commit(self):
        self.commits += 1

    def refresh(self, user):
        user.id = 17


class FakeResponse:
    def __init__(self, payload, status_code=200, headers=None):
        self.payload = payload
        self.status_code = status_code
        self.headers = headers or {}

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_oauth_state_is_signed_and_authorization_url_contains_state(monkeypatch):
    state = spotify_oauth_service.create_oauth_state()
    url = spotify_oauth_service.build_authorization_url(state)
    params = parse_qs(urlparse(url).query)

    spotify_oauth_service.validate_oauth_state(state)
    assert "client_id=" in url
    assert params["state"] == [state]
    assert "user-library-read" in params["scope"][0]


def test_oauth_state_rejects_tampering():
    state = spotify_oauth_service.create_oauth_state()
    tampered = f"{state}tampered"

    try:
        spotify_oauth_service.validate_oauth_state(tampered)
    except jwt.InvalidTokenError:
        pass
    else:
        raise AssertionError("Tampered OAuth state was accepted")


def test_callback_persists_encrypted_refresh_token(monkeypatch):
    responses = iter([
        FakeResponse({"access_token": "spotify-access", "refresh_token": "spotify-refresh"}),
        FakeResponse({"id": "spotify-user", "display_name": "Spotify User"}),
    ])
    monkeypatch.setattr(spotify_oauth_service.requests, "post", lambda *args, **kwargs: next(responses))
    monkeypatch.setattr(spotify_oauth_service.requests, "get", lambda *args, **kwargs: next(responses))
    db = FakeDB()

    token, user_id = spotify_oauth_service.complete_spotify_callback(
        db,
        "authorization-code",
        spotify_oauth_service.create_oauth_state(),
    )

    assert user_id == 17
    assert jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["sub"] == "17"
    assert isinstance(db.user, User)
    assert decrypt_refresh_token(db.user.refresh_token_cipher) == "spotify-refresh"
    assert db.commits == 1

def test_callback_rejects_spotify_id_not_on_allowlist(monkeypatch):
    monkeypatch.setattr(type(settings), "allowed_spotify_ids", lambda self: ["someone-else"])
    responses = iter([
        FakeResponse({"access_token": "spotify-access", "refresh_token": "spotify-refresh"}),
        FakeResponse({"id": "spotify-user", "display_name": "Spotify User"}),
    ])
    monkeypatch.setattr(spotify_oauth_service.requests, "post", lambda *args, **kwargs: next(responses))
    monkeypatch.setattr(spotify_oauth_service.requests, "get", lambda *args, **kwargs: next(responses))
    db = FakeDB()

    try:
        spotify_oauth_service.complete_spotify_callback(
            db,
            "authorization-code",
            spotify_oauth_service.create_oauth_state(),
        )
    except spotify_oauth_service.SpotifyAccessDeniedError:
        pass
    else:
        raise AssertionError("Non-allowlisted Spotify account was not rejected")
    assert db.commits == 0
    assert db.user is None


def test_callback_allows_spotify_id_on_allowlist(monkeypatch):
    monkeypatch.setattr(type(settings), "allowed_spotify_ids", lambda self: ["spotify-user"])
    responses = iter([
        FakeResponse({"access_token": "spotify-access", "refresh_token": "spotify-refresh"}),
        FakeResponse({"id": "spotify-user", "display_name": "Spotify User"}),
    ])
    monkeypatch.setattr(spotify_oauth_service.requests, "post", lambda *args, **kwargs: next(responses))
    monkeypatch.setattr(spotify_oauth_service.requests, "get", lambda *args, **kwargs: next(responses))
    db = FakeDB()

    token, user_id = spotify_oauth_service.complete_spotify_callback(
        db,
        "authorization-code",
        spotify_oauth_service.create_oauth_state(),
    )

    assert user_id == 17
    assert isinstance(db.user, User)


def test_callback_marks_rate_limited_on_429_token_exchange(monkeypatch):
    monkeypatch.setattr(
        spotify_oauth_service.requests,
        "post",
        lambda *args, **kwargs: FakeResponse({}, status_code=429, headers={"Retry-After": "120"}),
    )
    db = FakeDB()

    with pytest.raises(spotify_oauth_service.SpotifyRateLimitedError):
        spotify_oauth_service.complete_spotify_callback(db, "authorization-code", spotify_oauth_service.create_oauth_state())

    blocked_until = spotify_oauth_service.spotify_rate_limit_blocked_until()
    assert blocked_until is not None
    assert blocked_until > datetime.now(timezone.utc)
    assert db.commits == 0


def test_callback_skips_request_when_already_blocked(monkeypatch):
    monkeypatch.setattr(
        spotify_oauth_service, "_spotify_blocked_until", datetime.now(timezone.utc) + timedelta(minutes=10)
    )

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Spotify should not be contacted during an active rate-limit block")

    monkeypatch.setattr(spotify_oauth_service.requests, "post", _fail_if_called)
    db = FakeDB()

    with pytest.raises(spotify_oauth_service.SpotifyRateLimitedError):
        spotify_oauth_service.complete_spotify_callback(db, "authorization-code", spotify_oauth_service.create_oauth_state())
