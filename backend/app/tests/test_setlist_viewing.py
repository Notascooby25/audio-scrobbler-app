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

ANDY, SAM, STRANGER, GONE = 1, 2, 3, 4
SONGS = {"set": [{"song": [{"name": "Pounding"}, {"name": "Black and White Town"}]}]}
READ_ROUTES = [
    "/setlists/attendances",
    "/setlists/stats/artists",
    "/setlists/stats/songs",
    "/setlists/stats/venues",
]


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


def _gig(user_id: int, setlist_id: str, artist: str, support_of: str | None = None, **extra) -> AttendedConcert:
    return AttendedConcert(
        user_id=user_id,
        setlist_id=setlist_id,
        artist_name=artist,
        venue_name="Rock City",
        city="Nottingham",
        country="UK",
        event_date=datetime(2025, 5, 1, 20),
        is_support_act=support_of is not None,
        parent_setlist_id=support_of,
        raw_data={"id": setlist_id, "sets": SONGS},
        song_count=2,
        **extra,
    )


@pytest.fixture(autouse=True)
def people():
    app.dependency_overrides[get_db] = _db
    db = TestingSession()
    for model in (GigCompanion, Notification, ListeningEvent, AttendedConcert, Follow, User):
        db.query(model).delete()
    for uid, name, active in (
        (ANDY, "Andy", True),
        (SAM, "Sam", True),
        (STRANGER, "Stranger", True),
        (GONE, "Gone", False),
    ):
        db.add(
            User(
                id=uid,
                spotify_user_id=f"sp{uid}",
                username=name.lower(),
                display_name=name,
                refresh_token_cipher="c",
                is_active=active,
            )
        )
    db.add_all([Follow(follower_id=ANDY, followee_id=SAM), Follow(follower_id=ANDY, followee_id=GONE)])
    db.add_all(
        [
            _gig(SAM, "doves1", "Doves", notes="Sam's private note"),
            _gig(SAM, "supp1", "Support Band", support_of="doves1", notes="Another private note"),
            _gig(ANDY, "andy1", "Elbow", notes="Andy's own note"),
        ]
    )
    db.commit()
    db.close()
    act_as(ANDY)
    yield
    app.dependency_overrides.clear()


def _gig_id(user_id: int, setlist_id: str) -> int:
    db = TestingSession()
    gig_id = db.query(AttendedConcert.id).filter_by(user_id=user_id, setlist_id=setlist_id).scalar()
    db.close()
    return gig_id


def test_a_follower_sees_someones_gigs_without_their_notes():
    gigs = client.get(f"/setlists/attendances?user_id={SAM}").json()
    assert {g["artist_name"] for g in gigs} == {"Doves", "Support Band"}
    assert all(g["notes"] is None for g in gigs)

    gig = client.get(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}?user_id={SAM}").json()
    assert (gig["artist_name"], gig["notes"]) == ("Doves", None)

    artists = client.get(f"/setlists/stats/artists?user_id={SAM}").json()
    assert {a["artist_name"] for a in artists} == {"Doves", "Support Band"}
    assert "private note" not in str(artists)
    for route in READ_ROUTES:
        res = client.get(f"{route}?user_id={SAM}")
        assert res.status_code == 200, route
        assert "private note" not in res.text, route

    # Hiding the notes from a viewer doesn't touch the stored ones
    db = TestingSession()
    assert db.get(AttendedConcert, _gig_id(SAM, "doves1")).notes == "Sam's private note"
    db.close()


def test_your_own_gigs_still_include_your_notes():
    assert client.get("/setlists/attendances").json()[0]["notes"] == "Andy's own note"
    assert client.get(f"/setlists/attendances?user_id={ANDY}").json()[0]["notes"] == "Andy's own note"
    gig = client.get(f"/setlists/attendances/{_gig_id(ANDY, 'andy1')}").json()
    assert gig["notes"] == "Andy's own note"


