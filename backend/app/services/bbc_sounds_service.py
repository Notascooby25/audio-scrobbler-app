import re
import requests

def _normalize_spotify_uri(uri: str | None) -> str | None:
    if not uri:
        return None
    if uri.startswith("spotify:track:"):
        return uri
    match = re.search(r"track/([a-zA-Z0-9]+)", uri)
    if match:
        return f"spotify:track:{match.group(1)}"
    return None

def fetch_bbc_playlist(play_id: str) -> dict:
    url = f"https://rms.api.bbc.co.uk/v2/experience/inline/play/{play_id}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    
    # Locate tracklist segment
    tracks = []
    spotify_uris = []
    title = f"BBC Sounds: {play_id}"
    
    for module in data.get('data', []):
        module_title = module.get('title')
        
        if module_title == 'Tracklist':
            for track in module.get('data', []):
                if track.get('type') == 'segment_item':
                    raw_spotify_uri = None
                    for uri in track.get('uris', []):
                        if uri.get('id') == 'commercial-music-service-spotify':
                            raw_spotify_uri = uri.get('uri')
                    
                    spotify_uri = _normalize_spotify_uri(raw_spotify_uri)
                    if spotify_uri:
                        spotify_uris.append(spotify_uri)

                    offset = track.get('offset') or {}
                    start = offset.get('start', 0) or 0
                    end = offset.get('end')
                    duration = (end - start) if (end is not None and end > start) else None
                    
                    titles = track.get('titles') or {}
                    artist = titles.get('primary') or 'Unknown Artist'
                    track_title = titles.get('secondary') or 'Unknown Track'

                    tracks.append({
                        "segment_id": track.get('id') or f"seg_{len(tracks)}",
                        "artist": artist,
                        "title": track_title,
                        "offset_seconds": start,
                        "duration_seconds": duration,
                        "spotify_uri": spotify_uri,
                        "image_url": track.get('image_url')
                    })
        
        elif module_title == 'Player':
            for item in module.get('data', []):
                if item.get('type') == 'playable_item' and item.get('titles', {}).get('primary'):
                    title = f"{item['titles']['primary']} - {item['titles'].get('secondary', '')}".strip(" -")

    return {
        "title": title,
        "tracks": tracks,
        "spotify_uris": spotify_uris
    }
