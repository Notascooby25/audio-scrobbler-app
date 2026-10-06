import json
import logging
from pywebpush import webpush, WebPushException
from app.db import SessionLocal
from app.models import PushSubscription, Notification
from app.config import settings

logging.basicConfig(level=logging.INFO)

def send_test_push(user_id=1):
    db = SessionLocal()
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subs:
        print(f"No push subscriptions found for user {user_id}")
        return

    print(f"Found {len(subs)} subscriptions. Sending test push...")

    # Also create an in-app notification so the bell updates
    notif = Notification(
        user_id=user_id,
        title="Test Notification",
        message="This is a test to verify your push setup is working!",
        type="system"
    )
    db.add(notif)
    db.commit()

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                },
                data=json.dumps({
                    "title": "Audio Scrobbler",
                    "body": "It works! Your push notifications are successfully configured.",
                    "url": "/settings?tab=notifications"
                }),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": "mailto:admin@localhost"}
            )
            print("Successfully sent push notification!")
        except WebPushException as ex:
            print("I'm sorry, but I couldn't send the push notification.", repr(ex))
            if ex.response and ex.response.text:
                print(ex.response.text)
