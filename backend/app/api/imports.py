from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.imports import ImportScrobbleRequest, ImportScrobbleResponse
from ..services.spotify_import_service import import_spotify_history
from ..services.youtube_import_service import import_youtube_history

router = APIRouter(tags=["imports"])


@router.post("/import/scrobbles", response_model=ImportScrobbleResponse, status_code=status.HTTP_200_OK)
def import_scrobbles(
    payload: ImportScrobbleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportScrobbleResponse:
    source = payload.source.lower()
    if source == "spotify":
        summary = import_spotify_history(db, current_user.id, payload.entries)
        return ImportScrobbleResponse(source="spotify", summary={
            "inserted": summary["inserted"],
            "skipped": summary["skipped"],
            "duplicate": 0,
        })
    if source == "youtube":
        summary = import_youtube_history(db, current_user.id, payload.entries)
        return ImportScrobbleResponse(source="youtube", summary={
            "inserted": summary["inserted"],
            "skipped": summary["skipped"],
            "duplicate": 0,
        })
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported import source")
