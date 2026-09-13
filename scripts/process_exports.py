import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

# ─── Helpers ───────────────────────────────────────────────────────────────────

def clean_title(title: str) -> str:
    """Strips extra metadata like (Remastered) or [Live] for better API matching."""
    cleaned = re.sub(
        r'[\(\[\{].*?(remaster|live|version|edit|deluxe|feat|ft\.).*?[\)\]\}]',
        '',
        title,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r'-\s*(remastered|live|radio edit|single version).*$',
        '',
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip() if cleaned.strip() else title


def is_artist_match(target_artist: str, returned_artist: str) -> bool:
    """Strictly checks if the returned artist name matches the target artist."""
    t_art = target_artist.lower().strip()
    r_art = returned_artist.lower().strip()
    
    if t_art == r_art:
        return True
        
    r_artists = re.split(r'[,&]| feat\. | ft\. ', r_art)
    r_artists = [a.strip() for a in r_artists]
    
    return t_art in r_artists


def fetch_and_validate(url: str, target_artist: str) -> dict | None:
    """Fetches search results with retry logic and validates the artist."""
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                url, headers={'User-Agent': 'music-parser-app/1.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())

            if 'error' in data and data['error'].get('code') == 4:
                time.sleep(5)
                continue

            for item in data.get('data', []):
                ret_artist = item.get('artist', {}).get('name', '')
                if is_artist_match(target_artist, ret_artist):
                    return item
            return None 

        except urllib.error.HTTPError as e:
            if e.code in (429, 403):
                time.sleep(5)
            else:
                break
        except Exception:
            time.sleep(2)
    return None


def deezer_search(artist: str, title: str) -> dict | None:
    """Searches Deezer's API using precise and loose fallback queries."""
    clean_t = clean_title(title)
    safe_artist = artist.replace('"', '')
    safe_title = clean_t.replace('"', '')

    # 1. Precise Advanced Search
    query = urllib.parse.quote(f'artist:"{safe_artist}" track:"{safe_title}"')
    url = f'https://api.deezer.com/search?q={query}'
    track = fetch_and_validate(url, artist)
    if track:
        return track

    # 2. Fallback Loose Search
    loose_query = urllib.parse.quote(f'{safe_artist} {safe_title}')
    url = f'https://api.deezer.com/search?q={loose_query}'
    return fetch_and_validate(url, artist)


def deezer_artwork(track: dict) -> str:
    """Extracts high-res album cover, or falls back to artist picture."""
    album = track.get('album', {})
    cover = album.get('cover_big') or album.get('cover_xl') or album.get('cover_medium')
    if cover:
        return cover
    
    artist = track.get('artist', {})
    return artist.get('picture_big') or artist.get('picture_medium') or ''


# ─── Processing Function ───────────────────────────────────────────────────────

def process_export_file(input_path: str, output_path: str, platform_type: str):
    print(f"\nProcessing [{platform_type}] file: {input_path}")
    
    if not os.path.exists(input_path):
        print(f"  -> File not found: {input_path}. Skipping.")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    songs = []
    skipped = 0
    cache = {}
    total = len(data)
    progress_file = f"progress_{platform_type}.json"

    if os.path.exists(progress_file):
        with open(progress_file, 'r', encoding='utf-8') as pf:
            state = json.load(pf)
            start_index = state.get('last_index', 0)
            songs = state.get('songs', [])
            skipped = state.get('skipped', 0)
            cache = state.get('cache', {})
        print(f"  -> Resuming from item {start_index} out of {total}...")
    else:
        start_index = 0

    try:
        for i in range(start_index, total):
            entry = data[i]
            artist = None
            raw_title = None
            release = None
            time_str = None

            # Parse based on detected platform structure
            if platform_type == 'youtube':
                if entry.get('header') != 'YouTube Music':
                    skipped += 1
                    continue
                subtitles = entry.get('subtitles', [])
                if not subtitles:
                    skipped += 1
                    continue
                channel = subtitles[0].get('name', '')
                if not channel.endswith('- Topic'):
                    skipped += 1
                    continue
                raw_title = entry.get('title', '').replace('Watched ', '', 1)
                artist = channel.replace(' - Topic', '')
                time_str = entry.get('time', '')

            elif platform_type == 'spotify':
                if 'master_metadata_track_name' not in entry or not entry.get('master_metadata_track_name'):
                    skipped += 1
                    continue
                if entry.get('episode_name') is not None:  # Skip podcasts
                    skipped += 1
                    continue
                raw_title = entry.get('master_metadata_track_name')
                artist = entry.get('master_metadata_album_artist_name')
                release = entry.get('master_metadata_album_album_name', '')
                time_str = entry.get('ts')

            if not raw_title or not artist:
                skipped += 1
                continue

            cache_key = f'{artist}|||{raw_title}'

            if cache_key in cache:
                cached_data = cache[cache_key]
                if cached_data is None:
                    skipped += 1
                else:
                    songs.append({
                        'artist': artist,
                        'song': raw_title,
                        'release': release or cached_data['release'],
                        'artwork': cached_data['artwork'],
                        'time': time_str,
                    })
                    art_status = '✓' if cached_data['artwork'] else '✗'
                    print(f'[{i+1}/{total}] [{platform_type}] (Cached) ♪ {artist} - {raw_title} [Art: {art_status}]')
                continue

            # Query Deezer API
            track = deezer_search(artist, raw_title)
            artwork = ''
            if track:
                artwork = deezer_artwork(track)
                if not release:
                    release = track.get('album', {}).get('title', '')
                time.sleep(0.2)
            else:
                time.sleep(0.2)

            cache[cache_key] = {'release': release, 'artwork': artwork}

            songs.append({
                'artist': artist,
                'song': raw_title,
                'release': release,
                'artwork': artwork,
                'time': time_str,
            })

            art_status = '✓' if artwork else '✗'
            album_str = f' ({release})' if release else ''
            print(f'[{i+1}/{total}] [{platform_type}] ♪ {artist} - {raw_title}{album_str} [Art: {art_status}]')

            # Save periodic progress every 25 items
            if (i + 1) % 25 == 0:
                with open(progress_file, 'w', encoding='utf-8') as pf:
                    json.dump({'last_index': i + 1, 'songs': songs, 'skipped': skipped, 'cache': cache}, pf)

    except KeyboardInterrupt:
        print("\nProcess interrupted! Saving progress...")
        with open(progress_file, 'w', encoding='utf-8') as pf:
            json.dump({'last_index': i, 'songs': songs, 'skipped': skipped, 'cache': cache}, pf)
        sys.exit(0)

    # Save final sheet
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(songs, f, indent=2, ensure_ascii=False)

    if os.path.exists(progress_file):
        os.remove(progress_file)

    print(f"  -> Finished! Kept {len(songs)} tracks, skipped {skipped}. Saved to {output_path}")


# ─── Summary Generator ─────────────────────────────────────────────────────────

def generate_summary_report():
    print("\nGenerating consolidated summary report...")
    all_songs = []
    yt_count = 0
    spotify_count = 0

    if os.path.exists('songs_youtube.json'):
        with open('songs_youtube.json', 'r', encoding='utf-8') as f:
            yt_data = json.load(f)
            yt_count = len(yt_data)
            all_songs.extend(yt_data)

    if os.path.exists('song_spotify.json'):
        with open('song_spotify.json', 'r', encoding='utf-8') as f:
            sp_data = json.load(f)
            spotify_count = len(sp_data)
            all_songs.extend(sp_data)

    total_plays = len(all_songs)
    if total_plays == 0:
        print("No processed tracks found to summarise.")
        return

    unique_songs = len(set((s['song'].lower().strip(), s['artist'].lower().strip()) for s in all_songs))
    unique_artists = len(set(s['artist'].lower().strip() for s in all_songs))
    unique_albums = len(set(s['release'].lower().strip() for s in all_songs if s.get('release')))
    
    missing_art = sum(1 for s in all_songs if not s.get('artwork') or s.get('artwork') == 'No Artwork')
    art_success_rate = ((total_plays - missing_art) / total_plays) * 100 if total_plays > 0 else 0

    # Extract timestamps to find date range
    timestamps = [s.get('time') for s in all_songs if s.get('time')]
    earliest = min(timestamps) if timestamps else 'N/A'
    latest = max(timestamps) if timestamps else 'N/A'

    report_text = f"""==================================================
        UNIFIED MUSIC EXPORT SUMMARY REPORT
==================================================
- Total Plays Processed      : {total_plays}
- YouTube Music Plays        : {yt_count}
- Spotify Plays              : {spotify_count}
- Total Unique Songs         : {unique_songs}
- Total Unique Artists       : {unique_artists}
- Total Unique Albums/Releases: {unique_albums}
- Missing Artwork Count      : {missing_art} ({art_success_rate:.1f}% success rate)
- Earliest Play Timestamp    : {earliest}
- Latest Play Timestamp      : {latest}
==================================================
"""

    summary_filename = 'listening_summary.txt'
    with open(summary_filename, 'w', encoding='utf-8') as sf:
        sf.write(report_text)

    print(f"Summary report successfully written to: {summary_filename}")


# ─── Main Execution ────────────────────────────────────────────────────────────

def run_all():
    input_dir = 'exported-files'
    
    if not os.path.exists(input_dir):
        print(f"Error: Directory '{input_dir}' does not exist. Please create it and add your files.")
        return

    for filename in os.listdir(input_dir):
        if filename.endswith('.json'):
            file_lower = filename.lower()
            full_path = os.path.join(input_dir, filename)
            
            if 'youtube' in file_lower or 'watch-history' in file_lower:
                process_export_file(full_path, 'songs_youtube.json', 'youtube')
            elif 'spotify' in file_lower or 'streaming_history' in file_lower or 'audio' in file_lower:
                process_export_file(full_path, 'song_spotify.json', 'spotify')
            else:
                print(f"Skipping unknown file format: {filename}")

    # Automatically generate the summary text file once files are processed
    generate_summary_report()
    print("\nAll export and summary tasks completed successfully.")


if __name__ == '__main__':
    run_all()
