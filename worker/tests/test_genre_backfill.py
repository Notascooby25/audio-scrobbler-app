from __future__ import annotations

from datetime import datetime, timezone

import pytest
import requests

import spotify_ingestion
from spotify_ingestion import (
    GENRE_LOOKUP_SPACING_SECONDS,
    MAX_GENRE_LOOKUPS_PER_RUN,
    SpotifyRateLimitedError,
    backfill_artist_genres,
)


def _http_error(status_code: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status_code
    return requests.HTTPError(f"HTTP {status_code}", response=response)


class FakeSpotifyClient:
    """Answers artist lookups from a dict. A value that is an Exception is raised instead."""

    def __init__(self, answers: dict[str, object]):
        self.answers = answers
        self.requested: list[str] = []

    def artist(self, access_token: str, artist_id: str) -> dict[str, object]:
        self.requested.append(artist_id)
        answer = self.answers[artist_id]
        if isinstance(answer, Exception):
            raise answer
        return answer  # type: ignore[return-value]


@pytest.fixture
def backend(monkeypatch):
    """Stands in for the backend's two genre-cache endpoints and records what is saved."""
    state = {"pending": [], "limit": None, "saved": []}

    def fake_pending(backend_url, worker_token, limit):
        state["limit"] = limit
        return state["pending"]

    def fake_submit(backend_url, worker_token, items):
        state["saved"].extend(items)

    monkeypatch.setattr(spotify_ingestion, "fetch_pending_genre_artist_ids", fake_pending)
    monkeypatch.setattr(spotify_ingestion, "submit_genre_cache_with_retries", fake_submit)
    return state


def _run(client, sleeps=None, **kwargs):
    recorded = sleeps if sleeps is not None else []
    return backfill_artist_genres(client, "http://backend", "token", "access", sleep=recorded.append, **kwargs)


def _pending(*artist_ids: str) -> list[dict[str, object]]:
    return [{"artist_spotify_id": artist_id, "artist_name": f"Artist {artist_id}"} for artist_id in artist_ids]


def test_saves_the_genres_spotify_returns(backend):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": ["indie rock", " shoegaze ", "indie rock", "", 7]}})

    stats = _run(client)

    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["indie rock", "shoegaze"]}]
    assert stats == {"processed": 1, "resolved": 1, "failures": 0}


def test_an_artist_with_no_genres_is_saved_as_empty_so_it_is_not_a_failure(backend):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": []}})

    stats = _run(client)

    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": []}]
    assert stats["failures"] == 0


def test_never_contacts_last_fm(backend, monkeypatch):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": ["jazz"]}})

    def fail_if_called(*args, **kwargs):
        raise AssertionError("no outside web request should be made by the Spotify-only path")

    monkeypatch.setattr(requests, "get", fail_if_called)

    _run(client)

    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["jazz"]}]


def test_a_rate_limit_stops_the_run_but_keeps_what_was_found(backend):
    backend["pending"] = _pending("a1", "a2", "a3")
    blocked_until = datetime(2030, 1, 1, tzinfo=timezone.utc)
    client = FakeSpotifyClient(
        {
            "a1": {"genres": ["folk"]},
            "a2": SpotifyRateLimitedError(blocked_until),
            "a3": {"genres": ["never reached"]},
        }
    )

    stats = _run(client)

    assert client.requested == ["a1", "a2"]
    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["folk"]}]
    assert stats == {"processed": 1, "resolved": 1, "failures": 0}


def test_a_missing_artist_is_saved_as_empty_but_other_errors_are_retried_later(backend):
    backend["pending"] = _pending("gone", "broken", "flaky")
    client = FakeSpotifyClient(
        {
            "gone": _http_error(404),
            "broken": _http_error(500),
            "flaky": requests.ConnectionError("network down"),
        }
    )

    stats = _run(client)

    assert backend["saved"] == [{"artist_spotify_id": "gone", "genres": []}]
    assert stats == {"processed": 3, "resolved": 1, "failures": 2}


def test_a_run_is_capped_and_asks_the_backend_for_no_more_than_the_cap(backend):
    backend["pending"] = _pending(*[f"a{n}" for n in range(5)])
    client = FakeSpotifyClient({f"a{n}": {"genres": ["pop"]} for n in range(5)})

    _run(client, max_items=500)

    assert backend["limit"] == MAX_GENRE_LOOKUPS_PER_RUN


def test_lookups_are_spaced_out(backend):
    backend["pending"] = _pending("a1", "a2", "a3")
    client = FakeSpotifyClient({name: {"genres": ["pop"]} for name in ("a1", "a2", "a3")})
    sleeps: list[float] = []

    _run(client, sleeps=sleeps)

    assert sleeps == [GENRE_LOOKUP_SPACING_SECONDS, GENRE_LOOKUP_SPACING_SECONDS]


def test_nothing_pending_makes_no_spotify_calls(backend):
    client = FakeSpotifyClient({})

    stats = _run(client)

    assert client.requested == []
    assert backend["saved"] == []
    assert stats == {"processed": 0, "resolved": 0, "failures": 0}
