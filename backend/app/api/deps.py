from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..services import social_service
from ..services.auth_service import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = decode_access_token(credentials.credentials)
    except (ValueError, jwt.InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def resolve_viewable_user_id(db: Session, current_user: User, user_id: int | None) -> int:
    """The user whose data to show: the caller, or someone they follow (404/403 otherwise)."""
    if user_id is None:
        return current_user.id
    target = social_service.get_active_user(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not social_service.can_view_details(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="This data is only visible to the owner or their followers")
    return user_id
