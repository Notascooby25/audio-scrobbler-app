import re

with open('worker/app.py', 'r') as f:
    content = f.read()

content = re.sub(r'playlist_cache_interval_minutes = int\(os\.getenv\("WORKER_PLAYLIST_CACHE_INTERVAL_MINUTES", "15"\)\)\n', '', content)
content = re.sub(r'playlist_cache_batch_size = int\(os\.getenv\("WORKER_PLAYLIST_CACHE_BATCH_SIZE", "10"\)\)\n', '', content)
content = re.sub(r'last_playlist_cache_sync_at: str \| None = None\nlast_playlist_cache_sync_processed = 0\nlast_playlist_cache_sync_resolved = 0\nlast_playlist_cache_sync_failures = 0\n', '', content)

content = re.sub(r'\s*"last_playlist_cache_sync_at": last_playlist_cache_sync_at or "never",.*?"last_playlist_cache_sync_failures": str\(last_playlist_cache_sync_failures\),', '', content, flags=re.DOTALL)
content = re.sub(r'\s*# HELP audio_scrobbler_worker_playlist_cache_processed.*?f"audio_scrobbler_worker_playlist_cache_failures \{last_playlist_cache_sync_failures\}",', '', content, flags=re.DOTALL)

with open('worker/app.py', 'w') as f:
    f.write(content)

