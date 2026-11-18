from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import pytest

from backend.app.services import skiddle_service
from backend.app.services.skiddle_service import (
    SkiddleClient,
    canonical_artist_key,
    parse_skiddle_event,
)

FIXTURE = Path(__file__).parent / "fixtures" / "skiddle_search_sample.json"
SECRET = "sk-test-secret-key-123"


def _sample_events() -> list[dict[str, Any]]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["results"]


def _by_id(event_id: str) -> dict[str, Any]:
    return next(e for e in _sample_events() if e["id"] == event_id)


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: Any = None, headers: dict[str, str] | None = None):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}

    def json(self) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("GET", f"https://www.skiddle.com/x?api_key={SECRET}")
            raise httpx.HTTPStatusError("bad", request=request, response=httpx.Response(self.status_code))


class FakeHttp:
    """Stands in for httpx.Client; replays scripted outcomes and records every call."""

    def __init__(self, outcomes: list[Any]):
        self.outcomes = list(outcomes)
        self.calls: list[dict[str, Any]] = []

    def __call__(self, *args: Any, **kwargs: Any) -> FakeHttp:
        self.client_kwargs = kwargs
        return self

    def __enter__(self) -> FakeHttp:
        return self

    def __exit__(self, *exc: Any) -> None:
        return None

    def get(self, url: str, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None):
        self.calls.append({"url": url, "params": dict(params or {}), "headers": dict(headers or {})})
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _client(monkeypatch: pytest.MonkeyPatch, outcomes: list[Any], key: str = SECRET):
    fake = FakeHttp(outcomes)
    monkeypatch.setattr(skiddle_service.httpx, "Client", fake)
    sleeps: list[float] = []
    client = SkiddleClient(api_key=key, sleep=sleeps.append, jitter=lambda: 0.0)
    return client, fake, sleeps


def _page(count: int, total: int, start: int = 0) -> FakeResponse:
    results = [{"id": str(start + i)} for i in range(count)]
    return FakeResponse(200, {"error": 0, "totalcount": str(total), "pagecount": 1, "results": results})


# ---- parser -----------------------------------------------------------------


def test_parse_event_with_artists_maps_every_field():
    parsed = parse_skiddle_event(_by_id("43160194"))
    assert parsed is not None
    assert parsed["source"] == "skiddle"
    assert parsed["external_id"] == "43160194"
    assert parsed["artist_name"] == "The Feeling"
    assert parsed["artist_key"] == "the feeling"
    assert parsed["attraction_names"] == ["The Feeling"]
    assert parsed["event_name"] == "The Feeling"
    assert parsed["venue_name"] == "HMV EMPIRE COVENTRY"
    assert parsed["city"] == "Coventry"
    assert parsed["country_code"] == "GB"
    assert isinstance(parsed["lat"], float) and isinstance(parsed["lng"], float)
    assert parsed["event_date"] == date(2026, 11, 26)
    assert parsed["is_cancelled"] is False
    assert parsed["onsale_start_at"] is None


def test_parse_event_uses_the_link_exactly_as_given():
    raw = _by_id("43160194")
    parsed = parse_skiddle_event(raw)
    assert parsed is not None
    assert parsed["ticket_url"] == raw["link"]


def test_parse_event_without_artists_falls_back_to_event_name():
    parsed = parse_skiddle_event(_by_id("43140187"))
    assert parsed is not None
    assert parsed["artist_name"] == "Fang Night - Mesch:, Crackbears, Balloon Tomb"
    assert parsed["attraction_names"] == ["Fang Night - Mesch:, Crackbears, Balloon Tomb"]


def test_parse_event_merges_artist_spellings_that_differ_only_by_ampersand():
    parsed = parse_skiddle_event(_by_id("42803240"))
    assert parsed is not None
    assert len(parsed["attraction_names"]) == 1
    assert parsed["attraction_keys"] == ["echo and the bunnymen"]


def test_parse_event_reads_local_start_time():
    parsed = parse_skiddle_event(_by_id("43140187"))
    assert parsed is not None
    assert parsed["event_time"] == "19:30"


def test_parse_event_marks_cancelled_events():
    raw = dict(_by_id("43160194"), cancelled="1")
    parsed = parse_skiddle_event(raw)
    assert parsed is not None and parsed["is_cancelled"] is True


def test_parse_event_drops_unsafe_links_and_images():
    raw = dict(_by_id("43160194"), link="javascript:alert(1)", imageurl="data:text/html,x", largeimageurl="")
    parsed = parse_skiddle_event(raw)
    assert parsed is not None
    assert parsed["ticket_url"] is None
    assert parsed["image_url"] is None


@pytest.mark.parametrize("patch", [{"id": ""}, {"date": ""}, {"date": "not-a-date"}])
def test_parse_event_skips_events_missing_id_or_date(patch: dict[str, str]):
    assert parse_skiddle_event(dict(_by_id("43160194"), **patch)) is None


def test_parse_event_tolerates_missing_venue_and_bad_coordinates():
    raw = dict(_by_id("43160194"))
    raw["venue"] = {"name": "Somewhere", "latitude": "abc", "longitude": None}
    parsed = parse_skiddle_event(raw)
    assert parsed is not None
    assert parsed["lat"] is None and parsed["lng"] is None
    raw["venue"] = None
    assert parse_skiddle_event(raw) is not None


