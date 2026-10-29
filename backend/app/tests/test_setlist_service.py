from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import SetlistApiUsage, SetlistCache
from backend.app.services.setlist_service import (
    SetlistApiAuthError,
    SetlistApiKeyMissingError,
    SetlistRateLimitError,
    SetlistService,
    extract_setlist_id,
    sanitize_setlist_username,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_rate_limiter_spacing_and_daily_cap(db_session: Session):
    service = SetlistService(db=db_session, api_key="dummy_key")

    # Call 1 should succeed and create SetlistApiUsage record
    service._acquire_rate_limit()
    usage = db_session.query(SetlistApiUsage).filter_by(id=1).first()
    assert usage is not None
    assert usage.daily_count == 1

    # Simulate daily cap reached (1440 limit, 1400 safety cap)
    usage.daily_count = 1400
    db_session.commit()

    with pytest.raises(SetlistRateLimitError, match="Daily Setlist.fm API quota reached"):
        service._acquire_rate_limit()


def test_get_setlist_uses_cache(db_session: Session):
    service = SetlistService(db=db_session, api_key="dummy_key")

    mock_response = {
        "id": "abc12345",
        "artist": {"name": "Public Service Broadcasting"},
        "venue": {"name": "Alexandra Palace", "city": {"name": "London", "country": {"name": "United Kingdom"}}},
        "eventDate": "26-09-2026",
        "sets": {"set": [{"song": [{"name": "Gagarin"}, {"name": "Go!"}]}]},
    }

    # Pre-populate cache
    cache = SetlistCache(
        cache_key="setlist:abc12345",
        response_json=mock_response,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(cache)
    db_session.commit()

    with patch("httpx.get") as mock_get:
        res = service.get_setlist("abc12345")
        assert res == mock_response
        mock_get.assert_not_called()


def test_search_setlists_http_and_caching(db_session: Session):
    service = SetlistService(db=db_session, api_key="dummy_key")

    mock_data = {
        "total": 1,
        "page": 1,
        "itemsPerPage": 20,
        "setlist": [
            {
                "id": "foo123",
                "artist": {"name": "Foo Fighters"},
                "venue": {"name": "Anfield"},
                "eventDate": "27-06-2026",
            }
        ],
    }

    with patch("httpx.get") as mock_get:
        mock_http_resp = MagicMock()
        mock_http_resp.status_code = 200
        mock_http_resp.json.return_value = mock_data
        mock_get.return_value = mock_http_resp

        res = service.search_setlists(artist_name="Foo Fighters", country_code="GB", year=2026)
        assert res["total"] == 1
        assert res["setlist"][0]["id"] == "foo123"
        mock_get.assert_called_once()

    # Second call should read from SetlistCache
    with patch("httpx.get") as mock_get:
        cached_res = service.search_setlists(artist_name="Foo Fighters", country_code="GB", year=2026)
        assert cached_res["total"] == 1
        mock_get.assert_not_called()


def test_support_acts_festival_capping(db_session: Session):
    """Review Focus 1: Festival lineups with >10 artists are capped to protect UI and quota."""
    service = SetlistService(db=db_session, api_key="dummy_key")

    many_acts = [{"id": f"act_{i}", "artist": {"name": f"Band {i}"}, "eventDate": "27-06-2026"} for i in range(25)]
    mock_data = {"setlist": many_acts}

    with patch.object(service, "search_setlists_raw", return_value=mock_data):
        support_acts = service.get_venue_date_setlists(
            venue_id="venue_fest_1", event_date_str="27-06-2026", exclude_setlist_id="act_0"
        )
        # Should be capped at 10 items max
        assert len(support_acts) <= 10
        # Excluded main setlist should not be in results
        assert all(act["id"] != "act_0" for act in support_acts)


def test_missing_api_key_raises_error(db_session: Session):
    service = SetlistService(db=db_session, api_key="")
    with pytest.raises(SetlistApiKeyMissingError, match="Setlist.fm API key is not configured"):
        service._request("/search/setlists")


def test_api_key_auth_rejection_raises_error(db_session: Session):
    service = SetlistService(db=db_session, api_key="invalid_key")
    with patch("httpx.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_get.return_value = mock_resp
        with pytest.raises(SetlistApiAuthError, match="Setlist.fm API key was rejected"):
            service._request("/search/setlists")


def test_sanitize_setlist_username():
    assert sanitize_setlist_username("crispylettuce") == "crispylettuce"
    assert sanitize_setlist_username("Crispylettuce") == "Crispylettuce"
    assert sanitize_setlist_username("https://www.setlist.fm/user/crispylettuce") == "crispylettuce"
    assert sanitize_setlist_username("https://www.setlist.fm/user/Crispylettuce/") == "Crispylettuce"
    assert sanitize_setlist_username("https://www.setlist.fm/attended/crispylettuce") == "crispylettuce"
    assert sanitize_setlist_username("https://www.setlist.fm/attended/Crispylettuce/") == "Crispylettuce"
    assert sanitize_setlist_username("https://www.setlist.fm/concerts/crispylettuce") == "crispylettuce"
    assert sanitize_setlist_username("  CRISPYLETTUCE/  ") == "CRISPYLETTUCE"


def test_get_user_attended_multi_casing_fallback(db_session: Session):
    service = SetlistService(db=db_session, api_key="test_key")

    with patch.object(service, "_request") as mock_req:
        # First call with lowercase returns empty, second call with Capitalized returns results
        mock_req.side_effect = [
            {"total": 0, "setlist": []},
            {"total": 5, "setlist": [{"id": "show_1"}]},
        ]

        data = service.get_user_attended("crispylettuce")
        assert data["total"] == 5
        assert len(data["setlist"]) == 1
        assert mock_req.call_count == 2
        assert mock_req.call_args_list[0][0][0] == "/user/crispylettuce/attended"
        assert mock_req.call_args_list[1][0][0] == "/user/Crispylettuce/attended"


def test_search_setlists_month_filter(db_session: Session):
    service = SetlistService(db=db_session, api_key="test_key")
    raw_results = {
        "total": 3,
        "page": 1,
        "itemsPerPage": 20,
        "setlist": [
            {"id": "show_nov_3", "artist": {"name": "The Snuts"}, "eventDate": "03-11-2026"},
            {"id": "show_nov_4", "artist": {"name": "The Snuts"}, "eventDate": "04-11-2026"},
            {"id": "show_oct_30", "artist": {"name": "The Snuts"}, "eventDate": "30-10-2026"},
        ],
    }

    with patch.object(service, "search_setlists_raw", return_value=raw_results):
        # Filter by November (11)
        res_nov = service.search_setlists(artist_name="The Snuts", month=11)
        assert len(res_nov["setlist"]) == 2
        assert res_nov["setlist"][0]["id"] == "show_nov_3"
        assert res_nov["setlist"][1]["id"] == "show_nov_4"

        # Filter by October (10)
        res_oct = service.search_setlists(artist_name="The Snuts", month=10)
        assert len(res_oct["setlist"]) == 1
        assert res_oct["setlist"][0]["id"] == "show_oct_30"

        # Filter by December (12) -> empty
        res_dec = service.search_setlists(artist_name="The Snuts", month=12)
        assert len(res_dec["setlist"]) == 0


def test_extract_setlist_id():
    assert (
        extract_setlist_id(
            "https://www.setlist.fm/setlist/public-service-broadcasting/2026/alexandra-palace-london-england-334a28f1.html"
        )
        == "334a28f1"
    )
    assert (
        extract_setlist_id("https://www.setlist.fm/show/2026-11-14/o2-academy-birmingham-england-334a28f1.html")
        == "334a28f1"
    )
    assert extract_setlist_id("334a28f1") == "334a28f1"
    assert extract_setlist_id("3bd69926") == "3bd69926"
    assert (
        extract_setlist_id("https://www.setlist.fm/setlist/artist/year/venue-334a28f1.html?foo=bar#top") == "334a28f1"
    )
    assert extract_setlist_id("Not a setlist") is None
    assert extract_setlist_id("") is None


def test_search_setlists_direct_url_or_id(db_session: Session):
    service = SetlistService(db=db_session, api_key="test_key")
    single_show = {"id": "334a28f1", "artist": {"name": "Shed Seven"}, "eventDate": "14-11-2026"}

    with patch.object(service, "get_setlist", return_value=single_show) as mock_get:
        # 1. Via setlist_url_or_id
        res = service.search_setlists(setlist_url_or_id="334a28f1")
        assert res["total"] == 1
        assert res["setlist"][0]["id"] == "334a28f1"
        mock_get.assert_called_with("334a28f1")

        # 2. Via artist_name containing full Setlist.fm URL
        res2 = service.search_setlists(
            artist_name="https://www.setlist.fm/show/2026-11-14/o2-academy-birmingham-england-334a28f1.html"
        )
        assert res2["total"] == 1
        assert res2["setlist"][0]["id"] == "334a28f1"
