from __future__ import annotations

from datetime import date, datetime, timedelta
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
from backend.app.services.gig_discovery_sync_service import (
    TicketmasterClient,
    encode_geohash,
    get_user_discovery_artists,
    sanitize_external_url,
    sync_discovered_gigs,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    # autoflush=False matches the real app's session (db.py)
    with Session(engine, autoflush=False) as session:
        yield session


def test_encode_geohash_and_sanitize_external_url():
    gh = encode_geohash(51.5074, -0.1278, precision=5)
    assert gh == "gcpvj"
    assert sanitize_external_url("https://www.ticketmaster.co.uk/event/1") == "https://www.ticketmaster.co.uk/event/1"
    assert sanitize_external_url("http://example.com/gig") == "http://example.com/gig"
    assert sanitize_external_url("javascript:alert(1)") is None
    assert sanitize_external_url("ftp://example.com/file") is None
    assert sanitize_external_url("") is None


def test_get_user_discovery_artists_supports_min_plays_and_excludes_blocked(db_session: Session):
    user = User(spotify_user_id="sp-1", username="u1", display_name="U1", refresh_token_cipher="c")
    db_session.add(user)
    db_session.flush()

    now = utc_now()
    for i in range(6):
        db_session.add(
            ListeningEvent(
                user_id=user.id,
                track_id=f"ta-{i}",
                play_id=f"pa-{i}",
                track_name="Song A",
                artist_name="Artist A",
                played_at=now - timedelta(days=i + 1),
                source="spotify",
            )
        )
    for i in range(2):
        db_session.add(
            ListeningEvent(
                user_id=user.id,
                track_id=f"tb-{i}",
                play_id=f"pb-{i}",
                track_name="Song B",
                artist_name="Artist B",
                played_at=now - timedelta(days=i + 1),
                source="spotify",
            )
        )
    for i in range(10):
        db_session.add(
            ListeningEvent(
                user_id=user.id,
                track_id=f"tc-{i}",
                play_id=f"pc-{i}",
                track_name="Song C",
                artist_name="Artist C",
                played_at=now - timedelta(days=i + 1),
                source="spotify",
            )
        )
    db_session.add(BlockedItem(user_id=user.id, entity_type="artist", name="Artist C"))
    db_session.add(
        AttendedConcert(
            user_id=user.id,
            setlist_id="sl-1",
            artist_name="Seen Live Band",
            venue_name="Brixton",
            city="London",
            country="UK",
            event_date=datetime(2025, 5, 1),
        )
    )
    db_session.commit()

    artists = get_user_discovery_artists(
        db_session,
        user.id,
        {
            "my_artists_mode": "min_plays",
            "my_artists_min_plays": 5,
            "my_artists_months": 12,
            "include_seen_live": True,
        },
    )
    assert "artist a" in artists
    assert "seen live band" in artists
    assert "artist b" not in artists
    assert "artist c" not in artists

    artists_no_live = get_user_discovery_artists(
        db_session,
        user.id,
        {
            "my_artists_mode": "top_n",
            "my_artists_limit": 1,
            "my_artists_months": 12,
            "include_seen_live": False,
        },
    )
    assert artists_no_live == {"artist a"}


def test_sync_discovered_gigs_upserts_multi_attraction_and_prunes_past(db_session: Session, monkeypatch):
    user = User(spotify_user_id="sp-2", username="u2", display_name="U2", refresh_token_cipher="c")
    db_session.add(user)
    db_session.flush()
    db_session.add(UserPreferences(user_id=user.id, home_city="London", home_lat=51.5074, home_lng=-0.1278))
    db_session.add(
        ListeningEvent(
            user_id=user.id,
            track_id="t1",
            track_name="Boys in the Better Land",
            artist_name="Fontaines D.C.",
            played_at=utc_now() - timedelta(days=2),
            source="spotify",
        )
    )
    # Past event that should be pruned
    db_session.add(
        DiscoveredGig(
            source="ticketmaster",
            external_id="old-1",
            artist_name="Old Band",
            artist_key="old band",
            attraction_names=["Old Band"],
            attraction_keys=["old band"],
            event_name="Old Show",
            venue_name="Old Venue",
            city="London",
            country_code="GB",
            event_date=date.today() - timedelta(days=5),
        )
    )
    db_session.commit()

    future_date = (date.today() + timedelta(days=10)).isoformat()
    sample_event = {
        "id": "tm-999",
        "name": "Festival Night",
        "url": "https://www.ticketmaster.co.uk/event/tm-999",
        "dates": {
            "start": {"localDate": future_date, "localTime": "19:30:00"},
            "status": {"code": "onsale"},
        },
        "sales": {"public": {"startDateTime": "2026-11-10T09:00:00Z"}},
        "images": [{"url": "https://s1.ticketm.net/img.jpg", "width": 640}],
        "_embedded": {
            "attractions": [{"name": "Headliner"}, {"name": "Fontaines D.C."}],
            "venues": [
                {
                    "name": "Finsbury Park",
                    "city": {"name": "London"},
                    "country": {"countryCode": "GB"},
                    "location": {"latitude": "51.5642", "longitude": "-0.1062"},
                }
            ],
        },
    }

    fake_client = MagicMock(spec=TicketmasterClient)
    fake_client.api_key = "test-key"
    fake_client.search_events.return_value = [sample_event]

    monkeypatch.setattr(
        "backend.app.services.gig_discovery_sync_service.TicketmasterClient",
        lambda *args, **kwargs: fake_client,
    )

    stats = sync_discovered_gigs(db_session)
    assert stats["upserted"] >= 1
    assert stats["pruned"] == 1

    gig = db_session.query(DiscoveredGig).filter_by(external_id="tm-999").one()
    assert gig.artist_name == "Headliner"
    assert gig.attraction_keys == ["headliner", "fontaines d.c."]
    assert gig.country_code == "GB"
    assert gig.onsale_start_at is not None
    assert db_session.query(DiscoveredGig).filter_by(external_id="old-1").first() is None


def test_ticketmaster_event_returned_by_two_searches_is_stored_once(db_session: Session, monkeypatch):
    user = User(spotify_user_id="sp-dup", username="ud", display_name="UD", refresh_token_cipher="c")
    db_session.add(user)
    db_session.flush()
    db_session.add(UserPreferences(user_id=user.id, home_city="London", home_lat=51.5074, home_lng=-0.1278))
    db_session.add(
        ListeningEvent(
            user_id=user.id,
            track_id="t1",
            track_name="Song",
            artist_name="Headliner",
            played_at=utc_now() - timedelta(days=2),
            source="spotify",
        )
    )
    db_session.commit()

    day = (date.today() + timedelta(days=10)).isoformat()
    event = {
        "id": "tm-dup",
        "name": "Headliner Live",
        "url": "https://www.ticketmaster.co.uk/event/tm-dup",
        "dates": {"start": {"localDate": day}, "status": {"code": "onsale"}},
        "_embedded": {"attractions": [{"name": "Headliner"}], "venues": [{"name": "V", "city": {"name": "London"}}]},
    }
    fake_client = MagicMock(spec=TicketmasterClient)
    fake_client.api_key = "test-key"
    fake_client.search_events.return_value = [event, event]  # same gig, artist search and local search
    monkeypatch.setattr(
        "backend.app.services.gig_discovery_sync_service.TicketmasterClient",
        lambda *args, **kwargs: fake_client,
    )
    sync_discovered_gigs(db_session)
    assert fake_client.search_events.call_count >= 2
    assert db_session.query(DiscoveredGig).filter_by(external_id="tm-dup").count() == 1
