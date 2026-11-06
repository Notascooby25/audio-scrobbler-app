from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.services.youtube_service import resolve_channel_info
from backend.app.schemas.notifications import PushSubscriptionCreate


def test_youtube_channel_lookup_rejects_internal_urls():
    with pytest.raises(ValueError, match="Only YouTube URLs"):
        resolve_channel_info("http://127.0.0.1:8000/admin")

    with pytest.raises(ValueError, match="Only YouTube URLs"):
        resolve_channel_info("http://192.168.1.1/secret")

    with pytest.raises(ValueError, match="Only YouTube URLs"):
        resolve_channel_info("http://sleep_backend:8000/metrics")

    with pytest.raises(ValueError, match="Only YouTube URLs"):
        resolve_channel_info("https://example.com/exploit")


def test_push_subscription_rejects_non_https_and_untrusted_domains():
    with pytest.raises(ValidationError):
        PushSubscriptionCreate(
            endpoint="http://fcm.googleapis.com/fcm/send/123",
            p256dh="key",
            auth="auth",
        )

    with pytest.raises(ValidationError):
        PushSubscriptionCreate(
            endpoint="https://attacker.com/steal-push",
            p256dh="key",
            auth="auth",
        )

    with pytest.raises(ValidationError):
        PushSubscriptionCreate(
            endpoint="https://192.168.1.50:8000/probe",
            p256dh="key",
            auth="auth",
        )


def test_push_subscription_accepts_valid_providers():
    valid = PushSubscriptionCreate(
        endpoint="https://fcm.googleapis.com/fcm/send/test-token",
        p256dh="key123",
        auth="auth123",
    )
    assert valid.endpoint == "https://fcm.googleapis.com/fcm/send/test-token"

    mozilla = PushSubscriptionCreate(
        endpoint="https://updates.push.services.mozilla.com/wpush/v2/test-token",
        p256dh="key123",
        auth="auth123",
    )
    assert mozilla.endpoint.startswith("https://updates.push.services.mozilla.com")
