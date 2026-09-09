"""Add per-user ingestion checkpoints."""

from alembic import op
import sqlalchemy as sa

revision = "0003_add_ingestion_checkpoints"
down_revision = "0002_add_duration_ms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingestion_checkpoints",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("last_played_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("ingestion_checkpoints")