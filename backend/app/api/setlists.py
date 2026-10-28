from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.setlists import (
    ArtistLeaderboardItem,
    AttendedConcertResponse,
    DeleteConcertResponse,
    LogAttendanceRequest,
    SongLeaderboardItem,
    VenueLeaderboardItem,
)
from ..services.setlist_attendance_service import SetlistAttendanceService
from ..services.setlist_service import SetlistRateLimitError, SetlistService
from ..services.setlist_stats_service import SetlistStatsService

router = APIRouter(prefix="/api/setlists", tags=["setlists"])


@router.get("/search")
def search_setlists(
    artist_name: str | None = Query(None),
    country_code: str | None = Query(None),
    year: int | None = Query(None),
    venue_name: str | None = Query(None),
    p: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    service = SetlistService(db=db)
    try:
        return service.search_setlists(
            artist_name=artist_name,
            country_code=country_code,
            year=year,
            venue_name=venue_name,
            p=p,
        )
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc


@router.get("/venue-support")
def get_venue_date_support_acts(
    venue_id: str = Query(...),
    event_date: str = Query(...),  # dd-MM-yyyy
    exclude_setlist_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    service = SetlistService(db=db)
    try:
        return service.get_venue_date_setlists(
            venue_id=venue_id,
            event_date_str=event_date,
            exclude_setlist_id=exclude_setlist_id,
        )
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc


@router.get("/attendances")
def list_attendances(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    stats_service = SetlistStatsService(db=db)
    return stats_service.get_my_gigs(user_id=current_user.id, limit=limit, offset=offset)


@router.post("/attend", response_model=AttendedConcertResponse, status_code=status.HTTP_201_CREATED)
def attend_concert(
    payload: LogAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendedConcertResponse:
    setlist_svc = SetlistService(db=db)
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=setlist_svc)
    try:
        concert = attendance_svc.log_concert_attendance(
            user_id=current_user.id,
            setlist_id=payload.setlist_id,
            support_setlist_ids=payload.support_setlist_ids,
        )
        return AttendedConcertResponse.model_validate(concert)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc


@router.delete("/{concert_id}", response_model=DeleteConcertResponse)
def delete_attendance(
    concert_id: int,
    include_support_acts: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeleteConcertResponse:
    setlist_svc = SetlistService(db=db)
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=setlist_svc)
    count = attendance_svc.delete_concert_attendance(
        user_id=current_user.id,
        concert_id=concert_id,
        include_support_acts=include_support_acts,
    )
    return DeleteConcertResponse(deleted_count=count)


@router.post("/{concert_id}/refresh", response_model=AttendedConcertResponse)
def refresh_setlist(
    concert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendedConcertResponse:
    setlist_svc = SetlistService(db=db)
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=setlist_svc)
    try:
        concert = attendance_svc.refresh_concert_setlist(user_id=current_user.id, concert_id=concert_id)
        return AttendedConcertResponse.model_validate(concert)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc


@router.get("/stats/artists", response_model=list[ArtistLeaderboardItem])
def get_artists_seen_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ArtistLeaderboardItem]:
    stats_svc = SetlistStatsService(db=db)
    return [
        ArtistLeaderboardItem.model_validate(item) for item in stats_svc.get_artists_seen_leaderboard(current_user.id)
    ]


@router.get("/stats/songs", response_model=list[SongLeaderboardItem])
def get_songs_heard_leaderboard(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SongLeaderboardItem]:
    stats_svc = SetlistStatsService(db=db)
    return [
        SongLeaderboardItem.model_validate(item)
        for item in stats_svc.get_songs_heard_leaderboard(current_user.id, limit=limit)
    ]


@router.get("/stats/venues", response_model=list[VenueLeaderboardItem])
def get_venues_visited_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[VenueLeaderboardItem]:
    stats_svc = SetlistStatsService(db=db)
    return [
        VenueLeaderboardItem.model_validate(item) for item in stats_svc.get_venues_visited_leaderboard(current_user.id)
    ]


@router.get("/export")
def export_gigs(
    format: str = Query("json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    stats_svc = SetlistStatsService(db=db)
    content, media_type = stats_svc.export_attended_gigs(current_user.id, format=format)
    filename = f"attended_gigs.{format.lower()}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{setlist_id}")
def get_setlist_details(
    setlist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    service = SetlistService(db=db)
    try:
        data = service.get_setlist(setlist_id)
        if not data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setlist {setlist_id} not found.")
        return data
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
