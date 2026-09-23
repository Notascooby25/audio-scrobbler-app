import urllib.parse
import urllib.request
import json

def itunes_artwork(artist: str, title: str) -> str:
    query = urllib.parse.quote(f"{artist} {title}")
    url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read())
            if data.get("results"):
                res = data["results"][0]
                art = res.get("artworkUrl100")
                if art:
                    return art.replace("100x100bb", "500x500bb")
    except Exception as e:
        print(e)
    return None

def deezer_search(artist, title):
    query = urllib.parse.quote(f"artist:\"{artist}\" track:\"{title}\"")
    url = f"https://api.deezer.com/search?q={query}&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read())
            if data.get("data"):
                return data["data"][0]
    except Exception as e:
        print(e)
    return None

dz = deezer_search("Oasis", "I'm Outta Time")
if dz:
    artist = dz.get("artist", {})
    art = artist.get("picture_big") or artist.get("picture_medium")
    print("Deezer:", art)
else:
    print("Deezer: None")

it_art = itunes_artwork("Oasis", "I'm Outta Time")
print("iTunes:", it_art)

