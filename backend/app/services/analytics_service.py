from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Follow, LikedTrack, ListeningEvent
from ..queries.analytics_queries import (
    build_report_heatmap_query,
    build_library_count_query,
    build_library_entities_query,
    build_library_entity_count_query,
    build_library_scrobbles_query,
    build_monthly_summary_query,
    build_recent_scrobbles_query,
    build_scrobbles_timeline_query,
    build_report_clock_query,
    build_report_monthly_query,
    build_report_period_count_query,
    build_report_weekly_query,
    build_report_decade_query,
    build_stats_summary_query,
    build_top_entities_query,
    resolve_date_range,
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
    HeatmapPoint,
    ReportChartsResponse,
    ReportPoint,
    ReportSummaryResponse,
    ScrobbleListEntry,
    ScrobbleListResponse,
    StatsResponse,
    TimelineEntry,
    TimelineResponse,
)


def _liked_track_ids(db: Session, user_id: int, candidate_ids: set[str]) -> set[str]:
    # Lightweight test doubles for `db` only implement `.execute()`, not the
    # ORM `.query()` API — skip gracefully rather than erroring on those.
    if not candidate_ids or not hasattr(db, "query"):
        return set()
    return {
        record.spotify_track_id
        for record in db.query(LikedTrack)
        .filter(LikedTrack.user_id == user_id, LikedTrack.spotify_track_id.in_(candidate_ids))
        .all()
    }


def _candidate_track_ids(rows) -> set[str]:
    return {track_id for row in rows if (track_id := getattr(row, "spotify_track_id", None))}


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
    liked_ids = _liked_track_ids(db, user_id, _candidate_track_ids(rows))

    scrobbles = [
        ScrobbleListEntry(
            id=row.id,
            track_name=row.track_name,
            artist_name=row.artist_name,
            source=row.source,
            played_at=row.played_at,
            artwork_url=getattr(row, "artwork_url", None),
            spotify_track_id=getattr(row, "spotify_track_id", None),
            is_liked=getattr(row, "spotify_track_id", None) in liked_ids,
        )
        for row in rows
    ]

    return ScrobbleListResponse(
        user_id=user_id,
        scrobbles=scrobbles,
        limit=limit,
        offset=offset,
    )


def _parse_sources(val: str | None) -> list[str]:
    if not val:
        return []
    return [s.strip() for s in str(val).split(",") if s.strip()]


def get_user_charts(
    db: Session,
    user_id: int,
    entity: str,
    range_key: str,
    limit: int = 10,
    start: datetime | None = None,
    end: datetime | None = None,
) -> ChartResponse:

    if entity == "genres":
        from ..models import GenreCache
        from ..queries.analytics_queries import build_report_genre_artist_counts_query
        from collections import Counter
        
        statement = build_report_genre_artist_counts_query(user_id=user_id, start=start, end=end)
        rows = db.execute(statement).all()
        artist_ids = {row.artist_id for row in rows if row.artist_id}
        
        genres_by_artist = {}
        if artist_ids:
            cache_rows = db.query(GenreCache).filter(GenreCache.artist_spotify_id.in_(artist_ids)).all()
            genres_by_artist = {r.artist_spotify_id: r.genres for r in cache_rows}
            
        counter = Counter()
        for row in rows:
            if not row.artist_id: continue
            genres = genres_by_artist.get(row.artist_id, [])
            for g in genres:
                counter[g] += row.play_count
                
        entries = [
            ChartEntry(label=g, secondary=None, play_count=count, artwork_url=None, sources=[])
            for g, count in counter.most_common(limit)
        ]
        return ChartResponse(user_id=user_id, entity=entity, range=range_key, entries=entries)

    statement = build_top_entities_query(user_id=user_id, entity=entity, range_key=range_key, limit=limit, start=start, end=end)
    rows = db.execute(statement).all()
    liked_ids = _liked_track_ids(db, user_id, _candidate_track_ids(rows)) if entity == "tracks" else set()

    entries = []
    for row in rows:
        row_sources = _parse_sources(getattr(row, "sources", None))
        if entity == "artists":
            entries.append(ChartEntry(label=row.artist_name, secondary=None, play_count=row.play_count, artwork_url=getattr(row, "artwork_url", None), sources=row_sources))
        elif entity == "tracks":
            track_id = getattr(row, "spotify_track_id", None)
            entries.append(ChartEntry(label=row.track_name, secondary=row.artist_name, play_count=row.play_count, artwork_url=getattr(row, "artwork_url", None), spotify_track_id=track_id, sources=row_sources, is_liked=track_id in liked_ids))
        else:
            entries.append(ChartEntry(label=row.album_name, secondary=row.artist_name, play_count=row.play_count, artwork_url=getattr(row, "artwork_url", None), sources=row_sources))

    return ChartResponse(user_id=user_id, entity=entity, range=range_key, entries=entries)


