from __future__ import annotations

from datetime import date
from sqlalchemy import func, select

from ..models import ListeningEvent


def _parse_month(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(f"{value}-01")
    except ValueError as exc:
        raise ValueError(f"Invalid month format: {value!r}. Expected YYYY-MM.") from exc


def _month_end(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def build_monthly_summary_query(
    user_id: int,
    from_month: str | None = None,
    to_month: str | None = None,
):
    from_date = _parse_month(from_month) or date.min
    to_date = _parse_month(to_month) or date.today().replace(day=1)
    if from_date > to_date:
        raise ValueError("from_month must be earlier than or equal to to_month")

    month_expr = func.date_trunc("month", ListeningEvent.played_at)
    return (
        select(
            func.to_char(month_expr, "YYYY-MM").label("month"),
            func.count(ListeningEvent.id).label("total_plays"),
            func.count(func.distinct(ListeningEvent.track_id)).label("unique_tracks"),
            func.coalesce(func.sum(ListeningEvent.duration_ms), 0).label("total_duration_ms"),
        )
        .where(ListeningEvent.user_id == user_id)
        .where(ListeningEvent.played_at >= from_date)
        .where(ListeningEvent.played_at < _month_end(to_date))
        .group_by(month_expr)
        .order_by(month_expr)
    )


def build_recent_scrobbles_query(user_id: int, limit: int, offset: int):
    return (
        select(
            ListeningEvent.id,
            ListeningEvent.track_name,
            ListeningEvent.artist_name,
            ListeningEvent.source,
            ListeningEvent.played_at,
        )
        .where(ListeningEvent.user_id == user_id)
        .order_by(ListeningEvent.played_at.desc())
        .limit(limit)
        .offset(offset)
    )
