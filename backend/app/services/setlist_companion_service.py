from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import AttendedConcert, Follow, GigCompanion, Notification, User
from .setlist_attendance_service import DuplicateGigError, SetlistAttendanceService, extract_songs_from_setlist_data
from .setlist_service import SetlistService

# People you can pick from on one gig (the picker lists everyone you follow)
MAX_FOLLOWING = 200


def _owned_gig(db: Session, owner_id: int, concert_id: int) -> AttendedConcert:
    gig = db.query(AttendedConcert).filter_by(id=concert_id, user_id=owner_id).first()
    if gig is None:
        raise LookupError("Gig not found.")
    return gig


def _person(user: User) -> dict[str, Any]:
    return {"user_id": user.id, "username": user.username, "display_name": user.display_name}


def _followed_users(db: Session, owner_id: int) -> list[User]:
    return (
        db.query(User)
        .join(Follow, Follow.followee_id == User.id)
        .filter(Follow.follower_id == owner_id, User.is_active.is_(True))
        .order_by(func.lower(User.display_name))
        .limit(MAX_FOLLOWING)
        .all()
    )


def _matching_gig(db: Session, user_id: int, gig: AttendedConcert) -> AttendedConcert | None:
    """The user's own copy of this gig: the same Setlist.fm show, or the same artist that night."""
    setlist_id = None if gig.setlist_id.startswith("manual-") else gig.setlist_id
    return SetlistAttendanceService(db=db, setlist_service=SetlistService(db=db)).find_existing_gig(
        user_id, setlist_id, gig.artist_name, gig.event_date
    )


def _gig_label(gig: AttendedConcert) -> str:
    return f"{gig.artist_name} at {gig.venue_name} on {gig.event_date.day} {gig.event_date.strftime('%b %Y')}"


def list_companions(db: Session, owner_id: int, concert_id: int) -> dict[str, Any]:
    """Who the owner went with, plus the people they follow (for the picker), with those who
    already logged this gig themselves first."""
    gig = _owned_gig(db, owner_id, concert_id)
    rows = db.query(GigCompanion).filter_by(concert_id=gig.id).order_by(GigCompanion.id).all()
    users = {u.id: u for u in db.query(User).filter(User.id.in_([r.friend_id for r in rows]), User.is_active.is_(True))}

    companions = []
    for row in rows:
        user = users.get(row.friend_id)
        if user is None:
            continue
        status = row.status
        if status == "added" and not db.get(AttendedConcert, row.friend_concert_id or 0):
            status = "dismissed"  # they added it, then deleted it again
        companions.append({**_person(user), "status": status})

    tagged = {row.friend_id for row in rows}
    following = []
    for user in _followed_users(db, owner_id):
        if user.id not in tagged:
            following.append({**_person(user), "logged_it": _matching_gig(db, user.id, gig) is not None})
    following.sort(key=lambda p: not p["logged_it"])
    return {"companions": companions, "following": following}


def add_companions(db: Session, owner: User, concert_id: int, friend_ids: list[int]) -> dict[str, Any]:
    """Adds people the owner follows. Each gets an invite to add the gig themselves; anyone
    who already logged it is simply linked."""
    gig = _owned_gig(db, owner.id, concert_id)
    followed = {u.id: u for u in _followed_users(db, owner.id)}
    wanted = list(dict.fromkeys(friend_ids))
    if any(fid not in followed for fid in wanted):
        raise PermissionError("You can only add people you follow.")

    existing = {r.friend_id for r in db.query(GigCompanion).filter_by(concert_id=gig.id)}
    for fid in wanted:
        if fid in existing:
            continue
        own_copy = _matching_gig(db, fid, gig)
        db.add(
            GigCompanion(
                concert_id=gig.id,
                owner_id=owner.id,
                friend_id=fid,
                status="added" if own_copy else "pending",
                friend_concert_id=own_copy.id if own_copy else None,
            )
        )
        message = f"{owner.display_name} says you were at {_gig_label(gig)}. Add it to your gigs from Set Lists."
        # Removing and re-adding someone mustn't pile up the same unread notification
        already_told = db.query(Notification).filter_by(user_id=fid, message=message, is_read=False).first()
        if own_copy is None and already_told is None:
            db.add(Notification(user_id=fid, title="Were you at this gig?", message=message, type="general"))
    db.commit()
    return list_companions(db, owner.id, gig.id)


def remove_companion(db: Session, owner_id: int, concert_id: int, friend_id: int) -> bool:
    """Takes someone off the owner's gig. A gig they already added stays theirs."""
    gig = _owned_gig(db, owner_id, concert_id)
    removed = db.query(GigCompanion).filter_by(concert_id=gig.id, friend_id=friend_id).delete()
    db.commit()
    return bool(removed)


def _support_acts(db: Session, gig: AttendedConcert) -> list[AttendedConcert]:
    if gig.is_support_act:
        return []
    return (
        db.query(AttendedConcert)
        .filter_by(user_id=gig.user_id, parent_setlist_id=gig.setlist_id, is_support_act=True)
        .filter(AttendedConcert.id != gig.id)
        .order_by(AttendedConcert.id)
        .all()
    )


