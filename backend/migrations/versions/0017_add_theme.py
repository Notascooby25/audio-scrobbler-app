"""add_theme

Revision ID: 0017_add_theme
Revises: 0016_add_genre_cache
Create Date: 2026-09-25 13:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0017_add_theme'
down_revision: Union[str, None] = '0016_add_genre_cache'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add theme column with default value
    op.add_column('user_preferences', sa.Column('theme', sa.String(length=16), server_default='system', nullable=False))
    
    # Add the check constraint
    op.create_check_constraint('ck_user_preferences_theme', 'user_preferences', "theme IN ('light', 'dark', 'system')")


def downgrade() -> None:
    # Drop the constraint and column
    op.drop_constraint('ck_user_preferences_theme', 'user_preferences', type_='check')
    op.drop_column('user_preferences', 'theme')
