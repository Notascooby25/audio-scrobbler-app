from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..queries.analytics_queries import CHART_ENTITIES, CHART_RANGES
from ..schemas.analytics import (
    ChartResponse,
    LegacyChartResponse,
    LibraryResponse,
    LibraryScrobbleResponse,
    MonthlySummaryResponse,
    ScrobbleListResponse,
    StatsResponse,
    TimelineResponse,
    ReportChartsResponse,
    ReportSummaryResponse,
)
from ..services import social_service
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


@router.get("/recent-scrobbles")
def recent_scrobbles(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScrobbleListResponse:
    return get_recent_scrobbles(db, current_user.id, limit, offset)


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

    target_user = social_service.get_active_user(db, user_id)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not social_service.can_view_details(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="Charts are only visible to the owner or their followers")

    return get_user_charts(db, user_id, entity, range, limit)


@stats_router.get("/summary", response_model=StatsResponse)
def stats_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatsResponse:
    return get_stats_summary(db, current_user.id)


def _top_stats(entity: str, limit: int, db: Session, current_user: User) -> ChartResponse:
    return get_user_charts(db, current_user.id, entity, "overall", limit)


@stats_router.get("/top-artists", response_model=ChartResponse)
def top_artists(
    limit: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    return _top_stats("artists", limit, db, current_user)


@stats_router.get("/top-albums", response_model=ChartResponse)
def top_albums(
    limit: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    return _top_stats("albums", limit, db, current_user)


@stats_router.get("/top-tracks", response_model=ChartResponse)
def top_tracks(
    limit: int = Query(default=8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    return _top_stats("tracks", limit, db, current_user)


@library_router.get("/scrobbles", response_model=LibraryScrobbleResponse)
def library_scrobbles(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryScrobbleResponse:
    return get_library_scrobbles(db, current_user.id, limit, offset)


@library_router.get("/{entity}", response_model=LibraryResponse | TimelineResponse)
def library_entities(
    entity: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryResponse | TimelineResponse:
    if entity == "timeline":
        return get_scrobbles_timeline(db, current_user.id)
    if entity not in CHART_ENTITIES:
        raise HTTPException(status_code=404, detail="Library collection not found")
    return get_library_entities(db, current_user.id, entity, limit, offset)


@reports_router.get("/summary", response_model=ReportSummaryResponse)
def reports_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportSummaryResponse:
    return get_report_summary(db, current_user.id)


@reports_router.get("/charts", response_model=ReportChartsResponse)
def reports_charts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportChartsResponse:
    return get_report_charts(db, current_user.id)


@reports_router.get("/{entity}", response_model=ChartResponse)
def reports_entities(
    entity: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartResponse:
    if entity not in CHART_ENTITIES:
        raise HTTPException(status_code=404, detail="Report collection not found")
    return get_user_charts(db, current_user.id, entity, "overall", 10)
