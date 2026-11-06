from __future__ import annotations

from datetime import datetime, timezone

from backend.app.datetime_utils import utc_now


def test_utc_now_returns_naive_datetime():
    now = utc_now()
    assert isinstance(now, datetime)
    # Must be naive (tzinfo is None) to match existing database models
    assert now.tzinfo is None


def test_utc_now_is_close_to_system_utc():
    before = datetime.now(timezone.utc).replace(tzinfo=None)
    now = utc_now()
    after = datetime.now(timezone.utc).replace(tzinfo=None)
    assert before <= now <= after
    assert abs((now - before).total_seconds()) < 1.0
