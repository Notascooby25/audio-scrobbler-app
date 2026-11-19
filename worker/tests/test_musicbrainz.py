from __future__ import annotations

import pytest
import requests

from musicbrainz import (
    MIN_SECONDS_BETWEEN_REQUESTS,
    MUSICBRAINZ_USER_AGENT,
    MusicBrainzClient,
    MusicBrainzUnavailableError,
)

ARTIST_ID = "0383dadf-2a4e-4d10-a46a-e9e041da8eb3"
OTHER_ARTIST_ID = "5b11f4ce-a62d-471e-81fc-a69a8278c7da"
SPOTIFY_ID = "1dfeR4HaWDbWqFHLkxsg1d"


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: object = None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if self._payload is None:
            raise ValueError("no body")
        return self._payload


class FakeSession:
    """Answers each request from a queue, in order, and remembers what was asked."""

    def __init__(self, *replies: object):
        self.replies = list(replies)
        self.calls: list[dict[str, object]] = []

    def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append({"url": url, "params": params, "headers": headers, "timeout": timeout})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


class FakeClock:
    def __init__(self):
        self.now = 1000.0
        self.slept: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


def _client(*replies: object) -> tuple[MusicBrainzClient, FakeSession, FakeClock]:
    session = FakeSession(*replies)
    clock = FakeClock()
    return MusicBrainzClient(session=session, sleep=clock.sleep, clock=clock.time), session, clock


def _artist_search(*candidates: dict[str, object]) -> FakeResponse:
    return FakeResponse(200, {"artists": list(candidates)})


def _genres(*pairs: tuple[str, int]) -> FakeResponse:
    return FakeResponse(200, {"id": ARTIST_ID, "genres": [{"name": name, "count": count} for name, count in pairs]})


def test_every_request_sends_a_contact_user_agent_with_no_email():
    client, session, _ = _client(FakeResponse(404))

    client.find_artist_by_spotify_id(SPOTIFY_ID)

    headers = session.calls[0]["headers"]
    assert headers["User-Agent"] == MUSICBRAINZ_USER_AGENT
    assert "https://github.com/" in MUSICBRAINZ_USER_AGENT
    assert "@" not in MUSICBRAINZ_USER_AGENT
    assert session.calls[0]["params"]["fmt"] == "json"


def test_finds_an_artist_from_its_spotify_link():
    relation = {"target-type": "artist", "artist": {"id": ARTIST_ID, "name": "Radiohead"}}
    client, session, _ = _client(FakeResponse(200, {"relations": [relation]}))

    assert client.find_artist_by_spotify_id(SPOTIFY_ID) == ARTIST_ID
    assert session.calls[0]["url"].endswith("/url")
    assert session.calls[0]["params"]["resource"] == f"https://open.spotify.com/artist/{SPOTIFY_ID}"
    assert session.calls[0]["params"]["inc"] == "artist-rels"


def test_a_spotify_link_shared_by_two_artists_is_not_trusted():
    relations = [
        {"target-type": "artist", "artist": {"id": ARTIST_ID}},
        {"target-type": "artist", "artist": {"id": OTHER_ARTIST_ID}},
    ]
    client, _, _ = _client(FakeResponse(200, {"relations": relations}))

    assert client.find_artist_by_spotify_id(SPOTIFY_ID) is None


def test_an_odd_looking_spotify_id_is_never_sent():
    client, session, _ = _client()

    assert client.find_artist_by_spotify_id("abc/../../x?y=1") is None
    assert session.calls == []


def test_name_search_accepts_one_confident_exact_match():
    client, session, _ = _client(
        _artist_search(
            {"id": ARTIST_ID, "name": "Radiohead", "score": 100},
            {"id": OTHER_ARTIST_ID, "name": "Radiohead Tribute Band", "score": 90},
        )
    )

    assert client.find_artist_by_name("Radiohead") == ARTIST_ID
    assert session.calls[0]["params"]["query"] == 'artist:"Radiohead"'


def test_name_search_ignores_case_accents_and_ampersands():
    client, _, _ = _client(_artist_search({"id": ARTIST_ID, "name": "Beyoncé & The Band", "score": "100"}))

    assert client.find_artist_by_name("beyonce and the band") == ARTIST_ID


