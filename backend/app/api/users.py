from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..datetime_utils import utc_now
from ..db import get_db
from ..models import ArtworkCache, Notification, RealtimePlaybackState, User
from ..queries.analytics_queries import DATE_RANGE_PRESETS, resolve_date_range
from ..schemas.users import (
    FollowActionResponse, FollowersListResponse, FollowingListResponse, UserProfileResponse,
    UserSearchResponse, NowPlayingResponse, LeaderboardResponse,
    CopyScrobblesRequest, CopyScrobblesResponse, RemoveFollowerResponse,
    ShareScrobblesRequest, ShareScrobblesResponse
)
from ..services import social_service
from ..services.color_service import fetch_and_extract_color
from ..services.push_service import queue_push

router = APIRouter(prefix="/users", tags=["users"])

# A person who follows, unfollows and follows again must not be able to flood the
# notification list, so the same follower alerts the same user at most once a day.
FOLLOW_NOTIFICATION_COOLDOWN = timedelta(hours=24)


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
        is_new_follow = social_service.follow_user(db, current_user.id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if is_new_follow:
        _notify_new_follower(db, current_user, user_id)
    return FollowActionResponse(following=True, follower_count=social_service.follower_count(db, user_id))


def _notify_new_follower(db: Session, follower: User, followee_id: int) -> None:
    name = getattr(follower, "display_name", None) or getattr(follower, "username", None) or "Someone"
    message = f"{name} started following you"
    # The link carries the follower's id, so the cooldown is per person: two followers who
    # share a display name both alert, and renaming yourself cannot dodge the cooldown.
    link = f"/following?from={follower.id}"
    recently_alerted = (
        db.query(Notification)
        .filter(
            Notification.user_id == followee_id,
            Notification.type == "follow",
            Notification.link == link,
            Notification.created_at >= utc_now() - FOLLOW_NOTIFICATION_COOLDOWN,
        )
        .first()
    )
    if recently_alerted is not None:
        return
    db.add(
        Notification(
            user_id=followee_id,
            title="New follower",
            message=message,
            type="follow",
            link=link,
        )
    )
    db.commit()
    queue_push(followee_id, "New follower", message, link)


@router.delete("/{user_id}/follow", response_model=FollowActionResponse, status_code=status.HTTP_200_OK)
def unfollow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FollowActionResponse:
    _get_active_user_or_404(db, user_id)
    social_service.unfollow_user(db, current_user.id, user_id)
    return FollowActionResponse(following=False, follower_count=social_service.follower_count(db, user_id))


@router.get("/me/following", response_model=FollowingListResponse, status_code=status.HTTP_200_OK)
def following(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FollowingListResponse:
    return FollowingListResponse(results=social_service.get_following(db, current_user.id, limit, offset))


@router.get("/me/followers", response_model=FollowersListResponse, status_code=status.HTTP_200_OK)
def followers(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FollowersListResponse:
    return FollowersListResponse(results=social_service.get_followers(db, current_user.id, limit, offset))


@router.delete(
    "/me/followers/{follower_id}", response_model=RemoveFollowerResponse, status_code=status.HTTP_200_OK
)
def remove_follower(
    follower_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RemoveFollowerResponse:
    social_service.remove_follower(db, current_user.id, follower_id)
    return RemoveFollowerResponse(follower_count=social_service.follower_count(db, current_user.id))


@router.get("/me/leaderboard", response_model=LeaderboardResponse, status_code=status.HTTP_200_OK)
def leaderboard(
    range: str = Query(default="last.week", description="One of: last.week, last.month, last.year, all.time, custom"),
    start_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    end_date: str | None = Query(default=None, description="Required for range=custom (ISO date)."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeaderboardResponse:
    if range not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")
    try:
        period_start, period_end, _, _, _ = resolve_date_range(range, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    
    return LeaderboardResponse(results=social_service.get_community_leaderboard(db, current_user.id, period_start, period_end))


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


@router.get("/{user_id}/now-playing", response_model=NowPlayingResponse, status_code=status.HTTP_200_OK)
def now_playing(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NowPlayingResponse:
    _get_active_user_or_404(db, user_id)
    # Check if they allow viewing details (if private profile, etc, handled by social_service later if needed)
    # For now, just return the state
    state = db.query(RealtimePlaybackState).filter(RealtimePlaybackState.user_id == user_id).first()
    if not state or not state.is_playing:
        return NowPlayingResponse(is_playing=False)
        
    # parse raw_metadata for track info
    track_name = None
    artist_name = None
    album_name = None
    artwork_url = None
    track_id = state.track_id
    if state.raw_metadata and isinstance(state.raw_metadata, dict):
        item = state.raw_metadata.get("item", {})
        if item:
            track_name = item.get("name")
            track_id = item.get("id") or track_id
            artists = item.get("artists", [])
            if artists:
                artist_name = artists[0].get("name")
            album = item.get("album", {})
            if album:
                album_name = album.get("name")
                images = album.get("images", [])
                if images and isinstance(images, list) and isinstance(images[0], dict):
                    artwork_url = images[0].get("url")

    artwork_color = None
    if artwork_url:
        cached = db.query(ArtworkCache).filter(ArtworkCache.artwork_url == artwork_url).first()
        if cached and cached.dominant_color:
            artwork_color = cached.dominant_color
        else:
            color = fetch_and_extract_color(artwork_url)
            if color:
                artwork_color = color
                if cached:
                    cached.dominant_color = color
                else:
                    db.merge(
                        ArtworkCache(
                            track_id=track_id or artwork_url,
                            artwork_url=artwork_url,
                            dominant_color=color,
                        )
                    )
                db.commit()

    return NowPlayingResponse(
        is_playing=True,
        track_id=track_id,
        track_name=track_name,
        artist_name=artist_name,
        album_name=album_name,
        artwork_url=artwork_url,
        artwork_color=artwork_color,
        progress_ms=state.max_progress_ms,
        duration_ms=state.duration_ms,
        raw_metadata=state.raw_metadata,
    )


@router.post("/{user_id}/copy-scrobbles", response_model=CopyScrobblesResponse, status_code=status.HTTP_200_OK)
def copy_scrobbles_endpoint(
    user_id: int,
    payload: CopyScrobblesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopyScrobblesResponse:
    target_user = _get_active_user_or_404(db, user_id)
    if not social_service.can_view_details(db, current_user.id, target_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Must follow user to copy their scrobbles")
        
    copied = social_service.copy_scrobbles(
        db=db,
        target_user_id=target_user.id,
        current_user_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date
    )
    return CopyScrobblesResponse(copied_count=copied)


@router.post("/{user_id}/share-scrobbles", response_model=ShareScrobblesResponse, status_code=status.HTTP_200_OK)
def share_scrobbles_endpoint(
    user_id: int,
    payload: ShareScrobblesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareScrobblesResponse:
    """Adds the signed-in user's plays in a time range to someone they follow."""
    recipient = _get_active_user_or_404(db, user_id)
    if recipient.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot share scrobbles with yourself")
    if not social_service.is_following(db, current_user.id, recipient.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Must follow user to share scrobbles with them")

    shared = social_service.share_scrobbles(
        db=db,
        sharer_id=current_user.id,
        recipient_id=recipient.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    if shared:
        _notify_scrobbles_shared(db, current_user, recipient.id, shared)
    return ShareScrobblesResponse(shared_count=shared)


def _notify_scrobbles_shared(db: Session, sharer: User, recipient_id: int, count: int) -> None:
    name = getattr(sharer, "display_name", None) or getattr(sharer, "username", None) or "Someone"
    noun = "scrobble" if count == 1 else "scrobbles"
    message = f"{name} added {count} {noun} to your history"
    link = f"/profile/{sharer.id}"
    db.add(
        Notification(
            user_id=recipient_id,
            title="Scrobbles shared with you",
            message=message,
            type="general",
            link=link,
        )
    )
    db.commit()
    queue_push(recipient_id, "Scrobbles shared with you", message, link)
