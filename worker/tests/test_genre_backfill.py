from __future__ import annotations

from datetime import datetime, timezone

import pytest
import requests

import spotify_ingestion
from musicbrainz import MusicBrainzUnavailableError
from spotify_ingestion import (
    GENRE_LOOKUP_SPACING_SECONDS,
    MAX_GENRE_LOOKUPS_PER_RUN,
    MAX_MUSICBRAINZ_LOOKUPS_PER_RUN,
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


def _run(client, sleeps=None, access_token="access", **kwargs):
    recorded = sleeps if sleeps is not None else []
    return backfill_artist_genres(client, "http://backend", "token", access_token, sleep=recorded.append, **kwargs)


class FakeMusicBrainz:
    """Answers genre lookups from a dict of artist id -> genres. An Exception value is raised instead."""

    def __init__(self, answers: dict[str, object] | None = None):
        self.answers = answers or {}
        self.requested: list[tuple[str, str | None]] = []

    def lookup_genres(self, spotify_artist_id: str, artist_name: str | None) -> list[str]:
        self.requested.append((spotify_artist_id, artist_name))
        answer = self.answers.get(spotify_artist_id, [])
        if isinstance(answer, Exception):
            raise answer
        return answer  # type: ignore[return-value]


def _counts(stats: dict[str, int]) -> dict[str, int]:
    return {key: stats[key] for key in ("processed", "resolved", "failures")}


def _pending(*artist_ids: str) -> list[dict[str, object]]:
    return [{"artist_spotify_id": artist_id, "artist_name": f"Artist {artist_id}"} for artist_id in artist_ids]


def test_saves_the_genres_spotify_returns(backend):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": ["indie rock", " shoegaze ", "indie rock", "", 7]}})

    stats = _run(client)

    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["indie rock", "shoegaze"]}]
    assert _counts(stats) == {"processed": 1, "resolved": 1, "failures": 0}


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
    assert _counts(stats) == {"processed": 1, "resolved": 1, "failures": 0}


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
    assert _counts(stats) == {"processed": 3, "resolved": 1, "failures": 2}


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
    assert _counts(stats) == {"processed": 0, "resolved": 0, "failures": 0}


# --- MusicBrainz as the backup for Spotify ---------------------------------------------


def test_musicbrainz_is_not_asked_when_spotify_has_genres(backend):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": ["jazz"]}})
    musicbrainz = FakeMusicBrainz({"a1": ["should not be used"]})

    stats = _run(client, musicbrainz=musicbrainz)

    assert musicbrainz.requested == []
    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["jazz"]}]
    assert (stats["from_spotify"], stats["from_musicbrainz"]) == (1, 0)


def test_musicbrainz_fills_in_when_spotify_has_no_genres(backend):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": []}})
    musicbrainz = FakeMusicBrainz({"a1": ["post-punk", "new wave"]})

    stats = _run(client, musicbrainz=musicbrainz)

    assert musicbrainz.requested == [("a1", "Artist a1")]
    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["post-punk", "new wave"]}]
    assert (stats["from_spotify"], stats["from_musicbrainz"]) == (0, 1)


def test_an_artist_neither_source_knows_is_saved_as_empty(backend):
    backend["pending"] = _pending("a1")
    client = FakeSpotifyClient({"a1": {"genres": []}})
    musicbrainz = FakeMusicBrainz({"a1": []})

    stats = _run(client, musicbrainz=musicbrainz)

    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": []}]
    assert stats["failures"] == 0


def test_a_musicbrainz_outage_leaves_the_artist_to_be_retried_and_stops_asking_it(backend):
    backend["pending"] = _pending("a1", "a2", "a3")
    client = FakeSpotifyClient({"a1": {"genres": []}, "a2": {"genres": []}, "a3": {"genres": ["folk"]}})
    musicbrainz = FakeMusicBrainz({"a1": MusicBrainzUnavailableError("HTTP 503")})

    stats = _run(client, musicbrainz=musicbrainz)

    assert [artist_id for artist_id, _ in musicbrainz.requested] == ["a1"]
    # a1 and a2 are NOT saved as "no genres": MusicBrainz never actually answered for them.
    assert backend["saved"] == [{"artist_spotify_id": "a3", "genres": ["folk"]}]
    assert stats["failures"] == 2


def test_when_spotify_is_rate_limited_musicbrainz_carries_on_alone(backend):
    backend["pending"] = _pending("a1", "a2", "a3")
    client = FakeSpotifyClient(
        {
            "a1": SpotifyRateLimitedError(datetime(2030, 1, 1, tzinfo=timezone.utc)),
            "a2": {"genres": ["never asked"]},
            "a3": {"genres": ["never asked"]},
        }
    )
    musicbrainz = FakeMusicBrainz({"a1": ["house"], "a2": ["techno"], "a3": []})

    stats = _run(client, musicbrainz=musicbrainz)

    assert client.requested == ["a1"]
    assert backend["saved"] == [
        {"artist_spotify_id": "a1", "genres": ["house"]},
        {"artist_spotify_id": "a2", "genres": ["techno"]},
    ]
    # a3 has no MusicBrainz genres, but Spotify never answered, so it is not recorded as empty.
    assert stats["from_musicbrainz"] == 2
    assert stats["failures"] == 0


def test_with_no_spotify_token_musicbrainz_does_the_whole_run(backend):
    backend["pending"] = _pending("a1", "a2")
    client = FakeSpotifyClient({})
    musicbrainz = FakeMusicBrainz({"a1": ["ambient"], "a2": []})

    stats = _run(client, access_token=None, musicbrainz=musicbrainz)

    assert client.requested == []
    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["ambient"]}]
    assert stats["from_musicbrainz"] == 1


def test_with_no_spotify_token_and_no_musicbrainz_nothing_happens(backend):
    backend["pending"] = _pending("a1")

    stats = _run(FakeSpotifyClient({}), access_token=None)

    assert backend["saved"] == []
    assert _counts(stats) == {"processed": 0, "resolved": 0, "failures": 0}


def test_a_spotify_error_with_a_musicbrainz_answer_still_saves_the_genres(backend):
    backend["pending"] = _pending("a1", "a2")
    client = FakeSpotifyClient({"a1": _http_error(500), "a2": _http_error(500)})
    musicbrainz = FakeMusicBrainz({"a1": ["metal"], "a2": []})

    stats = _run(client, musicbrainz=musicbrainz)

    assert backend["saved"] == [{"artist_spotify_id": "a1", "genres": ["metal"]}]
    # a2: Spotify errored and MusicBrainz found nothing, so it is retried, not saved as empty.
    assert stats["failures"] == 1


def test_musicbrainz_is_limited_per_run_and_the_rest_wait_for_the_next_run(backend):
    count = MAX_MUSICBRAINZ_LOOKUPS_PER_RUN + 4
    names = [f"a{n}" for n in range(count)]
    backend["pending"] = _pending(*names)
    client = FakeSpotifyClient({name: {"genres": []} for name in names})
    musicbrainz = FakeMusicBrainz({name: ["rock"] for name in names})

    _run(client, musicbrainz=musicbrainz, max_items=count)

    assert len(musicbrainz.requested) == MAX_MUSICBRAINZ_LOOKUPS_PER_RUN
    assert len(backend["saved"]) == MAX_MUSICBRAINZ_LOOKUPS_PER_RUN
    # Spotify is not asked about artists that the run has no MusicBrainz capacity left for.
    assert len(client.requested) == MAX_MUSICBRAINZ_LOOKUPS_PER_RUN + 1
