import re
with open('worker/spotify_ingestion.py', 'r') as f:
    content = f.read()

# Add fetch_pending_genre_artist_ids and submit_genre_cache_with_retries near the top where fetch_pending_playlist_uris used to be.
functions = '''
def fetch_pending_genre_artist_ids(backend_url: str, worker_token: str, limit: int) -> list[dict[str, object]]:
    response = requests.get(
        f"{backend_url.rstrip('/')}/spotify/internal/genre-cache/pending",
        headers={"Authorization": f"Bearer {worker_token}"},
        params={"limit": limit},
        timeout=10,
    )
    response.raise_for_status()
    return response.json().get("items", [])


def submit_genre_cache_with_retries(backend_url: str, worker_token: str, items: list[dict[str, object]]):
    if not items:
        return
    url = f"{backend_url.rstrip('/')}/spotify/internal/genre-cache"
    headers = {"Authorization": f"Bearer {worker_token}"}
    for attempt in range(3):
        response = requests.post(
            url,
            headers=headers,
            json={"items": items},
            timeout=10,
        )
        if response.status_code in (500, 502, 503, 504) and attempt < 2:
            import time
            time.sleep(2 ** attempt)
            continue
        response.raise_for_status()
        return
'''

# Find a good place to insert, e.g. after sync_liked_tracks_to_backend
insert_pos = content.find('def sync_liked_tracks_to_backend')
content = content[:insert_pos] + functions + '\n\n' + content[insert_pos:]

client_functions = '''
    def get_client_credentials_token(self) -> str:
        response = self._request("post", SPOTIFY_TOKEN_URL, data={"grant_type": "client_credentials"}, auth=(self.client_id, self.client_secret))
        response.raise_for_status()
        return response.json()["access_token"]

    def artists(self, access_token: str, artist_ids: list[str]) -> list[dict[str, object]]:
        if not artist_ids:
            return []
        url = "https://api.spotify.com/v1/artists"
        params = {"ids": ",".join(artist_ids)}
        response = self._request("get", url, headers={"Authorization": f"Bearer {access_token}"}, params=params)
        response.raise_for_status()
        return [artist for artist in response.json().get("artists", []) if artist is not None]
'''

# insert into SpotifyClient
# find `def recently_played`
insert_pos2 = content.find('    def recently_played(')
content = content[:insert_pos2] + client_functions + '\n' + content[insert_pos2:]

# append backfill_artist_genres
backfill_function = '''
def backfill_artist_genres(
    client: SpotifyClient,
    backend_url: str,
    worker_token: str,
    max_items: int = 50,
) -> dict[str, int]:
    stats = {"processed": 0, "resolved": 0, "failures": 0}
    try:
        pending = fetch_pending_genre_artist_ids(backend_url, worker_token, limit=max_items)
        if not pending:
            return stats
        
        artist_ids = [p["artist_spotify_id"] for p in pending]
        stats["processed"] = len(artist_ids)
        
        # Spotify allows up to 50 artists per request
        access_token = client.get_client_credentials_token()
        
        # Fetch genres
        resolved_items = []
        # Chunking into 50s just in case max_items > 50
        for i in range(0, len(artist_ids), 50):
            chunk = artist_ids[i:i + 50]
            try:
                artists_data = client.artists(access_token, chunk)
                for artist in artists_data:
                    resolved_items.append({
                        "artist_spotify_id": artist["id"],
                        "genres": artist.get("genres", [])
                    })
            except Exception:
                stats["failures"] += len(chunk)
                
        # For any artist ID we couldn't resolve, fallback to empty genres array
        resolved_ids = {item["artist_spotify_id"] for item in resolved_items}
        for aid in artist_ids:
            if aid not in resolved_ids:
                resolved_items.append({
                    "artist_spotify_id": aid,
                    "genres": []
                })
                
        submit_genre_cache_with_retries(backend_url, worker_token, resolved_items)
        stats["resolved"] = len(resolved_ids)
    except Exception as e:
        stats["failures"] += 1
    return stats
'''

content += backfill_function + '\n'

with open('worker/spotify_ingestion.py', 'w') as f:
    f.write(content)
