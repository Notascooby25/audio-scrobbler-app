"""add_setlist_tracking

Revision ID: 0020_add_setlist_tracking
Revises: 0019_add_followed_youtube_channels
Create Date: 2026-10-28 22:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0020_add_setlist_tracking"
down_revision: Union[str, None] = "0019_add_followed_youtube_channels"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. attended_concerts
    op.create_table(
        "attended_concerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("setlist_id", sa.String(length=64), nullable=False),
        sa.Column("artist_name", sa.String(length=255), nullable=False),
        sa.Column("artist_mbid", sa.String(length=64), nullable=True),
        sa.Column("venue_name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("country", sa.String(length=128), nullable=False),
        sa.Column("event_date", sa.DateTime(), nullable=False),
        sa.Column("tour_name", sa.String(length=255), nullable=True),
        sa.Column("setlist_url", sa.Text(), nullable=True),
        sa.Column("is_support_act", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("parent_setlist_id", sa.String(length=64), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("song_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "setlist_id", name="uq_user_attended_setlist"),
    )
    op.create_index(op.f("ix_attended_concerts_id"), "attended_concerts", ["id"], unique=False)
    op.create_index(op.f("ix_attended_concerts_user_id"), "attended_concerts", ["user_id"], unique=False)
    op.create_index(op.f("ix_attended_concerts_setlist_id"), "attended_concerts", ["setlist_id"], unique=False)
    op.create_index(op.f("ix_attended_concerts_artist_name"), "attended_concerts", ["artist_name"], unique=False)
    op.create_index(op.f("ix_attended_concerts_venue_name"), "attended_concerts", ["venue_name"], unique=False)
    op.create_index(op.f("ix_attended_concerts_event_date"), "attended_concerts", ["event_date"], unique=False)

    # 2. setlist_cache
    op.create_table(
        "setlist_cache",
        sa.Column("cache_key", sa.String(length=255), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("cache_key"),
    )
    op.create_index(op.f("ix_setlist_cache_expires_at"), "setlist_cache", ["expires_at"], unique=False)

    # 3. setlist_api_usage
    op.create_table(
        "setlist_api_usage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("last_call_at", sa.DateTime(), nullable=False),
        sa.Column("daily_date", sa.String(length=10), nullable=False),
        sa.Column("daily_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("setlist_api_usage")
    op.drop_index(op.f("ix_setlist_cache_expires_at"), table_name="setlist_cache")
    op.drop_table("setlist_cache")
    op.drop_index(op.f("ix_attended_concerts_event_date"), table_name="attended_concerts")
    op.drop_index(op.f("ix_attended_concerts_venue_name"), table_name="attended_concerts")
    op.drop_index(op.f("ix_attended_concerts_artist_name"), table_name="attended_concerts")
    op.drop_index(op.f("ix_attended_concerts_setlist_id"), table_name="attended_concerts")
    op.drop_index(op.f("ix_attended_concerts_user_id"), table_name="attended_concerts")
    op.drop_index(op.f("ix_attended_concerts_id"), table_name="attended_concerts")
    op.drop_table("attended_concerts")
