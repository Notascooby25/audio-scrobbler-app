"""Add per-user display preferences."""

from alembic import op
import sqlalchemy as sa


revision = "0009_add_user_preferences"
down_revision = "0008_add_artist_artwork"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("default_date_range", sa.String(length=32), nullable=False, server_default="last.week"),
        sa.Column("default_page_size", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("default_library_view", sa.String(length=16), nullable=False, server_default="list"),
        sa.Column("scrobbles_view", sa.String(length=16), nullable=True),
        sa.Column("artists_view", sa.String(length=16), nullable=True),
        sa.Column("albums_view", sa.String(length=16), nullable=True),
        sa.Column("tracks_view", sa.String(length=16), nullable=True),
        sa.Column("liked_tracks_view", sa.String(length=16), nullable=True),
        sa.Column("show_artwork", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("show_source_badges", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("timestamp_mode", sa.String(length=16), nullable=False, server_default="relative"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
        sa.CheckConstraint("default_page_size IN (10, 25, 50, 100)", name="ck_user_preferences_page_size"),
        sa.CheckConstraint("default_library_view IN ('list', 'grid')", name="ck_user_preferences_library_view"),
    )
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_table("user_preferences")