from __future__ import annotations
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..services.bbc_sounds_service import fetch_bbc_playlist
from ..services.spotify_playlist_service import create_playlist
from ..services.spotify_oauth_service import SpotifyAccessDeniedError, SpotifyRateLimitedError

router = APIRouter(prefix="/tools", tags=["tools"])

class ScopeCreepRequest(BaseModel):
    url: str

class ScopeCreepResponse(BaseModel):
    message: str
    playlist_url: str

@router.post("/scope-creep", response_model=ScopeCreepResponse)
def scope_creep(
    req: ScopeCreepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Extract ID from URL (e.g. m0031tc6)
    match = re.search(r'/play/([a-zA-Z0-9]+)', req.url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid BBC Sounds URL. Make sure it contains /play/<id>")
    
    play_id = match.group(1)
    
    try:
        bbc_data = fetch_bbc_playlist(play_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch BBC Sounds data: {str(e)}")
        
    if not bbc_data["spotify_uris"]:
        raise HTTPException(status_code=400, detail="No Spotify tracks found for this BBC Sounds episode.")
        
    try:
        playlist_url = create_playlist(
            db, 
            current_user, 
            bbc_data["title"], 
            f"Generated from {req.url} via Audio Scrobbler App Scope Creep",
            bbc_data["spotify_uris"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create Spotify playlist: {str(e)}. Make sure you have re-authenticated to grant playlist-modify-private scope.")
        
    return ScopeCreepResponse(
        message=f"Created playlist '{bbc_data['title']}' with {len(bbc_data['spotify_uris'])} tracks.",
        playlist_url=playlist_url
    )
