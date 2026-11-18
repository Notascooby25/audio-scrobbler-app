from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.models import DiscoveredGig, DiscoveredGigInterest, User, UserPreferences
from backend.app.services.gig_discovery_service import query_discovered_gigs

TODAY = date.today()


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


def _gig(
    db: Session, ext: str, *, days: int = 10, first_seen: datetime | None = None, source: str = "skiddle", **kw: Any
):
    gig = DiscoveredGig(
        source=source,
        external_id=ext,
        artist_name=ext,
        artist_key=ext,
        attraction_names=[ext],
        attraction_keys=[ext],
        event_name=ext,
        venue_name="V",
        city="Coventry",
        country_code="GB",
        lat=52.4,
        lng=-1.5,
        event_date=TODAY + timedelta(days=days),
        first_seen_at=first_seen or utc_now(),
        **kw,
    )
    db.add(gig)
    db.commit()
    return gig


def _ids(db: Session, user: User, **params: Any) -> list[str]:
    params.setdefault("scope", "local")
    params.setdefault("radius_miles", 100)
    return [i["external_id"] for i in query_discovered_gigs(db, user.id, **params)["items"]]


def _by_id(db: Session, user: User) -> dict[str, dict[str, Any]]:
    items = query_discovered_gigs(db, user.id, scope="local", radius_miles=100)["items"]
    return {i["external_id"]: i for i in items}


# ---- "Newly announced" must not light up on the first import of a source -----------------


def test_everything_from_the_first_import_is_not_newly_announced(db: Session, user: User):
    now = utc_now()
    for i in range(5):
        _gig(db, f"first-{i}", first_seen=now - timedelta(days=2) + timedelta(minutes=i))
    assert not any(i["is_newly_announced"] for i in _by_id(db, user).values())


def test_a_gig_that_appears_after_the_first_import_is_newly_announced(db: Session, user: User):
    now = utc_now()
    _gig(db, "first", first_seen=now - timedelta(days=3))
    _gig(db, "later", first_seen=now - timedelta(days=1))  # a day after the first import
    items = _by_id(db, user)
    assert items["first"]["is_newly_announced"] is False
    assert items["later"]["is_newly_announced"] is True


def test_newly_announced_expires_after_a_week(db: Session, user: User):
    now = utc_now()
    _gig(db, "first", first_seen=now - timedelta(days=30))
    _gig(db, "old", first_seen=now - timedelta(days=10))
    assert _by_id(db, user)["old"]["is_newly_announced"] is False


def test_each_source_has_its_own_first_import(db: Session, user: User):
    now = utc_now()
    _gig(db, "sk-first", first_seen=now - timedelta(days=20))
    _gig(db, "tm-first", first_seen=now - timedelta(days=2), source="ticketmaster")
    _gig(db, "tm-later", first_seen=now - timedelta(hours=20), source="ticketmaster")
    items = _by_id(db, user)
    assert items["tm-first"]["is_newly_announced"] is False  # first import of Ticketmaster
    assert items["tm-later"]["is_newly_announced"] is True


def test_an_on_sale_date_still_marks_a_gig_as_new(db: Session, user: User):
    now = utc_now()
    _gig(db, "first", first_seen=now - timedelta(days=2))
    _gig(db, "onsale", first_seen=now - timedelta(days=2), onsale_start_at=now - timedelta(days=1))
    assert _by_id(db, user)["onsale"]["is_newly_announced"] is True


# ---- "Newly announced" and "Interested" are filters of their own, combinable with dates ------


def _seed_mixed(db: Session, user: User) -> None:
    now = utc_now()
    _gig(db, "base", days=3, first_seen=now - timedelta(days=5))
    _gig(db, "new-soon", days=3, first_seen=now - timedelta(days=1))
    _gig(db, "new-far", days=60, first_seen=now - timedelta(days=1))
    gig = _gig(db, "liked-far", days=60, first_seen=now - timedelta(days=5))
    db.add(DiscoveredGigInterest(user_id=user.id, discovered_gig_id=gig.id))
    db.commit()


def test_only_new_filters_and_combines_with_a_date_window(db: Session, user: User):
    _seed_mixed(db, user)
    assert sorted(_ids(db, user, only_new=True)) == ["new-far", "new-soon"]
    assert _ids(db, user, only_new=True, date_window="7d") == ["new-soon"]


def test_only_interested_shows_your_shortlist_and_still_respects_dates(db: Session, user: User):
    _seed_mixed(db, user)
    assert _ids(db, user, only_interested=True) == ["liked-far"]
    assert _ids(db, user, only_interested=True, date_window="7d") == []


def test_only_interested_ignores_the_where_filters(db: Session, user: User):
    _seed_mixed(db, user)
    assert _ids(db, user, scope="my_artists", only_interested=True) == ["liked-far"]


def test_old_date_window_values_still_work(db: Session, user: User):
    _seed_mixed(db, user)
    assert sorted(_ids(db, user, date_window="newly_announced")) == ["new-far", "new-soon"]
    assert _ids(db, user, date_window="interested") == ["liked-far"]


def test_saved_filters_carry_the_new_options(db: Session, user: User):
    saved = query_discovered_gigs(db, user.id)["saved_filters"]
    assert saved["only_new"] is False and saved["only_interested"] is False
