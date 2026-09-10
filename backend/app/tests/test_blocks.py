from __future__ import annotations

from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import blocks as blocks_module
from backend.app.db import Base
from backend.app.main import app
from backend.app.models import BlockedItem, ListeningEvent, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)


class DemoUser:
    id = 1


def _seed(db):
    db.query(BlockedItem).delete()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()
    db.add(User(id=1, spotify_user_id="demo", username="demo", display_name="Demo", refresh_token_cipher="c", is_active=True))
    now = datetime.utcnow()
    rows = [
        ("Football Weekly", "The Guardian", "Football Weekly Podcast", 1),
        ("Football Weekly Extra", "The Guardian", "Football Weekly Podcast", 2),
        ("Slow Show", "The National", "Boxer", 3),
        ("Intro", "The xx", "xx", 4),
        ("Intro", "M83", "Saturdays = Youth", 5),
    ]
    for track, artist, album, offset in rows:
        db.add(ListeningEvent(
            user_id=1,
            track_id=f"track-{offset}",
            track_name=track,
            artist_name=artist,
            album_name=album,
            played_at=now - timedelta(hours=offset),
            source="youtube",
            play_id=f"track-{offset}",
        ))
    db.commit()


def setup_function():
    db = TestingSession()
    _seed(db)
    app.dependency_overrides[blocks_module.get_db] = lambda: db
    app.dependency_overrides[blocks_module.get_current_user] = lambda: DemoUser()


def teardown_function():
    app.dependency_overrides.clear()


def test_block_album_hides_matching_events_case_insensitively():
    response = client.post("/users/me/blocks", json={"entity_type": "album", "name": "football weekly podcast"})

    assert response.status_code == 201
    assert response.json()["hidden_count"] == 2

    db = TestingSession()
    from backend.app.queries.analytics_queries import build_recent_scrobbles_query
    visible = db.execute(build_recent_scrobbles_query(1, 50, 0)).all()
    assert {row.track_name for row in visible} == {"Slow Show", "Intro"}
    db.close()


def test_block_is_idempotent_and_listed():
    first = client.post("/users/me/blocks", json={"entity_type": "artist", "name": "The Guardian"})
    second = client.post("/users/me/blocks", json={"entity_type": "artist", "name": "the guardian"})

    assert first.status_code == 201
    assert second.status_code == 201
    listing = client.get("/users/me/blocks")
    assert len(listing.json()["blocks"]) == 1


def test_unblock_restores_visibility():
    created = client.post("/users/me/blocks", json={"entity_type": "artist", "name": "The Guardian"}).json()

    response = client.delete(f"/users/me/blocks/{created['block']['id']}")

    assert response.status_code == 204
    db = TestingSession()
    from backend.app.queries.analytics_queries import build_library_count_query
    assert db.execute(build_library_count_query(1)).scalar_one() == 5
    db.close()


def test_block_rejects_unknown_entity_type():
    response = client.post("/users/me/blocks", json={"entity_type": "playlist", "name": "Anything"})
    assert response.status_code == 400


def test_delete_track_entries_requires_artist_match():
    response = client.post("/library/delete-entries", json={"entity_type": "track", "name": "Intro", "secondary": "The xx"})

    assert response.status_code == 200
    assert response.json()["deleted"] == 1

    db = TestingSession()
    remaining = {row.artist_name for row in db.query(ListeningEvent).filter(ListeningEvent.track_name == "Intro").all()}
    assert remaining == {"M83"}
    db.close()


def test_delete_artist_entries_removes_all_matching():
    response = client.post("/library/delete-entries", json={"entity_type": "artist", "name": "the guardian"})

    assert response.status_code == 200
    assert response.json()["deleted"] == 2
