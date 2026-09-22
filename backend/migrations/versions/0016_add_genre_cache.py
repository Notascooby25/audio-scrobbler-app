"""add genre cache

Revision ID: 0016_add_genre_cache
Revises: 0015_add_playlist_cache
Create Date: 2026-09-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0016_add_genre_cache'
down_revision: Union[str, None] = '0015_add_playlist_cache'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        default_expr = sa.text("'[]'::json")
    else:
        default_expr = sa.text("'[]'")

    op.create_table(
        "genre_cache",
        sa.Column("artist_spotify_id", sa.String(length=255), primary_key=True, nullable=False),
        sa.Column("genres", sa.JSON(), nullable=False, server_default=default_expr),
        sa.Column("cached_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_genre_cache_artist_spotify_id", "genre_cache", ["artist_spotify_id"])

def downgrade() -> None:
    op.drop_index("ix_genre_cache_artist_spotify_id", table_name="genre_cache")
    op.drop_table("genre_cache")
