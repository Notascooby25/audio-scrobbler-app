"""add_category_page_sizes

Revision ID: 0030_add_category_page_sizes
Revises: 0029_add_jukebox_archive_limit
Create Date: 2026-10-31 21:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0030_add_category_page_sizes"
down_revision: Union[str, None] = "0029_add_jukebox_archive_limit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("user_preferences") as batch_op:
            batch_op.drop_constraint("ck_user_preferences_page_size", type_="check")
            batch_op.create_check_constraint(
                "ck_user_preferences_page_size",
                "default_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
            )
            batch_op.add_column(sa.Column("scrobbles_page_size", sa.Integer(), nullable=True))
            batch_op.create_check_constraint(
                "ck_user_preferences_scrobbles_page_size",
                "scrobbles_page_size IS NULL OR scrobbles_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
            )
            batch_op.add_column(sa.Column("artists_page_size", sa.Integer(), nullable=True))
            batch_op.create_check_constraint(
                "ck_user_preferences_artists_page_size",
                "artists_page_size IS NULL OR artists_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
            )
            batch_op.add_column(sa.Column("albums_page_size", sa.Integer(), nullable=True))
            batch_op.create_check_constraint(
                "ck_user_preferences_albums_page_size",
                "albums_page_size IS NULL OR albums_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
            )
            batch_op.add_column(sa.Column("tracks_page_size", sa.Integer(), nullable=True))
            batch_op.create_check_constraint(
                "ck_user_preferences_tracks_page_size",
                "tracks_page_size IS NULL OR tracks_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
            )
    else:
        op.drop_constraint("ck_user_preferences_page_size", "user_preferences", type_="check")
        op.create_check_constraint(
            "ck_user_preferences_page_size",
            "user_preferences",
            "default_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
        )
        op.add_column("user_preferences", sa.Column("scrobbles_page_size", sa.Integer(), nullable=True))
        op.create_check_constraint(
            "ck_user_preferences_scrobbles_page_size",
            "user_preferences",
            "scrobbles_page_size IS NULL OR scrobbles_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
        )
        op.add_column("user_preferences", sa.Column("artists_page_size", sa.Integer(), nullable=True))
        op.create_check_constraint(
            "ck_user_preferences_artists_page_size",
            "user_preferences",
            "artists_page_size IS NULL OR artists_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
        )
        op.add_column("user_preferences", sa.Column("albums_page_size", sa.Integer(), nullable=True))
        op.create_check_constraint(
            "ck_user_preferences_albums_page_size",
            "user_preferences",
            "albums_page_size IS NULL OR albums_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
        )
        op.add_column("user_preferences", sa.Column("tracks_page_size", sa.Integer(), nullable=True))
        op.create_check_constraint(
            "ck_user_preferences_tracks_page_size",
            "user_preferences",
            "tracks_page_size IS NULL OR tracks_page_size IN (5, 10, 20, 25, 50, 100, 150, 200, 250)",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("user_preferences") as batch_op:
            batch_op.drop_constraint("ck_user_preferences_tracks_page_size", type_="check")
            batch_op.drop_column("tracks_page_size")
            batch_op.drop_constraint("ck_user_preferences_albums_page_size", type_="check")
            batch_op.drop_column("albums_page_size")
            batch_op.drop_constraint("ck_user_preferences_artists_page_size", type_="check")
            batch_op.drop_column("artists_page_size")
            batch_op.drop_constraint("ck_user_preferences_scrobbles_page_size", type_="check")
            batch_op.drop_column("scrobbles_page_size")
            batch_op.drop_constraint("ck_user_preferences_page_size", type_="check")
            batch_op.create_check_constraint(
                "ck_user_preferences_page_size",
                "default_page_size IN (10, 25, 50, 100, 150, 200, 250)",
            )
    else:
        op.drop_constraint("ck_user_preferences_tracks_page_size", "user_preferences", type_="check")
        op.drop_column("user_preferences", "tracks_page_size")
        op.drop_constraint("ck_user_preferences_albums_page_size", "user_preferences", type_="check")
        op.drop_column("user_preferences", "albums_page_size")
        op.drop_constraint("ck_user_preferences_artists_page_size", "user_preferences", type_="check")
        op.drop_column("user_preferences", "artists_page_size")
        op.drop_constraint("ck_user_preferences_scrobbles_page_size", "user_preferences", type_="check")
        op.drop_column("user_preferences", "scrobbles_page_size")
        op.drop_constraint("ck_user_preferences_page_size", "user_preferences", type_="check")
        op.create_check_constraint(
            "ck_user_preferences_page_size",
            "user_preferences",
            "default_page_size IN (10, 25, 50, 100, 150, 200, 250)",
        )
