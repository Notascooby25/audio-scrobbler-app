from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.preferences import HomeCityRequest, UserPreferencesResponse, UserPreferencesUpdate
from ..services import preferences_service
from ..services.gig_distance_service import HomeCityNotFoundError, clear_home_city, set_home_city
from ..services.geocoding_service import GeocodingUnavailableError

router = APIRouter(prefix="/users/me/settings", tags=["preferences"])


@router.get("", response_model=UserPreferencesResponse)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> UserPreferencesResponse:
    return UserPreferencesResponse.model_validate(preferences_service.get_or_create(db, current_user.id))


@router.put("/home-city", response_model=UserPreferencesResponse)
def put_home_city(
    payload: HomeCityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPreferencesResponse:
    try:
        preferences = set_home_city(db, current_user.id, payload.city)
    except HomeCityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except GeocodingUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return UserPreferencesResponse.model_validate(preferences)


@router.delete("/home-city", response_model=UserPreferencesResponse)
def delete_home_city(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPreferencesResponse:
    return UserPreferencesResponse.model_validate(clear_home_city(db, current_user.id))


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