def test_name_search_gives_up_when_two_artists_share_the_name():
    client, _, _ = _client(
        _artist_search(
            {"id": ARTIST_ID, "name": "Nirvana", "score": 100},
            {"id": OTHER_ARTIST_ID, "name": "Nirvana", "score": 100},
        )
    )

    assert client.find_artist_by_name("Nirvana") is None


@pytest.mark.parametrize(
    "candidate",
    [
        {"id": ARTIST_ID, "name": "Radiohead", "score": 80},
        {"id": ARTIST_ID, "name": "Radiohead Tribute", "score": 100},
        {"id": "not-a-real-id", "name": "Radiohead", "score": 100},
        {"id": ARTIST_ID, "name": "Radiohead", "score": "high"},
    ],
)
def test_name_search_refuses_doubtful_matches(candidate):
    client, _, _ = _client(_artist_search(candidate))

    assert client.find_artist_by_name("Radiohead") is None


def test_quotes_in_an_artist_name_cannot_break_out_of_the_search_phrase():
    client, session, _ = _client(_artist_search())

    client.find_artist_by_name('Say "Hi" \\ Bye')

    assert session.calls[0]["params"]["query"] == 'artist:"Say \\"Hi\\" \\\\ Bye"'


def test_genres_are_ordered_by_votes_and_zero_vote_genres_are_dropped():
    client, session, _ = _client(_genres(("art rock", 3), ("alternative rock", 9), ("downvoted", 0), ("electronic", 3)))

    assert client.get_genres(ARTIST_ID) == ["alternative rock", "art rock", "electronic"]
    assert session.calls[0]["url"].endswith(f"/artist/{ARTIST_ID}")
    assert session.calls[0]["params"]["inc"] == "genres"


def test_an_odd_looking_musicbrainz_id_is_never_used_in_a_path():
    client, session, _ = _client()

    assert client.get_genres("../../admin") == []
    assert session.calls == []


def test_lookup_prefers_the_spotify_link_and_skips_the_name_search():
    relation = {"target-type": "artist", "artist": {"id": ARTIST_ID}}
    client, session, _ = _client(FakeResponse(200, {"relations": [relation]}), _genres(("rock", 5)))

    assert client.lookup_genres(SPOTIFY_ID, "Radiohead") == ["rock"]
    assert len(session.calls) == 2
    assert session.calls[0]["url"].endswith("/url")
    assert session.calls[1]["url"].endswith(f"/artist/{ARTIST_ID}")


def test_lookup_falls_back_to_the_name_when_the_spotify_link_is_unknown():
    client, session, _ = _client(
        FakeResponse(404),
        _artist_search({"id": ARTIST_ID, "name": "Radiohead", "score": 100}),
        _genres(("rock", 5)),
    )

    assert client.lookup_genres(SPOTIFY_ID, "Radiohead") == ["rock"]
    assert len(session.calls) == 3


def test_lookup_returns_nothing_when_no_confident_match_exists():
    client, session, _ = _client(FakeResponse(404), _artist_search())

    assert client.lookup_genres(SPOTIFY_ID, "Unknown Band") == []
    assert len(session.calls) == 2


def test_requests_are_at_least_a_second_apart():
    client, _, clock = _client(FakeResponse(404), FakeResponse(404), FakeResponse(404))

    client.find_artist_by_spotify_id(SPOTIFY_ID)
    client.find_artist_by_spotify_id(SPOTIFY_ID)
    client.find_artist_by_spotify_id(SPOTIFY_ID)

    assert len(clock.slept) == 2
    assert all(seconds == pytest.approx(MIN_SECONDS_BETWEEN_REQUESTS) for seconds in clock.slept)


@pytest.mark.parametrize(
    "reply",
    [
        FakeResponse(503),
        FakeResponse(429),
        FakeResponse(500),
        requests.ConnectionError("down"),
        requests.Timeout("slow"),
        FakeResponse(200, None),
    ],
)
def test_busy_or_unreachable_musicbrainz_is_reported_not_treated_as_no_genres(reply):
    client, _, _ = _client(reply)

    with pytest.raises(MusicBrainzUnavailableError):
        client.find_artist_by_spotify_id(SPOTIFY_ID)
