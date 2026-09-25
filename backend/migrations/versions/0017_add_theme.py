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
    with op.batch_alter_table('user_preferences') as batch_op:
        batch_op.add_column(sa.Column('theme', sa.String(length=16), server_default='system', nullable=False))
        # Add the check constraint
        batch_op.create_check_constraint('ck_user_preferences_theme', "theme IN ('light', 'dark', 'system')")


def downgrade() -> None:
    # Drop the constraint and column
    with op.batch_alter_table('user_preferences') as batch_op:
        batch_op.drop_constraint('ck_user_preferences_theme', type_='check')
        batch_op.drop_column('theme')
