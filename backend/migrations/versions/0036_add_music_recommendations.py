"""add_music_recommendations_and_notification_link

Revision ID: 0036_add_music_recommendations
Revises: 0035_add_rough_trade_albums_tables
Create Date: 2026-11-12 14:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0036_add_music_recommendations"
down_revision: Union[str, None] = "0035_add_rough_trade_albums_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add link column to notifications
    op.add_column("notifications", sa.Column("link", sa.String(length=255), nullable=True))

    # 2. Create music_recommendations table
    op.create_table(
        "music_recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("receiver_id", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("artist_name", sa.String(length=255), nullable=False),
        sa.Column("album_name", sa.String(length=255), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("spotify_uri", sa.String(length=255), nullable=True),
        sa.Column("spotify_url", sa.Text(), nullable=True),
        sa.Column("note", sa.String(length=280), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_music_recommendations_id"), "music_recommendations", ["id"], unique=False)
    op.create_index(op.f("ix_music_recommendations_sender_id"), "music_recommendations", ["sender_id"], unique=False)
    op.create_index(op.f("ix_music_recommendations_receiver_id"), "music_recommendations", ["receiver_id"], unique=False)
    op.create_index(op.f("ix_music_recommendations_status"), "music_recommendations", ["status"], unique=False)
    op.create_index(
        "ix_music_recommendations_receiver_status",
        "music_recommendations",
        ["receiver_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_music_recommendations_receiver_status", table_name="music_recommendations")
    op.drop_index(op.f("ix_music_recommendations_status"), table_name="music_recommendations")
    op.drop_index(op.f("ix_music_recommendations_receiver_id"), table_name="music_recommendations")
    op.drop_index(op.f("ix_music_recommendations_sender_id"), table_name="music_recommendations")
    op.drop_index(op.f("ix_music_recommendations_id"), table_name="music_recommendations")
    op.drop_table("music_recommendations")
    op.drop_column("notifications", "link")
