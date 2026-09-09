from __future__ import annotations

import re

from sqlalchemy.orm import Session

from ..models import User


def slugify_username(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "user"


def generate_unique_username(db: Session, base: str) -> str:
    slug = slugify_username(base)
    candidate = slug
    suffix = 2
    while db.query(User).filter(User.username == candidate).first() is not None:
        candidate = f"{slug}-{suffix}"
        suffix += 1
    return candidate