def test_only_followers_can_view_someones_gigs():
    act_as(STRANGER)
    sam_gig = _gig_id(SAM, "doves1")
    for route in [*READ_ROUTES, f"/setlists/attendances/{sam_gig}", f"/setlists/attendances/{sam_gig}/bill"]:
        assert client.get(f"{route}?user_id={SAM}").status_code == 403, route
    # Without user_id it's their own (empty) history, never Sam's
    assert client.get("/setlists/attendances").json() == []
    assert client.get(f"/setlists/attendances/{sam_gig}").status_code == 404


def test_inactive_or_unknown_people_are_not_found():
    assert client.get(f"/setlists/attendances?user_id={GONE}").status_code == 404
    assert client.get("/setlists/attendances?user_id=999").status_code == 404


def test_a_gig_id_must_belong_to_the_person_being_viewed():
    assert client.get(f"/setlists/attendances/{_gig_id(ANDY, 'andy1')}?user_id={SAM}").status_code == 404
    assert client.get(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}").status_code == 404


def test_a_follower_sees_the_bill_as_the_owner_logged_it():
    res = client.get(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/bill?user_id={SAM}")
    assert res.status_code == 200
    acts = res.json()["acts"]
    assert [(a["artist_name"], a["logged"]) for a in acts] == [("Support Band", True)]


def test_viewing_never_lets_you_change_their_gigs():
    sam_gig = _gig_id(SAM, "doves1")
    assert client.patch(f"/setlists/{sam_gig}/notes", json={"notes": "mine now"}).status_code == 404
    assert client.delete(f"/setlists/{sam_gig}").json()["deleted_count"] == 0
    db = TestingSession()
    assert db.get(AttendedConcert, sam_gig).notes == "Sam's private note"
    db.close()


def test_i_was_there_too_copies_the_whole_night_without_setlist_calls():
    with patch("backend.app.services.setlist_service.SetlistService.get_setlist") as get_setlist:
        res = client.post(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/add-to-mine?user_id={SAM}")

    get_setlist.assert_not_called()
    assert res.status_code == 201
    assert (res.json()["artist_name"], res.json()["notes"]) == ("Doves", None)
    db = TestingSession()
    andy_gigs = {g.setlist_id: g for g in db.query(AttendedConcert).filter_by(user_id=ANDY)}
    assert andy_gigs["supp1"].parent_setlist_id == "doves1"
    assert andy_gigs["supp1"].notes is None
    assert db.query(ListeningEvent).filter_by(user_id=ANDY, source="setlistfm").count() == 4
    assert db.query(Notification).filter_by(user_id=SAM).one().message.startswith("Andy was at Doves")
    db.close()

    again = client.post(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/add-to-mine?user_id={SAM}")
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "already_logged"


def test_i_was_there_too_from_a_support_act_adds_the_headliner_too():
    res = client.post(f"/setlists/attendances/{_gig_id(SAM, 'supp1')}/add-to-mine?user_id={SAM}")
    assert res.status_code == 201
    assert res.json()["artist_name"] == "Doves"
    db = TestingSession()
    assert {g.setlist_id for g in db.query(AttendedConcert).filter_by(user_id=ANDY)} == {"andy1", "doves1", "supp1"}
    db.close()


def test_i_was_there_too_needs_you_to_follow_them():
    act_as(STRANGER)
    res = client.post(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/add-to-mine?user_id={SAM}")
    assert res.status_code == 403
    db = TestingSession()
    assert db.query(AttendedConcert).filter_by(user_id=STRANGER).count() == 0
    db.close()


def test_i_was_there_too_answers_a_pending_invite():
    db = TestingSession()
    db.add(Follow(follower_id=SAM, followee_id=ANDY))
    db.commit()
    db.close()
    act_as(SAM)
    client.post(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/companions", json={"friend_ids": [ANDY]})

    act_as(ANDY)
    assert len(client.get("/setlists/invites").json()) == 1
    client.post(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/add-to-mine?user_id={SAM}")
    assert client.get("/setlists/invites").json() == []

    act_as(SAM)
    companions = client.get(f"/setlists/attendances/{_gig_id(SAM, 'doves1')}/companions").json()["companions"]
    assert companions[0]["status"] == "added"
