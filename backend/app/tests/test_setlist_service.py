from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import SetlistApiUsage, SetlistCache
from backend.app.services.setlist_service import SetlistRateLimitError, SetlistService


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
