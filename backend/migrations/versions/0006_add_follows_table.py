"""Add follows table for the social follow feature."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0006_add_follows_table"
down_revision = "0005_add_username_and_album_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "follows" not in inspector.get_table_names():
        op.create_table(
            "follows",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("follower_id", sa.Integer(), nullable=False),
            sa.Column("followee_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("follower_id", "followee_id", name="uq_follow_identity"),
            sa.CheckConstraint("follower_id != followee_id", name="ck_follow_no_self_follow"),
        )
        op.create_index("ix_follows_id", "follows", ["id"], unique=False)
        op.create_index("ix_follows_follower_id", "follows", ["follower_id"], unique=False)
        op.create_index("ix_follows_followee_id", "follows", ["followee_id"], unique=False)


def downgrade() -> None:
    op.drop_table("follows")
