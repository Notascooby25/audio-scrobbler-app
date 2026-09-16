from __future__ import annotations

import requests

from backend.app.services import spotify_library_service


class FakeResponse:
    def __init__(self, status_code, headers=None, payload=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_request_retries_after_429_and_succeeds(monkeypatch):
    responses = iter([
        FakeResponse(429, headers={"Retry-After": "0"}),
        FakeResponse(200, payload={"ok": True}),
    ])
    sleeps = []
    monkeypatch.setattr(spotify_library_service.requests, "request", lambda *a, **k: next(responses))
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: sleeps.append(seconds))

    response = spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")

    assert response.json() == {"ok": True}
    assert sleeps == [0.0]


def test_request_retries_after_server_error_with_backoff(monkeypatch):
    responses = iter([
        FakeResponse(503),
        FakeResponse(200, payload={"ok": True}),
    ])
    sleeps = []
    monkeypatch.setattr(spotify_library_service.requests, "request", lambda *a, **k: next(responses))
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: sleeps.append(seconds))

    response = spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")

    assert response.json() == {"ok": True}
    assert sleeps == [1]


def test_request_raises_after_exhausting_retries_on_persistent_429(monkeypatch):
    monkeypatch.setattr(
        spotify_library_service.requests,
        "request",
        lambda *a, **k: FakeResponse(429, headers={"Retry-After": "0"}),
    )
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: None)

    # The final attempt (attempt == 2) no longer qualifies for a retry, so it
    # falls through to raise_for_status() rather than the trailing guard —
    # matching the worker's identical SpotifyClient._request behavior.
    try:
        spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")
    except requests.HTTPError as exc:
        assert "429" in str(exc)
    else:
        raise AssertionError("Expected requests.HTTPError after exhausting retries")


def test_request_does_not_retry_on_other_client_errors(monkeypatch):
    calls = []

    def fake_request(*args, **kwargs):
        calls.append(1)
        return FakeResponse(401)

    monkeypatch.setattr(spotify_library_service.requests, "request", fake_request)
    monkeypatch.setattr(spotify_library_service.time, "sleep", lambda seconds: None)

    try:
        spotify_library_service._request("GET", "https://api.spotify.com/v1/me/tracks")
    except requests.HTTPError:
        pass
    else:
        raise AssertionError("Expected requests.HTTPError for a non-retryable status")

    assert len(calls) == 1
