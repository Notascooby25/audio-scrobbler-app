from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from pywebpush import WebPushException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import notifications as notifications_module
from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import Notification, PushSubscription, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)

client = TestClient(app)

KEYS_SET = replace(
    notifications_module.settings,
    vapid_public_key="pub",
    vapid_private_key="priv",
    vapid_subject="mailto:owner@example.org",
)
KEYS_MISSING = replace(notifications_module.settings, vapid_public_key="", vapid_private_key="")


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def setup_function():
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSession()
    db.query(PushSubscription).delete()
    db.query(Notification).delete()
    db.query(User).delete()
    user = User(
        spotify_user_id="push_user",
        username="push_user",
        display_name="Push",
        refresh_token_cipher="cipher",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user.id)
    db.close()


def teardown_function():
    app.dependency_overrides.clear()


def _add_subscription() -> int:
    db = TestingSession()
    user = db.query(User).one()
    sub = PushSubscription(user_id=user.id, endpoint="https://fcm.googleapis.com/x", p256dh="p", auth="a")
    db.add(sub)
    db.commit()
    sub_id = sub.id
    db.close()
    return sub_id


def _count(model) -> int:
    db = TestingSession()
    try:
        return db.query(model).count()
    finally:
        db.close()


def test_reports_missing_keys_with_a_clear_message():
    with patch.object(notifications_module, "settings", KEYS_MISSING):
        body = client.post("/notifications/push/test").json()
    assert body["status"] == "error"
    assert "VAPID" in body["message"]


def test_reports_no_registered_devices():
    with patch.object(notifications_module, "settings", KEYS_SET):
        body = client.post("/notifications/push/test").json()
    assert body == {"status": "error", "message": "No active subscriptions found"}


def test_success_uses_configured_contact_address():
    _add_subscription()
    with patch.object(notifications_module, "settings", KEYS_SET), patch.object(
        notifications_module, "webpush"
    ) as mock_webpush:
        body = client.post("/notifications/push/test").json()
    assert body == {"status": "ok", "sent_to": 1}
    assert mock_webpush.call_args.kwargs["vapid_claims"] == {"sub": "mailto:owner@example.org"}
    assert _count(Notification) == 1


def test_expired_device_is_removed_and_reported_as_error():
    _add_subscription()
    gone = WebPushException("gone", response=SimpleNamespace(status_code=410))
    with patch.object(notifications_module, "settings", KEYS_SET), patch.object(
        notifications_module, "webpush", side_effect=gone
    ):
        body = client.post("/notifications/push/test").json()
    assert body["status"] == "error"
    assert body["sent_to"] == 0
    assert "expired" in body["message"]
    assert _count(PushSubscription) == 0
    assert _count(Notification) == 0


def test_other_failure_keeps_the_device_and_reports_error():
    _add_subscription()
    rejected = WebPushException("nope", response=SimpleNamespace(status_code=403))
    with patch.object(notifications_module, "settings", KEYS_SET), patch.object(
        notifications_module, "webpush", side_effect=rejected
    ):
        body = client.post("/notifications/push/test").json()
    assert body["status"] == "error"
    assert "rejected" in body["message"]
    assert _count(PushSubscription) == 1


def test_default_contact_address_when_unset():
    assert notifications_module.settings.vapid_subject.startswith("mailto:")


def test_unsubscribe_removes_only_that_device_for_that_user():
    _add_subscription()
    db = TestingSession()
    other = User(spotify_user_id="other", username="other", display_name="O", refresh_token_cipher="c", is_active=True)
    db.add(other)
    db.commit()
    db.add(PushSubscription(user_id=other.id, endpoint="https://fcm.googleapis.com/x", p256dh="p", auth="a"))
    db.commit()
    db.close()

    resp = client.post("/notifications/push/unsubscribe", json={"endpoint": "https://fcm.googleapis.com/x"})

    assert resp.json() == {"status": "unsubscribed"}
    assert _count(PushSubscription) == 1  # the other user's device with the same endpoint survives
