"""add_cover_band_flag

Revision ID: 0034_add_cover_band_flag
Revises: 0033_add_artwork_color_and_match_sleeve
Create Date: 2026-11-10 19:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0034_add_cover_band_flag"
down_revision: Union[str, None] = "0033_add_artwork_color_and_match_sleeve"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("attended_concerts") as batch_op:
        batch_op.add_column(sa.Column("is_cover_band", sa.Boolean(), server_default=sa.text("false"), nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("attended_concerts") as batch_op:
        batch_op.drop_column("is_cover_band")
