from __future__ import annotations

import threading
import time
from datetime import timedelta
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


def test_gig_discovery_syncs_never_overlap(monkeypatch):
    """Skiddle asks for one request at a time, so two syncs must queue rather than run together."""
    running = 0
    peak = 0
    guard = threading.Lock()

    def slow_post(url, params=None, headers=None, timeout=None):
        nonlocal running, peak
        with guard:
            running += 1
            peak = max(peak, running)
        time.sleep(0.05)
        with guard:
            running -= 1
        resp = MagicMock()
        resp.raise_for_status.return_value = None
        resp.json.return_value = {"configured": 1}
        return resp

    monkeypatch.setattr(worker_app.requests, "post", slow_post)
    threads = [threading.Thread(target=worker_app.run_gig_discovery_sync, args=(uid,)) for uid in (1, 2, 3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert peak == 1


def test_trigger_gig_discovery_is_debounced_for_a_couple_of_minutes(monkeypatch):
    worker_app._last_discovery_trigger_by_user.clear()
    monkeypatch.setattr(worker_app, "run_gig_discovery_sync", MagicMock())
    client = TestClient(worker_app.app)
    headers = {"X-Worker-Token": worker_app.worker_token}
    first = client.post("/internal/trigger-gig-discovery", json={"user_id": 9}, headers=headers)
    assert first.json()["scheduled"] is True
    worker_app._last_discovery_trigger_by_user[9] -= timedelta(seconds=90)  # 90 s later: still too soon
    second = client.post("/internal/trigger-gig-discovery", json={"user_id": 9}, headers=headers)
    assert second.json()["scheduled"] is False
    worker_app._last_discovery_trigger_by_user[9] -= timedelta(seconds=60)  # 150 s later: fine
    third = client.post("/internal/trigger-gig-discovery", json={"user_id": 9}, headers=headers)
    assert third.json()["scheduled"] is True
