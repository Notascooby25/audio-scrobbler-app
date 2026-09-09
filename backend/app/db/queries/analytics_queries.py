from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select

from backend.app.models import ListeningEvent


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
    user_id: UUID,
    from_month: str | None = None,
    to_month: str | None = None,
):
    from_date = _parse_month(from_month) or date.today().replace(day=1)
    to_date = _parse_month(to_month) or date.today().replace(day=1)

    month_expr = func.date_trunc("month", ListeningEvent.played_at)
    statement = (
        select(
            func.to_char(month_expr, "YYYY-MM").label("month"),
            func.count(ListeningEvent.id).label("total_plays"),
            func.count(func.distinct(ListeningEvent.track_id)).label("unique_tracks"),
            func.coalesce(func.sum(ListeningEvent.source), 0).label("total_duration_ms"),
        )
        .where(ListeningEvent.user_id == user_id)
        .where(ListeningEvent.played_at >= from_date)
        .where(ListeningEvent.played_at < _month_end(to_date))
        .group_by(month_expr)
        .order_by(month_expr)
    )
    return statement
