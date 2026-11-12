"""Sends a phone (web push) notification alongside an in-app bell notification."""

from __future__ import annotations

import json
import logging
import threading

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select

from ..config import settings
from ..db import SessionLocal
from ..models import PushSubscription

logger = logging.getLogger(__name__)

# HTTP statuses a push service returns when a device registration is permanently gone.
EXPIRED_PUSH_STATUS_CODES = (404, 410)


def queue_push(user_id: int, title: str, body: str, url: str = "/") -> None:
    """Sends a push to every device the user has signed up, without slowing the caller.

    Call this after the notification row has been committed. It never raises: a failed
    push must not break the action that caused it."""
    if not (settings.vapid_private_key and settings.vapid_public_key):
        return
    threading.Thread(target=_deliver, args=(user_id, title, body, url), daemon=True).start()


def _deliver(user_id: int, title: str, body: str, url: str) -> None:
    db = SessionLocal()
    try:
        subs = db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id)).all()
        expired: list[int] = []
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=json.dumps({"title": title, "body": body, "url": url}),
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_subject},
                )
            except WebPushException as exc:
                logger.warning("WebPush failed for subscription %s: %s", sub.id, exc)
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code in EXPIRED_PUSH_STATUS_CODES:
                    expired.append(sub.id)
            except Exception:
                # One bad device (e.g. a malformed key) must not stop the user's other devices.
                logger.exception("Unexpected error sending push to subscription %s", sub.id)
        if expired:
            db.execute(delete(PushSubscription).where(PushSubscription.id.in_(expired)))
            db.commit()
    except Exception:
        logger.exception("Could not send push notification to user %s", user_id)
    finally:
        db.close()
