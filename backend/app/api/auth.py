from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas.auth import AccessTokenResponse, DevTokenRequest
from ..services.auth_service import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/dev-token", response_model=AccessTokenResponse)
def create_dev_token(request: DevTokenRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    if settings.environment.lower() != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    user = db.query(User).filter(User.id == request.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")
    return AccessTokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_ttl_seconds,
    )