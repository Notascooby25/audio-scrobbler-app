import urllib.parse
import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def itunes(artist, title):
    query = urllib.parse.quote(f"{artist} {title}")
    url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            if results:
                return results[0].get("artistName"), results[0].get("artworkUrl100")
    except Exception as exc:
        print(exc)
    return None, None

def deezer_search(artist, title):
    query = urllib.parse.quote(f"artist:\"{artist}\" track:\"{title}\"")
    url = f"https://api.deezer.com/search?q={query}&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read())
            if data.get("data"):
                return data["data"][0].get("artist", {}).get("name"), data["data"][0].get("album", {}).get("cover_big")
    except Exception as e:
        print(e)
    return None, None
    
tracks = ["Dreams", "You Again", "Three Wishes"]
for t in tracks:
    print(t, "iTunes:", itunes("The Lottery Winners", t))
    print(t, "Deezer:", deezer_search("The Lottery Winners", t))
