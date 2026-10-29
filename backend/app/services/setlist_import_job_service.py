from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from ..models import Notification, SetlistImportJob
from .setlist_attendance_service import SetlistAttendanceService
from .setlist_import_service import sync_user_setlist_history
from .setlist_service import SetlistRateLimitError, SetlistService

logger = logging.getLogger(__name__)

# Gigs per worker run, so one internal request stays short; the rest continue next run
MAX_GIGS_PER_RUN = 200


def next_quota_reset(now: datetime | None = None) -> datetime:
    """The Setlist.fm daily count resets at midnight UTC; resume a few minutes after."""
    now = now or datetime.utcnow()
    return datetime.combine(now.date() + timedelta(days=1), datetime.min.time()) + timedelta(minutes=5)


def open_job(db: Session, user_id: int) -> SetlistImportJob | None:
    return (
        db.query(SetlistImportJob)
        .filter_by(user_id=user_id, status="paused")
        .order_by(SetlistImportJob.id.desc())
        .first()
    )


def job_summary(job: SetlistImportJob | None) -> dict[str, Any] | None:
    if job is None:
        return None
    return {
        "id": job.id,
        "kind": job.kind,
        "status": job.status,
        "imported_count": job.imported_count,
        "total": job.total,
        "resume_after": job.resume_after.isoformat(),
    }


def save_paused_import(
    db: Session,
    user_id: int,
    kind: str,
    result: dict[str, Any],
    setlist_username: str | None = None,
    payload: list[Any] | None = None,
    job: SetlistImportJob | None = None,
) -> SetlistImportJob:
    """Records (or updates) the user's one paused import so the worker can carry it on."""
    job = job or open_job(db, user_id)
    if job is None or job.kind != kind:
        if job is not None:
            # A new import replaces a paused one; already-logged gigs are skipped anyway
            job.status = "cancelled"
        job = SetlistImportJob(user_id=user_id, kind=kind, imported_count=0, total=0)
        db.add(job)

    quota_hit = result.get("status") == "paused_rate_limit"
    job.status = "paused"
    job.setlist_username = setlist_username or job.setlist_username
    job.payload = payload
    job.next_page = int(result.get("resume_page") or 1)
    job.imported_count = (job.imported_count or 0) + int(result.get("imported_count") or 0)
    job.total = max(job.total or 0, int(result.get("total_found") or 0))
    job.message = result.get("message")
    # Quota: wait for the reset. Budget: carry on at the next worker run.
    job.resume_after = next_quota_reset() if quota_hit else datetime.utcnow()
    db.commit()
    return job


def finish_open_job(db: Session, user_id: int, kind: str) -> None:
    """An import completed by hand supersedes a paused one it covers: a full profile
    import covers any profile/selected import, a selective one only another selective."""
    job = open_job(db, user_id)
    if job is None or job.kind == "file_songs":
        return
    if kind == "profile" or job.kind == kind:
        job.status = "done"
        db.commit()


def cancel_open_job(db: Session, user_id: int) -> bool:
    job = open_job(db, user_id)
    if job is None:
        return False
    job.status = "cancelled"
    db.commit()
    return True


def _resume_file_songs(db: Session, job: SetlistImportJob, svc: SetlistService) -> dict[str, Any]:
    attendance = SetlistAttendanceService(db=db, setlist_service=svc)
    remaining = [int(cid) for cid in (job.payload or [])]
    done = 0
    for idx, concert_id in enumerate(remaining):
        if done >= MAX_GIGS_PER_RUN:
            return {"status": "paused_budget", "imported_count": done, "remaining_ids": remaining[idx:]}
        try:
            attendance.refresh_concert_setlist(user_id=job.user_id, concert_id=concert_id)
        except SetlistRateLimitError as exc:
            return {
                "status": "paused_rate_limit",
                "imported_count": done,
                "remaining_ids": remaining[idx:],
                "message": str(exc),
            }
        except ValueError:
            # The gig was deleted since; nothing to fetch
            pass
        done += 1
    return {"status": "completed", "imported_count": done}


def resume_due_jobs(db: Session, setlist_service: SetlistService | None = None, limit: int = 5) -> dict[str, int]:
    """Carries on paused imports whose resume time has passed. Called by the worker."""
    svc = setlist_service or SetlistService(db=db)
    jobs = (
        db.query(SetlistImportJob)
        .filter(SetlistImportJob.status == "paused", SetlistImportJob.resume_after <= datetime.utcnow())
        .order_by(SetlistImportJob.resume_after)
        .limit(limit)
        .all()
    )
    counts = {"processed": 0, "finished": 0, "repaused": 0, "failed": 0}
    for job in jobs:
        counts["processed"] += 1
        try:
            if job.kind == "file_songs":
                result = _resume_file_songs(db, job, svc)
            else:
                result = sync_user_setlist_history(
                    user_id=job.user_id,
                    setlist_username=job.setlist_username or "",
                    db=db,
                    setlist_service=svc,
                    selected_setlist_ids=job.payload if job.kind == "selected" else None,
                    start_page=job.next_page,
                    max_gigs=MAX_GIGS_PER_RUN,
                )
        except Exception as exc:  # noqa: BLE001 - one bad job must not stop the others
            logger.warning("Setlist import job %s failed: %s", job.id, exc)
            db.rollback()
            job.status = "failed"
            job.message = str(exc)[:500]
            db.commit()
            counts["failed"] += 1
            continue

        if result.get("status") in ("paused_rate_limit", "paused_budget"):
            save_paused_import(
                db,
                job.user_id,
                job.kind,
                result,
                payload=result.get("remaining_ids", job.payload if job.kind == "profile" else None),
                job=job,
            )
            counts["repaused"] += 1
            continue

        job.status = "done" if result.get("status") == "completed" else "failed"
        job.imported_count = (job.imported_count or 0) + int(result.get("imported_count") or 0)
        job.message = result.get("message")
        if job.status == "done":
            what = "gigs updated with songs" if job.kind == "file_songs" else "gigs added"
            db.add(
                Notification(
                    user_id=job.user_id,
                    title="Setlist.fm import finished",
                    message=f"Your paused import has finished: {job.imported_count} {what}.",
                    type="general",
                )
            )
            counts["finished"] += 1
        else:
            counts["failed"] += 1
        db.commit()
    return counts
