from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.scrobble_settings import UserScrobbleSettingsResponse, UserScrobbleSettingsUpdate
from ..services import scrobble_settings_service

router = APIRouter(prefix="/users/me/settings/scrobble", tags=["scrobble-settings"])


@router.get("", response_model=UserScrobbleSettingsResponse)
def get_scrobble_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserScrobbleSettingsResponse:
    return UserScrobbleSettingsResponse.from_model(scrobble_settings_service.get_or_create(db, current_user.id))


@router.patch("", response_model=UserScrobbleSettingsResponse)
def patch_scrobble_settings(
    changes: UserScrobbleSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserScrobbleSettingsResponse:
    try:
        settings = scrobble_settings_service.update(db, current_user.id, changes.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UserScrobbleSettingsResponse.from_model(settings)
