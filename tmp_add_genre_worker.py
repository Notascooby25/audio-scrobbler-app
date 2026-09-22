import re
with open('worker/app.py', 'r') as f:
    content = f.read()

import_block = '''import os
genre_cache_interval_minutes = int(os.environ.get("WORKER_GENRE_CACHE_INTERVAL_MINUTES", "5"))
genre_cache_batch_size = int(os.environ.get("WORKER_GENRE_CACHE_BATCH_SIZE", "50"))
'''
content = content.replace('import os', import_block, 1)

state_block = '''
last_genre_cache_sync_at = "never"
last_genre_cache_sync_processed = 0
last_genre_cache_sync_resolved = 0
last_genre_cache_sync_failures = 0
'''
content = content.replace('last_file_import_failed = 0', 'last_file_import_failed = 0\n' + state_block)

func_block = '''
def run_genre_cache_backfill() -> None:
    global last_genre_cache_sync_at, last_genre_cache_sync_processed, last_genre_cache_sync_resolved, last_genre_cache_sync_failures
    if not spotify_enabled or not spotify_client_id or not spotify_client_secret:
        return
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        return
    client = SpotifyClient(spotify_client_id, spotify_client_secret, refresh_token_key)
    try:
        from spotify_ingestion import backfill_artist_genres
        result = backfill_artist_genres(client, backend_url, worker_token, max_items=genre_cache_batch_size)
        last_genre_cache_sync_processed = result["processed"]
        last_genre_cache_sync_resolved = result["resolved"]
        last_genre_cache_sync_failures = result["failures"]
        last_genre_cache_sync_at = datetime.now(timezone.utc).isoformat()
        if result["processed"] > 0:
            logger.info("Genre cache backfill: %s processed, %s resolved, %s failures", result["processed"], result["resolved"], result["failures"])
    except Exception:
        logger.exception("Genre cache backfill failed")
'''

content = content.replace('def run_file_import', func_block + '\ndef run_file_import')

sched_block = '''
    if spotify_enabled:
        scheduler.add_job(
            run_genre_cache_backfill,
            "interval",
            minutes=genre_cache_interval_minutes,
            id="genre_cache_backfill",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc),
        )
'''
content = content.replace('scheduler.start()', sched_block + '\n    scheduler.start()')

health_add = '''
        "last_genre_cache_sync_at": last_genre_cache_sync_at,
        "last_genre_cache_sync_processed": str(last_genre_cache_sync_processed),
        "last_genre_cache_sync_resolved": str(last_genre_cache_sync_resolved),
        "last_genre_cache_sync_failures": str(last_genre_cache_sync_failures),
'''
content = content.replace('"last_file_import_failed": str(last_file_import_failed),', '"last_file_import_failed": str(last_file_import_failed),\n' + health_add)

metric_add = '''        "# HELP audio_scrobbler_worker_genre_cache_processed Total genre cache items processed.",
        "# TYPE audio_scrobbler_worker_genre_cache_processed gauge",
        f"audio_scrobbler_worker_genre_cache_processed {last_genre_cache_sync_processed}",
        "# HELP audio_scrobbler_worker_genre_cache_resolved Total genre cache items resolved.",
        "# TYPE audio_scrobbler_worker_genre_cache_resolved gauge",
        f"audio_scrobbler_worker_genre_cache_resolved {last_genre_cache_sync_resolved}",
'''
content = content.replace('        "# HELP audio_scrobbler_worker_file_import_failed', metric_add + '        "# HELP audio_scrobbler_worker_file_import_failed')

with open('worker/app.py', 'w') as f:
    f.write(content)
