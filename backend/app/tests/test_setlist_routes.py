from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import ANY, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_current_user
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import AttendedConcert, ListeningEvent, User
from backend.app.services.setlist_service import SetlistApiKeyMissingError, SetlistUserNotFoundError

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
        search_res = client.get("/setlists/search?artist_name=Public+Service+Broadcasting")
        assert search_res.status_code == 200
        assert search_res.json()["total"] == 1

        search_month_res = client.get("/setlists/search?artist_name=Public+Service+Broadcasting&month=11")
        assert search_month_res.status_code == 200
        assert mock_svc.search_setlists.call_args[1]["month"] == 11

        # 2. Log attendance
        attend_res = client.post("/setlists/attend", json={"setlist_id": "show_123", "support_setlist_ids": []})
        assert attend_res.status_code == 201
        logged_concert = attend_res.json()
        assert logged_concert["artist_name"] == "Public Service Broadcasting"
        concert_id = logged_concert["id"]

        # 3. Get attendances (My Gigs)
        gigs_res = client.get("/setlists/attendances")
        assert gigs_res.status_code == 200
        assert len(gigs_res.json()) == 1

        # 4. Stats endpoints
        artists_res = client.get("/setlists/stats/artists")
        assert artists_res.status_code == 200
        assert len(artists_res.json()) == 1
        assert artists_res.json()[0]["artist_name"] == "Public Service Broadcasting"

        songs_res = client.get("/setlists/stats/songs")
        assert songs_res.status_code == 200
        assert len(songs_res.json()) == 2

        venues_res = client.get("/setlists/stats/venues")
        assert venues_res.status_code == 200
        assert len(venues_res.json()) == 1
        assert venues_res.json()[0]["venue_name"] == "Alexandra Palace"

        # 5. Export
        export_json = client.get("/setlists/export?format=json")
        assert export_json.status_code == 200
        assert "Public Service Broadcasting" in export_json.text

        export_csv = client.get("/setlists/export?format=csv")
        assert export_csv.status_code == 200
        assert "Alexandra Palace" in export_csv.text

        # 6. Patch gig notes
        notes_res = client.patch(f"/setlists/{concert_id}/notes", json={"notes": "Stood near sound desk, brilliant!"})
        assert notes_res.status_code == 200
        assert notes_res.json()["notes"] == "Stood near sound desk, brilliant!"

        # 7. Get setlist detail (logged)
        detail_res = client.get("/setlists/setlist/show_123")
        assert detail_res.status_code == 200
        assert detail_res.json()["already_logged"] is True
        assert detail_res.json()["notes"] == "Stood near sound desk, brilliant!"
        assert detail_res.json()["artist"]["name"] == "Public Service Broadcasting"

        # 8. Delete gig
        del_res = client.delete(f"/setlists/{concert_id}?include_support_acts=true")
        assert del_res.status_code == 200
        assert del_res.json()["deleted_count"] == 1

        # Verify attendances now empty
        empty_gigs = client.get("/setlists/attendances")
        assert empty_gigs.status_code == 200
        assert len(empty_gigs.json()) == 0


