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

    assert app.health_check() == {
        "status": "ok",
        "service": "worker",
        "scheduler_running": "true",
        "fixture_enabled": "false",
        "spotify_enabled": "false",
        "last_spotify_sync_at": "never",
        "last_spotify_sync_users": "0",
        "last_spotify_sync_failures": "0",
        "last_spotify_sync_events": "0",
    }