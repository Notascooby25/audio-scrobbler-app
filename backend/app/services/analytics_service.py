from __future__ import annotations

from sqlalchemy.orm import Session

from ..queries.analytics_queries import (
    build_monthly_summary_query,
    build_recent_scrobbles_query,
    build_top_entities_query,
)
from ..schemas.analytics import (
    ChartEntry,
    ChartResponse,
    MonthlySummaryEntry,
    MonthlySummaryResponse,
    ScrobbleListEntry,
    ScrobbleListResponse,
)


def get_monthly_summary(
    db: Session,
    user_id: int,
    from_month: str | None = None,
    to_month: str | None = None,
) -> MonthlySummaryResponse:
    statement = build_monthly_summary_query(
        user_id=user_id,
        from_month=from_month,
        to_month=to_month,
    )
    rows = db.execute(statement).all()

    summary = [
        MonthlySummaryEntry(
            month=row.month,
            total_plays=int(row.total_plays),
            unique_tracks=int(row.unique_tracks),
            total_listening_minutes=int(getattr(row, "total_duration_ms", 0) // 60000),
        )
        for row in rows
    ]

    return MonthlySummaryResponse(
        user_id=user_id,
        summary=summary,
        total_months=len(summary),
    )


def get_recent_scrobbles(
    db: Session,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> ScrobbleListResponse:
    statement = build_recent_scrobbles_query(user_id=user_id, limit=limit, offset=offset)
    rows = db.execute(statement).all()

    scrobbles = [
        ScrobbleListEntry(
            id=row.id,
            track_name=row.track_name,
            artist_name=row.artist_name,
            source=row.source,
            played_at=row.played_at,
        )
        for row in rows
    ]

    return ScrobbleListResponse(
        user_id=user_id,
        scrobbles=scrobbles,
        limit=limit,
        offset=offset,
    )


def get_user_charts(
    db: Session,
    user_id: int,
    entity: str,
    range_key: str,
    limit: int = 10,
) -> ChartResponse:
    statement = build_top_entities_query(user_id=user_id, entity=entity, range_key=range_key, limit=limit)
    rows = db.execute(statement).all()

    entries = []
    for row in rows:
        if entity == "artists":
            entries.append(ChartEntry(label=row.artist_name, secondary=None, play_count=row.play_count))
        elif entity == "tracks":
            entries.append(ChartEntry(label=row.track_name, secondary=row.artist_name, play_count=row.play_count))
        else:
            entries.append(ChartEntry(label=row.album_name, secondary=row.artist_name, play_count=row.play_count))

    return ChartResponse(user_id=user_id, entity=entity, range=range_key, entries=entries)
