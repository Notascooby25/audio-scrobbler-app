from __future__ import annotations

import re
import requests
from sqlalchemy.orm import Session
from ..models import User
from .spotify_library_service import _refresh_access_token, _request

SPOTIFY_API_BASE = "https://api.spotify.com/v1"

def _normalize_spotify_uri(uri: str) -> str | None:
    if uri.startswith("spotify:track:"):
        return uri
    # Match open.spotify.com/track/<id>
    match = re.search(r"track/([a-zA-Z0-9]+)", uri)
    if match:
        return f"spotify:track:{match.group(1)}"
    return None

def create_playlist(db: Session, user: User, title: str, description: str, track_uris: list[str]) -> str:
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    
    # 1. Create playlist using the modern /me/playlists endpoint
    create_url = f"{SPOTIFY_API_BASE}/me/playlists"
    create_resp = _request(
        "POST", 
        create_url, 
        headers=headers,
        json={
            "name": title,
            "description": description,
            "public": False
        }
    )
    create_resp.raise_for_status()
    playlist_id = create_resp.json()["id"]
    playlist_url = create_resp.json()["external_urls"]["spotify"]
    
    # 2. Normalize track URIs to spotify:track:<id>
    valid_uris = []
    for uri in track_uris:
        norm = _normalize_spotify_uri(uri)
        if norm:
            valid_uris.append(norm)

    # 3. Add tracks in batches of 100 using the modern /items endpoint
    add_url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/items"
    for i in range(0, len(valid_uris), 100):
        batch = valid_uris[i:i+100]
        add_resp = _request(
            "POST",
            add_url,
            headers=headers,
            json={"uris": batch}
        )
        add_resp.raise_for_status()
        
    return playlist_url
