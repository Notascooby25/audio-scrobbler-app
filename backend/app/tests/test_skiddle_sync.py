from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.models import (
    AttendedConcert,
    BlockedItem,
    DiscoveredGig,
    ListeningEvent,
    User,
    UserPreferences,
)
from backend.app.services import gig_discovery_sync_service as sync_module
from backend.app.services.gig_discovery_service import query_discovered_gigs
from backend.app.services.gig_discovery_sync_service import (
    configured_sources,
    sync_discovered_gigs,
)
from backend.app.services.skiddle_service import SkiddleClient

FIXTURE = Path(__file__).parent / "fixtures" / "skiddle_search_sample.json"
WARWICK = (52.28, -1.585)


def _events() -> list[dict[str, Any]]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["results"]


@pytest.fixture(autouse=True)
def only_skiddle_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SKIDDLE_API_KEY", "test-skiddle-key")
    monkeypatch.setenv("TICKETMASTER_API_KEY", "")


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    # autoflush=False matches the real app's session (db.py): new rows are not visible to later
    # queries until flushed, which is exactly what let duplicate gigs crash the live sync.
    with Session(engine, autoflush=False) as session:
        yield session


def _user(db: Session, n: int = 1, *, home: tuple[float, float] | None = WARWICK, radius: int = 10) -> User:
    user = User(spotify_user_id=f"sp-{n}", username=f"u{n}", display_name=f"U{n}", refresh_token_cipher="c")
    db.add(user)
    db.flush()
    db.add(
        UserPreferences(
            user_id=user.id,
            home_city="Warwick" if home else None,
            home_lat=home[0] if home else None,
            home_lng=home[1] if home else None,
            local_gig_radius_miles=radius,
        )
    )
    db.commit()
    return user


def _listen(db: Session, user: User, artist: str, plays: int = 6) -> None:
    for i in range(plays):
        db.add(
            ListeningEvent(
                user_id=user.id,
                track_id=f"{artist}-{i}",
                play_id=f"{artist}-p{i}",
                track_name="Song",
                artist_name=artist,
                played_at=utc_now() - timedelta(days=i + 1),
                source="spotify",
            )
        )
    db.commit()


def _fake_client(monkeypatch: pytest.MonkeyPatch, results: list[dict[str, Any]], blocked: bool = False) -> MagicMock:
    fake = MagicMock(spec=SkiddleClient)
    fake.api_key = "test-skiddle-key"
    fake.blocked = blocked
    fake.search_all.return_value = results
    monkeypatch.setattr(sync_module, "SkiddleClient", lambda *a, **k: fake)
    return fake


def _future(raw: dict[str, Any], days: int = 10) -> dict[str, Any]:
    day = (date.today() + timedelta(days=days)).isoformat()
    return dict(raw, date=day, startdate=f"{day}T19:30:00+00:00")


# ---- configuration -------------------------------------------------------------


def test_configured_sources_reports_which_keys_are_set(monkeypatch: pytest.MonkeyPatch):
    assert configured_sources() == ["skiddle"]
    monkeypatch.setenv("TICKETMASTER_API_KEY", "tm")
    assert configured_sources() == ["ticketmaster", "skiddle"]
    monkeypatch.setenv("SKIDDLE_API_KEY", " '' ")
    monkeypatch.setenv("TICKETMASTER_API_KEY", "")
    assert configured_sources() == []


