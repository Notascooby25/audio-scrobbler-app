from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.analytics import MonthlySummaryResponse
from ..services.analytics_service import get_monthly_summary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/monthly-summary")
def monthly_summary(
    from_month: str | None = Query(default=None, description="Inclusive lower-bound month in YYYY-MM format."),
    to_month: str | None = Query(default=None, description="Inclusive upper-bound month in YYYY-MM format."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MonthlySummaryResponse:
    try:
        return get_monthly_summary(db, current_user.id, from_month, to_month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
