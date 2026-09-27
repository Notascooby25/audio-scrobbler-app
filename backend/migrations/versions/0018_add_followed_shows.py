"""add_followed_shows

Revision ID: 0018_add_followed_shows
Revises: 0017_add_theme
Create Date: 2026-09-27 14:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018_add_followed_shows'
down_revision: Union[str, None] = '0017_add_theme'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'followed_shows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('brand_id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('synopsis', sa.Text(), nullable=True),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'brand_id', name='uq_followed_show_user_brand')
    )
    op.create_index(op.f('ix_followed_shows_id'), 'followed_shows', ['id'], unique=False)
    op.create_index(op.f('ix_followed_shows_user_id'), 'followed_shows', ['user_id'], unique=False)
    op.create_index(op.f('ix_followed_shows_brand_id'), 'followed_shows', ['brand_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_followed_shows_brand_id'), table_name='followed_shows')
    op.drop_index(op.f('ix_followed_shows_user_id'), table_name='followed_shows')
    op.drop_index(op.f('ix_followed_shows_id'), table_name='followed_shows')
    op.drop_table('followed_shows')
