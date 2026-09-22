import re

with open('worker/spotify_ingestion.py', 'r') as f:
    content = f.read()

# remove fetch_pending_playlist_uris
content = re.sub(r'def fetch_pending_playlist_uris.*?def ', 'def ', content, flags=re.DOTALL)
# remove submit_playlist_cache_with_retries
content = re.sub(r'def submit_playlist_cache_with_retries.*?\nclass ', 'class ', content, flags=re.DOTALL)
# remove SpotifyClient.playlist
content = re.sub(r'    def playlist\(self, access_token: str, playlist_id: str\) -> dict\[str, object\]:.*?return self\._request\("GET", url, headers=headers\)\.json\(\)\n', '', content, flags=re.DOTALL)
# remove backfill_playlist_names
content = re.sub(r'\ndef backfill_playlist_names\(.*?return stats\n', '', content, flags=re.DOTALL)

with open('worker/spotify_ingestion.py', 'w') as f:
    f.write(content)
