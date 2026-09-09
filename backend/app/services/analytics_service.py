from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.queries.analytics_queries import build_monthly_summary_query
from backend.app.schemas.analytics import MonthlySummaryEntry, MonthlySummaryResponse


async def get_monthly_summary(
    db: AsyncSession,
    user_id: UUID,
    from_month: str | None = None,
    to_month: str | None = None,
) -> MonthlySummaryResponse:
    statement = build_monthly_summary_query(
        user_id=user_id,
        from_month=from_month,
        to_month=to_month,
    )
    rows = (await db.execute(statement)).all()

    summary = [
        MonthlySummaryEntry(
            month=row.month,
            total_plays=int(row.total_plays),
            unique_tracks=int(row.unique_tracks),
            total_listening_minutes=int((row.total_duration_ms or 0) // 60000),
        )
        for row in rows
    ]

    return MonthlySummaryResponse(
        user_id=user_id,
        summary=summary,
        total_months=len(summary),
    )
