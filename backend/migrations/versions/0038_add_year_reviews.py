"""add_year_reviews

Revision ID: 0038_add_year_reviews
Revises: 0037_add_gig_discovery_tables
Create Date: 2026-11-27 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0038_add_year_reviews"
down_revision: Union[str, None] = "0037_add_gig_discovery_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "year_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("stage", sa.String(length=16), nullable=False),
        sa.Column("format_version", sa.Integer(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column("window_end", sa.DateTime(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column("seen_at", sa.DateTime(), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "year", "stage", name="uq_year_review_user_year_stage"),
    )
    op.create_index("ix_year_reviews_id", "year_reviews", ["id"], unique=False)
    op.create_index("ix_year_reviews_user_id", "year_reviews", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_year_reviews_user_id", table_name="year_reviews")
    op.drop_index("ix_year_reviews_id", table_name="year_reviews")
    op.drop_table("year_reviews")
