"""Makes and stores each person's Wrapped snapshots.

A snapshot is worked out once and then only read, so the numbers a person has seen never change under them.
Stages: `preview` (30 December morning, only early-access people can see it), `unlock` (18:00 on 31 December,
what people see, with a bell notification and a push) and `final` (just after midnight on 1 January, covering
the whole year, quietly replacing `unlock`). The worker asks `run_due` regularly, and the server's own clock
decides which stages are due, so a worker that was down at the wrong moment catches up on its next run.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..datetime_utils import utc_now
from ..models import ListeningEvent, Notification, User, YearReview
from ..queries.analytics_queries import not_blocked_clause
from .push_service import queue_push
from .wrapped_gig_stats import build_gig_stats
from .wrapped_music_stats import LONDON, MIN_PLAYS, build_music_stats, to_london

logger = logging.getLogger(__name__)

FORMAT_VERSION = 1
FIRST_LIVE_YEAR = 2026
STAGES = ("preview", "unlock", "final")
PREVIEW_AT = (12, 30, 8, 0)  # month, day, hour, minute in London time
UNLOCK_AT = (12, 31, 18, 0)
FINAL_AT = (1, 1, 0, 5)  # in the following January


def london_to_utc_naive(local: datetime) -> datetime:
    """A naive London wall-clock time as a naive UTC time."""
    return local.replace(tzinfo=LONDON).astimezone(timezone.utc).replace(tzinfo=None)


def early_access_ids() -> list[int]:
    return settings.wrapped_early_access_ids()


def backfill_from_year() -> int:
    """First past year to build an archive Wrapped for (0 = off)."""
    return settings.wrapped_backfill_year()


def unlock_moment(year: int) -> datetime:
    """When a year unlocks, as naive UTC."""
    return london_to_utc_naive(datetime(year, *UNLOCK_AT))


def _stage_moment(year: int, stage: str) -> datetime:
    if stage == "preview":
        return london_to_utc_naive(datetime(year, *PREVIEW_AT))
    if stage == "unlock":
        return unlock_moment(year)
    return london_to_utc_naive(datetime(year + 1, *FINAL_AT))


def _years_to_check(now: datetime) -> list[int]:
    """This year, plus last year until the end of February so a worker that was down still catches up."""
    local = to_london(now)
    years = [local.year]
    if local.month <= 2:
        years.append(local.year - 1)
    return sorted(year for year in years if year >= FIRST_LIVE_YEAR)


def _window(year: int, stage: str, now: datetime) -> tuple[datetime, datetime]:
    start = london_to_utc_naive(datetime(year, 1, 1))
    year_end = london_to_utc_naive(datetime(year + 1, 1, 1))
    end = year_end if stage in ("final", "archive") else min(now, year_end)
    return start, end


def _changed(old: dict[str, Any], new: dict[str, Any]) -> list[str]:
    changed: list[str] = []
    for part in ("music", "gigs"):
        before, after = old.get(part) or {}, new.get(part) or {}
        for key in sorted(set(before) | set(after)):
            if before.get(key) != after.get(key):
                changed.append(f"{part}.{key}")
    return changed


def generate_year_review(
    db: Session,
    user_id: int,
    year: int,
    stage: str,
    now: datetime,
    is_sample: bool = False,
    replace: bool = False,
) -> YearReview | None:
    """Makes one snapshot. Returns None if the person has too little to show.

    An existing snapshot is returned untouched unless `replace` is set (used only to refresh the sample)."""
    existing = db.execute(
        select(YearReview).where(YearReview.user_id == user_id, YearReview.year == year, YearReview.stage == stage)
    ).scalar_one_or_none()
    if existing is not None and not replace:
        return existing

    start, end = _window(year, stage, now)
    music = build_music_stats(db, user_id, start, end)
    gig_today = min(to_london(end - timedelta(seconds=1)).date(), date(year, 12, 31))
    gigs = build_gig_stats(db, user_id, year, today=gig_today)
    if music is None and gigs is None:
        return None

    partial_from = None
    if music and music["history_starts_at"]:
        first = to_london(datetime.fromisoformat(music["history_starts_at"])).date()
        if first > date(year, 1, 1):
            partial_from = first.isoformat()

    data: dict[str, Any] = {
        "year": year,
        "stage": stage,
        "date_from": to_london(start).date().isoformat(),
        "date_to": gig_today.isoformat(),
        "partial_from": partial_from,
        "music": music,
        "gigs": gigs,
        "changed": [],
    }
    if stage == "final":
        unlock = db.execute(
            select(YearReview).where(
                YearReview.user_id == user_id, YearReview.year == year, YearReview.stage == "unlock"
            )
        ).scalar_one_or_none()
        if unlock is not None:
            data["changed"] = _changed(unlock.data, data)

    if existing is not None:
        review = existing
        review.data, review.window_start, review.window_end = data, start, end
        review.generated_at, review.is_sample = utc_now(), is_sample
    else:
        review = YearReview(
            user_id=user_id,
            year=year,
            stage=stage,
            format_version=FORMAT_VERSION,
            data=data,
            is_sample=is_sample,
            window_start=start,
            window_end=end,
            generated_at=utc_now(),
        )
        db.add(review)

    notify = stage == "unlock" and not is_sample and existing is None
    title, message, link = _notification_text(year, music, gigs)
    if notify:
        db.add(Notification(user_id=user_id, title=title, message=message, type="wrapped", link=link))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # another run made it first
        return None
    if notify:
        queue_push(user_id, title, message, link)
    return review


def is_eligible(db: Session, user_id: int, year: int, now: datetime) -> bool:
    """True when the person already has enough in the year to get a Wrapped (30 plays or a gig night)."""
    start, end = _window(year, "preview", now)
    plays = db.scalar(
        select(func.count(ListeningEvent.id)).where(
            ListeningEvent.user_id == user_id,
            ListeningEvent.played_at >= start,
            ListeningEvent.played_at < end,
            not_blocked_clause(user_id),
        )
    )
    if (plays or 0) >= MIN_PLAYS:
        return True
    return build_gig_stats(db, user_id, year, today=to_london(end - timedelta(seconds=1)).date()) is not None


def _notification_text(year: int, music: dict[str, Any] | None, gigs: dict[str, Any] | None) -> tuple[str, str, str]:
    parts = []
    if music:
        parts.append(f"about {music['estimated_minutes']:,} minutes of music")
    if gigs:
        parts.append(f"{gigs['nights']} gig night{'s' if gigs['nights'] != 1 else ''}")
    return f"Your {year} Wrapped is ready", "Your year: " + " and ".join(parts) + ".", f"/wrapped/{year}"


def run_due(db: Session, now: datetime) -> dict[str, int]:
    """Makes every snapshot that is due and missing, for every active person. Safe to run repeatedly."""
    user_ids = list(db.scalars(select(User.id).where(User.is_active.is_(True)).order_by(User.id)))
    generated = failed = 0
    for year in _years_to_check(now):
        for stage in STAGES:
            if now < _stage_moment(year, stage):
                continue
            have = set(db.scalars(select(YearReview.user_id).where(YearReview.year == year, YearReview.stage == stage)))
            for user_id in user_ids:
                if user_id in have:
                    continue
                try:
                    if generate_year_review(db, user_id, year, stage, now) is not None:
                        generated += 1
                except Exception as exc:  # one person's problem must not stop everyone after them
                    db.rollback()
                    failed += 1
                    logger.warning("Wrapped %s %s failed for user %s: %s", year, stage, user_id, type(exc).__name__)
    archived, archive_failed = _backfill_past_years(db, now, user_ids)
    return {"generated": generated, "failed": failed + archive_failed, "archived": archived}


def _backfill_past_years(db: Session, now: datetime, user_ids: list[int]) -> tuple[int, int]:
    """Quiet "archive" snapshots for the years before the live release, for everyone with enough in that year.

    No banner and no notification (the banner only looks at unlock and final snapshots). A person who already
    has any snapshot for a year keeps it. People with too little in a year get nothing, and are simply checked
    again next time, which is cheap."""
    first = backfill_from_year()
    if first <= 0:
        return 0, 0
    made = failed = 0
    for year in range(first, FIRST_LIVE_YEAR):
        have = set(db.scalars(select(YearReview.user_id).where(YearReview.year == year)))
        for user_id in user_ids:
            if user_id in have:
                continue
            try:
                if generate_year_review(db, user_id, year, "archive", now) is not None:
                    made += 1
            except Exception as exc:  # one person's problem must not stop everyone after them
                db.rollback()
                failed += 1
                logger.warning("Wrapped %s archive failed for user %s: %s", year, user_id, type(exc).__name__)
    return made, failed
