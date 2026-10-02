"""add_notifications

Revision ID: 669e05e5205e
Revises: 0018_add_followed_shows
Create Date: 2026-10-02 18:27:43.115582
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '669e05e5205e'
down_revision: Union[str, None] = '0018_add_followed_shows'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False, server_default='general'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)

    # push_subscriptions table
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.String(length=255), nullable=False),
        sa.Column('auth', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'endpoint', name='uq_push_subscription_user_endpoint')
    )
    op.create_index(op.f('ix_push_subscriptions_id'), 'push_subscriptions', ['id'], unique=False)
    op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)

    # user_preferences columns
    op.add_column('user_preferences', sa.Column('notify_recaps', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('user_preferences', sa.Column('notify_milestones', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('user_preferences', sa.Column('notify_system', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('user_preferences', sa.Column('recap_frequency', sa.String(length=16), nullable=False, server_default='weekly'))


def downgrade() -> None:
    op.drop_column('user_preferences', 'recap_frequency')
    op.drop_column('user_preferences', 'notify_system')
    op.drop_column('user_preferences', 'notify_milestones')
    op.drop_column('user_preferences', 'notify_recaps')

    op.drop_index(op.f('ix_push_subscriptions_user_id'), table_name='push_subscriptions')
    op.drop_index(op.f('ix_push_subscriptions_id'), table_name='push_subscriptions')
    op.drop_table('push_subscriptions')

    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')