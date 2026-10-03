from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Notification, PushSubscription, User
from ..api.deps import get_current_user
from ..schemas.notifications import NotificationResponse, PushSubscriptionCreate, UnreadCountResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return db.scalars(stmt).all()


@router.get("/unread_count", response_model=UnreadCountResponse)
def get_unread_count(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    count = len(db.scalars(stmt).all())
    return {"count": count}


@router.post("/mark_read")
def mark_notifications_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    db.execute(stmt)
    db.commit()
    return {"status": "ok"}


@router.post("/push/subscribe")
def subscribe_push(
    sub: PushSubscriptionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    stmt = select(PushSubscription).where(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == sub.endpoint
    )
    existing = db.scalar(stmt)
    if not existing:
        db.add(
            PushSubscription(
                user_id=current_user.id,
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
            )
        )
        db.commit()
    return {"status": "subscribed"}

@router.get("/push/vapid_public_key")
def get_vapid_public_key():
    from app.config import settings
    return {"vapid_public_key": settings.vapid_public_key}

@router.post("/push/test")
def test_push_notification(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    from pywebpush import webpush, WebPushException
    from app.config import settings
    import json
    
    if not settings.vapid_private_key:
        return {"status": "error", "message": "VAPID keys not configured on server"}
        
    subs = db.scalars(select(PushSubscription).where(PushSubscription.user_id == current_user.id)).all()
    if not subs:
        return {"status": "error", "message": "No active subscriptions found"}
        
    success = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}
                },
                data=json.dumps({
                    'title': 'Test Notification',
                    'body': 'This is a test notification from Audio Scrobbler!',
                    'url': '/settings?tab=notifications'
                }),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": "mailto:admin@example.com"}
            )
            success += 1
        except WebPushException as e:
            print(f"WebPush exception: {e}")
            
    # Also add it to the in-app notification bell list
    db.add(Notification(
        user_id=current_user.id,
        title="Test Notification",
        message="This is a test notification from Audio Scrobbler!",
        type="general"
    ))
    db.commit()
            
    return {"status": "ok", "sent_to": success}
