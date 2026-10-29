from __future__ import annotations

from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import AttendedConcert, Follow, GigCompanion, ListeningEvent, Notification, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
client = TestClient(app)

ANDY, SAM, JO, STRANGER = 1, 2, 3, 4
SONGS = {"set": [{"song": [{"name": "Pounding"}, {"name": "Black and White Town"}]}]}


def _db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def act_as(user_id: int) -> None:
    db = TestingSession()
    user = db.get(User, user_id)
    db.expunge(user)
    db.close()
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(autouse=True)
def people():
    app.dependency_overrides[get_db] = _db
    db = TestingSession()
    for model in (GigCompanion, Notification, ListeningEvent, AttendedConcert, Follow, User):
        db.query(model).delete()
    for uid, name in ((ANDY, "Andy"), (SAM, "Sam"), (JO, "Jo"), (STRANGER, "Stranger")):
        db.add(
            User(
                id=uid,
                spotify_user_id=f"sp{uid}",
                username=name.lower(),
                display_name=name,
                refresh_token_cipher="c",
                is_active=True,
            )
        )
    db.add_all([Follow(follower_id=ANDY, followee_id=SAM), Follow(follower_id=ANDY, followee_id=JO)])
    db.add_all(
        [
            _gig(ANDY, "doves1", "Doves", notes="Secret note"),
            _gig(ANDY, "supp1", "Support Band", support_of="doves1"),
        ]
    )
    db.commit()
    db.close()
    act_as(ANDY)
    yield
    app.dependency_overrides.clear()


def _gig(user_id: int, setlist_id: str, artist: str, support_of: str | None = None, **extra) -> AttendedConcert:
    return AttendedConcert(
        user_id=user_id,
        setlist_id=setlist_id,
        artist_name=artist,
        venue_name="Rock City",
        city="Nottingham",
        country="UK",
        event_date=datetime(2025, 5, 1),
        is_support_act=support_of is not None,
        parent_setlist_id=support_of,
        raw_data={"id": setlist_id, "sets": SONGS},
        song_count=2,
        **extra,
    )


def _gig_id(user_id: int, setlist_id: str = "doves1") -> int:
    db = TestingSession()
    gig_id = db.query(AttendedConcert.id).filter_by(user_id=user_id, setlist_id=setlist_id).scalar()
    db.close()
    return gig_id


def _invite(friend_ids: list[int]):
    return client.post(f"/setlists/attendances/{_gig_id(ANDY)}/companions", json={"friend_ids": friend_ids})


def test_you_can_only_add_people_you_follow():
    assert _invite([STRANGER]).status_code == 403
    assert _invite([ANDY]).status_code == 403
    # Another user's gig is invisible
    act_as(SAM)
    assert client.get(f"/setlists/attendances/{_gig_id(ANDY)}/companions").status_code == 404
    assert _invite([ANDY]).status_code == 404


def test_inviting_lists_them_and_notifies_them():
    res = _invite([SAM])

    assert res.status_code == 200
    assert res.json()["companions"] == [{"user_id": SAM, "username": "sam", "display_name": "Sam", "status": "pending"}]
    assert [p["user_id"] for p in res.json()["following"]] == [JO]
    db = TestingSession()
    note = db.query(Notification).filter_by(user_id=SAM).one()
    assert "Andy says you were at Doves at Rock City on 1 May 2025" in note.message
    db.close()


def test_the_invited_person_adds_the_gig_with_support_acts_and_no_setlist_calls():
    _invite([SAM])
    act_as(SAM)
    invites = client.get("/setlists/invites").json()
    assert len(invites) == 1
    assert invites[0]["from_user"]["display_name"] == "Andy"
    assert invites[0]["support_acts"] == ["Support Band"]
    # The owner's notes are never shared
    assert "Secret note" not in str(invites)

    with patch("backend.app.services.setlist_service.SetlistService.get_setlist") as get_setlist:
        res = client.post(f"/setlists/invites/{invites[0]['id']}/add")

    get_setlist.assert_not_called()
    assert res.status_code == 200
    assert (res.json()["artist_name"], res.json()["notes"]) == ("Doves", None)
    db = TestingSession()
    sam_gigs = {g.setlist_id: g for g in db.query(AttendedConcert).filter_by(user_id=SAM)}
    assert sam_gigs["supp1"].parent_setlist_id == "doves1"
    assert db.query(ListeningEvent).filter_by(user_id=SAM, source="setlistfm").count() == 4
    assert db.query(Notification).filter_by(user_id=ANDY).one().message.startswith("Sam added Doves")
    db.close()
    assert client.get("/setlists/invites").json() == []

    act_as(ANDY)
    companions = client.get(f"/setlists/attendances/{_gig_id(ANDY)}/companions").json()["companions"]
    assert companions[0]["status"] == "added"


def test_someone_who_already_logged_it_is_linked_not_invited():
    db = TestingSession()
    db.add(_gig(JO, "doves1", "Doves"))
    db.commit()
    db.close()

    following = client.get(f"/setlists/attendances/{_gig_id(ANDY)}/companions").json()["following"]
    assert following[0] == {"user_id": JO, "username": "jo", "display_name": "Jo", "logged_it": True}

    res = _invite([JO])
    assert res.json()["companions"][0]["status"] == "added"
    db = TestingSession()
    assert db.query(Notification).filter_by(user_id=JO).count() == 0
    assert db.query(AttendedConcert).filter_by(user_id=JO).count() == 1
    db.close()


def test_invites_can_only_be_answered_by_the_invited_person():
    _invite([SAM])
    act_as(SAM)
    invite_id = client.get("/setlists/invites").json()[0]["id"]

    act_as(JO)
    assert client.post(f"/setlists/invites/{invite_id}/add").status_code == 404
    assert client.post(f"/setlists/invites/{invite_id}/dismiss").status_code == 404

    act_as(SAM)
    assert client.post(f"/setlists/invites/{invite_id}/dismiss").status_code == 204
    assert client.get("/setlists/invites").json() == []
    assert client.post(f"/setlists/invites/{invite_id}/add").status_code == 404


def test_removing_a_companion_and_deleting_the_gig_withdraw_invites():
    _invite([SAM, JO])
    gig_id = _gig_id(ANDY)
    assert client.delete(f"/setlists/attendances/{gig_id}/companions/{JO}").status_code == 204
    assert client.delete(f"/setlists/attendances/{gig_id}/companions/{JO}").status_code == 404

    assert client.delete(f"/setlists/{gig_id}").status_code == 200
    act_as(SAM)
    assert client.get("/setlists/invites").json() == []
    db = TestingSession()
    assert db.query(GigCompanion).count() == 0
    db.close()


def test_friend_list_is_limited_per_request():
    assert _invite([]).status_code == 422
    assert _invite(list(range(100, 121))).status_code == 422
