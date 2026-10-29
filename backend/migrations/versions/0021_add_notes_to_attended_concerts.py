"""add_notes_to_attended_concerts

Revision ID: 0021_add_notes_to_attended_concerts
Revises: 0020_add_setlist_tracking
Create Date: 2026-10-29 03:37:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0021_add_notes_to_attended_concerts"
down_revision: Union[str, None] = "0020_add_setlist_tracking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attended_concerts", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("attended_concerts", "notes")
