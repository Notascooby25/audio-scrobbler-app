from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.users import FollowActionResponse, UserProfileResponse, UserSearchResponse
from ..services import social_service

router = APIRouter(prefix="/users", tags=["users"])


def _get_active_user_or_404(db: Session, user_id: int) -> User:
    user = social_service.get_active_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/{user_id}/follow", response_model=FollowActionResponse, status_code=status.HTTP_200_OK)
def follow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FollowActionResponse:
    _get_active_user_or_404(db, user_id)
    try:
        social_service.follow_user(db, current_user.id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return FollowActionResponse(following=True, follower_count=social_service.follower_count(db, user_id))


@router.delete("/{user_id}/follow", response_model=FollowActionResponse, status_code=status.HTTP_200_OK)
def unfollow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FollowActionResponse:
    _get_active_user_or_404(db, user_id)
    social_service.unfollow_user(db, current_user.id, user_id)
    return FollowActionResponse(following=False, follower_count=social_service.follower_count(db, user_id))


@router.get("/search", response_model=UserSearchResponse, status_code=status.HTTP_200_OK)
def search(
    q: str = Query(default="", max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserSearchResponse:
    return UserSearchResponse(results=social_service.search_users(db, q))


@router.get("/{user_id}/profile", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
def profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    target_user = _get_active_user_or_404(db, user_id)
    return social_service.get_user_profile(db, current_user.id, target_user)
