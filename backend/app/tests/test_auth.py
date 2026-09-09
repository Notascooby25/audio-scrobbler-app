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
