"""add_artwork_color_and_match_sleeve

Revision ID: 0033_add_artwork_color_and_match_sleeve
Revises: 0032_add_skin_preference
Create Date: 2026-11-07 12:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0033_add_artwork_color_and_match_sleeve"
down_revision: Union[str, None] = "0032_add_skin_preference"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.add_column(
            sa.Column("match_album_sleeve", sa.Boolean(), server_default=sa.true(), nullable=False)
        )

    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.add_column(
            sa.Column("artwork_color", sa.String(length=7), nullable=True)
        )

    with op.batch_alter_table("artwork_cache") as batch_op:
        batch_op.add_column(
            sa.Column("dominant_color", sa.String(length=7), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("artwork_cache") as batch_op:
        batch_op.drop_column("dominant_color")

    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.drop_column("artwork_color")

    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.drop_column("match_album_sleeve")
