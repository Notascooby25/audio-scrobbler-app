"""Add canonical import identity fields for source-aware dedupe."""

from alembic import op
import sqlalchemy as sa

revision = "0004_add_canonical_import_identity"
down_revision = "0003_add_ingestion_checkpoints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.add_column(sa.Column("play_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("raw_metadata", sa.JSON(), nullable=True))

    op.execute(
        "UPDATE listening_events SET play_id = track_id WHERE play_id IS NULL"
    )
    op.execute(
        "UPDATE listening_events SET source = 'spotify' WHERE source IS NULL"
    )

    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.alter_column("source", existing_type=sa.String(length=64), nullable=False)
        batch_op.alter_column("play_id", existing_type=sa.String(length=255), nullable=False)
        batch_op.create_unique_constraint(
            "uq_listening_event_source_identity",
            ["user_id", "source", "play_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.drop_constraint("uq_listening_event_source_identity", type_="unique")
        batch_op.drop_column("raw_metadata")
        batch_op.drop_column("play_id")
