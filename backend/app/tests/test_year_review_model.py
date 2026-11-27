from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.datetime_utils import utc_now
from backend.app.db import Base
from backend.app.models import YearReview


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _review(stage: str, user_id: int = 1) -> YearReview:
    now = utc_now()
    return YearReview(
        user_id=user_id,
        year=2026,
        stage=stage,
        format_version=1,
        data={},
        window_start=now,
        window_end=now,
        generated_at=now,
    )


def test_unique_per_user_year_stage(db_session: Session) -> None:
    db_session.add(_review("unlock"))
    db_session.commit()
    db_session.add(_review("unlock"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
    db_session.add(_review("final"))
    db_session.add(_review("unlock", user_id=2))
    db_session.commit()


def test_defaults(db_session: Session) -> None:
    db_session.add(_review("preview"))
    db_session.commit()
    row = db_session.query(YearReview).one()
    assert row.is_sample is False
    assert row.seen_at is None
    assert row.dismissed_at is None
