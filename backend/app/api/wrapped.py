from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..datetime_utils import utc_now
from ..db import get_db
from ..models import User, YearReview
from ..schemas.wrapped import (
    WrappedBanner,
    WrappedDetailResponse,
    WrappedListResponse,
    WrappedYearEntry,
)
from ..services import wrapped_service
from ..services.wrapped_music_stats import to_london
from .deps import get_current_user
from .ingestion import require_worker_token

# Not "/wrapped": that is the page's own address in the app (/wrapped/2026), so the API needs a different path.
router = APIRouter(prefix="/year-reviews", tags=["wrapped"])

STAGE_ORDER = {"preview": 0, "archive": 1, "unlock": 1, "final": 2}


def _visible_rows(db: Session, user_id: int) -> list[YearReview]:
    """The person's own snapshots they may see. Previews and the sample year are early-access only."""
    early = user_id in wrapped_service.early_access_ids()
    rows = db.scalars(select(YearReview).where(YearReview.user_id == user_id)).all()
    return [row for row in rows if early or (not row.is_sample and row.stage != "preview")]


def _newest(rows: list[YearReview]) -> YearReview:
    return max(rows, key=lambda row: STAGE_ORDER[row.stage])


def _entry(rows: list[YearReview]) -> WrappedYearEntry:
    row = _newest(rows)
    music = row.data.get("music") or {}
    top = (music.get("top_artists") or [None])[0] or {}
    return WrappedYearEntry(
        year=row.year,
        status="ready",
        stage=row.stage,
        updated=bool(row.data.get("changed")),
        seen=any(r.seen_at is not None for r in rows),
        is_sample=row.is_sample,
        top_artist=top.get("name"),
        top_artist_artwork=top.get("artwork_url"),
        date_from=row.data.get("date_from"),
        date_to=row.data.get("date_to"),
    )


def _banner_year(rows: list[YearReview]) -> int | None:
    """The newest released year the person hasn't opened or dismissed."""
    released: dict[int, list[YearReview]] = {}
    for row in rows:
        if not row.is_sample and row.stage in ("unlock", "final"):
            released.setdefault(row.year, []).append(row)
    for year in sorted(released, reverse=True):
        if not any(r.seen_at or r.dismissed_at for r in released[year]):
            return year
        return None
    return None


@router.get("", response_model=WrappedListResponse)
def list_wrapped(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WrappedListResponse:
    rows = _visible_rows(db, current_user.id)
    by_year: dict[int, list[YearReview]] = {}
    for row in rows:
        by_year.setdefault(row.year, []).append(row)
    years = [_entry(group) for group in by_year.values()]

    now = utc_now()
    this_year = to_london(now).year
    if (
        this_year >= wrapped_service.FIRST_LIVE_YEAR
        and this_year not in by_year
        and wrapped_service.is_eligible(db, current_user.id, this_year, now)
    ):
        years.append(
            WrappedYearEntry(year=this_year, status="locked", unlocks_at=wrapped_service.unlock_moment(this_year))
        )
    years.sort(key=lambda entry: entry.year, reverse=True)
    banner_year = _banner_year(rows)
    return WrappedListResponse(years=years, banner=WrappedBanner(year=banner_year) if banner_year else None)


def _year_rows_or_404(db: Session, user_id: int, year: int) -> list[YearReview]:
    rows = [row for row in _visible_rows(db, user_id) if row.year == year]
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No Wrapped for that year.")
    return rows


@router.get("/{year}", response_model=WrappedDetailResponse)
def get_wrapped(
    year: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WrappedDetailResponse:
    row = _newest(_year_rows_or_404(db, current_user.id, year))
    return WrappedDetailResponse(
        year=row.year,
        stage=row.stage,
        is_sample=row.is_sample,
        updated=bool(row.data.get("changed")),
        format_version=row.format_version,
        data=row.data,
    )


@router.post("/{year}/seen", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def mark_seen(
    year: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    row = _newest(_year_rows_or_404(db, current_user.id, year))
    if row.seen_at is None:
        row.seen_at = utc_now()
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{year}/dismiss", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def dismiss(
    year: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    row = _newest(_year_rows_or_404(db, current_user.id, year))
    if row.dismissed_at is None:
        row.dismissed_at = utc_now()
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/internal/run-due")
def run_due(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_worker_token)],
) -> dict[str, int]:
    """Called by the worker: makes any Wrapped snapshots that are due by the server's clock."""
    return wrapped_service.run_due(db, utc_now())
