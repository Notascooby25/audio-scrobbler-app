"""Add artwork cache table.

Revision ID: 0011_add_artwork_cache
Revises: 0010_add_blocked_items
Create Date: 2026-09-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_add_artwork_cache"
down_revision = "0010_add_blocked_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "artwork_cache",
        sa.Column("track_id", sa.String(length=255), primary_key=True, nullable=False),
        sa.Column("artwork_url", sa.Text(), nullable=False),
        sa.Column("cached_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("track_id"),
    )
    op.create_index("ix_artwork_cache_track_id", "artwork_cache", ["track_id"])


def downgrade() -> None:
    op.drop_index("ix_artwork_cache_track_id", table_name="artwork_cache")
    op.drop_table("artwork_cache")

