from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..api.deps import get_current_user, resolve_viewable_user_id
from ..db import get_db
from ..models import User
from ..queries.analytics_queries import (
    CHART_ENTITIES,
    CHART_RANGES,
    DATE_RANGE_PRESETS,
    get_forgotten_favorites,
    get_friends_comparison_data,
    get_on_this_day_tracks,
    resolve_date_range,
)
from ..schemas.friends_comparison import FriendsComparisonResponse
from ..schemas.analytics import (
    ChartResponse,
    CreateRediscoverPlaylistRequest,
    CreateRediscoverPlaylistResponse,
    LegacyChartResponse,
    LibraryResponse,
    LibraryScrobbleResponse,
    MonthlySummaryResponse,
    RediscoverResponse,
    ReportChartsResponse,
    ReportSummaryResponse,
    ScrobbleListResponse,
    StatsResponse,
    TimelineResponse,
)
from ..services.analytics_service import (
    get_library_entities,
    get_library_scrobbles,
    get_monthly_summary,
    get_recent_scrobbles,
    get_report_charts,
    get_report_summary,
    get_scrobbles_timeline,
    get_stats_summary,
    get_user_charts,
)
from ..services.spotify_playlist_service import create_playlist, normalize_spotify_uri

router = APIRouter(prefix="/analytics", tags=["analytics"])
stats_router = APIRouter(prefix="/stats", tags=["stats"])
library_router = APIRouter(prefix="/library", tags=["library"])
reports_router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/monthly-summary")
def monthly_summary(
    from_month: str | None = Query(default=None, description="Inclusive lower-bound month in YYYY-MM format."),
    to_month: str | None = Query(default=None, description="Inclusive upper-bound month in YYYY-MM format."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MonthlySummaryResponse:
    try:
        return get_monthly_summary(db, current_user.id, from_month, to_month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/rediscover", response_model=RediscoverResponse)
def get_rediscover(
    mode: str = Query(
        default="forgotten",
        pattern="^(forgotten|anniversary)$",
        description="Mode: 'forgotten' (unplayed favorites) or 'anniversary' (on this day in past years)",
    ),
    limit: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RediscoverResponse:
    if mode == "anniversary":
        tracks = get_on_this_day_tracks(db, current_user.id, limit=limit)
    else:
        tracks = get_forgotten_favorites(db, current_user.id, limit=limit)
    return RediscoverResponse(user_id=current_user.id, mode=mode, tracks=tracks)


@router.post("/rediscover/playlist", response_model=CreateRediscoverPlaylistResponse)
def export_rediscover_playlist(
    body: CreateRediscoverPlaylistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreateRediscoverPlaylistResponse:
    if body.mode not in ("forgotten", "anniversary"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'forgotten' or 'anniversary'.")

    raw_track_ids: list[str] = []
    if body.track_ids:
        raw_track_ids = body.track_ids
    else:
        if body.mode == "anniversary":
            tracks = get_on_this_day_tracks(db, current_user.id, limit=50)
        else:
            tracks = get_forgotten_favorites(db, current_user.id, limit=50)
        raw_track_ids = [t["track_id"] for t in tracks if t.get("track_id")]

    valid_uris: list[str] = []
    for tid in raw_track_ids:
        norm = normalize_spotify_uri(tid)
        if norm and norm not in valid_uris:
            valid_uris.append(norm)

    if not valid_uris:
        raise HTTPException(
            status_code=400,
            detail="No Spotify tracks found to create a playlist.",
        )

    now = datetime.utcnow()
    if body.title:
        title = body.title
    elif body.mode == "anniversary":
        title = f"On This Day — {now.strftime('%b %d')}"
    else:
        title = f"Forgotten Favorites — {now.strftime('%b %Y')}"

    desc = (
        "Tracks from past years around this time, saved from Audio Scrobbler App."
        if body.mode == "anniversary"
        else "Forgotten favorites rediscovery playlist, saved from Audio Scrobbler App."
    )

    try:
        playlist_name, playlist_url, count = create_playlist(
            db=db,
            user=current_user,
            title=title,
            description=desc,
            track_uris=valid_uris,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create Spotify playlist: {str(exc)}",
        ) from exc

    return CreateRediscoverPlaylistResponse(
        playlist_name=playlist_name,
        playlist_url=playlist_url,
        track_count=count,
    )


@router.get("/recent-scrobbles")
def recent_scrobbles(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: int | None = Query(default=None, description="Optional: view a followed user's recent scrobbles."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScrobbleListResponse:
    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    return get_recent_scrobbles(db, target_user_id, limit, offset)


@router.get("/charts/{user_id}", response_model=LegacyChartResponse)
def user_charts(
    user_id: int,
    entity: str = Query(default="artists", description="One of: artists, tracks, albums"),
    range: str = Query(default="overall", description="One of: 7day, 1month, 12month, overall"),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    if entity not in CHART_ENTITIES:
        raise HTTPException(status_code=400, detail=f"Unsupported entity: {entity!r}")
    if range not in CHART_RANGES:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")

    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    return get_user_charts(db, target_user_id, entity, range, limit)


@stats_router.get("/summary", response_model=StatsResponse)
def stats_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatsResponse:
    return get_stats_summary(db, current_user.id)


def _resolve_optional_range(
    range_key: str | None, start_date: str | None, end_date: str | None
) -> tuple[object | None, object | None]:
    if range_key is None or range_key == "all.time":
        return None, None
    if range_key not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range_key!r}")
    try:
        period_start, period_end, _previous_start, _previous_end, _granularity = resolve_date_range(
            range_key, start_date, end_date
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return period_start, period_end


def _top_stats(
    entity: str,
    limit: int,
    db: Session,
    current_user: User,
    range: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> ChartResponse:
    period_start, period_end = _resolve_optional_range(range, start_date, end_date)
    kwargs = {"start": period_start, "end": period_end} if period_start is not None else {}
    return get_user_charts(db, current_user.id, entity, "overall", limit, **kwargs)


@stats_router.get("/top-artists", response_model=ChartResponse)
def top_artists(
    limit: int = Query(default=10, ge=1, le=50),
    range: str | None = Query(default=None, description="Optional: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    return _top_stats("artists", limit, db, current_user, range, start_date, end_date)


@stats_router.get("/top-albums", response_model=ChartResponse)
def top_albums(
    limit: int = Query(default=10, ge=1, le=50),
    range: str | None = Query(default=None, description="Optional: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    return _top_stats("albums", limit, db, current_user, range, start_date, end_date)


@stats_router.get("/top-tracks", response_model=ChartResponse)
def top_tracks(
    limit: int = Query(default=10, ge=1, le=50),
    range: str | None = Query(default=None, description="Optional: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    return _top_stats("tracks", limit, db, current_user, range, start_date, end_date)


@library_router.get("/scrobbles", response_model=LibraryScrobbleResponse)
def library_scrobbles(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    range: str | None = Query(default=None, description="Optional: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    filter_entity: str | None = Query(default=None, description="Optional filter: artist, album, or track."),
    filter_name: str | None = Query(default=None),
    filter_secondary: str | None = Query(default=None, description="Artist name for album or track filters."),
    search: str | None = Query(default=None, description="Search query for track, artist, or album name."),
    user_id: int | None = Query(default=None, description="Optional: view a followed user's library."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryScrobbleResponse:
    if filter_entity not in (None, "artist", "album", "track"):
        raise HTTPException(status_code=400, detail="Unsupported filter entity")
    if (filter_entity is None) != (filter_name is None):
        raise HTTPException(status_code=400, detail="filter_entity and filter_name must be provided together")
    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    period_start, period_end = _resolve_optional_range(range, start_date, end_date)
    kwargs = {"start": period_start, "end": period_end} if period_start is not None else {}
    if filter_entity is None:
        return get_library_scrobbles(db, target_user_id, limit, offset, search_query=search, **kwargs)
    return get_library_scrobbles(
        db,
        target_user_id,
        limit,
        offset,
        filter_entity=filter_entity,
        filter_name=filter_name,
        filter_secondary=filter_secondary,
        search_query=search,
        **kwargs,
    )


@library_router.get("/{entity}", response_model=LibraryResponse | TimelineResponse)
def library_entities(
    entity: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    range: str | None = Query(default=None, description="Optional: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required when range=custom (ISO date)."),
    search: str | None = Query(default=None, description="Search query for name."),
    user_id: int | None = Query(default=None, description="Optional: view a followed user's library."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryResponse | TimelineResponse:
    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    if entity == "timeline":
        return get_scrobbles_timeline(db, target_user_id)
    if entity not in CHART_ENTITIES:
        raise HTTPException(status_code=404, detail="Library collection not found")
    period_start, period_end = _resolve_optional_range(range, start_date, end_date)
    kwargs = {"start": period_start, "end": period_end} if period_start is not None else {}
    return get_library_entities(db, target_user_id, entity, limit, offset, search_query=search, **kwargs)


@reports_router.get("/summary", response_model=ReportSummaryResponse)
def reports_summary(
    range: str = Query(default="last.month", description="One of: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    compare_to_previous: bool = Query(default=True),
    user_id: int | None = Query(default=None, description="Optional: view a followed user's reports."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportSummaryResponse:
    if range not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")
    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    try:
        return get_report_summary(db, target_user_id, range, start_date, end_date, compare_to_previous)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@reports_router.get("/charts", response_model=ReportChartsResponse)
def reports_charts(
    range: str = Query(default="last.month", description="One of: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    user_id: int | None = Query(default=None, description="Optional: view a followed user's reports."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportChartsResponse:
    if range not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")
    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    try:
        return get_report_charts(db, target_user_id, range, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@reports_router.get("/friends-comparison", response_model=FriendsComparisonResponse)
def reports_friends_comparison(
    range: str = Query(default="last.week", description="One of: last.week, last.month, last.year, all.time, custom"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FriendsComparisonResponse:
    if range not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")
    try:
        period_start, period_end, _, _, _ = resolve_date_range(range, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_friends_comparison_data(db, current_user.id, period_start, period_end)


@reports_router.get("/{entity}", response_model=ChartResponse)
def reports_entities(
    entity: str,
    range: str = Query(default="last.month", description="One of: last.week, last.month, last.year, custom"),
    start_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    user_id: int | None = Query(default=None, description="Optional: view a followed user's reports."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    if entity not in CHART_ENTITIES:
        raise HTTPException(status_code=404, detail="Report collection not found")
    if range not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")
    target_user_id = resolve_viewable_user_id(db, current_user, user_id)
    try:
        period_start, period_end, _previous_start, _previous_end, _granularity = resolve_date_range(
            range, start_date, end_date
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_user_charts(db, target_user_id, entity, "overall", 10, start=period_start, end=period_end)
