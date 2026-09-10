from __future__ import annotations

from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import analytics as analytics_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import Follow, ListeningEvent, User

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class ViewerUser:
    id = 1
    spotify_user_id = "viewer"


def _seed(db):
    db.query(Follow).delete()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()
    db.add(User(id=1, spotify_user_id="viewer", username="viewer", display_name="Viewer", refresh_token_cipher="c", is_active=True))
    db.add(User(id=2, spotify_user_id="target", username="music-fan", display_name="Music Fan", refresh_token_cipher="c", is_active=True))
    db.commit()

    now = datetime.utcnow()
    events = [
        ("The National", "Slow Show", "Trouble Will Find Me", now - timedelta(days=1)),
        ("The National", "Slow Show", "Trouble Will Find Me", now - timedelta(days=2)),
        ("The National", "Bloodbuzz Ohio", "High Violet", now - timedelta(days=3)),
        ("M83", "Midnight City", "Hurry Up, We're Dreaming", now - timedelta(days=400)),
    ]
    for index, (artist, track, album, played_at) in enumerate(events):
        db.add(
            ListeningEvent(
                user_id=2,
                track_id=f"track-{index}",
                track_name=track,
                artist_name=artist,
                album_name=album,
                played_at=played_at,
                source="spotify",
                play_id=f"track-{index}",
            )
        )
    db.commit()


def test_charts_requires_authentication():
    response = client.get("/analytics/charts/2")
    assert response.status_code == 401


def test_charts_forbidden_for_non_followers():
    db = TestingSession()
    _seed(db)
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/analytics/charts/2", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 403


def test_charts_returns_404_for_unknown_user():
    db = TestingSession()
    _seed(db)
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/analytics/charts/999", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 404


def test_charts_rejects_unsupported_entity_and_range():
    db = TestingSession()
    _seed(db)
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        bad_entity = client.get("/analytics/charts/2?entity=playlists", headers={"Authorization": "Bearer test"})
        bad_range = client.get("/analytics/charts/2?range=5year", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert bad_entity.status_code == 400
    assert bad_range.status_code == 400


def test_charts_returns_top_artists_for_followers():
    db = TestingSession()
    _seed(db)
    db.add(Follow(follower_id=1, followee_id=2))
    db.commit()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/analytics/charts/2?entity=artists&range=overall", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 200
    payload = response.json()
    assert payload["entity"] == "artists"
    assert payload["entries"][0] == {"label": "The National", "secondary": None, "play_count": 3}


def test_charts_range_filter_excludes_old_plays():
    db = TestingSession()
    _seed(db)
    db.add(Follow(follower_id=1, followee_id=2))
    db.commit()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/analytics/charts/2?entity=artists&range=12month", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    labels = [entry["label"] for entry in response.json()["entries"]]
    assert "M83" not in labels
    assert "The National" in labels


def test_charts_returns_top_albums_with_secondary_artist():
    db = TestingSession()
    _seed(db)
    db.add(Follow(follower_id=1, followee_id=2))
    db.commit()
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/analytics/charts/2?entity=albums&range=overall", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    entries = response.json()["entries"]
    top = next(entry for entry in entries if entry["label"] == "Trouble Will Find Me")
    assert top["secondary"] == "The National"
    assert top["play_count"] == 2


def test_charts_are_visible_to_owner_without_following():
    db = TestingSession()
    _seed(db)
    app.dependency_overrides[analytics_module.get_db] = lambda: db
    app.dependency_overrides[analytics_module.get_current_user] = lambda: ViewerUser()
    try:
        response = client.get("/analytics/charts/1?entity=artists&range=overall", headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.clear()
        db.close()

    assert response.status_code == 200
