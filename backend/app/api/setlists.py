from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import AttendedConcert, User
from ..schemas.setlists import (
    ArtistLeaderboardItem,
    AttendedConcertResponse,
    DeleteConcertResponse,
    FileImportRequest,
    FileImportResponse,
    GigBillResponse,
    LogBillActRequest,
    LogAttendanceRequest,
    LogManualConcertRequest,
    SetlistImportRequest,
    SetlistPreviewItem,
    SetlistPreviewResponse,
    SongLeaderboardItem,
    UpdateConcertNotesRequest,
    VenueLeaderboardItem,
)
from ..services.setlist_attendance_service import DuplicateGigError, SetlistAttendanceService
from ..services.setlist_service import (
    SetlistApiAuthError,
    SetlistApiKeyMissingError,
    SetlistRateLimitError,
    SetlistService,
    SetlistUserNotFoundError,
)
from ..services.setlist_file_import_service import FileImportError, import_gigs_from_file
from ..services.setlist_import_service import sync_user_setlist_history
from ..services.setlist_stats_service import SetlistStatsService

router = APIRouter(prefix="/setlists", tags=["setlists"])


def _already_logged(exc: DuplicateGigError) -> HTTPException:
    existing = exc.existing
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "already_logged",
            "message": "Gig already logged.",
            "same_show": exc.same_show,
            "existing": {
                "id": existing.id,
                "artist_name": existing.artist_name,
                "venue_name": existing.venue_name,
                "city": existing.city,
                "event_date": existing.event_date.isoformat() if existing.event_date else None,
            },
        },
    )


@router.get("/status")
def get_setlist_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    service = SetlistService(db=db)
    return service.get_status()


