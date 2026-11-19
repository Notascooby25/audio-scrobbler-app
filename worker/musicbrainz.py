"""MusicBrainz genre lookups, used when Spotify has no genres for an artist.

MusicBrainz is free and needs no key, but it asks for about one request a second per
IP address and a User-Agent that says how to contact the app's maintainers. Faster or
anonymous callers get "503 Service Unavailable" and, if it persists, are blocked.
See https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

Only artist names and Spotify artist IDs are ever sent. Nothing about a user is.

Genre data is MusicBrainz community data: credit it wherever it is shown."""

from __future__ import annotations

import logging
import re
import time
import unicodedata

import requests

logger = logging.getLogger(__name__)

MUSICBRAINZ_API_URL = "https://musicbrainz.org/ws/2"
# A contact URL, not a person's email, as the MusicBrainz rules allow.
MUSICBRAINZ_USER_AGENT = "AudioScrobblerApp/1.0 ( https://github.com/Notascooby25/audio-scrobbler-app )"
MIN_SECONDS_BETWEEN_REQUESTS = 1.1
REQUEST_TIMEOUT_SECONDS = 10
# A name search is only trusted when the name is the same and MusicBrainz is very sure.
MIN_NAME_SEARCH_SCORE = 95
NAME_SEARCH_LIMIT = 5
MAX_SEARCH_NAME_LENGTH = 255
MAX_GENRES_PER_ARTIST = 10

_MBID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_SPOTIFY_ARTIST_ID_PATTERN = re.compile(r"^[A-Za-z0-9]{1,64}$")


class MusicBrainzUnavailableError(Exception):
    """MusicBrainz is busy, down or unreachable. Stop asking it for the rest of this run."""


def _normalise_name(name: str) -> str:
    """Lower-case, accent-free, single-spaced, with '&' as 'and', for comparing artist names."""
    decomposed = unicodedata.normalize("NFKD", name)
    without_accents = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(without_accents.casefold().replace("&", " and ").split())


def _escape_for_quoted_search(name: str) -> str:
    return name.replace("\\", "\\\\").replace('"', '\\"')


class MusicBrainzClient:
    def __init__(self, session: requests.Session | None = None, sleep=time.sleep, clock=time.monotonic):
        self._session = session or requests.Session()
        self._sleep = sleep
        self._clock = clock
        self._last_request_at: float | None = None

    def _wait_for_turn(self) -> None:
        if self._last_request_at is None:
            return
        wait = MIN_SECONDS_BETWEEN_REQUESTS - (self._clock() - self._last_request_at)
        if wait > 0:
            self._sleep(wait)

    def _get(self, path: str, params: dict[str, str]) -> dict[str, object] | None:
        """Returns the JSON object, None when MusicBrainz has nothing, or raises if it is unavailable."""
        self._wait_for_turn()
        try:
            response = self._session.get(
                f"{MUSICBRAINZ_API_URL}{path}",
                params={**params, "fmt": "json"},
                headers={"User-Agent": MUSICBRAINZ_USER_AGENT, "Accept": "application/json"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            raise MusicBrainzUnavailableError(type(exc).__name__) from exc
        finally:
            self._last_request_at = self._clock()

        if response.status_code == 404:
            return None
        if response.status_code == 429 or response.status_code >= 500:
            raise MusicBrainzUnavailableError(f"HTTP {response.status_code}")
        if response.status_code >= 400:
            logger.debug("MusicBrainz rejected a lookup: HTTP %s", response.status_code)
            return None
        try:
            data = response.json()
        except ValueError as exc:
            raise MusicBrainzUnavailableError("unreadable reply") from exc
        return data if isinstance(data, dict) else None

    def find_artist_by_spotify_id(self, spotify_artist_id: str) -> str | None:
        """The MusicBrainz artist that links to this exact Spotify artist, if there is exactly one."""
        if not _SPOTIFY_ARTIST_ID_PATTERN.match(spotify_artist_id):
            return None
        data = self._get(
            "/url",
            {"resource": f"https://open.spotify.com/artist/{spotify_artist_id}", "inc": "artist-rels"},
        )
        if not data:
            return None
        artist_ids: set[str] = set()
        for relation in data.get("relations") or []:
            artist = relation.get("artist") if isinstance(relation, dict) else None
            artist_id = artist.get("id") if isinstance(artist, dict) else None
            if isinstance(artist_id, str) and _MBID_PATTERN.match(artist_id):
                artist_ids.add(artist_id)
        return next(iter(artist_ids)) if len(artist_ids) == 1 else None

    def find_artist_by_name(self, name: str) -> str | None:
        """The one MusicBrainz artist with exactly this name. Anything doubtful returns None.

        A wrong artist with the same name would show the wrong genres, so a blank is better
        than a guess: two artists with the name, a different name or a low score all give None."""
        wanted = _normalise_name(name)
        if not wanted or len(name) > MAX_SEARCH_NAME_LENGTH:
            # Artist names can come from imported history, so refuse absurd ones rather than send them on.
            return None
        data = self._get(
            "/artist",
            {"query": f'artist:"{_escape_for_quoted_search(name)}"', "limit": str(NAME_SEARCH_LIMIT)},
        )
        if not data:
            return None
        matches: set[str] = set()
        for candidate in data.get("artists") or []:
            if not isinstance(candidate, dict):
                continue
            candidate_id = candidate.get("id")
            candidate_name = candidate.get("name")
            try:
                score = int(candidate.get("score", 0))
            except (TypeError, ValueError):
                continue
            if (
                isinstance(candidate_id, str)
                and _MBID_PATTERN.match(candidate_id)
                and isinstance(candidate_name, str)
                and score >= MIN_NAME_SEARCH_SCORE
                and _normalise_name(candidate_name) == wanted
            ):
                matches.add(candidate_id)
        return next(iter(matches)) if len(matches) == 1 else None

    def get_genres(self, musicbrainz_artist_id: str) -> list[str]:
        """Genre names for an artist, most agreed-on first. Genres, not tags: tags include noise like 'seen live'."""
        if not _MBID_PATTERN.match(musicbrainz_artist_id):
            return []
        data = self._get(f"/artist/{musicbrainz_artist_id}", {"inc": "genres"})
        if not data:
            return []
        voted: list[tuple[int, str]] = []
        for genre in data.get("genres") or []:
            if not isinstance(genre, dict) or not isinstance(genre.get("name"), str) or not genre["name"].strip():
                continue
            count = genre.get("count", 1)
            if isinstance(count, int) and count > 0:
                voted.append((count, genre["name"].strip()))
        voted.sort(key=lambda entry: (-entry[0], entry[1]))
        names: list[str] = []
        for _, genre_name in voted:
            if genre_name not in names:
                names.append(genre_name)
        return names[:MAX_GENRES_PER_ARTIST]

    def lookup_genres(self, spotify_artist_id: str, artist_name: str | None) -> list[str]:
        """Genres for an artist: found by Spotify link first, then by exact name.

        Returns [] when MusicBrainz has no confident match or no genres. Raises
        MusicBrainzUnavailableError when it could not be asked at all."""
        musicbrainz_artist_id = self.find_artist_by_spotify_id(spotify_artist_id)
        if musicbrainz_artist_id is None and artist_name:
            musicbrainz_artist_id = self.find_artist_by_name(artist_name)
        if musicbrainz_artist_id is None:
            return []
        return self.get_genres(musicbrainz_artist_id)
