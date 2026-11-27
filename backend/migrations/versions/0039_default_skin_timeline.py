"""default_skin_timeline

New accounts start in the Timeline skin. Only the column's default changes: no existing row is
updated, so everyone who already has a stored skin keeps it.

Revision ID: 0039_default_skin_timeline
Revises: 0038_add_year_reviews
Create Date: 2026-11-28 09:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0039_default_skin_timeline"
down_revision: Union[str, None] = "0038_add_year_reviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.alter_column(
            "skin",
            existing_type=sa.String(length=16),
            existing_nullable=False,
            server_default="timeline",
        )


def downgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.alter_column(
            "skin",
            existing_type=sa.String(length=16),
            existing_nullable=False,
            server_default="classic",
        )
