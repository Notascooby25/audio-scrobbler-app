from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import Follow, MusicRecommendation, Notification, User
from ..schemas.recommendations import (
    MusicRecommendationCreate,
    MusicRecommendationResponse,
    MusicRecommendationStatusUpdate,
)
from ..services.push_service import queue_push

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=MusicRecommendationResponse, status_code=status.HTTP_201_CREATED)
def create_recommendation(
    payload: MusicRecommendationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if payload.receiver_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot recommend music to yourself",
        )

    # Check receiver exists
    receiver = db.get(User, payload.receiver_id)
    if not receiver or not receiver.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check follow relationship: sender must follow receiver
    follow_stmt = select(Follow).where(
        Follow.follower_id == current_user.id,
        Follow.followee_id == payload.receiver_id,
    )
    is_following = db.scalars(follow_stmt).first()
    if not is_following:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only recommend music to users you follow",
        )

    rec = MusicRecommendation(
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        item_type=payload.item_type,
        title=payload.title,
        artist_name=payload.artist_name,
        album_name=payload.album_name,
        image_url=payload.image_url,
        spotify_uri=payload.spotify_uri,
        spotify_url=payload.spotify_url,
        note=payload.note,
        status="pending",
    )
    db.add(rec)

    sender_name = current_user.display_name or current_user.username or "A friend"
    message = f"{sender_name} recommended {payload.title} by {payload.artist_name}"
    notif = Notification(
        user_id=payload.receiver_id,
        title="Music Recommendation",
        message=message,
        type="recommendation",
        link="/play",
    )
    db.add(notif)
    db.commit()
    queue_push(payload.receiver_id, "Music Recommendation", message, "/play")
    db.refresh(rec)

    response_data = MusicRecommendationResponse.model_validate(rec)
    response_data.sender_name = sender_name
    return response_data


@router.get("/active", response_model=list[MusicRecommendationResponse])
def get_active_recommendations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    stmt = (
        select(MusicRecommendation, User.display_name, User.username)
        .join(User, User.id == MusicRecommendation.sender_id)
        .where(
            MusicRecommendation.receiver_id == current_user.id,
            MusicRecommendation.status == "pending",
        )
        .order_by(MusicRecommendation.created_at.desc())
    )
    results = db.execute(stmt).all()

    output = []
    for rec, disp_name, uname in results:
        item = MusicRecommendationResponse.model_validate(rec)
        item.sender_name = disp_name or uname or "A friend"
        output.append(item)
    return output


@router.patch("/{recommendation_id}/status", response_model=MusicRecommendationResponse)
def update_recommendation_status(
    recommendation_id: int,
    payload: MusicRecommendationStatusUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if payload.status not in ("listened", "dismissed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be either 'listened' or 'dismissed'",
        )

    rec = db.get(MusicRecommendation, recommendation_id)
    if not rec or rec.receiver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )

    rec.status = payload.status
    db.commit()
    db.refresh(rec)

    # Fetch sender name for response
    sender = db.get(User, rec.sender_id)
    response_data = MusicRecommendationResponse.model_validate(rec)
    response_data.sender_name = (sender.display_name or sender.username) if sender else None
    return response_data
