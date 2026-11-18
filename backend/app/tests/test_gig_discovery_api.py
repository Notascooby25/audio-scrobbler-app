from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.config import settings
from backend.app.datetime_utils import utc_now
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.services import gig_discovery_service
from backend.app.models import (
    BlockedItem,
    DiscoveredGig,
    ListeningEvent,
    User,
    UserPreferences,
)

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)

LONDON = (51.5074, -0.1278)
BRIXTON = (51.4613, -0.1156)  # ~3.2 miles from central London
MANCHESTER = (53.4808, -2.2426)  # ~163 miles from London


class DemoUser:
    id = 101
    spotify_user_id = "sp_101"
    username = "andy"
    display_name = "Andy"


def _override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: DemoUser()
    monkeypatch.setenv("TICKETMASTER_API_KEY", "test-tm-key")

    with TestingSession() as db:
        db.add(
            User(
                id=101,
                spotify_user_id="sp_101",
                username="andy",
                display_name="Andy",
                refresh_token_cipher="c",
            )
        )
        db.add(
            UserPreferences(
                user_id=101,
                home_city="London",
                home_lat=LONDON[0],
                home_lng=LONDON[1],
                local_gig_radius_miles=6,
            )
        )
        now = utc_now()
        for i in range(6):
            db.add(
                ListeningEvent(
                    user_id=101,
                    track_id=f"t-{i}",
                    play_id=f"p-{i}",
                    track_name="Boys",
                    artist_name="Fontaines D.C.",
                    played_at=now - timedelta(days=i + 1),
                    source="spotify",
                )
            )
        db.add(BlockedItem(user_id=101, entity_type="artist", name="Blocked Band"))

        today = date.today()
        # Days until upcoming Saturday (0 if today is Saturday)
        days_to_sat = (5 - today.weekday()) % 7
        sat = today + timedelta(days=days_to_sat)

        # 1. Festival in Manchester featuring Fontaines D.C. as support/bill act, newly announced
        db.add(
            DiscoveredGig(
                source="ticketmaster",
                external_id="tm-fest",
                artist_name="Big Headliner",
                artist_key="big headliner",
                attraction_names=["Big Headliner", "Fontaines D.C."],
                attraction_keys=["big headliner", "fontaines d.c."],
                event_name="Manchester Summer Fest",
                venue_name="Heaton Park",
                city="Manchester",
                country_code="GB",
                lat=MANCHESTER[0],
                lng=MANCHESTER[1],
                event_date=today + timedelta(days=20),
                onsale_start_at=now - timedelta(days=2),
                first_seen_at=now - timedelta(days=2),
                ticket_url="https://ticketmaster.co.uk/fest",
            )
        )
        # 2. Local gig this weekend in Brixton (~3.2 mi) by an unknown artist
        db.add(
            DiscoveredGig(
                source="ticketmaster",
                external_id="tm-local",
                artist_name="Local Indie Band",
                artist_key="local indie band",
                attraction_names=["Local Indie Band"],
                attraction_keys=["local indie band"],
                event_name="Local Indie Band Live",
                venue_name="Brixton Academy",
                city="London",
                country_code="GB",
                lat=BRIXTON[0],
                lng=BRIXTON[1],
                event_date=sat,
                first_seen_at=now - timedelta(days=30),
                ticket_url="https://ticketmaster.co.uk/local",
            )
        )
        # 3. Blocked artist gig
        db.add(
            DiscoveredGig(
                source="ticketmaster",
                external_id="tm-blocked",
                artist_name="Blocked Band",
                artist_key="blocked band",
                attraction_names=["Blocked Band"],
                attraction_keys=["blocked band"],
                event_name="Blocked Show",
                venue_name="O2",
                city="London",
                country_code="GB",
                lat=LONDON[0],
                lng=LONDON[1],
                event_date=today + timedelta(days=5),
                first_seen_at=now - timedelta(days=1),
            )
        )
        db.commit()

    yield
    app.dependency_overrides.clear()


def test_discover_unconfigured_returns_200_gracefully(monkeypatch):
    monkeypatch.setenv("TICKETMASTER_API_KEY", "")
    res = client.get("/setlists/discover")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False
    assert body["items"] == []


def test_discover_my_artists_matches_festival_bill_and_excludes_blocked():
    res = client.get("/setlists/discover?scope=my_artists")
    assert res.status_code == 200
    items = res.json()["items"]
    ids = [item["external_id"] for item in items]
    assert "tm-fest" in ids
    assert "tm-blocked" not in ids
    assert "tm-local" not in ids
    fest = next(i for i in items if i["external_id"] == "tm-fest")
    assert fest["is_my_artist"] is True
    assert fest["is_newly_announced"] is True


