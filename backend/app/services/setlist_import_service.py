from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from ..models import AttendedConcert
from .setlist_attendance_service import SetlistAttendanceService
from .setlist_service import SetlistRateLimitError, SetlistService

logger = logging.getLogger(__name__)


def sync_user_setlist_history(
    user_id: int,
    setlist_username: str,
    db: Session,
    setlist_service: SetlistService | None = None,
    selected_setlist_ids: list[str] | None = None,
) -> dict[str, Any]:
    svc = setlist_service or SetlistService(db=db)
    attendance_svc = SetlistAttendanceService(db=db, setlist_service=svc)

    imported_count = 0

    if selected_setlist_ids is not None:
        total_found = len(selected_setlist_ids)
        logger.info(
            "Starting selective Setlist.fm import for user %s: %s shows selected", user_id, total_found
        )
        for setlist_id in selected_setlist_ids:
            if not setlist_id:
                continue
            existing = db.query(AttendedConcert).filter_by(user_id=user_id, setlist_id=setlist_id).first()
            if existing:
                continue
            try:
                attendance_svc.log_concert_attendance(
                    user_id=user_id,
                    setlist_id=setlist_id,
                    support_setlist_ids=[],
                )
                imported_count += 1
            except SetlistRateLimitError as exc:
                logger.warning("Setlist.fm rate limit quota reached during selective import: %s", exc)
                return {
                    "status": "paused_rate_limit",
                    "imported_count": imported_count,
                    "total_found": total_found,
                    "message": str(exc),
                }
            except Exception as exc:
                logger.warning("Skipping setlist %s due to error: %s", setlist_id, exc)

        return {
            "status": "completed",
            "imported_count": imported_count,
            "total_found": total_found,
        }

    page = 1
    total_found = 0

    logger.info("Starting historical Setlist.fm import for user %s (username: %s)", user_id, setlist_username)

    while True:
        try:
            data = svc.get_user_attended(username=setlist_username, p=page)
        except SetlistRateLimitError as exc:
            logger.warning("Setlist.fm rate limit quota reached during import: %s", exc)
            return {
                "status": "paused_rate_limit",
                "imported_count": imported_count,
                "total_found": total_found,
                "message": str(exc),
            }
        except Exception as exc:
            logger.error("Unexpected error fetching attended setlists: %s", exc)
            return {
                "status": "error",
                "imported_count": imported_count,
                "total_found": total_found,
                "message": str(exc),
            }

        setlists = data.get("setlist", []) if isinstance(data, dict) else []
        total_found = data.get("total", total_found)
        items_per_page = data.get("itemsPerPage", 20)

        if not setlists:
            break

        for item in setlists:
            if not isinstance(item, dict):
                continue
            setlist_id = item.get("id")
            if not setlist_id:
                continue

            # Check if already imported
            existing = db.query(AttendedConcert).filter_by(user_id=user_id, setlist_id=setlist_id).first()
            if existing:
                continue

            try:
                attendance_svc.log_concert_attendance(
                    user_id=user_id,
                    setlist_id=setlist_id,
                    support_setlist_ids=[],
                )
                imported_count += 1
            except SetlistRateLimitError as exc:
                logger.warning("Setlist.fm rate limit quota reached during concert log: %s", exc)
                return {
                    "status": "paused_rate_limit",
                    "imported_count": imported_count,
                    "total_found": total_found,
                    "message": str(exc),
                }
            except Exception as exc:
                logger.warning("Skipping setlist %s due to error: %s", setlist_id, exc)

        # Check pagination
        if page * items_per_page >= total_found or not setlists:
            break
        page += 1

    logger.info("Completed Setlist.fm historical import: %s gigs imported", imported_count)
    return {
        "status": "completed",
        "imported_count": imported_count,
        "total_found": total_found,
    }
