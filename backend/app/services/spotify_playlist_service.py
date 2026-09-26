from __future__ import annotations

import requests
from sqlalchemy.orm import Session
from ..models import User
from .spotify_library_service import _refresh_access_token, _request

SPOTIFY_API_BASE = "https://api.spotify.com/v1"

def create_playlist(db: Session, user: User, title: str, description: str, track_uris: list[str]) -> str:
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    
    # 1. Get user profile to get spotify user id
    me_resp = _request("GET", f"{SPOTIFY_API_BASE}/me", headers=headers)
    me_resp.raise_for_status()
    spotify_user_id = me_resp.json()["id"]
    
    # 2. Create playlist
    create_url = f"{SPOTIFY_API_BASE}/users/{spotify_user_id}/playlists"
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
    
    # 3. Add tracks in batches of 100
    add_url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks"
    for i in range(0, len(track_uris), 100):
        batch = track_uris[i:i+100]
        add_resp = _request(
            "POST",
            add_url,
            headers=headers,
            json={"uris": batch}
        )
        add_resp.raise_for_status()
        
    return playlist_url
