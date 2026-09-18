"""add realtime scrobbling settings and state

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-18 13:16:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0014_add_realtime_scrobbling'
down_revision = '0013_add_checkpoint_last_polled_at'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('realtime_playback_state',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('track_id', sa.String(length=255), nullable=False),
    sa.Column('duration_ms', sa.BigInteger(), nullable=False),
    sa.Column('max_progress_ms', sa.BigInteger(), nullable=False, server_default='0'),
    sa.Column('scrobbled', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('raw_metadata', sa.JSON(), nullable=True),
    sa.Column('is_playing', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.add_column('user_scrobble_settings', sa.Column('realtime_sync_enabled', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('user_scrobble_settings', sa.Column('scrobble_threshold_percent', sa.Integer(), server_default='50', nullable=False))

def downgrade() -> None:
    op.drop_column('user_scrobble_settings', 'scrobble_threshold_percent')
    op.drop_column('user_scrobble_settings', 'realtime_sync_enabled')
    op.drop_table('realtime_playback_state')
