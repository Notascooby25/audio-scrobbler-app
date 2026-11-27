from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import users as users_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import Follow, ListeningEvent, Notification, User
from backend.app.services import social_service

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
# Mirrors backend/app/db.py: no autocommit and no autoflush, as in production.
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)

HEADERS = {"Authorization": "Bearer test"}
WHOLE_YEAR = {"start_date": "2026-01-01T00:00:00Z", "end_date": "2026-12-31T23:59:59Z"}


class SharerUser:
    id = 1
    spotify_user_id = "sharer"
    display_name = "Sharer"
    username = "sharer"


def _seed(db, *, sharer_follows_recipient: bool = True):
    db.query(Notification).delete()
    db.query(Follow).delete()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()
    db.add(
        User(
            id=1,
            spotify_user_id="sharer",
            username="sharer",
            display_name="Sharer",
            refresh_token_cipher="c",
            is_active=True,
        )
    )
    db.add(
        User(
            id=2,
            spotify_user_id="recipient",
            username="recipient",
            display_name="Recipient",
            refresh_token_cipher="c",
            is_active=True,
        )
    )
    db.add(
        User(
            id=3,
            spotify_user_id="other",
            username="other",
            display_name="Other",
            refresh_token_cipher="c",
            is_active=True,
        )
    )
    db.add(
        User(
            id=4,
            spotify_user_id="gone",
            username="gone",
            display_name="Gone",
            refresh_token_cipher="c",
            is_active=False,
        )
    )
    if sharer_follows_recipient:
        db.add(Follow(follower_id=1, followee_id=2))
    db.commit()


def _play(db, user_id: int, play_id: str, when: datetime, track: str = "Slow Show") -> None:
    db.add(
        ListeningEvent(
            user_id=user_id,
            track_id=play_id,
            track_name=track,
            artist_name="The National",
            album_name="Trouble Will Find Me",
            played_at=when,
            source="spotify",
            play_id=play_id,
        )
    )
    db.commit()


def _post(db, user_id: int, body: dict):
    app.dependency_overrides[users_module.get_db] = lambda: db
    app.dependency_overrides[users_module.get_current_user] = lambda: SharerUser()
    try:
        return client.post(f"/users/{user_id}/share-scrobbles", json=body, headers=HEADERS)
    finally:
        app.dependency_overrides.clear()


def test_share_requires_authentication():
    response = client.post("/users/2/share-scrobbles", json=WHOLE_YEAR)
    assert response.status_code == 401


def test_share_adds_my_plays_to_their_history():
    db = TestingSession()
    try:
        _seed(db)
        _play(db, 1, "car-1", datetime(2026, 11, 26, 18, 30), "Car Song")
        response = _post(db, 2, WHOLE_YEAR)
        theirs = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2).all()
        mine = db.query(ListeningEvent).filter(ListeningEvent.user_id == 1).all()
    finally:
        db.close()

    assert response.status_code == 200
    assert response.json()["shared_count"] == 1
    assert [e.track_name for e in theirs] == ["Car Song"]
    assert theirs[0].played_at == datetime(2026, 11, 26, 18, 30)
    assert len(mine) == 1  # my own history is untouched


def test_share_only_includes_plays_inside_the_range():
    db = TestingSession()
    try:
        _seed(db)
        _play(db, 1, "inside", datetime(2026, 11, 26, 18, 30))
        _play(db, 1, "before", datetime(2026, 11, 26, 16, 0))
        _play(db, 1, "after", datetime(2026, 11, 26, 21, 0))
        response = _post(db, 2, {"start_date": "2026-11-26T18:00:00Z", "end_date": "2026-11-26T20:00:00Z"})
        theirs = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2).all()
    finally:
        db.close()

    assert response.json()["shared_count"] == 1
    assert [e.play_id for e in theirs] == ["inside"]


def test_share_skips_plays_they_already_have_and_does_not_notify_again():
    db = TestingSession()
    try:
        _seed(db)
        _play(db, 1, "car-1", datetime(2026, 11, 26, 18, 30))
        _post(db, 2, WHOLE_YEAR)
        second = _post(db, 2, WHOLE_YEAR)
        theirs = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2).all()
        notifications = db.query(Notification).filter(Notification.user_id == 2).all()
    finally:
        db.close()

    assert second.status_code == 200
    assert second.json()["shared_count"] == 0
    assert len(theirs) == 1
    assert len(notifications) == 1


def test_share_skips_a_play_they_have_under_a_different_play_id():
    """The table forbids one track twice at the same moment, so this must be skipped, not crash."""
    db = TestingSession()
    try:
        _seed(db)
        moment = datetime(2026, 11, 26, 18, 30)
        _play(db, 1, "same-song", moment)
        db.add(
            ListeningEvent(
                user_id=2,
                track_id="same-song",
                track_name="Slow Show",
                artist_name="The National",
                played_at=moment,
                source="spotify_import",
                play_id="a-different-id",
            )
        )
        _play(db, 1, "other-song", datetime(2026, 11, 26, 18, 40))
        response = _post(db, 2, WHOLE_YEAR)
        theirs = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2).all()
    finally:
        db.close()

    assert response.status_code == 200
    assert response.json()["shared_count"] == 1
    assert sorted(e.track_id for e in theirs) == ["other-song", "same-song"]


