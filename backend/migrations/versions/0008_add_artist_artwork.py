"""Add cached artist artwork metadata."""

from alembic import op
import sqlalchemy as sa


revision = "0008_add_artist_artwork"
down_revision = "0007_add_artwork_and_liked_tracks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.add_column(sa.Column("artist_artwork_url", sa.Text(), nullable=True))
    with op.batch_alter_table("liked_tracks") as batch_op:
        batch_op.add_column(sa.Column("artist_artwork_url", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("liked_tracks") as batch_op:
        batch_op.drop_column("artist_artwork_url")
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.drop_column("artist_artwork_url")