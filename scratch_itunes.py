import urllib.request
import urllib.parse
import json

def search_itunes(artist, track):
    query = urllib.parse.quote(f"{artist} {track}")
    url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=1"
    
    req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            if results:
                art = results[0].get("artworkUrl100")
                if art:
                    return art.replace("100x100bb", "600x600bb")
    except Exception as e:
        print(f"Error: {e}")
    return None

print(search_itunes("Daft Punk", "Get Lucky"))
