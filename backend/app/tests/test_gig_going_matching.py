from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, DiscoveredGig, ListeningEvent, User, UserPreferences
from backend.app.datetime_utils import utc_now
from backend.app.services.gig_discovery_service import attend_discovered_gig, query_discovered_gigs

GIG_DAY = date.today() + timedelta(days=30)


@pytest.fixture(autouse=True)
def configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SKIDDLE_API_KEY", "k")
    monkeypatch.setenv("TICKETMASTER_API_KEY", "")


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine, autoflush=False) as session:
        yield session


@pytest.fixture
def user(db: Session) -> User:
    u = User(spotify_user_id="s", username="u", display_name="U", refresh_token_cipher="c")
    db.add(u)
    db.flush()
    db.add(UserPreferences(user_id=u.id, home_city="Warwick", home_lat=52.28, home_lng=-1.585))
    db.commit()
    return u


def _gig(db: Session, name: str, *, event_name: str | None = None, day: date = GIG_DAY, ext: str = "g1", **kw: Any):
    gig = DiscoveredGig(
        source="skiddle",
        external_id=ext,
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=event_name or name,
        venue_name="HMV EMPIRE COVENTRY",
        city="Coventry",
        country_code="GB",
        lat=52.4,
        lng=-1.5,
        event_date=day,
        **kw,
    )
    db.add(gig)
    db.commit()
    return gig


def _attended(db: Session, user: User, artist: str, day: date = GIG_DAY, sid: str = "sf1") -> AttendedConcert:
    row = AttendedConcert(
        user_id=user.id,
        setlist_id=sid,
        artist_name=artist,
        venue_name="HMV Empire",
        city="Coventry",
        country="United Kingdom",
        event_date=datetime.combine(day, datetime.min.time()),
    )
    db.add(row)
    db.commit()
    return row


def _items(db: Session, user: User) -> list[dict[str, Any]]:
    return query_discovered_gigs(db, user.id, scope="local", radius_miles=100)["items"]


def test_curly_apostrophe_gig_is_recognised_as_going(db: Session, user: User):
    logged = _attended(db, user, "DMA’s")  # as stored from Setlist.fm
    _gig(db, "DMA's", event_name="DMAs")  # as Skiddle lists it
    item = _items(db, user)[0]
    assert item["already_going"] is True
    assert item["concert_id"] == logged.id


def test_same_artist_on_a_different_day_is_not_going(db: Session, user: User):
    _attended(db, user, "DMA’s", day=GIG_DAY + timedelta(days=1))
    _gig(db, "DMA's")
    assert _items(db, user)[0]["already_going"] is False


def test_a_different_band_on_the_same_day_is_not_going(db: Session, user: User):
    _attended(db, user, "Fat Dog")
    _gig(db, "Fat Cat")
    assert _items(db, user)[0]["already_going"] is False


def test_logged_artist_named_only_in_a_title_only_listing_counts_as_going(db: Session, user: User):
    logged = _attended(db, user, "Crackbears")
    title = "Fang Night - Mesch:, Crackbears, Balloon Tomb"
    _gig(db, title, event_name=title)
    item = _items(db, user)[0]
    assert item["already_going"] is True and item["concert_id"] == logged.id


def test_tribute_nights_and_short_names_are_not_matched_by_title(db: Session, user: User):
    _attended(db, user, "Yes")
    _gig(db, "Yes We Can Quiz Night", ext="g2")
    _attended(db, user, "Michael Jackson", sid="sf2")
    _gig(db, "MAN IN THE MIRROR - Tribute To Michael Jackson", ext="g3")
    assert [i["already_going"] for i in _items(db, user)] == [False, False]


def test_seen_live_and_your_artist_badges_ignore_punctuation(db: Session, user: User):
    _attended(db, user, "DMA’s", day=date.today() - timedelta(days=400))  # seen in the past
    for i in range(6):
        db.add(
            ListeningEvent(
                user_id=user.id,
                track_id=f"t{i}",
                play_id=f"p{i}",
                track_name="S",
                artist_name="Fontaines DC",
                played_at=utc_now() - timedelta(days=i + 1),
                source="spotify",
            )
        )
    db.commit()
    _gig(db, "DMA's", ext="g1")
    _gig(db, "Fontaines D.C.", ext="g2")
    by_artist = {i["artist_name"]: i for i in _items(db, user)}
    assert by_artist["DMA's"]["is_seen_live"] is True
    assert by_artist["Fontaines D.C."]["is_my_artist"] is True


def test_clicking_im_going_on_an_already_logged_gig_reuses_it(db: Session, user: User):
    logged = _attended(db, user, "DMA’s")
    gig = _gig(db, "DMA's", event_name="DMAs")
    concert = attend_discovered_gig(db, user.id, gig.id)
    assert concert.id == logged.id
    assert db.query(AttendedConcert).filter_by(user_id=user.id).count() == 1


def test_clicking_im_going_on_a_new_gig_still_creates_one(db: Session, user: User):
    gig = _gig(db, "DMA's")
    concert = attend_discovered_gig(db, user.id, gig.id)
    assert concert.artist_name == "DMA's"
    assert attend_discovered_gig(db, user.id, gig.id).id == concert.id  # still idempotent
    assert db.query(AttendedConcert).filter_by(user_id=user.id).count() == 1
