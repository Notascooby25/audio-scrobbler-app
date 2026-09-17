"""Add per-user scrobble settings and liked-songs sync bookkeeping."""

from alembic import op
import sqlalchemy as sa


revision = "0012_add_user_scrobble_settings"
down_revision = "5f9e2b1b3a3c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_scrobble_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("strip_remaster_tags", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("poll_interval_minutes", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("liked_tracks_sync_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("liked_tracks_backfill_offset", sa.Integer(), nullable=True),
        sa.Column("liked_tracks_watermark", sa.DateTime(), nullable=True),
        sa.Column("liked_tracks_catch_up_floor", sa.DateTime(), nullable=True),
        sa.Column("liked_tracks_last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_scrobble_settings_user_id"),
    )
    op.create_index("ix_user_scrobble_settings_user_id", "user_scrobble_settings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_scrobble_settings_user_id", table_name="user_scrobble_settings")
    op.drop_table("user_scrobble_settings")
