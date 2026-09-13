from __future__ import annotations

import json
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..api.ingestion import require_worker_token
from ..db import get_db
from ..models import ArtworkCache, ListeningEvent, User
from ..schemas.imports import (
    DeleteImportResponse,
    ImportScrobbleRequest,
    ImportScrobbleResponse,
    UnifiedImportProgressEvent,
    UnifiedImportRequest,
    UnifiedImportResponse,
    WorkerImportScrobbleRequest,
    WorkerUnifiedImportRequest,
)
from ..services.processed_import_service import process_unified_import, process_unified_import_stream

router = APIRouter(tags=["imports"])
IMPORT_SOURCES = ("spotify", "youtube")


def _run_import(db: Session, user_id: int, source: str, entries: list[dict[str, object]]) -> ImportScrobbleResponse:
    normalized_source = source.lower()
    if normalized_source not in IMPORT_SOURCES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported import source")

    result = process_unified_import(db, user_id, entries, source_hint=normalized_source)
    summary = result["summary"]
    return ImportScrobbleResponse(
        source=result["source"],
        summary={
            "inserted": summary["inserted"],
            "skipped": summary["skipped"],
            "duplicate": summary.get("duplicate", 0),
        },
    )


def _format_sse(event_name: str, data: dict[str, object]) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"


def _generate_sse_stream(
    db: Session, user_id: int, entries: list[dict[str, object]], source: str | None = None
) -> Iterator[str]:
    for event in process_unified_import_stream(db, user_id, entries, source_hint=source):
        event_type = "complete" if event.stage == "completion" else "progress"
        yield _format_sse(event_type, event.model_dump())


# ─── Unified Import Endpoints ──────────────────────────────────────────────────

@router.post("/import/unified", status_code=status.HTTP_200_OK)
def import_unified(
    payload: UnifiedImportRequest,
    stream: bool = Query(False, description="Whether to stream real-time progress via Server-Sent Events"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unified import endpoint for Spotify and YouTube Music exports with optional SSE progress streaming."""
    if stream:
        return StreamingResponse(
            _generate_sse_stream(db, current_user.id, payload.entries, payload.source),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    result = process_unified_import(db, current_user.id, payload.entries, payload.source)
    return UnifiedImportResponse(
        status="ok",
        source=result["source"],
        summary=result["summary"],
        errors=result.get("errors", []),
    )


@router.post("/import/internal/unified", status_code=status.HTTP_200_OK)
def import_unified_internal(
    payload: WorkerUnifiedImportRequest,
    stream: bool = Query(False, description="Whether to stream real-time progress via Server-Sent Events"),
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
):
    """Internal unified import endpoint for the ingestion worker."""
    user = db.query(User).filter(User.id == payload.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")

    if stream:
        return StreamingResponse(
            _generate_sse_stream(db, payload.user_id, payload.entries, payload.source),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    result = process_unified_import(db, payload.user_id, payload.entries, payload.source)
    return UnifiedImportResponse(
        status="ok",
        source=result["source"],
        summary=result["summary"],
        errors=result.get("errors", []),
    )


# ─── Artwork Cache Lookup Endpoint ───────────────────────────────────────────

@router.get("/artwork/cache/{track_id}", status_code=status.HTTP_200_OK)
def get_cached_artwork(
    track_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves locally cached artwork URL for a track_id."""
    cached = db.query(ArtworkCache).filter(ArtworkCache.track_id == track_id).first()
    if not cached:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artwork not cached")
    return {
        "track_id": cached.track_id,
        "artwork_url": cached.artwork_url,
        "cached_at": cached.cached_at.isoformat(),
    }


# ─── Legacy Endpoints (Backward Compatible) ───────────────────────────────────

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


@router.delete("/import/scrobbles/{source}", response_model=DeleteImportResponse)
def delete_imported_scrobbles(
    source: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeleteImportResponse:
    normalized_source = source.lower()
    if normalized_source not in IMPORT_SOURCES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported import source")
    deleted = db.query(ListeningEvent).filter(
        ListeningEvent.user_id == current_user.id,
        ListeningEvent.source == normalized_source,
    ).delete(synchronize_session=False)
    db.commit()
    return DeleteImportResponse(source=normalized_source, deleted=int(deleted))
