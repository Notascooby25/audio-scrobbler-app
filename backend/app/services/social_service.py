from __future__ import annotations

from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Follow, ListeningEvent, User
from ..schemas.users import LastScrobble, UserProfileResponse


def get_active_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()


def can_view_details(db: Session, viewer_id: int, target_user_id: int) -> bool:
    return viewer_id == target_user_id or is_following(db, viewer_id, target_user_id)


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


def _attach_last_scrobbles(db: Session, users: list[User]) -> list[dict]:
    results = []
    for user in users:
        event = (
            db.query(ListeningEvent)
            .filter(ListeningEvent.user_id == user.id)
            .order_by(ListeningEvent.played_at.desc())
            .first()
        )
        last_scrobble = None
        if event is not None:
            last_scrobble = LastScrobble(
                track_name=event.track_name,
                artist_name=event.artist_name,
                album_name=event.album_name,
                source=event.source,
                played_at=event.played_at,
                track_id=event.track_id,
                artwork_url=event.artwork_url,
            )
        results.append({
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "last_scrobble": last_scrobble
        })
    return results

def get_following(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    users = (
        db.query(User)
        .join(Follow, Follow.followee_id == User.id)
        .filter(Follow.follower_id == user_id, User.is_active.is_(True))
        .order_by(User.username)
        .limit(limit)
        .offset(offset)
        .all()
    )
    return _attach_last_scrobbles(db, users)


def search_users(db: Session, query: str, limit: int = 20) -> list[dict]:
    if not query.strip():
        users = db.query(User).filter(User.is_active.is_(True)).order_by(User.username).limit(limit).all()
        return _attach_last_scrobbles(db, users)
        
    like_pattern = f"%{query.strip()}%"
    users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            or_(User.username.ilike(like_pattern), User.display_name.ilike(like_pattern)),
        )
        .order_by(User.username)
        .limit(limit)
        .all()
    )
    return _attach_last_scrobbles(db, users)


def get_user_profile(db: Session, viewer_id: int, target_user: User) -> UserProfileResponse:
    is_self = viewer_id == target_user.id
    following = is_self or is_following(db, viewer_id, target_user.id)
    can_view = is_self or following

    last_scrobble = None
    if can_view:
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
                track_id=event.track_id,
                artwork_url=event.artwork_url,
            )

    return UserProfileResponse(
        id=target_user.id,
        username=target_user.username,
        display_name=target_user.display_name,
        follower_count=follower_count(db, target_user.id),
        following_count=following_count(db, target_user.id),
        is_self=is_self,
        is_following=following,
        can_view_details=can_view,
        last_scrobble=last_scrobble,
    )


def get_community_leaderboard(db: Session, user_id: int, start: datetime | None, end: datetime | None) -> list[dict]:
    from ..queries.analytics_queries import build_report_period_count_query
    from datetime import datetime

    # Get current user and active followed users
    users = (
        db.query(User)
        .outerjoin(Follow, Follow.followee_id == User.id)
        .filter(
            User.is_active.is_(True),
            or_(User.id == user_id, Follow.follower_id == user_id)
        )
        .all()
    )
    
    # We need to deduplicate in case of weird cross-follows, though outerjoin + filter handles it
    unique_users = {u.id: u for u in users}.values()
    
    # Attach last scrobble
    users_with_scrobbles = _attach_last_scrobbles(db, list(unique_users))
    user_dict = {u["id"]: u for u in users_with_scrobbles}
    
    results = []
    # Using datetime.min/max if start/end are None, though analytics_queries might expect actual datetimes.
    # Actually, `build_report_period_count_query` requires datetime.
    real_start = start if start else datetime.min
    real_end = end if end else datetime.max

    for uid, uinfo in user_dict.items():
        count_row = db.execute(build_report_period_count_query(uid, real_start, real_end)).one()
        results.append({
            "user": uinfo,
            "scrobble_count": int(count_row.scrobble_count or 0),
            "unique_artists": int(count_row.unique_artists or 0)
        })

    # Sort primarily by scrobble_count descending, then unique_artists descending
    results.sort(key=lambda x: (x["scrobble_count"], x["unique_artists"]), reverse=True)
    return results


def copy_scrobbles(db: Session, target_user_id: int, current_user_id: int, start_date: datetime, end_date: datetime) -> int:
    events = (
        db.query(ListeningEvent)
        .filter(
            ListeningEvent.user_id == target_user_id,
            ListeningEvent.played_at >= start_date,
            ListeningEvent.played_at <= end_date,
        )
        .all()
    )
    
    if not events:
        return 0
        
    # to be absolutely bulletproof against IntegrityError without raw SQL UPSERT:
    all_existing_keys = {
        (row[0], row[1]) for row in db.query(ListeningEvent.source, ListeningEvent.play_id)
        .filter(
            ListeningEvent.user_id == current_user_id,
            ListeningEvent.play_id.in_([e.play_id for e in events])
        ).all()
    }
    
    new_events = []
    for ev in events:
        if (ev.source, ev.play_id) not in all_existing_keys:
            new_events.append(
                ListeningEvent(
                    user_id=current_user_id,
                    track_id=ev.track_id,
                    track_name=ev.track_name,
                    artist_name=ev.artist_name,
                    album_name=ev.album_name,
                    artwork_url=ev.artwork_url,
                    artist_artwork_url=ev.artist_artwork_url,
                    played_at=ev.played_at,
                    duration_ms=ev.duration_ms,
                    source=ev.source,
                    play_id=ev.play_id,
                    payload=ev.payload,
                    raw_metadata=ev.raw_metadata,
                    created_at=datetime.utcnow()
                )
            )
            
    if new_events:
        db.bulk_save_objects(new_events)
        db.commit()
        
    return len(new_events)