def test_sync_does_nothing_when_no_source_has_a_key(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SKIDDLE_API_KEY", "")
    fake = _fake_client(monkeypatch, _events())
    fake.api_key = ""
    stats = sync_discovered_gigs(db_session)
    assert stats["configured"] == 0
    fake.search_all.assert_not_called()


# ---- the sweeps -----------------------------------------------------------------


def test_local_sweep_searches_around_home_within_a_wide_radius(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    _user(db_session, radius=6)
    fake = _fake_client(monkeypatch, [_future(e) for e in _events()])
    stats = sync_discovered_gigs(db_session)

    local_calls = [c for c in fake.search_all.call_args_list if "latitude" in c.args[0]]
    assert len(local_calls) == 1
    params = local_calls[0].args[0]
    assert (params["latitude"], params["longitude"]) == WARWICK
    assert params["radius"] == 25  # a wide cache so changing the radius later works at once
    assert params["eventcode"] == "LIVE"
    assert params["minDate"] == date.today().isoformat()
    assert stats["configured"] == 1
    assert db_session.query(DiscoveredGig).filter_by(source="skiddle").count() == 4


def test_uk_sweep_runs_in_date_windows_when_users_have_artists(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session)
    _listen(db_session, user, "The Feeling")
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)

    uk_calls = [c.args[0] for c in fake.search_all.call_args_list if c.args[0].get("country") == "GB"]
    assert len(uk_calls) == len(sync_module.SKIDDLE_UK_WINDOW_DAYS)
    assert all(p["eventcode"] == "LIVE" and "latitude" not in p for p in uk_calls)
    starts = [p["minDate"] for p in uk_calls]
    assert starts == sorted(starts) and starts[0] == date.today().isoformat()
    for p in uk_calls:
        assert p["maxDate"] > p["minDate"]


def test_uk_sweep_is_skipped_for_a_single_user_refresh(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session)
    _listen(db_session, user, "The Feeling")
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session, user_id=user.id)
    assert all(c.args[0].get("country") != "GB" for c in fake.search_all.call_args_list)
    params = [c.args[0] for c in fake.search_all.call_args_list]
    assert len(params) == 2  # their local search and their one artist search
    assert [p["keyword"] for p in params if "keyword" in p] == ["the feeling"]


def _artist_searches(fake: MagicMock) -> list[dict[str, Any]]:
    return [c.args[0] for c in fake.search_all.call_args_list if "keyword" in c.args[0]]


def test_your_top_artists_are_searched_by_name_most_played_first(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session, home=None)
    _listen(db_session, user, "Quiet Band", plays=2)
    _listen(db_session, user, "Loud Band", plays=9)
    _listen(db_session, user, "Middle Band", plays=5)
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)

    searches = _artist_searches(fake)
    assert [p["keyword"] for p in searches] == ["loud band", "middle band", "quiet band"]
    first = searches[0]
    assert first["eventcode"] == "LIVE" and first["minDate"] == date.today().isoformat()
    assert "country" not in first  # their tours abroad are still worth knowing about
    one_page = [c.kwargs["max_pages"] for c in fake.search_all.call_args_list if "keyword" in c.args[0]]
    assert one_page == [1, 1, 1]


def test_artist_searches_are_capped_per_user(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session, home=None)
    cap = sync_module.SKIDDLE_ARTISTS_PER_USER
    for i in range(cap + 10):
        _listen(db_session, user, f"Band {i:02d}", plays=cap + 10 - i)  # Band 00 is the most played
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)

    names = [p["keyword"] for p in _artist_searches(fake)]
    assert len(names) == cap
    assert names[0] == "band 00" and f"band {cap + 5:02d}" not in names


def test_artists_shared_between_users_are_searched_once(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    for n in (1, 2):
        user = _user(db_session, n, home=None)
        _listen(db_session, user, "Shared Band")
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)
    assert [p["keyword"] for p in _artist_searches(fake)] == ["shared band"]


def test_blocked_artists_are_never_searched(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session, home=None)
    _listen(db_session, user, "Blocked Band")
    _listen(db_session, user, "Fine Band")
    db_session.add(BlockedItem(user_id=user.id, entity_type="artist", name="Blocked Band"))
    db_session.commit()
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)
    assert [p["keyword"] for p in _artist_searches(fake)] == ["fine band"]


