from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import ListeningEvent, User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/monthly-summary")
def monthly_summary(
    from_month: str | None = Query(default=None, description="Inclusive lower-bound month in YYYY-MM format."),
    to_month: str | None = Query(default=None, description="Inclusive upper-bound month in YYYY-MM format."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    if from_month and len(from_month) != 7:
        raise HTTPException(status_code=400, detail="from_month must be in YYYY-MM format")
    if to_month and len(to_month) != 7:
        raise HTTPException(status_code=400, detail="to_month must be in YYYY-MM format")

    month_expr = func.date_trunc("month", ListeningEvent.played_at)
    query = (
        db.query(
            func.to_char(month_expr, "YYYY-MM").label("month"),
            func.count(ListeningEvent.id).label("total_plays"),
            func.count(func.distinct(ListeningEvent.track_id)).label("unique_tracks"),
        )
        .filter(ListeningEvent.user_id == current_user.id)
        .group_by(month_expr)
        .order_by(month_expr.asc())
    )

    if from_month:
        from_dt = datetime.strptime(f"{from_month}-01", "%Y-%m-%d")
        query = query.filter(ListeningEvent.played_at >= from_dt)

    if to_month:
        to_dt = datetime.strptime(f"{to_month}-01", "%Y-%m-%d")
        query = query.filter(ListeningEvent.played_at < to_dt.replace(year=to_dt.year + 1) if to_dt.month == 12 else to_dt.replace(month=to_dt.month + 1))

    rows = query.all()
    summary = [
        {
            "month": row.month,
            "total_plays": int(row.total_plays),
            "unique_tracks": int(row.unique_tracks),
            "total_listening_minutes": 0,
        }
        for row in rows
    ]

    return {
        "user_id": current_user.id,
        "summary": summary,
        "total_months": len(summary),
    }
