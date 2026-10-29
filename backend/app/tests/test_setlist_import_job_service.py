from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.db import Base
from backend.app.models import AttendedConcert, Notification, SetlistImportJob
from backend.app.services import setlist_import_job_service as jobs
from backend.app.services.setlist_import_service import sync_user_setlist_history
from backend.app.services.setlist_service import SetlistRateLimitError


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def _show(setlist_id: str, artist: str) -> dict:
    return {
        "id": setlist_id,
        "artist": {"name": artist},
        "venue": {"name": "Rock City", "city": {"name": "Nottingham", "country": {"name": "UK"}}},
        "eventDate": "01-05-2025",
        "sets": {"set": [{"song": [{"name": f"{artist} song"}]}]},
    }


PAGES = {
    1: {"total": 2, "itemsPerPage": 1, "setlist": [_show("aa01", "Doves")]},
    2: {"total": 2, "itemsPerPage": 1, "setlist": [_show("bb02", "Elbow")]},
}


def _service(fail_page: int | None = None) -> MagicMock:
    service = MagicMock()

    def attended(username, p=1):
        if p == fail_page:
            raise SetlistRateLimitError("Daily Setlist.fm API quota reached (1400/1400).")
        return PAGES.get(p, {"total": 2, "setlist": []})

    service.get_user_attended.side_effect = attended
    shows = {"aa01": _show("aa01", "Doves"), "bb02": _show("bb02", "Elbow"), "cc03": _show("cc03", "Blur")}
    service.get_setlist.side_effect = lambda sid, force_refresh=False: shows.get(sid, {})
    return service


def _make_due(db: Session, job: SetlistImportJob) -> None:
    job.resume_after = datetime.utcnow() - timedelta(minutes=1)
    db.commit()


def test_profile_import_pauses_at_the_quota_and_resumes_after_the_reset(db_session: Session):
    result = sync_user_setlist_history(1, "andy202", db_session, setlist_service=_service(fail_page=2))
    job = jobs.save_paused_import(db_session, 1, "profile", result, setlist_username="andy202")

    assert (job.status, job.next_page, job.imported_count, job.total) == ("paused", 2, 1, 2)
    assert job.resume_after == jobs.next_quota_reset()
    # Not due until the quota resets
    assert jobs.resume_due_jobs(db_session, setlist_service=_service())["processed"] == 0

    _make_due(db_session, job)
    counts = jobs.resume_due_jobs(db_session, setlist_service=_service())

    assert counts == {"processed": 1, "finished": 1, "repaused": 0, "failed": 0}
    db_session.refresh(job)
    assert (job.status, job.imported_count) == ("done", 2)
    assert {g.artist_name for g in db_session.query(AttendedConcert).filter_by(user_id=1)} == {"Doves", "Elbow"}
    note = db_session.query(Notification).filter_by(user_id=1).one()
    assert "2 gigs added" in note.message


def test_large_selective_import_is_spread_across_runs(db_session: Session):
    with patch.object(jobs, "MAX_GIGS_PER_RUN", 2):
        job = jobs.save_paused_import(
            db_session,
            1,
            "selected",
            {"status": "paused_rate_limit", "total_found": 3},
            payload=["aa01", "bb02", "cc03"],
        )
        _make_due(db_session, job)

        first = jobs.resume_due_jobs(db_session, setlist_service=_service())
        db_session.refresh(job)
        assert first["repaused"] == 1
        assert job.payload == ["cc03"]
        # Budget pauses carry on at the next run, not tomorrow
        assert job.resume_after <= datetime.utcnow()

        second = jobs.resume_due_jobs(db_session, setlist_service=_service())
    db_session.refresh(job)
    assert second["finished"] == 1
    assert (job.status, job.imported_count) == ("done", 3)


def test_file_songs_job_fetches_songs_for_gigs_imported_without_them(db_session: Session):
    gig = AttendedConcert(
        user_id=1,
        setlist_id="aa01",
        artist_name="Doves",
        venue_name="Rock City",
        city="Nottingham",
        country="UK",
        event_date=datetime(2025, 5, 1),
        song_count=0,
    )
    db_session.add(gig)
    db_session.commit()
    job = jobs.save_paused_import(
        db_session, 1, "file_songs", {"status": "paused_rate_limit", "total_found": 2}, payload=[gig.id, 99999]
    )
    _make_due(db_session, job)

    counts = jobs.resume_due_jobs(db_session, setlist_service=_service())

    assert counts["finished"] == 1
    db_session.refresh(gig)
    assert gig.song_count == 1
    assert "updated with songs" in db_session.query(Notification).one().message


def test_cancel_and_jobs_are_per_user(db_session: Session):
    jobs.save_paused_import(db_session, 1, "profile", {"status": "paused_rate_limit"}, setlist_username="a")
    assert jobs.open_job(db_session, 2) is None
    assert jobs.cancel_open_job(db_session, 2) is False
    assert jobs.cancel_open_job(db_session, 1) is True
    assert jobs.open_job(db_session, 1) is None


def test_a_failing_job_does_not_stop_the_others(db_session: Session):
    for user_id in (1, 2):
        job = jobs.save_paused_import(
            db_session, user_id, "profile", {"status": "paused_rate_limit"}, setlist_username="x"
        )
        _make_due(db_session, job)
    service = _service()
    service.get_user_attended.side_effect = [RuntimeError("boom"), PAGES[1], PAGES[2]]

    counts = jobs.resume_due_jobs(db_session, setlist_service=service)

    assert (counts["failed"], counts["finished"]) == (1, 1)


def test_a_completed_selective_import_does_not_close_a_paused_full_import(db_session: Session):
    jobs.save_paused_import(db_session, 1, "profile", {"status": "paused_rate_limit"}, setlist_username="a")
    jobs.finish_open_job(db_session, 1, "selected")
    assert jobs.open_job(db_session, 1) is not None
    jobs.finish_open_job(db_session, 1, "profile")
    assert jobs.open_job(db_session, 1) is None
