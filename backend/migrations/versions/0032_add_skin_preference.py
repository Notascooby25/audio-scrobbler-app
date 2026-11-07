"""add_skin_preference

Revision ID: 0032_add_skin_preference
Revises: 0031_add_1001_albums_tables
Create Date: 2026-11-07 08:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0032_add_skin_preference"
down_revision: Union[str, None] = "0031_add_1001_albums_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VALID_SKINS = "'classic', 'sleeve', 'timeline'"


def upgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.add_column(sa.Column("skin", sa.String(length=16), server_default="classic", nullable=False))
        batch_op.create_check_constraint(
            "ck_user_preferences_skin",
            f"skin IN ({VALID_SKINS})",
        )


def downgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.drop_constraint("ck_user_preferences_skin", type_="check")
        batch_op.drop_column("skin")