def test_import_preview_and_selective_import():
    mock_setlist_data = {
        "id": "show_preview_1",
        "artist": {"name": "Foo Fighters"},
        "venue": {"name": "London Stadium", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
        "eventDate": "27-06-2024",
        "tour": {"name": "Everything or Nothing at All"},
        "url": "https://setlist.fm/ff1",
        "sets": {"set": [{"song": [{"name": "All My Life"}, {"name": "Everlong"}]}]},
    }
    with (
        patch("backend.app.api.setlists.SetlistService") as MockServiceCls,
        patch("backend.app.api.setlists.sync_user_setlist_history") as mock_sync,
    ):
        mock_svc = MockServiceCls.return_value
        mock_svc.get_user_attended.return_value = {
            "total": 1,
            "itemsPerPage": 20,
            "setlist": [mock_setlist_data],
        }
        mock_sync.return_value = {"status": "completed", "imported_count": 1, "total_found": 1}

        # 1. Preview
        preview_res = client.get("/setlists/import/preview?username=crispylettuce&page=1")
        assert preview_res.status_code == 200
        preview_json = preview_res.json()
        assert preview_json["total"] == 1
        assert preview_json["items"][0]["setlist_id"] == "show_preview_1"
        assert preview_json["items"][0]["artist_name"] == "Foo Fighters"
        assert preview_json["items"][0]["already_logged"] is False

        # 2. Selective Import
        import_res = client.post(
            "/setlists/import",
            json={"username": "crispylettuce", "setlist_ids": ["show_preview_1"]},
        )
        assert import_res.status_code == 200
        assert import_res.json()["imported_count"] == 1
        mock_sync.assert_called_once_with(
            user_id=42,
            setlist_username="crispylettuce",
            db=ANY,
            selected_setlist_ids=["show_preview_1"],
        )


def test_setlist_status_and_missing_api_key():
    with patch("backend.app.api.setlists.SetlistService") as MockServiceCls:
        mock_svc = MockServiceCls.return_value
        mock_svc.get_status.return_value = {"configured": False, "daily_quota": 1400, "daily_count": 0}

        status_res = client.get("/setlists/status")
        assert status_res.status_code == 200
        assert status_res.json()["configured"] is False

        # Missing key raises 503
        mock_svc.search_setlists.side_effect = SetlistApiKeyMissingError("Setlist.fm API key is not configured.")
        search_res = client.get("/setlists/search?artist_name=Foo+Fighters")
        assert search_res.status_code == 503
        assert "not configured" in search_res.json()["detail"]

        # User not found raises 404
        mock_svc.get_user_attended.side_effect = SetlistUserNotFoundError("User not found.")
        preview_res = client.get("/setlists/import/preview?username=nonexistent")
        assert preview_res.status_code == 404


def test_log_manual_concert_route():
    payload = {
        "artist_name": "Shed Seven",
        "venue_name": "O2 Academy Birmingham",
        "city": "Birmingham",
        "country": "United Kingdom",
        "event_date": "2026-11-14",
        "notes": "Balcony tickets booked!",
    }
    res = client.post("/setlists/manual", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["artist_name"] == "Shed Seven"
    assert data["venue_name"] == "O2 Academy Birmingham"
    assert data["city"] == "Birmingham"
    assert data["notes"] == "Balcony tickets booked!"
    assert data["setlist_id"].startswith("manual-")

    # Verify it shows in attendances
    gigs_res = client.get("/setlists/attendances")
    assert gigs_res.status_code == 200
    assert any(g["artist_name"] == "Shed Seven" for g in gigs_res.json())


def test_get_single_attendance_is_owner_only():
    db = TestingSession()
    mine = AttendedConcert(
        user_id=42,
        setlist_id="mine_1",
        artist_name="Red Rum Club",
        venue_name="O2 Institute",
        city="Birmingham",
        country="United Kingdom",
        event_date=datetime(2026, 10, 16),
        song_count=22,
        notes="Front row",
    )
    theirs = AttendedConcert(
        user_id=7,
        setlist_id="theirs_1",
        artist_name="Doves",
        venue_name="Rock City",
        city="Nottingham",
        country="United Kingdom",
        event_date=datetime(2026, 1, 1),
    )
    db.add_all([mine, theirs])
    db.commit()
    mine_id, theirs_id = mine.id, theirs.id
    db.close()

    response = client.get(f"/setlists/attendances/{mine_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["artist_name"] == "Red Rum Club"
    assert body["notes"] == "Front row"

    # Another user's gig is indistinguishable from a missing one
    assert client.get(f"/setlists/attendances/{theirs_id}").status_code == 404
    assert client.get("/setlists/attendances/999999").status_code == 404


def test_list_attendances_returns_more_than_fifty_gigs():
    db = TestingSession()
    db.add_all(
        [
            AttendedConcert(
                user_id=42,
                setlist_id=f"bulk_{i}",
                artist_name=f"Band {i}",
                venue_name="Rock City",
                city="Nottingham",
                country="United Kingdom",
                event_date=datetime(2020, 1, 1) + timedelta(days=i),
            )
            for i in range(60)
        ]
    )
    db.commit()
    db.close()

    response = client.get("/setlists/attendances?limit=2000")
    assert response.status_code == 200
    assert len(response.json()) == 60
    assert client.get("/setlists/attendances?limit=2001").status_code == 422
