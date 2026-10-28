from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import AttendedConcert, ListeningEvent, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


class DemoUser:
    id = 42
    spotify_user_id = "spotify_user_42"
    username = "crispylettuce"
    display_name = "Crispy Lettuce"


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: DemoUser()
    db = TestingSession()
    db.query(ListeningEvent).delete()
    db.query(AttendedConcert).delete()
    db.query(User).delete()
    db.add(
        User(
            id=42,
            spotify_user_id="spotify_user_42",
            username="crispylettuce",
            display_name="Crispy Lettuce",
            refresh_token_cipher="dummy",
            is_active=True,
        )
    )
    db.commit()
    db.close()


def teardown_function():
    app.dependency_overrides.clear()


def test_setlist_routes_crud():
    mock_setlist_data = {
        "id": "show_123",
        "artist": {"name": "Public Service Broadcasting", "mbid": "psb_mbid"},
        "venue": {"name": "Alexandra Palace", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
        "eventDate": "26-09-2026",
        "tour": {"name": "Space Tour"},
        "url": "https://setlist.fm/psb1",
        "sets": {"set": [{"song": [{"name": "Gagarin"}, {"name": "Go!"}]}]},
    }

    with patch("backend.app.api.setlists.SetlistService") as MockServiceCls:
        mock_svc = MockServiceCls.return_value
        mock_svc.search_setlists.return_value = {"total": 1, "setlist": [mock_setlist_data]}
        mock_svc.get_setlist.return_value = mock_setlist_data
        mock_svc.get_venue_date_setlists.return_value = []

        # 1. Search
        search_res = client.get("/api/setlists/search?artist_name=Public+Service+Broadcasting")
        assert search_res.status_code == 200
        assert search_res.json()["total"] == 1

        # 2. Log attendance
        attend_res = client.post("/api/setlists/attend", json={"setlist_id": "show_123", "support_setlist_ids": []})
        assert attend_res.status_code == 201
        logged_concert = attend_res.json()
        assert logged_concert["artist_name"] == "Public Service Broadcasting"
        concert_id = logged_concert["id"]

        # 3. Get attendances (My Gigs)
        gigs_res = client.get("/api/setlists/attendances")
        assert gigs_res.status_code == 200
        assert len(gigs_res.json()) == 1

        # 4. Stats endpoints
        artists_res = client.get("/api/setlists/stats/artists")
        assert artists_res.status_code == 200
        assert len(artists_res.json()) == 1
        assert artists_res.json()[0]["artist_name"] == "Public Service Broadcasting"

        songs_res = client.get("/api/setlists/stats/songs")
        assert songs_res.status_code == 200
        assert len(songs_res.json()) == 2

        venues_res = client.get("/api/setlists/stats/venues")
        assert venues_res.status_code == 200
        assert len(venues_res.json()) == 1
        assert venues_res.json()[0]["venue_name"] == "Alexandra Palace"

        # 5. Export
        export_json = client.get("/api/setlists/export?format=json")
        assert export_json.status_code == 200
        assert "Public Service Broadcasting" in export_json.text

        export_csv = client.get("/api/setlists/export?format=csv")
        assert export_csv.status_code == 200
        assert "Alexandra Palace" in export_csv.text

        # 6. Delete gig
        del_res = client.delete(f"/api/setlists/{concert_id}?include_support_acts=true")
        assert del_res.status_code == 200
        assert del_res.json()["deleted_count"] == 1

        # Verify attendances now empty
        empty_gigs = client.get("/api/setlists/attendances")
        assert empty_gigs.status_code == 200
        assert len(empty_gigs.json()) == 0