def test_canonical_artist_key_treats_ampersand_and_and_alike():
    assert canonical_artist_key("Echo & The Bunnymen") == canonical_artist_key("echo  AND the bunnymen")
    assert canonical_artist_key(None) == ""


# ---- client: request shape ---------------------------------------------------


def test_every_request_sends_a_descriptive_user_agent_and_the_key(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [_page(1, 1)])
    client.search_events({"latitude": 52.28, "longitude": -1.585, "radius": 10})
    call = fake.calls[0]
    agent = call["headers"]["User-Agent"]
    assert agent.startswith("AudioScrobblerApp/")
    assert "http" in agent  # names a URL, as the guidelines require
    assert call["params"]["api_key"] == SECRET
    assert call["params"]["radius"] == 10
    assert "limit" in call["params"]


def test_requests_use_a_short_timeout(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [_page(1, 1)])
    client.search_events({})
    assert fake.client_kwargs["timeout"] <= 10


def test_no_key_means_no_request_and_no_results(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [], key="")
    assert client.search_events({}) == []
    assert fake.calls == []


def test_key_is_trimmed_of_quotes_and_whitespace():
    assert SkiddleClient(api_key=" 'abc' \n").api_key == "abc"


# ---- client: paging and throttling -------------------------------------------


def test_paging_follows_offset_until_total_is_reached(monkeypatch: pytest.MonkeyPatch):
    client, fake, sleeps = _client(monkeypatch, [_page(100, 130), _page(30, 130, 100)])
    events = client.search_all({"eventcode": "LIVE"}, max_pages=5)
    assert len(events) == 130
    assert [c["params"]["offset"] for c in fake.calls] == [0, 100]
    assert all(c["params"]["limit"] == 100 for c in fake.calls)
    assert len(sleeps) >= 1  # paused between the two requests


def test_paging_stops_at_max_pages(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [_page(100, 1000), _page(100, 1000, 100), _page(100, 1000, 200)])
    events = client.search_all({}, max_pages=2)
    assert len(events) == 200
    assert len(fake.calls) == 2


def test_empty_result_page_ends_paging(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [_page(0, 0)])
    assert client.search_all({}, max_pages=5) == []
    assert len(fake.calls) == 1


# ---- client: failure handling -------------------------------------------------


def test_429_backs_off_honours_retry_after_then_succeeds(monkeypatch: pytest.MonkeyPatch):
    client, fake, sleeps = _client(monkeypatch, [FakeResponse(429, headers={"Retry-After": "7"}), _page(1, 1)])
    assert len(client.search_events({})) == 1
    assert len(fake.calls) == 2
    assert max(sleeps) >= 7


def test_5xx_and_timeouts_retry_with_growing_waits_then_give_up(monkeypatch: pytest.MonkeyPatch):
    client, fake, sleeps = _client(
        monkeypatch, [FakeResponse(503), httpx.ReadTimeout("slow"), FakeResponse(502), FakeResponse(500)]
    )
    assert client.search_events({}) == []
    assert 2 <= len(fake.calls) <= 4  # gives up after a few attempts
    waits = client.backoff_waits
    assert len(waits) >= 2
    assert waits == sorted(waits) and len(set(waits)) == len(waits)  # exponential, not constant
    assert all(w in sleeps for w in waits)


@pytest.mark.parametrize("status", [400, 401, 403, 404])
def test_client_errors_are_never_retried(monkeypatch: pytest.MonkeyPatch, status: int):
    client, fake, _ = _client(monkeypatch, [FakeResponse(status), _page(1, 1)])
    assert client.search_events({}) == []
    assert len(fake.calls) == 1


@pytest.mark.parametrize("status", [401, 403])
def test_auth_failure_stops_the_whole_sweep(monkeypatch: pytest.MonkeyPatch, status: int):
    client, fake, _ = _client(monkeypatch, [FakeResponse(status), _page(1, 1)])
    client.search_events({})
    assert client.blocked is True
    assert client.search_events({}) == []
    assert len(fake.calls) == 1


def test_repeated_429_marks_client_blocked_for_the_rest_of_the_sweep(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [FakeResponse(429)] * 4)
    assert client.search_events({}) == []
    assert client.blocked is True
    calls_so_far = len(fake.calls)
    assert client.search_events({}) == []
    assert len(fake.calls) == calls_so_far


def test_api_level_error_in_a_200_response_is_not_retried(monkeypatch: pytest.MonkeyPatch):
    client, fake, _ = _client(monkeypatch, [FakeResponse(200, {"error": 1, "errormessage": "bad"}), _page(1, 1)])
    assert client.search_events({}) == []
    assert len(fake.calls) == 1


def test_non_json_body_is_handled(monkeypatch: pytest.MonkeyPatch):
    client, _, _ = _client(monkeypatch, [FakeResponse(200, ValueError("not json"))])
    assert client.search_events({}) == []


# ---- the key must never reach the logs -----------------------------------------


def test_logs_never_contain_the_api_key(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture):
    request = httpx.Request("GET", f"https://www.skiddle.com/api/v1/events/search/?api_key={SECRET}")
    outcomes = [
        httpx.ConnectError(f"cannot reach {request.url}", request=request),
        FakeResponse(500),
        FakeResponse(401),
    ]
    client, _, _ = _client(monkeypatch, outcomes)
    with caplog.at_level(logging.DEBUG):
        client.search_events({})
    assert SECRET not in caplog.text
