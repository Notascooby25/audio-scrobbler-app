"""add_saved_albums_and_jukebox_settings

Revision ID: 0028_add_saved_albums
Revises: 0027_add_accent_color
Create Date: 2026-10-30 22:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0028_add_saved_albums"
down_revision: Union[str, None] = "0027_add_accent_color"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create saved_albums table
    op.create_table(
        "saved_albums",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("spotify_album_id", sa.String(length=255), nullable=False),
        sa.Column("album_name", sa.String(length=255), nullable=False),
        sa.Column("artist_name", sa.String(length=255), nullable=False),
        sa.Column("release_date", sa.String(length=32), nullable=True),
        sa.Column("release_year", sa.Integer(), nullable=True),
        sa.Column("genres", sa.JSON(), nullable=True),
        sa.Column("duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("artwork_url", sa.Text(), nullable=True),
        sa.Column("spotify_url", sa.Text(), nullable=True),
        sa.Column("added_at", sa.DateTime(), nullable=False),
        sa.Column("last_picked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "spotify_album_id", name="uq_saved_album_user_spotify_id"),
    )
    op.create_index("ix_saved_albums_id", "saved_albums", ["id"])
    op.create_index("ix_saved_albums_user_id", "saved_albums", ["user_id"])
    op.create_index("ix_saved_albums_spotify_album_id", "saved_albums", ["spotify_album_id"])

    # 2. Add columns to user_scrobble_settings
    with op.batch_alter_table("user_scrobble_settings") as batch_op:
        batch_op.add_column(sa.Column("saved_albums_sync_enabled", sa.Boolean(), server_default=sa.true(), nullable=False))
        batch_op.add_column(sa.Column("saved_albums_backfill_offset", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("saved_albums_last_synced_at", sa.DateTime(), nullable=True))

    # 3. Add jukebox_source to user_preferences
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.add_column(
            sa.Column("jukebox_source", sa.String(length=32), server_default="spotify_saved", nullable=False)
        )
        batch_op.create_check_constraint(
            "ck_user_preferences_jukebox_source",
            "jukebox_source IN ('spotify_saved', 'library_archive')",
        )


def downgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.drop_constraint("ck_user_preferences_jukebox_source", type_="check")
        batch_op.drop_column("jukebox_source")

    with op.batch_alter_table("user_scrobble_settings") as batch_op:
        batch_op.drop_column("saved_albums_last_synced_at")
        batch_op.drop_column("saved_albums_backfill_offset")
        batch_op.drop_column("saved_albums_sync_enabled")

    op.drop_index("ix_saved_albums_spotify_album_id", table_name="saved_albums")
    op.drop_index("ix_saved_albums_user_id", table_name="saved_albums")
    op.drop_index("ix_saved_albums_id", table_name="saved_albums")
    op.drop_table("saved_albums")
