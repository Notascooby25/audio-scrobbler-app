from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..api.ingestion import require_worker_token
from ..db import get_db
from ..models import User
from ..schemas.imports import ImportScrobbleRequest, ImportScrobbleResponse, WorkerImportScrobbleRequest
from ..services.spotify_import_service import import_spotify_history
from ..services.youtube_import_service import import_youtube_history

router = APIRouter(tags=["imports"])


def _run_import(db: Session, user_id: int, source: str, entries: list[dict[str, object]]) -> ImportScrobbleResponse:
    normalized_source = source.lower()
    if normalized_source == "spotify":
        summary = import_spotify_history(db, user_id, entries)
    elif normalized_source == "youtube":
        summary = import_youtube_history(db, user_id, entries)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported import source")
    return ImportScrobbleResponse(source=normalized_source, summary={
        "inserted": summary["inserted"],
        "skipped": summary["skipped"],
        "duplicate": summary.get("duplicate", 0),
    })


@router.post("/import/scrobbles", response_model=ImportScrobbleResponse, status_code=status.HTTP_200_OK)
def import_scrobbles(
    payload: ImportScrobbleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportScrobbleResponse:
    return _run_import(db, current_user.id, payload.source, payload.entries)


@router.post("/import/internal/scrobbles", response_model=ImportScrobbleResponse, status_code=status.HTTP_200_OK)
def import_scrobbles_internal(
    payload: WorkerImportScrobbleRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> ImportScrobbleResponse:
    user = db.query(User).filter(User.id == payload.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")
    return _run_import(db, payload.user_id, payload.source, payload.entries)

