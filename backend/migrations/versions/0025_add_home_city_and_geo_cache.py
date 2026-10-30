"""add_home_city_and_geo_cache

Revision ID: 0025_add_home_city_and_geo_cache
Revises: 0024_add_festival_flag
Create Date: 2026-10-30 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0025_add_home_city_and_geo_cache"
down_revision: Union[str, None] = "0024_add_festival_flag"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_preferences", sa.Column("home_city", sa.String(length=128), nullable=True))
    op.add_column("user_preferences", sa.Column("home_lat", sa.Float(), nullable=True))
    op.add_column("user_preferences", sa.Column("home_lng", sa.Float(), nullable=True))
    op.create_table(
        "geo_cache",
        sa.Column("cache_key", sa.String(length=255), primary_key=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_geo_cache_expires_at", "geo_cache", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_geo_cache_expires_at", table_name="geo_cache")
    op.drop_table("geo_cache")
    op.drop_column("user_preferences", "home_lng")
    op.drop_column("user_preferences", "home_lat")
    op.drop_column("user_preferences", "home_city")
