"""Add artwork metadata and Spotify liked tracks."""

from alembic import op
import sqlalchemy as sa


revision = "0007_add_artwork_and_liked_tracks"
down_revision = "0006_add_follows_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.add_column(sa.Column("artwork_url", sa.Text(), nullable=True))

    op.create_table(
        "liked_tracks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("spotify_track_id", sa.String(length=255), nullable=False),
        sa.Column("track_name", sa.String(length=255), nullable=False),
        sa.Column("artist_name", sa.String(length=255), nullable=False),
        sa.Column("album_name", sa.String(length=255), nullable=True),
        sa.Column("artwork_url", sa.Text(), nullable=True),
        sa.Column("added_at", sa.DateTime(), nullable=False),
        sa.Column("raw_metadata", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "spotify_track_id", name="uq_liked_track_user_spotify_id"),
    )
    op.create_index("ix_liked_tracks_user_id", "liked_tracks", ["user_id"])
    op.create_index("ix_liked_tracks_spotify_track_id", "liked_tracks", ["spotify_track_id"])


def downgrade() -> None:
    op.drop_index("ix_liked_tracks_spotify_track_id", table_name="liked_tracks")
    op.drop_index("ix_liked_tracks_user_id", table_name="liked_tracks")
    op.drop_table("liked_tracks")
    with op.batch_alter_table("listening_events") as batch_op:
        batch_op.drop_column("artwork_url")