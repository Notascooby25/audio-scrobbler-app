from __future__ import annotations

from datetime import date, datetime, timedelta
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


def build_recent_scrobbles_query(user_id: int, limit: int, offset: int, start: datetime | None = None, end: datetime | None = None):
    statement = (
        select(
            ListeningEvent.id,
            ListeningEvent.track_name,
            ListeningEvent.artist_name,
            ListeningEvent.source,
            ListeningEvent.played_at,
            ListeningEvent.artwork_url,
            ListeningEvent.track_id.label("spotify_track_id"),
        )
        .where(ListeningEvent.user_id == user_id)
    )
    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
        if end is not None:
            statement = statement.where(ListeningEvent.played_at < end)
    return statement.order_by(ListeningEvent.played_at.desc()).limit(limit).offset(offset)


CHART_RANGE_TO_DAYS = {"7day": 7, "1month": 30, "12month": 365}
CHART_ENTITIES = ("artists", "tracks", "albums")
CHART_RANGES = (*CHART_RANGE_TO_DAYS.keys(), "overall")

DATE_RANGE_PRESETS = ("last.week", "last.month", "last.year", "custom")


def build_top_entities_query(
    user_id: int,
    entity: str,
    range_key: str,
    limit: int = 10,
    start: datetime | None = None,
    end: datetime | None = None,
):
    if entity == "artists":
        group_columns = [ListeningEvent.artist_name]
    elif entity == "tracks":
        group_columns = [ListeningEvent.track_name, ListeningEvent.artist_name]
    elif entity == "albums":
        group_columns = [ListeningEvent.album_name, ListeningEvent.artist_name]
    else:
        raise ValueError(f"Unsupported chart entity: {entity!r}")

    artwork_column = ListeningEvent.artist_artwork_url if entity == "artists" else ListeningEvent.artwork_url
    selected_columns = [*group_columns, func.max(artwork_column).label("artwork_url"), func.count(ListeningEvent.id).label("play_count")]
    if entity == "tracks":
        selected_columns.append(func.max(ListeningEvent.track_id).label("spotify_track_id"))
    statement = select(*selected_columns).where(
        ListeningEvent.user_id == user_id
    )
    if entity == "albums":
        statement = statement.where(ListeningEvent.album_name.isnot(None))

    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
        if end is not None:
            statement = statement.where(ListeningEvent.played_at < end)
    else:
        days = CHART_RANGE_TO_DAYS.get(range_key)
        if days is not None:
            cutoff = datetime.utcnow() - timedelta(days=days)
            statement = statement.where(ListeningEvent.played_at >= cutoff)
        elif range_key != "overall":
            raise ValueError(f"Unsupported chart range: {range_key!r}")

    return (
        statement.group_by(*group_columns)
        .order_by(func.count(ListeningEvent.id).desc())
        .limit(limit)
    )


def resolve_date_range(
    range_key: str,
    start_date: str | None = None,
    end_date: str | None = None,
    now: datetime | None = None,
) -> tuple[datetime, datetime, datetime, datetime, str]:
    """Resolve a preset or custom date range into (period_start, period_end, previous_start, previous_end, granularity)."""
    now = now or datetime.utcnow()

    if range_key == "last.week":
        period_start, period_end, granularity = now - timedelta(days=7), now, "day"
    elif range_key == "last.month":
        period_start, period_end, granularity = now - timedelta(days=30), now, "day"
    elif range_key == "last.year":
        period_start, period_end, granularity = now - timedelta(days=365), now, "month"
    elif range_key == "custom":
        if not start_date or not end_date:
            raise ValueError("start_date and end_date are required for a custom range")
        period_start = datetime.fromisoformat(start_date)
        period_end = datetime.fromisoformat(end_date)
        if period_start > period_end:
            raise ValueError("start_date must be earlier than or equal to end_date")
        granularity = "day" if (period_end - period_start) <= timedelta(days=62) else "month"
    else:
        raise ValueError(f"Unsupported date range: {range_key!r}")

    span = period_end - period_start
    previous_end = period_start
    previous_start = period_start - span
    return period_start, period_end, previous_start, previous_end, granularity


def build_report_monthly_query(user_id: int, start: datetime, end: datetime):
    month_expr = func.date_trunc("month", ListeningEvent.played_at)
    return (
        select(func.to_char(month_expr, "YYYY-MM").label("label"), func.count(ListeningEvent.id).label("count"))
        .where(ListeningEvent.user_id == user_id, ListeningEvent.played_at >= start, ListeningEvent.played_at < end)
        .group_by(month_expr)
        .order_by(month_expr)
    )


