"""add_followed_youtube_channels

Revision ID: 0019_add_followed_youtube_channels
Revises: 669e05e5205e
Create Date: 2026-10-28 19:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0019_add_followed_youtube_channels'
down_revision: Union[str, None] = '669e05e5205e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'followed_youtube_channels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.String(length=64), nullable=False),
        sa.Column('channel_handle', sa.String(length=128), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'channel_id', name='uq_followed_youtube_channel_user')
    )
    op.create_index(op.f('ix_followed_youtube_channels_id'), 'followed_youtube_channels', ['id'], unique=False)
    op.create_index(op.f('ix_followed_youtube_channels_user_id'), 'followed_youtube_channels', ['user_id'], unique=False)
    op.create_index(op.f('ix_followed_youtube_channels_channel_id'), 'followed_youtube_channels', ['channel_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_followed_youtube_channels_channel_id'), table_name='followed_youtube_channels')
    op.drop_index(op.f('ix_followed_youtube_channels_user_id'), table_name='followed_youtube_channels')
    op.drop_index(op.f('ix_followed_youtube_channels_id'), table_name='followed_youtube_channels')
    op.drop_table('followed_youtube_channels')
