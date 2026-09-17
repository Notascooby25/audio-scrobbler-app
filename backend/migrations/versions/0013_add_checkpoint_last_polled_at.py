"""Add last_polled_at to ingestion_checkpoints for per-user poll-interval gating."""

from alembic import op
import sqlalchemy as sa


revision = "0013_add_checkpoint_last_polled_at"
down_revision = "0012_add_user_scrobble_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("ingestion_checkpoints") as batch_op:
        batch_op.add_column(sa.Column("last_polled_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("ingestion_checkpoints") as batch_op:
        batch_op.drop_column("last_polled_at")
