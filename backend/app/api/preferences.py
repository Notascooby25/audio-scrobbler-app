from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.preferences import UserPreferencesResponse, UserPreferencesUpdate
from ..services import preferences_service

router = APIRouter(prefix="/users/me/settings", tags=["preferences"])


@router.get("", response_model=UserPreferencesResponse)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> UserPreferencesResponse:
    return UserPreferencesResponse.model_validate(preferences_service.get_or_create(db, current_user.id))


@router.patch("", response_model=UserPreferencesResponse)
def patch_settings(
    changes: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPreferencesResponse:
    try:
        preferences = preferences_service.update(db, current_user.id, changes.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UserPreferencesResponse.model_validate(preferences)