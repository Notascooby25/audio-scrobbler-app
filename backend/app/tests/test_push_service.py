from __future__ import annotations

import json
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch

from pywebpush import WebPushException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import PushSubscription, User
from backend.app.services import push_service

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)

KEYS_SET = replace(
    push_service.settings, vapid_public_key="pub", vapid_private_key="priv", vapid_subject="mailto:owner@example.org"
)
KEYS_MISSING = replace(push_service.settings, vapid_public_key="", vapid_private_key="")


def setup_function():
    db = TestingSession()
    db.query(PushSubscription).delete()
    db.query(User).delete()
    db.add(User(id=7, spotify_user_id="u7", username="u7", display_name="U7", refresh_token_cipher="c", is_active=True))
    db.add(User(id=8, spotify_user_id="u8", username="u8", display_name="U8", refresh_token_cipher="c", is_active=True))
    db.add(PushSubscription(user_id=7, endpoint="https://fcm.googleapis.com/a", p256dh="p", auth="a"))
    db.add(PushSubscription(user_id=7, endpoint="https://fcm.googleapis.com/b", p256dh="p", auth="a"))
    db.add(PushSubscription(user_id=8, endpoint="https://fcm.googleapis.com/c", p256dh="p", auth="a"))
    db.commit()
    db.close()


def _endpoints() -> set[str]:
    db = TestingSession()
    try:
        return {s.endpoint for s in db.query(PushSubscription)}
    finally:
        db.close()


def test_queue_push_does_nothing_without_keys():
    with patch.object(push_service, "settings", KEYS_MISSING), patch.object(push_service.threading, "Thread") as thread:
        push_service.queue_push(7, "T", "B", "/x")
    thread.assert_not_called()


def test_queue_push_runs_in_the_background_when_keys_are_set():
    with patch.object(push_service, "settings", KEYS_SET), patch.object(push_service.threading, "Thread") as thread:
        push_service.queue_push(7, "T", "B", "/x")
    thread.assert_called_once_with(target=push_service._deliver, args=(7, "T", "B", "/x"), daemon=True)
    thread.return_value.start.assert_called_once()


def test_deliver_sends_only_to_that_users_devices():
    with patch.object(push_service, "settings", KEYS_SET), patch.object(push_service, "SessionLocal", TestingSession), patch.object(
        push_service, "webpush"
    ) as send:
        push_service._deliver(7, "Title", "Body", "/play")

    assert send.call_count == 2
    sent_to = {call.kwargs["subscription_info"]["endpoint"] for call in send.call_args_list}
    assert sent_to == {"https://fcm.googleapis.com/a", "https://fcm.googleapis.com/b"}
    first = send.call_args_list[0].kwargs
    assert json.loads(first["data"]) == {"title": "Title", "body": "Body", "url": "/play"}
    assert first["vapid_claims"] == {"sub": "mailto:owner@example.org"}


def test_deliver_removes_devices_the_push_service_says_are_gone():
    gone = WebPushException("gone", response=SimpleNamespace(status_code=410))
    with patch.object(push_service, "settings", KEYS_SET), patch.object(push_service, "SessionLocal", TestingSession), patch.object(
        push_service, "webpush", side_effect=gone
    ):
        push_service._deliver(7, "T", "B", "/x")

    assert _endpoints() == {"https://fcm.googleapis.com/c"}


def test_deliver_keeps_devices_on_other_failures_and_never_raises():
    rejected = WebPushException("nope", response=SimpleNamespace(status_code=403))
    with patch.object(push_service, "settings", KEYS_SET), patch.object(push_service, "SessionLocal", TestingSession), patch.object(
        push_service, "webpush", side_effect=rejected
    ):
        push_service._deliver(7, "T", "B", "/x")

    assert len(_endpoints()) == 3


def test_one_broken_device_does_not_stop_the_others():
    calls = []

    def flaky(**kwargs):
        calls.append(kwargs["subscription_info"]["endpoint"])
        if kwargs["subscription_info"]["endpoint"].endswith("/a"):
            raise ValueError("malformed key")

    with patch.object(push_service, "settings", KEYS_SET), patch.object(push_service, "SessionLocal", TestingSession), patch.object(
        push_service, "webpush", side_effect=flaky
    ):
        push_service._deliver(7, "T", "B", "/x")

    assert len(calls) == 2
    assert len(_endpoints()) == 3
