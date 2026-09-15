"""increase page sizes

Revision ID: 5f9e2b1b3a3c
Revises: 
Create Date: 2026-09-13 22:25:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '5f9e2b1b3a3c'
down_revision = "0011_add_artwork_cache"  # We will manually get the correct down_revision
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table('user_preferences') as batch_op:
            batch_op.drop_constraint('ck_user_preferences_page_size', type_='check')
            batch_op.create_check_constraint(
                'ck_user_preferences_page_size',
                "default_page_size IN (10, 25, 50, 100, 150, 200, 250)"
            )
    else:
        op.drop_constraint('ck_user_preferences_page_size', 'user_preferences', type_='check')
        op.create_check_constraint(
            'ck_user_preferences_page_size',
            'user_preferences',
            "default_page_size IN (10, 25, 50, 100, 150, 200, 250)"
        )

def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table('user_preferences') as batch_op:
            batch_op.drop_constraint('ck_user_preferences_page_size', type_='check')
            batch_op.create_check_constraint(
                'ck_user_preferences_page_size',
                "default_page_size IN (10, 25, 50, 100)"
            )
    else:
        op.drop_constraint('ck_user_preferences_page_size', 'user_preferences', type_='check')
        op.create_check_constraint(
            'ck_user_preferences_page_size',
            'user_preferences',
            "default_page_size IN (10, 25, 50, 100)"
        )