def test_seen_live_artists_are_searched_after_the_most_played(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session, home=None)
    _listen(db_session, user, "Played Band")
    db_session.add(
        AttendedConcert(
            user_id=user.id,
            setlist_id="s1",
            artist_name="Seen Band",
            venue_name="V",
            city="C",
            country="GB",
            event_date=utc_now() - timedelta(days=100),
        )
    )
    db_session.commit()
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)
    assert [p["keyword"] for p in _artist_searches(fake)] == ["played band", "seen band"]


def test_artist_searches_stop_when_skiddle_blocks_us(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session, home=None)
    for name in ("A Band", "B Band", "C Band"):
        _listen(db_session, user, name)
    fake = _fake_client(monkeypatch, [])

    def block(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        fake.blocked = True
        return []

    fake.search_all.side_effect = block
    sync_discovered_gigs(db_session)
    assert fake.search_all.call_count == 1


def test_uk_windows_read_only_a_couple_of_pages_each(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session, home=None)
    _listen(db_session, user, "Some Band")
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)
    uk_pages = [c.kwargs["max_pages"] for c in fake.search_all.call_args_list if c.args[0].get("country") == "GB"]
    assert uk_pages == [2, 2, 2, 2]


def test_users_with_no_artists_and_no_home_cause_no_requests(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    _user(db_session, home=None)
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)
    fake.search_all.assert_not_called()


