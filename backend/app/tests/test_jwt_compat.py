"""Guards the sign-in tokens across PyJWT upgrades.

LEGACY_TOKEN was minted once with PyJWT 2.9.0 (the version before the upgrade) using the
throwaway TEST_SECRET below and an expiry in the year 2100. If a newer PyJWT ever stops
accepting it, everyone who is signed in right now would be signed out.
"""

from __future__ import annotations

import warnings
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from backend.app.config import settings
from backend.app.services import auth_service

TEST_SECRET = (
    "compat-test-secret-0123456789abcdef0123456789abcdef0123456789"  # not a real secret, test only  # gitleaks:allow
)
LEGACY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImV4cCI6NDEwMjQ0NDgwMH0.jm46NHA50Ruq6x_P4WPGqTjg87hiJ2O043BGvJnvjlk"  # gitleaks:allow


@pytest.fixture
def long_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_service, "settings", replace(settings, jwt_secret=TEST_SECRET))


def test_token_minted_by_the_old_pyjwt_still_signs_you_in(long_secret: None):
    assert auth_service.decode_access_token(LEGACY_TOKEN) == 42


def test_new_tokens_use_a_string_subject_and_round_trip(long_secret: None):
    token = auth_service.create_access_token(7)
    claims = jwt.decode(token, TEST_SECRET, algorithms=["HS256"])
    assert claims["sub"] == "7"
    assert auth_service.decode_access_token(token) == 7


def test_a_production_length_secret_raises_no_warnings(long_secret: None):
    with warnings.catch_warnings():
        warnings.simplefilter("error")  # any warning, such as a short-key warning, fails the test
        token = auth_service.create_access_token(7)
        assert auth_service.decode_access_token(token) == 7


@pytest.mark.parametrize("bad", ["", "not-a-token", LEGACY_TOKEN[:-4] + "AAAA", LEGACY_TOKEN + "x"])
def test_garbage_and_tampered_tokens_are_rejected(long_secret: None, bad: str):
    with pytest.raises(jwt.InvalidTokenError):
        auth_service.decode_access_token(bad)


def test_a_token_signed_with_another_secret_is_rejected(long_secret: None):
    forged = jwt.encode(
        {"sub": "42", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "x" * 64, algorithm="HS256"
    )
    with pytest.raises(jwt.InvalidTokenError):
        auth_service.decode_access_token(forged)


def test_a_token_that_asks_for_no_signature_is_rejected(long_secret: None):
    unsigned = jwt.encode({"sub": "42", "exp": 4102444800}, None, algorithm="none")
    with pytest.raises(jwt.InvalidTokenError):
        auth_service.decode_access_token(unsigned)
