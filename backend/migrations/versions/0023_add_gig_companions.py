"""add_gig_companions

Revision ID: 0023_add_gig_companions
Revises: 0022_add_setlist_import_jobs
Create Date: 2026-10-29 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0023_add_gig_companions"
down_revision: Union[str, None] = "0022_add_setlist_import_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gig_companions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("concert_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("friend_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("friend_concert_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("concert_id", "friend_id", name="uq_gig_companion"),
    )
    op.create_index(op.f("ix_gig_companions_id"), "gig_companions", ["id"], unique=False)
    op.create_index(op.f("ix_gig_companions_concert_id"), "gig_companions", ["concert_id"], unique=False)
    op.create_index(op.f("ix_gig_companions_owner_id"), "gig_companions", ["owner_id"], unique=False)
    op.create_index(op.f("ix_gig_companions_friend_id"), "gig_companions", ["friend_id"], unique=False)
    op.create_index(op.f("ix_gig_companions_status"), "gig_companions", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_gig_companions_status"), table_name="gig_companions")
    op.drop_index(op.f("ix_gig_companions_friend_id"), table_name="gig_companions")
    op.drop_index(op.f("ix_gig_companions_owner_id"), table_name="gig_companions")
    op.drop_index(op.f("ix_gig_companions_concert_id"), table_name="gig_companions")
    op.drop_index(op.f("ix_gig_companions_id"), table_name="gig_companions")
    op.drop_table("gig_companions")
