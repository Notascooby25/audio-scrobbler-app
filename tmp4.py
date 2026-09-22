import re

with open('worker/spotify_ingestion.py', 'r') as f:
    content = f.read()

content = re.sub(r'def fetch_pending_playlist_uris\(.*?(?=\n\n\ndef )', '', content, flags=re.DOTALL)
content = re.sub(r'def submit_playlist_cache_with_retries\(.*?(?=\n\n\ndef )', '', content, flags=re.DOTALL)
content = re.sub(r'    def playlist\(self, access_token: str, playlist_id: str\) -> dict\[str, object\]:.*?(?=\n\n    def )', '', content, flags=re.DOTALL)
content = re.sub(r'\n*def backfill_playlist_names\(.*?return stats\n', '', content, flags=re.DOTALL)

with open('worker/spotify_ingestion.py', 'w') as f:
    f.write(content)
