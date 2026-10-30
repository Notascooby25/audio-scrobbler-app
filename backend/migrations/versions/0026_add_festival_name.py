"""add_festival_name

Revision ID: 0026_add_festival_name
Revises: 0025_add_home_city_and_geo_cache
Create Date: 2026-10-30 14:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0026_add_festival_name"
down_revision: Union[str, None] = "0025_add_home_city_and_geo_cache"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attended_concerts", sa.Column("festival_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("attended_concerts", "festival_name")
