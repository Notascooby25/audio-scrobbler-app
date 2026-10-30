"""add_festival_flag

Revision ID: 0024_add_festival_flag
Revises: 0023_add_gig_companions
Create Date: 2026-10-30 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0024_add_festival_flag"
down_revision: Union[str, None] = "0023_add_gig_companions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attended_concerts",
        sa.Column("is_festival", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("attended_concerts", "is_festival")
