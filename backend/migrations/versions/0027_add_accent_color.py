"""add_accent_color

Revision ID: 0027_add_accent_color
Revises: 0026_add_festival_name
Create Date: 2026-10-30 16:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0027_add_accent_color"
down_revision: Union[str, None] = "0026_add_festival_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VALID_ACCENTS = (
    "'blue_monday', 'spotify_green', 'red_red_wine', 'purple_rain', "
    "'fools_gold', 'paint_it_black', 'pretty_in_pink', 'orange_crush'"
)


def upgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.add_column(
            sa.Column("accent_color", sa.String(length=24), server_default="blue_monday", nullable=False)
        )
        batch_op.create_check_constraint(
            "ck_user_preferences_accent_color",
            f"accent_color IN ({VALID_ACCENTS})",
        )


def downgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch_op:
        batch_op.drop_constraint("ck_user_preferences_accent_color", type_="check")
        batch_op.drop_column("accent_color")
