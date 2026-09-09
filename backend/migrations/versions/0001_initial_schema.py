"""Create the initial application schema."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("spotify_user_id", sa.String(length=255), nullable=False),
            sa.Column("display_name", sa.String(length=255), nullable=False),
            sa.Column("refresh_token_cipher", sa.Text(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("spotify_user_id"),
        )
        op.create_index("ix_users_id", "users", ["id"], unique=False)
        op.create_index("ix_users_spotify_user_id", "users", ["spotify_user_id"], unique=True)

    if "listening_events" not in tables:
        op.create_table(
            "listening_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("track_id", sa.String(length=255), nullable=False),
            sa.Column("track_name", sa.String(length=255), nullable=False),
            sa.Column("artist_name", sa.String(length=255), nullable=False),
            sa.Column("played_at", sa.DateTime(), nullable=False),
            sa.Column("source", sa.String(length=64), nullable=True),
            sa.Column("payload", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "track_id", "played_at", name="uq_listening_event_identity"),
        )
        op.create_index("ix_listening_events_id", "listening_events", ["id"], unique=False)
        op.create_index("ix_listening_events_user_id", "listening_events", ["user_id"], unique=False)
        op.create_index("ix_listening_events_track_id", "listening_events", ["track_id"], unique=False)
        op.create_index("ix_listening_events_played_at", "listening_events", ["played_at"], unique=False)
    elif not any(
        constraint.get("name") == "uq_listening_event_identity"
        for constraint in inspector.get_unique_constraints("listening_events")
    ):
        op.create_unique_constraint(
            "uq_listening_event_identity",
            "listening_events",
            ["user_id", "track_id", "played_at"],
        )


def downgrade() -> None:
    op.drop_table("listening_events")
    op.drop_table("users")