def list_invites(db: Session, user_id: int) -> list[dict[str, Any]]:
    """Gigs people say this user was at. Only the gig's public details, never the owner's notes."""
    rows = (
        db.query(GigCompanion, AttendedConcert, User)
        .join(AttendedConcert, AttendedConcert.id == GigCompanion.concert_id)
        .join(User, User.id == GigCompanion.owner_id)
        .filter(GigCompanion.friend_id == user_id, GigCompanion.status == "pending", User.is_active.is_(True))
        .order_by(AttendedConcert.event_date.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "from_user": _person(owner),
            "artist_name": gig.artist_name,
            "venue_name": gig.venue_name,
            "city": gig.city,
            "country": gig.country,
            "event_date": gig.event_date.isoformat(),
            "tour_name": gig.tour_name,
            "song_count": gig.song_count,
            "support_acts": [s.artist_name for s in _support_acts(db, gig)],
        }
        for row, gig, owner in rows
    ]


def _pending_invite(db: Session, user_id: int, invite_id: int) -> GigCompanion:
    row = db.query(GigCompanion).filter_by(id=invite_id, friend_id=user_id, status="pending").first()
    if row is None:
        raise LookupError("Invite not found.")
    return row


def _copy_gig(
    db: Session,
    attendance: SetlistAttendanceService,
    user_id: int,
    source: AttendedConcert,
    start_time: datetime,
    parent_setlist_id: str | None = None,
) -> AttendedConcert:
    # Uses the songs stored with the owner's gig, so this costs no Setlist.fm quota
    songs = extract_songs_from_setlist_data(source.raw_data if isinstance(source.raw_data, dict) else {})
    copy = AttendedConcert(
        user_id=user_id,
        setlist_id=source.setlist_id,
        artist_name=source.artist_name,
        artist_mbid=source.artist_mbid,
        venue_name=source.venue_name,
        city=source.city,
        country=source.country,
        event_date=source.event_date,
        tour_name=source.tour_name,
        setlist_url=source.setlist_url,
        is_support_act=parent_setlist_id is not None,
        parent_setlist_id=parent_setlist_id,
        raw_data=source.raw_data,
        song_count=len(songs),
    )
    db.add(copy)
    attendance._create_scrobbles_for_setlist(
        user_id=user_id,
        setlist_id=source.setlist_id,
        artist_name=source.artist_name,
        venue_name=source.venue_name,
        tour_name=source.tour_name,
        songs=songs,
        start_time=start_time,
    )
    return copy


def _copy_night(db: Session, user_id: int, gig: AttendedConcert) -> AttendedConcert:
    """Logs another user's gig and its support acts on this user's account (not committed)."""
    attendance = SetlistAttendanceService(db=db, setlist_service=SetlistService(db=db))
    day = datetime.combine(gig.event_date.date(), datetime.min.time())
    supports = [
        s
        for s in _support_acts(db, gig)
        if not db.query(AttendedConcert).filter_by(user_id=user_id, setlist_id=s.setlist_id).first()
    ]
    for idx, support in enumerate(supports):
        _copy_gig(db, attendance, user_id, support, day + timedelta(hours=18, minutes=45 + idx * 45), gig.setlist_id)
    headline_start = timedelta(hours=20, minutes=45) if supports else timedelta(hours=20)
    copy = _copy_gig(db, attendance, user_id, gig, day + headline_start)
    db.flush()
    return copy


def add_invited_gig(db: Session, user: User, invite_id: int) -> AttendedConcert:
    """The invited user says yes: the gig and its support acts are logged on their account."""
    row = _pending_invite(db, user.id, invite_id)
    gig = db.get(AttendedConcert, row.concert_id)
    if gig is None or gig.user_id != row.owner_id:
        db.delete(row)
        db.commit()
        raise LookupError("That gig has been removed.")

    own_copy = _matching_gig(db, user.id, gig) or _copy_night(db, user.id, gig)

    row.status = "added"
    row.friend_concert_id = own_copy.id
    db.add(
        Notification(
            user_id=row.owner_id,
            title="Gig added",
            message=f"{user.display_name} added {_gig_label(gig)} to their gigs.",
            type="general",
        )
    )
    db.commit()
    db.refresh(own_copy)
    return own_copy


def dismiss_invite(db: Session, user_id: int, invite_id: int) -> None:
    row = _pending_invite(db, user_id, invite_id)
    row.status = "dismissed"
    db.commit()


def add_friends_gig(db: Session, user: User, owner_id: int, concert_id: int) -> AttendedConcert:
    """'I was there too' on a followed person's gig: logs the whole night on the user's account.

    The caller checks the user may view the owner's gigs. Raises DuplicateGigError if the
    user already logged it."""
    opened = _owned_gig(db, owner_id, concert_id)
    gig = opened
    if opened.is_support_act and opened.parent_setlist_id:
        headliner = db.query(AttendedConcert).filter_by(user_id=owner_id, setlist_id=opened.parent_setlist_id).first()
        gig = headliner or opened

    existing = _matching_gig(db, user.id, gig)
    if existing is not None:
        raise DuplicateGigError(existing, same_show=existing.setlist_id == gig.setlist_id)
    own_copy = _copy_night(db, user.id, gig)

    # An invite to this gig is answered by adding it this way too
    for row in db.query(GigCompanion).filter(
        GigCompanion.friend_id == user.id, GigCompanion.concert_id.in_({opened.id, gig.id})
    ):
        row.status = "added"
        row.friend_concert_id = own_copy.id
    db.add(
        Notification(
            user_id=owner_id,
            title="Gig added",
            message=f"{user.display_name} was at {_gig_label(gig)} too and added it to their gigs.",
            type="general",
        )
    )
    db.commit()
    db.refresh(own_copy)
    return own_copy