def test_share_checks_every_play_id_when_the_range_needs_several_lookups(monkeypatch):
    """Postgres rejects one query with over 65,535 values, so lookups go in batches.

    The batch size is shrunk so a handful of plays spans several batches. Two of the recipient's
    rows share a play id but sit at a different time, so only the play-id lookup can catch them.
    """
    monkeypatch.setattr(social_service, "PLAY_ID_LOOKUP_BATCH", 2)
    db = TestingSession()
    try:
        _seed(db)
        for n in range(1, 6):
            _play(db, 1, f"p{n}", datetime(2026, 11, 26, 18, n))
        for n in (1, 4):
            db.add(
                ListeningEvent(
                    user_id=2,
                    track_id=f"their-track-{n}",
                    track_name="Other",
                    artist_name="Other",
                    played_at=datetime(2026, 5, 1, 9, n),
                    source="spotify",
                    play_id=f"p{n}",
                )
            )
        db.commit()
        response = _post(db, 2, WHOLE_YEAR)
        added = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2, ListeningEvent.track_id.like("p%")).all()
    finally:
        db.close()

    assert response.status_code == 200
    assert response.json()["shared_count"] == 3
    assert sorted(e.play_id for e in added) == ["p2", "p3", "p5"]


def test_share_does_not_pull_their_plays_into_my_history():
    db = TestingSession()
    try:
        _seed(db)
        _play(db, 2, "theirs-only", datetime(2026, 11, 26, 18, 30))
        response = _post(db, 2, WHOLE_YEAR)
        mine = db.query(ListeningEvent).filter(ListeningEvent.user_id == 1).all()
    finally:
        db.close()

    assert response.json()["shared_count"] == 0
    assert mine == []


def test_share_requires_following_the_recipient():
    db = TestingSession()
    try:
        _seed(db, sharer_follows_recipient=False)
        _play(db, 1, "car-1", datetime(2026, 11, 26, 18, 30))
        response = _post(db, 2, WHOLE_YEAR)
        theirs = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2).all()
    finally:
        db.close()

    assert response.status_code == 403
    assert theirs == []


def test_being_followed_by_the_recipient_is_not_enough():
    db = TestingSession()
    try:
        _seed(db, sharer_follows_recipient=False)
        db.add(Follow(follower_id=2, followee_id=1))  # they follow me, I do not follow them
        db.commit()
        _play(db, 1, "car-1", datetime(2026, 11, 26, 18, 30))
        response = _post(db, 2, WHOLE_YEAR)
    finally:
        db.close()

    assert response.status_code == 403


def test_share_with_yourself_is_rejected():
    db = TestingSession()
    try:
        _seed(db)
        response = _post(db, 1, WHOLE_YEAR)
    finally:
        db.close()

    assert response.status_code == 400


def test_share_with_inactive_or_unknown_user_is_404():
    db = TestingSession()
    try:
        _seed(db)
        db.add(Follow(follower_id=1, followee_id=4))
        db.commit()
        inactive = _post(db, 4, WHOLE_YEAR)
        unknown = _post(db, 999, WHOLE_YEAR)
    finally:
        db.close()

    assert inactive.status_code == 404
    assert unknown.status_code == 404


def test_share_rejects_an_end_before_the_start():
    db = TestingSession()
    try:
        _seed(db)
        _play(db, 1, "car-1", datetime(2026, 11, 26, 18, 30))
        response = _post(db, 2, {"start_date": "2026-11-26T20:00:00Z", "end_date": "2026-11-26T18:00:00Z"})
        theirs = db.query(ListeningEvent).filter(ListeningEvent.user_id == 2).all()
    finally:
        db.close()

    assert response.status_code == 422
    assert theirs == []


def test_share_tells_the_recipient_who_added_how_many():
    db = TestingSession()
    try:
        _seed(db)
        _play(db, 1, "car-1", datetime(2026, 11, 26, 18, 30))
        _play(db, 1, "car-2", datetime(2026, 11, 26, 18, 40))
        _post(db, 2, WHOLE_YEAR)
        notes = db.query(Notification).all()
    finally:
        db.close()

    assert len(notes) == 1
    assert notes[0].user_id == 2
    assert notes[0].message == "Sharer added 2 scrobbles to your history"
    assert notes[0].link == "/profile/1"


def test_nothing_shared_means_no_notification():
    db = TestingSession()
    try:
        _seed(db)
        response = _post(db, 2, WHOLE_YEAR)
        notes = db.query(Notification).all()
    finally:
        db.close()

    assert response.json()["shared_count"] == 0
    assert notes == []
