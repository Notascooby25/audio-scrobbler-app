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
    brand_info = None
    
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
                if item.get('type') == 'playable_item':
                    if item.get('titles', {}).get('primary'):
                        title = f"{item['titles']['primary']} - {item['titles'].get('secondary', '')}".strip(" -")
                    container = item.get('container')
                    if container and container.get('id'):
                        img = item.get('image_url') or ''
                        if '{recipe}' in img:
                            img = img.replace('{recipe}', '320x320')
                        brand_info = {
                            "brand_id": container.get('id'),
                            "title": container.get('title') or item.get('titles', {}).get('primary'),
                            "synopsis": container.get('synopses', {}).get('short') or item.get('synopses', {}).get('short'),
                            "image_url": img or None,
                        }

    return {
        "title": title,
        "tracks": tracks,
        "spotify_uris": spotify_uris,
        "brand_info": brand_info,
    }


def search_bbc_shows(query: str) -> list[dict]:
    url = f"https://rms.api.bbc.co.uk/v2/experience/inline/search?q={requests.utils.quote(query)}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    results = []
    seen = set()

    for module in resp.json().get('data', []):
        for item in module.get('data', []):
            if item.get('type') == 'container_item':
                brand_id = item.get('id')
                if not brand_id or brand_id in seen:
                    continue
                seen.add(brand_id)
                img = item.get('image_url') or ''
                if '{recipe}' in img:
                    img = img.replace('{recipe}', '320x320')
                results.append({
                    "brand_id": brand_id,
                    "title": item.get('titles', {}).get('primary') or brand_id,
                    "synopsis": item.get('synopses', {}).get('short'),
                    "image_url": img or None,
                })
    return results


def fetch_brand_episodes(brand_id: str, limit: int = 30) -> list[dict]:
    url = f"https://rms.api.bbc.co.uk/v2/programmes/playable?container={brand_id}&sort=sequential&type=episode&experience=domestic&limit={limit}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    episodes = []

    for item in resp.json().get('data', []):
        urn = item.get('urn', '')
        play_id = urn.split(':')[-1] if urn.startswith('urn:bbc:radio:episode:') else item.get('id')
        titles = item.get('titles', {})
        primary = titles.get('primary') or ''
        secondary = titles.get('secondary') or ''
        full_title = f"{primary}: {secondary}" if (primary and secondary) else (secondary or primary)
        img = item.get('image_url') or ''
        if '{recipe}' in img:
            img = img.replace('{recipe}', '320x320')

        episodes.append({
            "play_id": play_id,
            "title": full_title,
            "synopsis": item.get('synopses', {}).get('short'),
            "release_date": item.get('release', {}).get('label'),
            "availability": item.get('availability', {}).get('label'),
            "duration": item.get('duration', {}).get('label'),
            "image_url": img or None,
            "url": f"https://www.bbc.co.uk/sounds/play/{play_id}",
        })
    return episodes


def resolve_brand_info(input_str: str) -> dict:
    input_str = input_str.strip()

    # Check for episode play ID: /play/<id>
    play_match = re.search(r'/play/([a-zA-Z0-9]+)', input_str)
    if play_match:
        play_id = play_match.group(1)
        resp = requests.get(f"https://rms.api.bbc.co.uk/v2/experience/inline/play/{play_id}", timeout=10)
        resp.raise_for_status()
        for mod in resp.json().get('data', []):
            if mod.get('title') == 'Player':
                for p in mod.get('data', []):
                    container = p.get('container')
                    if container and container.get('id'):
                        img = p.get('image_url') or ''
                        if '{recipe}' in img:
                            img = img.replace('{recipe}', '320x320')
                        return {
                            "brand_id": container.get('id'),
                            "title": container.get('title') or p.get('titles', {}).get('primary'),
                            "synopsis": container.get('synopses', {}).get('short') or p.get('synopses', {}).get('short'),
                            "image_url": img or None,
                        }
        raise ValueError("Could not find show/brand details for this episode")

    # Check for brand / series / programmes in URL or bare ID
    brand_match = re.search(r'/(?:brand|series|programmes)/([a-zA-Z0-9]+)', input_str)
    brand_id = brand_match.group(1) if brand_match else input_str

    # 1. Try programmes JSON
    try:
        resp = requests.get(f"https://www.bbc.co.uk/programmes/{brand_id}.json", timeout=10)
        if resp.status_code == 200:
            prog = resp.json().get('programme', {})
            img = prog.get('image', {}).get('pid')
            img_url = f"https://ichef.bbci.co.uk/images/ic/320x320/{img}.jpg" if img else None
            return {
                "brand_id": brand_id,
                "title": prog.get('title') or brand_id,
                "synopsis": prog.get('short_synopsis'),
                "image_url": img_url,
            }
    except Exception:
        pass

    # 2. Try playable container endpoint
    try:
        resp = requests.get(f"https://rms.api.bbc.co.uk/v2/programmes/playable?container={brand_id}&limit=1", timeout=10)
        if resp.status_code == 200 and resp.json().get('data'):
            first = resp.json()['data'][0]
            titles = first.get('titles', {})
            img = first.get('image_url') or ''
            if '{recipe}' in img:
                img = img.replace('{recipe}', '320x320')
            return {
                "brand_id": brand_id,
                "title": titles.get('primary') or brand_id,
                "synopsis": first.get('synopses', {}).get('short'),
                "image_url": img or None,
            }
    except Exception:
        pass

    raise ValueError(f"Could not resolve BBC show or series from: {input_str}")
