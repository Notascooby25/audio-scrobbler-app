from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Follow, ListeningEvent, User
from ..schemas.users import LastScrobble, UserProfileResponse


def follow_user(db: Session, follower_id: int, followee_id: int) -> None:
    if follower_id == followee_id:
        raise ValueError("Users cannot follow themselves")
    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == follower_id, Follow.followee_id == followee_id)
        .first()
    )
    if existing is not None:
        return
    db.add(Follow(follower_id=follower_id, followee_id=followee_id))
    db.commit()


def unfollow_user(db: Session, follower_id: int, followee_id: int) -> None:
    db.query(Follow).filter(
        Follow.follower_id == follower_id, Follow.followee_id == followee_id
    ).delete()
    db.commit()


def is_following(db: Session, follower_id: int, followee_id: int) -> bool:
    return (
        db.query(Follow)
        .filter(Follow.follower_id == follower_id, Follow.followee_id == followee_id)
        .first()
        is not None
    )


def follower_count(db: Session, user_id: int) -> int:
    return db.query(Follow).filter(Follow.followee_id == user_id).count()


def following_count(db: Session, user_id: int) -> int:
    return db.query(Follow).filter(Follow.follower_id == user_id).count()


def search_users(db: Session, query: str, limit: int = 20) -> list[User]:
    like_pattern = f"%{query.strip()}%"
    if not query.strip():
        return []
    return (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            or_(User.username.ilike(like_pattern), User.display_name.ilike(like_pattern)),
        )
        .order_by(User.username)
        .limit(limit)
        .all()
    )


def get_user_profile(db: Session, viewer_id: int, target_user: User) -> UserProfileResponse:
    is_self = viewer_id == target_user.id
    following = is_self or is_following(db, viewer_id, target_user.id)
    can_view_details = is_self or following

    last_scrobble = None
    if can_view_details:
        event = (
            db.query(ListeningEvent)
            .filter(ListeningEvent.user_id == target_user.id)
            .order_by(ListeningEvent.played_at.desc())
            .first()
        )
        if event is not None:
            last_scrobble = LastScrobble(
                track_name=event.track_name,
                artist_name=event.artist_name,
                album_name=event.album_name,
                source=event.source,
                played_at=event.played_at,
            )

    return UserProfileResponse(
        id=target_user.id,
        username=target_user.username,
        display_name=target_user.display_name,
        follower_count=follower_count(db, target_user.id),
        following_count=following_count(db, target_user.id),
        is_self=is_self,
        is_following=following,
        can_view_details=can_view_details,
        last_scrobble=last_scrobble,
    )