def test_discover_api_returns_the_possible_match_flag():
    """The response schema once dropped is_possible_match, so the UI never saw it."""
    name = "Fang Night - Fontaines D.C., Another Band, Third Band"
    with TestingSession() as db:
        db.add(
            DiscoveredGig(
                source="skiddle",
                external_id="sk-title-only",
                artist_name=name,
                artist_key=name.lower(),
                attraction_names=[name],
                attraction_keys=[name.lower()],
                event_name=name,
                venue_name="Small Venue",
                city="Coventry",
                country_code="GB",
                event_date=date.today() + timedelta(days=9),
                first_seen_at=utc_now() - timedelta(days=30),
                ticket_url="https://www.skiddle.com/whats-on/x/1/",
            )
        )
        db.commit()
    items = client.get("/setlists/discover?scope=my_artists").json()["items"]
    by_id = {i["external_id"]: i for i in items}
    assert by_id["sk-title-only"]["is_possible_match"] is True
    assert by_id["tm-fest"]["is_possible_match"] is False


def test_discover_local_radius_and_weekend_filter():
    res_all = client.get("/setlists/discover?scope=local&radius_miles=6&date_window=weekend&only_my_artists=false")
    assert res_all.status_code == 200
    ids = [item["external_id"] for item in res_all.json()["items"]]
    assert "tm-local" in ids
    assert "tm-fest" not in ids

    res_mine = client.get("/setlists/discover?scope=local&radius_miles=6&only_my_artists=true")
    assert res_mine.status_code == 200
    assert res_mine.json()["items"] == []


def test_interest_toggle_and_attend_flow():
    items = client.get("/setlists/discover?scope=my_artists").json()["items"]
    gig_id = items[0]["id"]

    res_on = client.post(f"/setlists/discover/{gig_id}/interest")
    assert res_on.status_code == 200
    assert res_on.json()["is_interested"] is True

    res_int = client.get("/setlists/discover?date_window=interested")
    assert len(res_int.json()["items"]) == 1

    res_off = client.delete(f"/setlists/discover/{gig_id}/interest")
    assert res_off.status_code == 200
    assert res_off.json()["is_interested"] is False

    res_attend = client.post(f"/setlists/discover/{gig_id}/attend")
    assert res_attend.status_code == 200
    concert_id = res_attend.json()["concert_id"]
    assert concert_id > 0

    # Idempotent retry returns same concert_id
    res_attend_2 = client.post(f"/setlists/discover/{gig_id}/attend")
    assert res_attend_2.status_code == 200
    assert res_attend_2.json()["concert_id"] == concert_id


def test_patch_gig_discovery_preferences_and_internal_sync_auth():
    res = client.patch(
        "/users/me/settings/gig-discovery",
        json={
            "local_gig_radius_miles": 12,
            "gig_discovery_filters": {
                "scope": "local",
                "local_only_my_artists": True,
                "my_artists_mode": "min_plays",
                "my_artists_min_plays": 4,
                "my_artists_months": 6,
            },
        },
    )
    assert res.status_code == 200
    assert res.json()["local_gig_radius_miles"] == 12
    assert res.json()["gig_discovery_filters"]["my_artists_mode"] == "min_plays"

    unauth = client.post("/setlists/internal/discover-sync", headers={"X-Worker-Token": "wrong"})
    assert unauth.status_code in (401, 403)
    assert settings.worker_ingestion_token  # sanity check


def test_save_trigger_finds_the_worker_without_any_environment_variable(monkeypatch):
    """On the live host INGESTION_WORKER_URL is not set; the trigger must use the app's default."""
    monkeypatch.delenv("INGESTION_WORKER_URL", raising=False)
    monkeypatch.setenv("SKIDDLE_API_KEY", "k")
    fake_http = MagicMock()
    fake_http.return_value.__enter__.return_value = fake_http
    monkeypatch.setattr(gig_discovery_service.httpx, "Client", fake_http)

    gig_discovery_service.trigger_worker_discovery_sync(5)

    fake_http.post.assert_called_once()
    assert fake_http.post.call_args.args[0] == f"{settings.ingestion_worker_url}/internal/trigger-gig-discovery"
    assert fake_http.post.call_args.kwargs["json"] == {"user_id": 5}
    assert fake_http.post.call_args.kwargs["headers"] == {"X-Worker-Token": settings.worker_ingestion_token}
