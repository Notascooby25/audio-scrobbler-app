from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Follow, User


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
