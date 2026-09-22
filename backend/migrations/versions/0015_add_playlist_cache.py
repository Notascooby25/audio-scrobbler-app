"""Add playlist cache table for the Reports playlists view.

Revision ID: 0015_add_playlist_cache
Revises: 0014_add_realtime_scrobbling
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_add_playlist_cache"
down_revision = "0014_add_realtime_scrobbling"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "playlist_cache",
        sa.Column("playlist_uri", sa.String(length=255), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cached_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("playlist_uri"),
    )
    op.create_index("ix_playlist_cache_playlist_uri", "playlist_cache", ["playlist_uri"])


def downgrade() -> None:
    op.drop_index("ix_playlist_cache_playlist_uri", table_name="playlist_cache")
    op.drop_table("playlist_cache")
