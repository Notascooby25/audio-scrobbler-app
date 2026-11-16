from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import app as worker_app


def test_run_gig_discovery_sync_posts_internal_endpoint(monkeypatch):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"configured": 1, "upserted": 4, "pruned": 1}
    mock_resp.raise_for_status.return_value = None

    captured: dict = {}

    def fake_post(url, params=None, headers=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        captured["headers"] = headers
        return mock_resp

    monkeypatch.setattr(worker_app.requests, "post", fake_post)
    worker_app.run_gig_discovery_sync(user_id=7)

    assert captured["url"].endswith("/setlists/internal/discover-sync")
    assert captured["params"] == {"user_id": 7}
    assert captured["headers"] == {"X-Worker-Token": worker_app.worker_token}


def test_trigger_gig_discovery_requires_token_and_schedules(monkeypatch):
    client = TestClient(worker_app.app)
    unauth = client.post("/internal/trigger-gig-discovery", headers={"X-Worker-Token": "bad"})
    assert unauth.status_code == 401

    monkeypatch.setattr(worker_app, "run_gig_discovery_sync", MagicMock())
    res = client.post(
        "/internal/trigger-gig-discovery",
        json={"user_id": 5},
        headers={"X-Worker-Token": worker_app.worker_token},
    )
    assert res.status_code == 200
    assert res.json()["scheduled"] is True
