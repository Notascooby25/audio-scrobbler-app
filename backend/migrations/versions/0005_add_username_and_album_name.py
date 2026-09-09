"""Add username to users and album_name to listening_events."""

import re

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0005_add_username_and_album_name"
down_revision = "0004_add_canonical_import_identity"
branch_labels = None
depends_on = None


def _slugify(value: str | None) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return slug or "user"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    users_columns = {column["name"] for column in inspector.get_columns("users")}
    if "username" not in users_columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(sa.Column("username", sa.String(length=64), nullable=True))

        users_table = sa.table(
            "users",
            sa.column("id", sa.Integer),
            sa.column("spotify_user_id", sa.String),
            sa.column("username", sa.String),
        )
        rows = bind.execute(sa.select(users_table.c.id, users_table.c.spotify_user_id)).fetchall()
        used: set[str] = set()
        for row in rows:
            slug = _slugify(row.spotify_user_id)
            candidate = slug
            suffix = 2
            while candidate in used:
                candidate = f"{slug}-{suffix}"
                suffix += 1
            used.add(candidate)
            bind.execute(users_table.update().where(users_table.c.id == row.id).values(username=candidate))

        with op.batch_alter_table("users") as batch_op:
            batch_op.alter_column("username", existing_type=sa.String(length=64), nullable=False)
        op.create_index("ix_users_username", "users", ["username"], unique=True)

    listening_columns = {column["name"] for column in inspector.get_columns("listening_events")}
    if "album_name" not in listening_columns:
        with op.batch_alter_table("listening_events") as batch_op:
            batch_op.add_column(sa.Column("album_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.drop_column("album_name")
    op.drop_index("ix_users_username", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("username")
