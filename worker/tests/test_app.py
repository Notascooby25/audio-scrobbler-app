from __future__ import annotations

from datetime import datetime

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
    assert datetime.fromisoformat(event["played_at"])  # type: ignore[arg-type]


def test_fixture_ingestion_posts_internal_event(monkeypatch):
    class Response:
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