def get_stats_summary(db: Session, user_id: int) -> StatsResponse:
    row = db.execute(build_stats_summary_query(user_id)).one()
    return StatsResponse(
        user_id=user_id,
        total_scrobbles=int(row.total_scrobbles),
        unique_artists=int(row.unique_artists),
    )


def get_library_scrobbles(
    db: Session,
    user_id: int,
    limit: int,
    offset: int,
    start: datetime | None = None,
    end: datetime | None = None,
    filter_entity: str | None = None,
    filter_name: str | None = None,
    filter_secondary: str | None = None,
    search_query: str | None = None,
) -> LibraryScrobbleResponse:
    rows = db.execute(build_library_scrobbles_query(user_id, limit, offset, start, end, filter_entity, filter_name, filter_secondary, search_query)).all()
    total_count = db.execute(build_library_count_query(user_id, start, end, filter_entity, filter_name, filter_secondary, search_query)).scalar_one()
    liked_ids = _liked_track_ids(db, user_id, _candidate_track_ids(rows))
    scrobbles = [
        LibraryScrobbleEntry(
            id=row.id,
            track_name=row.track_name,
            artist_name=row.artist_name,
            source=row.source,
            played_at=row.played_at,
            artwork_url=getattr(row, "artwork_url", None),
            spotify_track_id=getattr(row, "spotify_track_id", None),
            is_liked=getattr(row, "spotify_track_id", None) in liked_ids,
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


def get_library_entities(
    db: Session,
    user_id: int,
    entity: str,
    limit: int,
    offset: int,
    start: datetime | None = None,
    end: datetime | None = None,
    search_query: str | None = None,
) -> LibraryResponse:
    rows = db.execute(build_library_entities_query(user_id, entity, limit, offset, start, end, search_query)).all()
    total_count = db.execute(build_library_entity_count_query(user_id, entity, start, end, search_query)).scalar_one()
    liked_ids = _liked_track_ids(db, user_id, _candidate_track_ids(rows)) if entity == "tracks" else set()
    entries = []
    for row in rows:
        row_sources = _parse_sources(getattr(row, "sources", None))
        if entity == "artists":
            entries.append(LibraryEntry(label=row.artist_name, play_count=int(row.play_count), artwork_url=getattr(row, "artwork_url", None), sources=row_sources))
        elif entity == "albums":
            entries.append(LibraryEntry(label=row.album_name, secondary=row.artist_name, play_count=int(row.play_count), artwork_url=getattr(row, "artwork_url", None), sources=row_sources))
        else:
            track_id = getattr(row, "spotify_track_id", None)
            entries.append(LibraryEntry(label=row.track_name, secondary=row.artist_name, play_count=int(row.play_count), artwork_url=getattr(row, "artwork_url", None), sources=row_sources, spotify_track_id=track_id, is_liked=track_id in liked_ids))
    return LibraryResponse(user_id=user_id, entries=entries, limit=limit, offset=offset, total_count=int(total_count))


def get_scrobbles_timeline(db: Session, user_id: int) -> TimelineResponse:
    rows = db.execute(build_scrobbles_timeline_query(user_id)).all()
    return TimelineResponse(
        user_id=user_id,
        entries=[TimelineEntry(period=row.period, count=int(row.count)) for row in rows],
    )


def get_report_summary(
    db: Session,
    user_id: int,
    range_key: str = "last.month",
    start_date: str | None = None,
    end_date: str | None = None,
    compare_to_previous: bool = True,
) -> ReportSummaryResponse:
    period_start, period_end, previous_start, previous_end, _granularity = resolve_date_range(range_key, start_date, end_date)
    total = db.execute(build_library_count_query(user_id)).scalar_one()
    current = db.execute(build_report_period_count_query(user_id, period_start, period_end)).one()
    current_count = int(current.scrobble_count)

    if range_key == "all.time":
        previous_count = 0
        comparison = 0.0
        earliest = db.query(func.min(ListeningEvent.played_at)).filter(ListeningEvent.user_id == user_id).scalar()
        days = max((period_end - earliest).days, 1) if earliest else 1
    else:
        previous_count = 0
        comparison = 0.0
        if compare_to_previous:
            previous = db.execute(build_report_period_count_query(user_id, previous_start, previous_end)).one()
            previous_count = int(previous.scrobble_count)
            comparison = ((current_count - previous_count) / previous_count * 100) if previous_count else 0.0
        days = max((period_end - period_start).days, 1)
    following_avg = None
    if range_key != "all.time":
        # Get list of followed user IDs
        followed_ids = [f.followee_id for f in db.query(Follow).filter(Follow.follower_id == user_id).all()]
        if followed_ids:
            # build_report_period_count_query already applies each user's own
            # not_blocked_clause internally, so calling it once per followed user
            # (rather than one combined query across all of them) means every
            # person's block rules are respected individually.
            total_follow_scrobbles = 0
            for f_id in followed_ids:
                f_count_row = db.execute(build_report_period_count_query(f_id, period_start, period_end)).one()
                total_follow_scrobbles += int(f_count_row.scrobble_count)
            following_avg = total_follow_scrobbles / len(followed_ids)

    return ReportSummaryResponse(
        user_id=user_id,
        range=range_key,
        total_scrobbles=int(total),
        period_scrobbles=current_count,
        previous_period_scrobbles=previous_count,
        comparison_percent=round(comparison, 1),
        listening_minutes=int(current.duration_ms // 60000),
        average_per_day=round(current_count / days, 1),
        following_average_scrobbles=round(following_avg, 1) if following_avg is not None else None,
    )


def get_report_charts(
    db: Session,
    user_id: int,
    range_key: str = "last.month",
    start_date: str | None = None,
    end_date: str | None = None,
) -> ReportChartsResponse:
    period_start, period_end, _previous_start, _previous_end, granularity = resolve_date_range(range_key, start_date, end_date)
    if granularity == "month":
        scrobble_rows = db.execute(build_report_monthly_query(user_id, period_start, period_end)).all()
    else:
        scrobble_rows = db.execute(build_report_weekly_query(user_id, period_start, period_end)).all()
    clock_rows = db.execute(build_report_clock_query(user_id, period_start, period_end)).all()
    clock_counts = {int(row.label): int(row.count) for row in clock_rows}
    
    decade_rows = db.execute(build_report_decade_query(user_id, period_start, period_end)).all()
    

    heatmap_rows = db.execute(build_report_heatmap_query(user_id, period_start, period_end)).all()
    heatmap_data = {(int(row.day), int(row.hour)): int(row.count) for row in heatmap_rows if row.day is not None and row.hour is not None}
    
    listening_heatmap = []
    for day in range(7):
        for hour in range(24):
            listening_heatmap.append(HeatmapPoint(day=day, hour=hour, count=heatmap_data.get((day, hour), 0)))
            
    return ReportChartsResponse(

        user_id=user_id,
        range=range_key,
        weekly_scrobbles=[ReportPoint(label=row.label, count=int(row.count)) for row in scrobble_rows],
        listening_clock=[ReportPoint(label=str(hour), count=clock_counts.get(hour, 0)) for hour in range(24)],
        music_by_decade=[ReportPoint(label=f"{int(row.label)}s", count=int(row.count)) for row in decade_rows if row.label],
        listening_heatmap=listening_heatmap,
    )
