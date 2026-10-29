from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import app


def test_fixture_is_disabled_by_default(monkeypatch):
    monkeypatch.setattr(app, "fixture_enabled", False)
    monkeypatch.setattr(app.requests, "post", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError()))

    app.run_fixture_ingestion()


def test_fixture_event_has_stable_identity_fields(monkeypatch):
    monkeypatch.setattr(app, "fixture_user_id", 7)
    event = app.build_fixture_event()

    assert event["user_id"] == 7
    assert event["track_id"] == "development-fixture-track"
    assert event["played_at"] == "2026-01-01T00:00:00+00:00"
    assert datetime.fromisoformat(event["played_at"])  # type: ignore[arg-type]


def test_fixture_ingestion_posts_internal_event(monkeypatch):
    class Response:
        status_code = 201

        def raise_for_status(self):
            return None

    calls = []
    monkeypatch.setattr(app, "fixture_enabled", True)
    monkeypatch.setattr(app, "backend_url", "http://backend:8000")
    monkeypatch.setattr(app, "worker_token", "test-token")
    monkeypatch.setattr(app.requests, "post", lambda *args, **kwargs: calls.append((args, kwargs)) or Response())

    app.run_fixture_ingestion()

    assert calls[0][0] == ("http://backend:8000/ingestion/internal/events",)
    assert calls[0][1]["headers"] == {"X-Worker-Token": "test-token"}


def test_fixture_ingestion_retries_server_errors(monkeypatch):
    class Response:
        status_code = 503

        def raise_for_status(self):
            raise app.requests.HTTPError("temporary failure")

    attempts = []
    monkeypatch.setattr(app, "fixture_enabled", True)
    monkeypatch.setattr(app.requests, "post", lambda *args, **kwargs: attempts.append(1) or Response())

    try:
        app.run_fixture_ingestion()
    except app.requests.HTTPError:
        pass

    assert len(attempts) == app.max_attempts


def test_health_reports_scheduler_and_fixture_status(monkeypatch):
    monkeypatch.setattr(app, "scheduler", SimpleNamespace(running=True))
    monkeypatch.setattr(app, "fixture_enabled", False)
    monkeypatch.setattr(app, "spotify_enabled", False)

    assert app.health_check() == {
        "status": "ok",
        "service": "worker",
        "scheduler_running": "true",
        "fixture_enabled": "false",
        "spotify_enabled": "false",
        "spotify_rate_limited_until": "not_limited",
        "last_spotify_sync_at": "never",
        "last_spotify_sync_users": "0",
        "last_spotify_sync_failures": "0",
        "last_spotify_sync_events": "0",
        "last_liked_tracks_sync_at": "never",
        "last_liked_tracks_sync_users": "0",
        "last_liked_tracks_sync_failures": "0",
        "last_liked_tracks_sync_events": "0",
        "file_import_enabled": "false",
        "last_file_import_at": "never",
        "last_file_import_processed": "0",
        "last_file_import_failed": "0",
        "last_setlist_resume_at": "never",
        "last_setlist_resume_processed": "0",
        "last_setlist_resume_failed": "0",
        "last_setlist_artwork_at": "never",
        "last_setlist_artwork_updated": "0",
        "last_genre_cache_sync_at": "never",
        "last_genre_cache_sync_processed": "0",
        "last_genre_cache_sync_resolved": "0",
        "last_genre_cache_sync_failures": "0",
    }


def test_readiness_requires_running_scheduler(monkeypatch):
    monkeypatch.setattr(app, "scheduler", SimpleNamespace(running=False))
    response = app.readiness_check()
    assert response.status_code == 503


def test_metrics_exposes_worker_gauges_without_user_data():
    metrics = app.metrics()
    assert "audio_scrobbler_worker_scheduler_running" in metrics
    assert "audio_scrobbler_worker_spotify_sync_failures" in metrics
    assert "audio_scrobbler_worker_file_import_processed" in metrics
    assert "user_id" not in metrics


def test_run_file_import_is_disabled_by_default(monkeypatch):
    monkeypatch.setattr(app, "file_import_enabled", False)
    monkeypatch.setattr(
        app,
        "process_import_directory",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError()),
    )

    app.run_file_import()


def test_run_file_import_records_processed_and_failed_counts(monkeypatch):
    monkeypatch.setattr(app, "file_import_enabled", True)
    monkeypatch.setattr(app, "process_import_directory", lambda *args, **kwargs: {"processed": 2, "failed": 1})

    app.run_file_import()

    assert app.last_file_import_processed == 2
    assert app.last_file_import_failed == 1
    assert app.last_file_import_at is not None

def test_setlist_import_resume_calls_the_backend_with_the_worker_token(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"processed": 2, "finished": 1, "repaused": 1, "failed": 0}

    calls = []
    monkeypatch.setattr(app, "backend_url", "http://backend:8000")
    monkeypatch.setattr(app, "worker_token", "test-token")
    monkeypatch.setattr(app.requests, "post", lambda *args, **kwargs: calls.append((args, kwargs)) or Response())

    app.run_setlist_import_resume()

    assert calls[0][0] == ("http://backend:8000/setlists/internal/resume-imports",)
    assert calls[0][1]["headers"] == {"X-Worker-Token": "test-token"}
    assert app.last_setlist_resume_processed == 2


def test_setlist_import_resume_survives_backend_errors(monkeypatch):
    def fail(*args, **kwargs):
        raise app.requests.ConnectionError("backend down")

    monkeypatch.setattr(app.requests, "post", fail)
    app.run_setlist_import_resume()  # must not raise


def test_setlist_artwork_backfill_calls_the_backend_with_the_worker_token(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"checked": 5, "updated": 12, "missed": 1, "lookups": 6}

    calls = []
    monkeypatch.setattr(app, "backend_url", "http://backend:8000")
    monkeypatch.setattr(app, "worker_token", "test-token")
    monkeypatch.setattr(app.requests, "post", lambda *args, **kwargs: calls.append((args, kwargs)) or Response())

    app.run_setlist_artwork_backfill()

    assert calls[0][0] == ("http://backend:8000/setlists/internal/backfill-artwork",)
    assert calls[0][1]["headers"] == {"X-Worker-Token": "test-token"}
    assert app.last_setlist_artwork_updated == 12
    monkeypatch.setattr(app, "last_setlist_artwork_at", None)
    monkeypatch.setattr(app, "last_setlist_artwork_updated", 0)


def test_setlist_artwork_backfill_survives_backend_errors(monkeypatch):
    def fail(*args, **kwargs):
        raise app.requests.ConnectionError("backend down")

    monkeypatch.setattr(app.requests, "post", fail)
    app.run_setlist_artwork_backfill()  # must not raise
