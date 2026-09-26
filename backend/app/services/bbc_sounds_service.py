import requests

def fetch_bbc_playlist(play_id: str) -> dict:
    url = f"https://rms.api.bbc.co.uk/v2/experience/inline/play/{play_id}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    
    # Locate tracklist segment
    tracklist = []
    title = f"BBC Sounds: {play_id}"
    
    for section in data.get('data', []):
        for module in section.get('data', []):
            if module.get('title') == 'Tracklist':
                for track in module.get('data', []):
                    if track.get('type') == 'segment_item':
                        spotify_uri = None
                        for uri in track.get('uris', []):
                            if uri.get('id') == 'commercial-music-service-spotify':
                                spotify_uri = uri.get('uri')
                        if spotify_uri:
                            tracklist.append(spotify_uri)
            elif module.get('title') == 'Player':
                for md in module.get('data', []):
                    if md.get('type') == 'playable_item' and md.get('titles', {}).get('primary'):
                        title = f"{md['titles']['primary']} - {md['titles'].get('secondary', '')}".strip(" -")

    return {
        "title": title,
        "spotify_uris": tracklist
    }
