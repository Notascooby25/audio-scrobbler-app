from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Returns the current UTC datetime without tzinfo.

    This modernizes datetime.utcnow() (deprecated in Python 3.12+) while preserving
    strict compatibility with naive DateTime database columns across SQLite and PostgreSQL.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
