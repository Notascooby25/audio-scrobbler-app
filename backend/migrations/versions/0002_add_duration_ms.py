"""Add optional listening duration."""

from alembic import op
import sqlalchemy as sa

revision = "0002_add_duration_ms"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("listening_events", sa.Column("duration_ms", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("listening_events", "duration_ms")