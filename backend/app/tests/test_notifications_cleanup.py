from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import Notification, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSession()
    db.query(Notification).delete()
    db.query(User).delete()
    db.commit()
    db.close()


def test_delete_single_notification():
    db = TestingSession()
    user = User(spotify_user_id="user_notif", username="user_notif", display_name="Test", refresh_token_cipher="test_cipher", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    n1 = Notification(user_id=user.id, title="N1", message="M1")
    n2 = Notification(user_id=user.id, title="N2", message="M2")
    db.add_all([n1, n2])
    db.commit()
    db.refresh(n1)
    db.refresh(n2)
    n1_id = n1.id
    n2_id = n2.id
    user_id = user.id

    app.dependency_overrides[get_current_user] = lambda: db.get(User, user_id)

    resp = client.delete(f"/notifications/{n1_id}")
    assert resp.status_code == 200

    db = TestingSession()
    remaining = db.scalars(select(Notification).where(Notification.user_id == user.id)).all()
    assert len(remaining) == 1
    assert remaining[0].id == n2_id
    db.close()


def test_clear_read_notifications():
    db = TestingSession()
    user = User(spotify_user_id="user_notif_2", username="user_notif_2", display_name="Test2", refresh_token_cipher="test_cipher", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    n_unread = Notification(user_id=user.id, title="Unread", message="Keep me", is_read=False)
    n_read = Notification(user_id=user.id, title="Read", message="Delete me", is_read=True)
    db.add_all([n_unread, n_read])
    db.commit()
    db.refresh(n_unread)
    db.refresh(n_read)
    n_unread_id = n_unread.id
    user_id = user.id

    app.dependency_overrides[get_current_user] = lambda: db.get(User, user_id)

    resp = client.delete("/notifications?read_only=true")
    assert resp.status_code == 200

    db = TestingSession()
    remaining = db.scalars(select(Notification).where(Notification.user_id == user.id)).all()
    assert len(remaining) == 1
    assert remaining[0].id == n_unread_id
    db.close()
