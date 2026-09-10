"""Add per-user blocked items."""

from alembic import op
import sqlalchemy as sa


revision = "0010_add_blocked_items"
down_revision = "0009_add_user_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blocked_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("entity_type IN ('artist', 'album', 'track')", name="ck_blocked_items_entity_type"),
    )
    op.create_index("ix_blocked_items_user_id", "blocked_items", ["user_id"])
    op.create_index(
        "uq_blocked_items_user_entity_name",
        "blocked_items",
        ["user_id", "entity_type", sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_blocked_items_user_entity_name", table_name="blocked_items")
    op.drop_index("ix_blocked_items_user_id", table_name="blocked_items")
    op.drop_table("blocked_items")
