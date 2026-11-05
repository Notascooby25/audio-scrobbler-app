"""add_1001_albums_tables

Revision ID: 0031_add_1001_albums_tables
Revises: 0030_add_category_page_sizes
Create Date: 2026-11-05 11:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0031_add_1001_albums_tables"
down_revision: Union[str, None] = "0030_add_category_page_sizes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_1001_album_completions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("album_id", sa.Integer(), nullable=False),
        sa.Column("is_completed", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("source", sa.String(length=32), server_default="manual", nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "album_id", name="uq_user_1001_album_completion"),
    )
    op.create_index(op.f("ix_user_1001_album_completions_id"), "user_1001_album_completions", ["id"], unique=False)
    op.create_index(
        op.f("ix_user_1001_album_completions_user_id"), "user_1001_album_completions", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_1001_album_completions_album_id"), "user_1001_album_completions", ["album_id"], unique=False
    )

    op.create_table(
        "user_1001_pending_confirmations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("album_id", sa.Integer(), nullable=False),
        sa.Column("opened_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("dismissed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "album_id", name="uq_user_1001_pending_confirmation"),
    )
    op.create_index(
        op.f("ix_user_1001_pending_confirmations_id"), "user_1001_pending_confirmations", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_user_1001_pending_confirmations_user_id"), "user_1001_pending_confirmations", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_1001_pending_confirmations_album_id"),
        "user_1001_pending_confirmations",
        ["album_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_1001_pending_confirmations_album_id"), table_name="user_1001_pending_confirmations")
    op.drop_index(op.f("ix_user_1001_pending_confirmations_user_id"), table_name="user_1001_pending_confirmations")
    op.drop_index(op.f("ix_user_1001_pending_confirmations_id"), table_name="user_1001_pending_confirmations")
    op.drop_table("user_1001_pending_confirmations")

    op.drop_index(op.f("ix_user_1001_album_completions_album_id"), table_name="user_1001_album_completions")
    op.drop_index(op.f("ix_user_1001_album_completions_user_id"), table_name="user_1001_album_completions")
    op.drop_index(op.f("ix_user_1001_album_completions_id"), table_name="user_1001_album_completions")
    op.drop_table("user_1001_album_completions")
