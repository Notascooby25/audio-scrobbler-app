from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app.api import auth as auth_module
from backend.app.api import deps
from backend.app.config import settings
from backend.app.db import get_db
from backend.app.main import app
from backend.app.services.auth_service import create_access_token, decode_access_token
from backend.app.services import spotify_oauth_service as spotify_oauth_service_module


client = TestClient(app)


class ActiveUser:
    id = 1
    is_active = True


class InactiveUser:
    id = 1
    is_active = False


class Query:
    def __init__(self, user):
        self.user = user

    def filter(self, *args):
        return self

    def first(self):
        if self.user is not None and not self.user.is_active:
            return None
        return self.user


class FakeDB:
    def __init__(self, user):
        self.user = user

    def query(self, *args):
        return Query(self.user)


def test_access_token_round_trip():
    token = create_access_token(42)
    assert decode_access_token(token) == 42


def test_expired_access_token_is_rejected():
    token = jwt.encode(
        {"sub": "42", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )

    try:
        decode_access_token(token)
    except jwt.ExpiredSignatureError:
        pass
    else:
        raise AssertionError("Expired token was accepted")


def test_current_user_rejects_inactive_user():
    token = create_access_token(1)
    credentials = type("Credentials", (), {"credentials": token})()

    with pytest.raises(HTTPException) as error:
        deps.get_current_user(credentials, FakeDB(InactiveUser()))

    assert error.value.status_code == 401


def test_dev_token_endpoint_returns_signed_token():
    app.dependency_overrides[auth_module.get_db] = lambda: FakeDB(ActiveUser())
    response = client.post("/auth/dev-token", json={"user_id": 1})
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert decode_access_token(response.json()["access_token"]) == 1


def test_spotify_denial_returns_bad_request():
    response = client.get("/auth/spotify/callback?state=valid-state&error=access_denied")
    assert response.status_code == 400


def test_cors_origins_are_parsed_and_wildcards_rejected_in_production():
    development = type(settings)(cors_origins="http://localhost:5173, https://example.test")
    assert development.allowed_cors_origins() == ["http://localhost:5173", "https://example.test"]

    production = type(settings)(
        environment="production",
        jwt_secret="real-jwt-secret",
        refresh_token_key="real-refresh-secret",
        worker_ingestion_token="real-worker-token",
        database_url="postgresql+psycopg://user:password@db:5432/app",
        spotify_client_id="client",
        spotify_client_secret="secret",
        cors_origins="*",
    )
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        production.validate()


def test_allowed_spotify_ids_are_parsed_and_empty_means_unrestricted():
    unrestricted = type(settings)(allowed_spotify_user_ids="")
    assert unrestricted.allowed_spotify_ids() == []

    restricted = type(settings)(allowed_spotify_user_ids="andy46, 1127785962")
    assert restricted.allowed_spotify_ids() == ["andy46", "1127785962"]


def test_spotify_callback_denies_non_allowlisted_account():
    def deny(*args, **kwargs):
        raise spotify_oauth_service_module.SpotifyAccessDeniedError("someone-else")

    app.dependency_overrides[auth_module.get_db] = lambda: FakeDB(ActiveUser())
    monkeypatch_target = auth_module.complete_spotify_callback
    auth_module.complete_spotify_callback = deny
    try:
        response = client.get("/auth/spotify/callback?state=valid-state&code=some-code")
    finally:
        auth_module.complete_spotify_callback = monkeypatch_target
        app.dependency_overrides.clear()

    assert response.status_code == 403


def test_spotify_status_reports_not_rate_limited_by_default(monkeypatch):
    monkeypatch.setattr(auth_module, "spotify_rate_limit_blocked_until", lambda: None)

    response = client.get("/auth/spotify/status")

    assert response.status_code == 200
    assert response.json() == {"rate_limited": False, "retry_after": None}


def test_spotify_status_reports_rate_limited_until(monkeypatch):
    blocked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
    monkeypatch.setattr(auth_module, "spotify_rate_limit_blocked_until", lambda: blocked_until)

    response = client.get("/auth/spotify/status")

    assert response.status_code == 200
    assert response.json() == {"rate_limited": True, "retry_after": blocked_until.isoformat()}


def test_spotify_authorize_returns_429_while_rate_limited(monkeypatch):
    blocked_until = datetime.now(timezone.utc) + timedelta(minutes=5)
    monkeypatch.setattr(auth_module, "spotify_rate_limit_blocked_until", lambda: blocked_until)
    monkeypatch.setattr(auth_module, "settings", type(settings)(spotify_client_id="client-id"))

    response = client.get("/auth/spotify/authorize")

    assert response.status_code == 429
    assert "Retry-After" in response.headers


def test_spotify_callback_returns_429_when_rate_limited(monkeypatch):
    # Force the raise-HTTPException branch regardless of any locally configured
    # FRONTEND_AUTH_CALLBACK_URL, which would otherwise redirect instead.
    monkeypatch.setattr(auth_module, "settings", type(settings)(frontend_auth_callback_url=""))

    def blocked(*args, **kwargs):
        raise spotify_oauth_service_module.SpotifyRateLimitedError(datetime.now(timezone.utc) + timedelta(minutes=5))

    monkeypatch_target = auth_module.complete_spotify_callback
    auth_module.complete_spotify_callback = blocked
    try:
        response = client.get("/auth/spotify/callback?state=valid-state&code=some-code")
    finally:
        auth_module.complete_spotify_callback = monkeypatch_target

    assert response.status_code == 429
    assert "Retry-After" in response.headers