def test_identical_home_locations_are_searched_once(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    _user(db_session, 1)
    _user(db_session, 2)
    fake = _fake_client(monkeypatch, [])
    sync_discovered_gigs(db_session)
    assert len([c for c in fake.search_all.call_args_list if "latitude" in c.args[0]]) == 1


def test_sweep_stops_as_soon_as_skiddle_blocks_us(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    user = _user(db_session)
    _listen(db_session, user, "The Feeling")
    fake = _fake_client(monkeypatch, [])

    def block_after_first(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        fake.blocked = True
        return []

    fake.search_all.side_effect = block_after_first
    sync_discovered_gigs(db_session)
    assert fake.search_all.call_count == 1


def test_resyncing_updates_rows_instead_of_duplicating(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    _user(db_session)
    events = [_future(e) for e in _events()]
    fake = _fake_client(monkeypatch, events)
    sync_discovered_gigs(db_session)
    first_seen = {g.external_id: g.first_seen_at for g in db_session.query(DiscoveredGig).all()}

    events[0] = dict(events[0], cancelled="1")
    fake.search_all.return_value = events
    sync_discovered_gigs(db_session)

    rows = db_session.query(DiscoveredGig).filter_by(source="skiddle").all()
    assert len(rows) == 4
    assert {g.external_id: g.first_seen_at for g in rows} == first_seen
    assert [g.is_cancelled for g in rows if g.external_id == events[0]["id"]] == [True]


def test_events_without_a_usable_date_are_skipped(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    _user(db_session)
    _fake_client(monkeypatch, [dict(_future(_events()[0]), date="")])
    sync_discovered_gigs(db_session)
    assert db_session.query(DiscoveredGig).count() == 0


def test_a_gig_returned_by_several_searches_is_stored_once(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    """Local, artist and UK searches overlap; the live sync once died on the resulting duplicate."""
    user = _user(db_session)
    _listen(db_session, user, "The Feeling")
    events = [_future(e) for e in _events()]
    fake = _fake_client(monkeypatch, events)  # every search returns the same events
    sync_discovered_gigs(db_session)
    assert fake.search_all.call_count > 2
    assert db_session.query(DiscoveredGig).filter_by(source="skiddle").count() == len(events)


def test_the_same_gig_twice_in_one_search_is_stored_once(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    _user(db_session)
    event = _future(_events()[0])
    _fake_client(monkeypatch, [event, dict(event, eventname="Renamed")])
    sync_discovered_gigs(db_session)
    rows = db_session.query(DiscoveredGig).filter_by(source="skiddle").all()
    assert [r.event_name for r in rows] == ["Renamed"]  # the later sighting wins


def test_events_that_already_started_in_the_past_are_not_stored(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    """Skiddle returns long-running listings (courses, exhibitions) whose start date is long gone."""
    _user(db_session)
    past = dict(_events()[0], date=(date.today() - timedelta(days=30)).isoformat())
    future = _future(_events()[1])
    _fake_client(monkeypatch, [past, future])
    sync_discovered_gigs(db_session)
    stored = {g.external_id for g in db_session.query(DiscoveredGig).all()}
    assert stored == {future["id"]}


# ---- matching "My Artists" ---------------------------------------------------------


def _store(db: Session, **overrides: Any) -> DiscoveredGig:
    base = {
        "source": "skiddle",
        "external_id": "x1",
        "artist_name": "Someone",
        "artist_key": "someone",
        "attraction_names": ["Someone"],
        "attraction_keys": ["someone"],
        "event_name": "Someone",
        "venue_name": "Venue",
        "city": "Warwick",
        "country_code": "GB",
        "event_date": date.today() + timedelta(days=5),
        "lat": WARWICK[0],
        "lng": WARWICK[1],
    }
    gig = DiscoveredGig(**{**base, **overrides})
    db.add(gig)
    db.commit()
    return gig


def _mine(db: Session, user: User) -> list[dict[str, Any]]:
    return query_discovered_gigs(db, user.id, scope="my_artists")["items"]


def test_discover_is_configured_with_only_a_skiddle_key(db_session: Session):
    user = _user(db_session)
    assert query_discovered_gigs(db_session, user.id)["configured"] is True


def test_discover_unconfigured_when_no_key(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SKIDDLE_API_KEY", "")
    user = _user(db_session)
    assert query_discovered_gigs(db_session, user.id)["configured"] is False


def test_ampersand_spelling_still_matches_your_artist(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Echo & The Bunnymen")
    _store(
        db_session,
        artist_name="Echo and the Bunnymen",
        artist_key="echo and the bunnymen",
        attraction_names=["Echo and the Bunnymen"],
        attraction_keys=["echo and the bunnymen"],
        event_name="Echo & The Bunnymen",
    )
    items = _mine(db_session, user)
    assert len(items) == 1
    assert items[0]["is_my_artist"] is True
    assert items[0]["is_possible_match"] is False


def test_artist_named_only_in_the_event_title_is_a_possible_match(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Crackbears")
    name = "Fang Night - Mesch:, Crackbears, Balloon Tomb"
    _store(
        db_session,
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=name,
    )
    items = _mine(db_session, user)
    assert len(items) == 1
    assert items[0]["is_my_artist"] is True
    assert items[0]["is_possible_match"] is True


def test_tribute_nights_are_not_treated_as_your_artist(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Michael Jackson")
    name = "MAN IN THE MIRROR - Tribute To Michael Jackson"
    _store(
        db_session,
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=name,
    )
    assert _mine(db_session, user) == []


def test_short_artist_names_are_not_matched_inside_titles(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Yes")
    name = "Yes We Can Quiz Night"
    _store(
        db_session,
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=name,
    )
    assert _mine(db_session, user) == []


def test_title_matching_needs_whole_words(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Pulp")
    name = "Pulpit Rock Showcase"
    _store(
        db_session,
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=name,
    )
    assert _mine(db_session, user) == []


def test_ticketmaster_rows_are_never_title_matched(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Crackbears")
    name = "Crackbears Night"
    _store(
        db_session,
        source="ticketmaster",
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=name,
    )
    assert _mine(db_session, user) == []


def test_blocked_artists_are_not_title_matched(db_session: Session):
    user = _user(db_session)
    _listen(db_session, user, "Crackbears")
    db_session.add(BlockedItem(user_id=user.id, entity_type="artist", name="Crackbears"))
    db_session.commit()
    name = "Fang Night - Mesch:, Crackbears, Balloon Tomb"
    _store(
        db_session,
        artist_name=name,
        artist_key=name.lower(),
        attraction_names=[name],
        attraction_keys=[name.lower()],
        event_name=name,
    )
    assert _mine(db_session, user) == []
