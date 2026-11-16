"""add_gig_discovery_tables

Revision ID: 0037_add_gig_discovery_tables
Revises: 0036_add_music_recommendations
Create Date: 2026-11-16 13:16:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0037_add_gig_discovery_tables"
down_revision: Union[str, None] = "0036_add_music_recommendations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("local_gig_radius_miles", sa.Integer(), nullable=False, server_default="10"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("gig_discovery_filters", sa.JSON(), nullable=True),
    )

    op.create_table(
        "discovered_gigs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=False),
        sa.Column("artist_name", sa.String(length=255), nullable=False),
        sa.Column("artist_key", sa.String(length=255), nullable=False),
        sa.Column("attraction_names", sa.JSON(), nullable=False),
        sa.Column("attraction_keys", sa.JSON(), nullable=False),
        sa.Column("event_name", sa.String(length=255), nullable=False),
        sa.Column("venue_name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("country_code", sa.String(length=8), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("event_time", sa.String(length=16), nullable=True),
        sa.Column("onsale_start_at", sa.DateTime(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(), nullable=False),
        sa.Column("ticket_url", sa.String(length=512), nullable=True),
        sa.Column("image_url", sa.String(length=512), nullable=True),
        sa.Column("is_cancelled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "external_id", name="uq_discovered_gigs_source_external_id"),
    )
    op.create_index("ix_discovered_gigs_source", "discovered_gigs", ["source"], unique=False)
    op.create_index("ix_discovered_gigs_artist_key", "discovered_gigs", ["artist_key"], unique=False)
    op.create_index("ix_discovered_gigs_country_code", "discovered_gigs", ["country_code"], unique=False)
    op.create_index("ix_discovered_gigs_event_date", "discovered_gigs", ["event_date"], unique=False)

    op.create_table(
        "discovered_gig_interests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("discovered_gig_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["discovered_gig_id"], ["discovered_gigs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "discovered_gig_id", name="uq_discovered_gig_interest_user_gig"),
    )
    op.create_index("ix_discovered_gig_interests_user_id", "discovered_gig_interests", ["user_id"], unique=False)
    op.create_index(
        "ix_discovered_gig_interests_discovered_gig_id",
        "discovered_gig_interests",
        ["discovered_gig_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_discovered_gig_interests_discovered_gig_id", table_name="discovered_gig_interests")
    op.drop_index("ix_discovered_gig_interests_user_id", table_name="discovered_gig_interests")
    op.drop_table("discovered_gig_interests")
    op.drop_index("ix_discovered_gigs_event_date", table_name="discovered_gigs")
    op.drop_index("ix_discovered_gigs_country_code", table_name="discovered_gigs")
    op.drop_index("ix_discovered_gigs_artist_key", table_name="discovered_gigs")
    op.drop_index("ix_discovered_gigs_source", table_name="discovered_gigs")
    op.drop_table("discovered_gigs")
    op.drop_column("user_preferences", "gig_discovery_filters")
    op.drop_column("user_preferences", "local_gig_radius_miles")