def build_stats_summary_query(user_id: int):
    return select(
        func.count(ListeningEvent.id).label("total_scrobbles"),
        func.count(func.distinct(ListeningEvent.artist_name)).label("unique_artists"),
    ).where(ListeningEvent.user_id == user_id)


def build_library_scrobbles_query(user_id: int, limit: int, offset: int, start: datetime | None = None, end: datetime | None = None):
    return build_recent_scrobbles_query(user_id=user_id, limit=limit, offset=offset, start=start, end=end)


def build_library_count_query(user_id: int, start: datetime | None = None, end: datetime | None = None):
    statement = select(func.count(ListeningEvent.id)).where(ListeningEvent.user_id == user_id)
    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
        if end is not None:
            statement = statement.where(ListeningEvent.played_at < end)
    return statement


def build_library_entities_query(
    user_id: int,
    entity: str,
    limit: int,
    offset: int,
    start: datetime | None = None,
    end: datetime | None = None,
):
    if entity == "artists":
        group_columns = [ListeningEvent.artist_name]
    elif entity == "albums":
        group_columns = [ListeningEvent.album_name, ListeningEvent.artist_name]
    elif entity == "tracks":
        group_columns = [ListeningEvent.track_name, ListeningEvent.artist_name]
    else:
        raise ValueError(f"Unsupported library entity: {entity!r}")

    statement = select(*group_columns, func.max(ListeningEvent.artwork_url).label("artwork_url"), func.count(ListeningEvent.id).label("play_count")).where(
        ListeningEvent.user_id == user_id
    )
    if entity == "albums":
        statement = statement.where(ListeningEvent.album_name.isnot(None))

    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
        if end is not None:
            statement = statement.where(ListeningEvent.played_at < end)

    return (
        statement.group_by(*group_columns)
        .order_by(func.count(ListeningEvent.id).desc())
        .limit(limit)
        .offset(offset)
    )


def build_library_entity_count_query(
    user_id: int,
    entity: str,
    start: datetime | None = None,
    end: datetime | None = None,
):
    if entity == "artists":
        value = ListeningEvent.artist_name
    elif entity == "albums":
        value = ListeningEvent.album_name
    elif entity == "tracks":
        value = ListeningEvent.track_name
    else:
        raise ValueError(f"Unsupported library entity: {entity!r}")

    statement = select(func.count(func.distinct(value))).where(ListeningEvent.user_id == user_id)
    if entity == "albums":
        statement = statement.where(value.isnot(None))
    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
        if end is not None:
            statement = statement.where(ListeningEvent.played_at < end)
    return statement


def build_scrobbles_timeline_query(user_id: int):
    year_expr = func.date_trunc("year", ListeningEvent.played_at)
    return (
        select(
            func.to_char(year_expr, "YYYY").label("period"),
            func.count(ListeningEvent.id).label("count"),
        )
        .where(ListeningEvent.user_id == user_id)
        .group_by(year_expr)
        .order_by(year_expr)
    )


def build_report_period_count_query(user_id: int, start: datetime, end: datetime):
    return select(
        func.count(ListeningEvent.id).label("scrobble_count"),
        func.coalesce(func.sum(ListeningEvent.duration_ms), 0).label("duration_ms"),
    ).where(
        ListeningEvent.user_id == user_id,
        ListeningEvent.played_at >= start,
        ListeningEvent.played_at < end,
    )


def build_report_weekly_query(user_id: int, start: datetime, end: datetime):
    day_expr = func.date_trunc("day", ListeningEvent.played_at)
    return (
        select(func.to_char(day_expr, "YYYY-MM-DD").label("label"), func.count(ListeningEvent.id).label("count"))
        .where(ListeningEvent.user_id == user_id, ListeningEvent.played_at >= start, ListeningEvent.played_at < end)
        .group_by(day_expr)
        .order_by(day_expr)
    )


def build_report_clock_query(user_id: int, start: datetime, end: datetime):
    hour_expr = func.extract("hour", ListeningEvent.played_at)
    return (
        select(hour_expr.label("label"), func.count(ListeningEvent.id).label("count"))
        .where(ListeningEvent.user_id == user_id, ListeningEvent.played_at >= start, ListeningEvent.played_at < end)
        .group_by(hour_expr)
        .order_by(hour_expr)
    )
