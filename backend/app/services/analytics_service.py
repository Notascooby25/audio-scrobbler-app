from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..models import LikedTrack
from ..queries.analytics_queries import (
    build_library_count_query,
    build_library_entities_query,
    build_library_entity_count_query,
    build_library_scrobbles_query,
    build_monthly_summary_query,
    build_recent_scrobbles_query,
    build_scrobbles_timeline_query,
    build_report_clock_query,
    build_report_period_count_query,
    build_report_weekly_query,
    build_stats_summary_query,
    build_top_entities_query,
)
from ..schemas.analytics import (
    ChartEntry,
    ChartResponse,
    MonthlySummaryEntry,
    MonthlySummaryResponse,
    LibraryEntry,
    LibraryResponse,
    LibraryScrobbleEntry,
    LibraryScrobbleResponse,
    ReportChartsResponse,
    ReportPoint,
    ReportSummaryResponse,
    ScrobbleListEntry,
    ScrobbleListResponse,
    StatsResponse,
    TimelineEntry,
    TimelineResponse,
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
            artwork_url=getattr(row, "artwork_url", None),
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
            entries.append(ChartEntry(label=row.artist_name, secondary=None, play_count=row.play_count, artwork_url=getattr(row, "artwork_url", None)))
        elif entity == "tracks":
            entries.append(ChartEntry(label=row.track_name, secondary=row.artist_name, play_count=row.play_count, artwork_url=getattr(row, "artwork_url", None)))
        else:
            entries.append(ChartEntry(label=row.album_name, secondary=row.artist_name, play_count=row.play_count, artwork_url=getattr(row, "artwork_url", None)))

    return ChartResponse(user_id=user_id, entity=entity, range=range_key, entries=entries)


def get_stats_summary(db: Session, user_id: int) -> StatsResponse:
    row = db.execute(build_stats_summary_query(user_id)).one()
    return StatsResponse(
        user_id=user_id,
        total_scrobbles=int(row.total_scrobbles),
        unique_artists=int(row.unique_artists),
        loved_tracks=db.query(LikedTrack).filter(LikedTrack.user_id == user_id).count(),
    )


def get_library_scrobbles(db: Session, user_id: int, limit: int, offset: int) -> LibraryScrobbleResponse:
    rows = db.execute(build_library_scrobbles_query(user_id, limit, offset)).all()
    total_count = db.execute(build_library_count_query(user_id)).scalar_one()
    scrobbles = [
        LibraryScrobbleEntry(
            id=row.id,
            track_name=row.track_name,
            artist_name=row.artist_name,
            source=row.source,
            played_at=row.played_at,
        )
        for row in rows
    ]
    return LibraryScrobbleResponse(
        user_id=user_id,
        scrobbles=scrobbles,
        limit=limit,
        offset=offset,
        total_count=int(total_count),
    )


def get_library_entities(db: Session, user_id: int, entity: str, limit: int, offset: int) -> LibraryResponse:
    rows = db.execute(build_library_entities_query(user_id, entity, limit, offset)).all()
    total_count = db.execute(build_library_entity_count_query(user_id, entity)).scalar_one()
    entries = []
    for row in rows:
        if entity == "artists":
            entries.append(LibraryEntry(label=row.artist_name, play_count=int(row.play_count), artwork_url=getattr(row, "artwork_url", None)))
        elif entity == "albums":
            entries.append(LibraryEntry(label=row.album_name, secondary=row.artist_name, play_count=int(row.play_count), artwork_url=getattr(row, "artwork_url", None)))
        else:
            entries.append(LibraryEntry(label=row.track_name, secondary=row.artist_name, play_count=int(row.play_count), artwork_url=getattr(row, "artwork_url", None)))
    return LibraryResponse(user_id=user_id, entries=entries, limit=limit, offset=offset, total_count=int(total_count))


def get_scrobbles_timeline(db: Session, user_id: int) -> TimelineResponse:
    rows = db.execute(build_scrobbles_timeline_query(user_id)).all()
    return TimelineResponse(
        user_id=user_id,
        entries=[TimelineEntry(period=row.period, count=int(row.count)) for row in rows],
    )


def get_report_summary(db: Session, user_id: int) -> ReportSummaryResponse:
    now = datetime.utcnow()
    period_start = now - timedelta(days=7)
    previous_start = period_start - timedelta(days=7)
    total = db.execute(build_library_count_query(user_id)).scalar_one()
    current = db.execute(build_report_period_count_query(user_id, period_start, now)).one()
    previous = db.execute(build_report_period_count_query(user_id, previous_start, period_start)).one()
    previous_count = int(previous.scrobble_count)
    current_count = int(current.scrobble_count)
    comparison = ((current_count - previous_count) / previous_count * 100) if previous_count else 0.0
    return ReportSummaryResponse(
        user_id=user_id,
        total_scrobbles=int(total),
        period_scrobbles=current_count,
        previous_period_scrobbles=previous_count,
        comparison_percent=round(comparison, 1),
        listening_minutes=int(current.duration_ms // 60000),
        average_per_day=round(current_count / 7, 1),
    )


def get_report_charts(db: Session, user_id: int) -> ReportChartsResponse:
    now = datetime.utcnow()
    start = now - timedelta(days=7)
    weekly_rows = db.execute(build_report_weekly_query(user_id, start, now)).all()
    clock_rows = db.execute(build_report_clock_query(user_id, start, now)).all()
    return ReportChartsResponse(
        user_id=user_id,
        weekly_scrobbles=[ReportPoint(label=row.label, count=int(row.count)) for row in weekly_rows],
        listening_clock=[ReportPoint(label=str(int(row.label)), count=int(row.count)) for row in clock_rows],
        music_by_decade=[],
    )
