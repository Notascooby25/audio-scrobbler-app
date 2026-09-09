from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import jwt

from backend.app.config import settings
from backend.app.models import User
from backend.app.security import decrypt_refresh_token
from backend.app.services import spotify_oauth_service


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
    def __init__(self, payload):
        self.payload = payload

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