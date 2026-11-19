from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.preferences import (
    GigDiscoverySettingsUpdate,
    HomeCityRequest,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)
from ..services import preferences_service
from ..services.geocoding_service import GeocodingUnavailableError
from ..services.gig_discovery_service import trigger_worker_discovery_sync
from ..services.gig_discovery_sync_service import merge_discovery_filters
from ..services.gig_distance_service import HomeCityNotFoundError, clear_home_city, set_home_city

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
    trigger_worker_discovery_sync(current_user.id)
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


@router.patch("/gig-discovery", response_model=UserPreferencesResponse)
def patch_gig_discovery_settings(
    payload: GigDiscoverySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPreferencesResponse:
    prefs = preferences_service.get_or_create(db, current_user.id)
    should_sync = False
    if payload.local_gig_radius_miles is not None:
        if payload.local_gig_radius_miles > (prefs.local_gig_radius_miles or 10):
            should_sync = True
        prefs.local_gig_radius_miles = payload.local_gig_radius_miles
    if payload.gig_discovery_filters is not None:
        merged = merge_discovery_filters(prefs.gig_discovery_filters)
        criteria_keys = {
            "my_artists_mode",
            "my_artists_limit",
            "my_artists_min_plays",
            "my_artists_months",
            "include_seen_live",
        }
        for key, value in payload.gig_discovery_filters.model_dump(exclude_unset=True).items():
            if key in merged:
                if key in criteria_keys and merged[key] != value:
                    should_sync = True
                merged[key] = value
        prefs.gig_discovery_filters = merged
    db.commit()
    db.refresh(prefs)
    if should_sync:
        trigger_worker_discovery_sync(current_user.id)
    return UserPreferencesResponse.model_validate(prefs)
