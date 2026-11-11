from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..services.catalog_rough_trade_service import (
    dismiss_user_rough_trade_pending,
    get_user_rough_trade_catalog,
    record_user_rough_trade_pending_play,
    toggle_user_rough_trade_album_completion,
)

router = APIRouter(prefix="/jukebox/rough-trade-albums", tags=["jukebox-rough-trade"])


class ToggleCompletedRequest(BaseModel):
    is_completed: bool
    source: str = "manual"


class PendingPlayRequest(BaseModel):
    album_id: int


class DismissPendingRequest(BaseModel):
    album_id: int | None = None


@router.get("", response_model=dict[str, Any])
@router.get("/", response_model=dict[str, Any])
def get_rough_trade_albums(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return get_user_rough_trade_catalog(db, current_user.id)


@router.post("/{album_id}/toggle-completed")
def toggle_completed(
    album_id: int,
    payload: ToggleCompletedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if album_id < 1 or album_id > 700:
        raise HTTPException(status_code=400, detail="Invalid album ID")
    return toggle_user_rough_trade_album_completion(
        db,
        current_user.id,
        album_id,
        payload.is_completed,
        payload.source,
    )


@router.post("/pending-play")
def record_pending_play(
    payload: PendingPlayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return record_user_rough_trade_pending_play(db, current_user.id, payload.album_id)


@router.post("/dismiss-pending")
def dismiss_pending(
    payload: DismissPendingRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    album_id = payload.album_id if payload else None
    return dismiss_user_rough_trade_pending(db, current_user.id, album_id)
