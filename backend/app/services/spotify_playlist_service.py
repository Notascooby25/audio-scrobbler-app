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

def _extract_playlist_id(url_or_id: str) -> str:
    cleaned = url_or_id.strip()
    if cleaned.startswith("spotify:playlist:"):
        return cleaned.split(":")[-1]
    match = re.search(r"playlist/([a-zA-Z0-9]+)", cleaned)
    if match:
        return match.group(1)
    clean_id = cleaned.split("?")[0].split("/")[0]
    return clean_id

def get_playlist_info(access_token: str, playlist_id: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}?fields=id,name,external_urls"
    resp = _request("GET", url, headers=headers)
    if resp.ok:
        return resp.json()
    return {
        "id": playlist_id,
        "name": "Spotify Playlist",
        "external_urls": {"spotify": f"https://open.spotify.com/playlist/{playlist_id}"},
    }

def get_user_playlists(db: Session, user: User) -> dict:
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{SPOTIFY_API_BASE}/me/playlists?limit=50"
    resp = _request("GET", url, headers=headers)
    if resp.status_code == 403:
        return {"playlists": [], "needs_scope": True}
    resp.raise_for_status()
    data = resp.json()
    playlists = [
        {
            "id": item["id"],
            "name": item.get("name", "Untitled Playlist"),
            "url": item.get("external_urls", {}).get("spotify", f"https://open.spotify.com/playlist/{item['id']}"),
        }
        for item in data.get("items", [])
        if item and "id" in item
    ]
    return {"playlists": playlists, "needs_scope": False}

def add_tracks_to_playlist(db: Session, user: User, playlist_id: str, track_uris: list[str]) -> tuple[str, str, int]:
    clean_id = _extract_playlist_id(playlist_id)
    access_token = _refresh_access_token(db, user)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # 1. Normalize track URIs to spotify:track:<id>
    valid_uris = []
    for uri in track_uris:
        norm = _normalize_spotify_uri(uri)
        if norm:
            valid_uris.append(norm)

    # 2. Add tracks in batches of 100 using the modern /items endpoint
    add_url = f"{SPOTIFY_API_BASE}/playlists/{clean_id}/items"
    for i in range(0, len(valid_uris), 100):
        batch = valid_uris[i:i+100]
        add_resp = _request(
            "POST",
            add_url,
            headers=headers,
            json={"uris": batch}
        )
        add_resp.raise_for_status()

    info = get_playlist_info(access_token, clean_id)
    playlist_name = info.get("name", "Spotify Playlist")
    playlist_url = info.get("external_urls", {}).get("spotify", f"https://open.spotify.com/playlist/{clean_id}")
    return playlist_name, playlist_url, len(valid_uris)

def create_playlist(db: Session, user: User, title: str, description: str, track_uris: list[str]) -> tuple[str, str, int]:
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

    # 2. Add tracks to the newly created playlist
    return add_tracks_to_playlist(db, user, playlist_id, track_uris)