@router.get("/search")
def search_setlists(
    artist_name: str | None = Query(None),
    country_code: str | None = Query(None),
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    venue_name: str | None = Query(None),
    setlist_url_or_id: str | None = Query(None),
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
            month=month,
            venue_name=venue_name,
            setlist_url_or_id=setlist_url_or_id,
            p=p,
        )
    except SetlistApiKeyMissingError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except SetlistApiAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
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
    limit: int = Query(50, ge=1, le=2000),
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
            notes=payload.notes,
            allow_duplicate=payload.allow_duplicate,
        )
        return AttendedConcertResponse.model_validate(concert)
    except DuplicateGigError as exc:
        raise _already_logged(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc


@router.post("/manual", response_model=AttendedConcertResponse, status_code=status.HTTP_201_CREATED)
def log_manual_concert(
    payload: LogManualConcertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendedConcertResponse:
    setlist_svc = SetlistService(db=db)
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=setlist_svc)
    try:
        concert = attendance_svc.log_manual_concert(
            user_id=current_user.id,
            artist_name=payload.artist_name,
            venue_name=payload.venue_name,
            city=payload.city,
            country=payload.country,
            event_date_str=payload.event_date,
            notes=payload.notes,
            setlist_url=payload.setlist_url,
            allow_duplicate=payload.allow_duplicate,
        )
        return AttendedConcertResponse.model_validate(concert)
    except DuplicateGigError as exc:
        raise _already_logged(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{concert_id}/notes", response_model=AttendedConcertResponse)
def update_concert_notes(
    concert_id: int,
    payload: UpdateConcertNotesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendedConcertResponse:
    setlist_svc = SetlistService(db=db)
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=setlist_svc)
    try:
        concert = attendance_svc.update_concert_notes(
            user_id=current_user.id,
            concert_id=concert_id,
            notes=payload.notes,
        )
        return AttendedConcertResponse.model_validate(concert)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/setlist/{setlist_id}")
def get_setlist_detail(
    setlist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    # Check if the user already logged this setlist locally
    logged = db.query(AttendedConcert).filter_by(user_id=current_user.id, setlist_id=setlist_id).first()
    if logged and logged.raw_data and isinstance(logged.raw_data, dict):
        res = dict(logged.raw_data)
        res["notes"] = logged.notes
        res["already_logged"] = True
        res["logged_concert_id"] = logged.id
        return res

    service = SetlistService(db=db)
    try:
        data = service.get_setlist(setlist_id)
        if not data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setlist {setlist_id} not found.")
        return data
    except SetlistApiKeyMissingError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Failed to fetch setlist: {exc}") from exc


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


@router.get("/attendances/{concert_id}", response_model=AttendedConcertResponse)
def get_attendance(
    concert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendedConcert:
    gig = SetlistStatsService(db=db).get_gig(user_id=current_user.id, concert_id=concert_id)
    if gig is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gig not found.")
    return gig


@router.get("/attendances/{concert_id}/bill", response_model=GigBillResponse)
def get_attendance_bill(
    concert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    stats_svc = SetlistStatsService(db=db)
    gig = stats_svc.get_gig(user_id=current_user.id, concert_id=concert_id)
    if gig is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gig not found.")
    return stats_svc.get_gig_bill(user_id=current_user.id, gig=gig, setlist_service=SetlistService(db=db))


@router.post(
    "/attendances/{concert_id}/bill",
    response_model=AttendedConcertResponse,
    status_code=status.HTTP_201_CREATED,
)
def log_attendance_bill_act(
    concert_id: int,
    payload: LogBillActRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendedConcert:
    gig = SetlistStatsService(db=db).get_gig(user_id=current_user.id, concert_id=concert_id)
    if gig is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gig not found.")
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=SetlistService(db=db))
    try:
        return attendance_svc.log_bill_act(user_id=current_user.id, gig=gig, setlist_id=payload.setlist_id)
    except DuplicateGigError as exc:
        raise _already_logged(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
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
    limit: int = Query(1000, ge=1, le=2000),
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


@router.get("/import/preview", response_model=SetlistPreviewResponse)
def preview_user_setlists(
    username: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SetlistPreviewResponse:
    service = SetlistService(db=db)
    try:
        data = service.get_user_attended(username=username.strip(), p=page)
    except SetlistApiKeyMissingError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except SetlistApiAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except SetlistUserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch setlists for {username}: {exc}",
        ) from exc

    setlists = data.get("setlist", []) if isinstance(data, dict) else []
    total = int(data.get("total", 0)) if isinstance(data, dict) else 0
    items_per_page = int(data.get("itemsPerPage", 20)) if isinstance(data, dict) else 20
    total_pages = (total + items_per_page - 1) // items_per_page if items_per_page > 0 else 1

    setlist_ids = [s.get("id") for s in setlists if isinstance(s, dict) and s.get("id")]
    logged_ids = set()
    if setlist_ids:
        rows = (
            db.query(AttendedConcert.setlist_id)
            .filter(AttendedConcert.user_id == current_user.id, AttendedConcert.setlist_id.in_(setlist_ids))
            .all()
        )
        logged_ids = {r[0] for r in rows}

    items: list[SetlistPreviewItem] = []
    for s in setlists:
        if not isinstance(s, dict) or not s.get("id"):
            continue
        sid = s["id"]
        artist = s.get("artist", {}).get("name", "Unknown Artist")
        venue_obj = s.get("venue", {}) if isinstance(s.get("venue"), dict) else {}
        venue_name = venue_obj.get("name", "Unknown Venue")
        city_obj = venue_obj.get("city", {}) if isinstance(venue_obj.get("city"), dict) else {}
        city = city_obj.get("name", "")
        country = city_obj.get("country", {}).get("name", "") if isinstance(city_obj.get("country"), dict) else ""
        tour_name = s.get("tour", {}).get("name") if isinstance(s.get("tour"), dict) else None
        event_date = s.get("eventDate", "")
        setlist_url = s.get("url")

        sets = s.get("sets", {}).get("set", []) if isinstance(s.get("sets"), dict) else []
        song_count = 0
        if isinstance(sets, list):
            for subset in sets:
                if isinstance(subset, dict):
                    songs = subset.get("song", [])
                    if isinstance(songs, list):
                        song_count += len(songs)

        items.append(
            SetlistPreviewItem(
                setlist_id=sid,
                artist_name=artist,
                venue_name=venue_name,
                city=city,
                country=country,
                event_date=event_date,
                tour_name=tour_name,
                setlist_url=setlist_url,
                song_count=song_count,
                already_logged=sid in logged_ids,
            )
        )

    return SetlistPreviewResponse(
        items=items,
        page=page,
        items_per_page=items_per_page,
        total=total,
        total_pages=total_pages,
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
    except SetlistApiKeyMissingError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except SetlistApiAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc


@router.post("/import/file", response_model=FileImportResponse)
def import_setlists_from_file(
    payload: FileImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return import_gigs_from_file(
            user_id=current_user.id,
            file_format=payload.format,
            content=payload.content,
            db=db,
            setlist_service=SetlistService(db=db),
        )
    except FileImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/import")
def import_setlists_from_profile(
    payload: SetlistImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return sync_user_setlist_history(
            user_id=current_user.id,
            setlist_username=payload.username.strip(),
            db=db,
            selected_setlist_ids=payload.setlist_ids,
        )
    except SetlistApiKeyMissingError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except SetlistApiAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except SetlistUserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SetlistRateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
