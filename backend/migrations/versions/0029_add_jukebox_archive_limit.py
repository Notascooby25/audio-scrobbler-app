"""add_jukebox_archive_limit

Revision ID: 0029_add_jukebox_archive_limit
Revises: 0028_add_saved_albums
Create Date: 2026-10-31 12:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0029_add_jukebox_archive_limit"
down_revision: Union[str, None] = "0028_add_saved_albums"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.add_column(sa.Column("jukebox_archive_limit", sa.Integer(), server_default="100", nullable=False))
        batch_op.create_check_constraint(
            "ck_user_preferences_jukebox_archive_limit",
            "jukebox_archive_limit IN (100, 150, 200, 250, 300)",
        )


def downgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.drop_constraint("ck_user_preferences_jukebox_archive_limit", type_="check")
        batch_op.drop_column("jukebox_archive_limit")
