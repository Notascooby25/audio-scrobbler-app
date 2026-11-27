"""backfill_gig_albums

Revision ID: 0039_backfill_gig_albums
Revises: 0038_add_year_reviews
Create Date: 2026-11-27 15:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0040_backfill_gig_albums"
down_revision: Union[str, None] = "0039_default_skin_timeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

listening_events = sa.table(
    "listening_events",
    sa.column("id", sa.Integer),
    sa.column("user_id", sa.Integer),
    sa.column("artist_name", sa.String),
    sa.column("track_name", sa.String),
    sa.column("album_name", sa.String),
    sa.column("source", sa.String),
)


def upgrade() -> None:
    bind = op.get_bind()

    non_live_rows = bind.execute(
        sa.select(
            listening_events.c.user_id,
            listening_events.c.artist_name,
            listening_events.c.track_name,
            listening_events.c.album_name,
            sa.func.count(listening_events.c.id).label("plays"),
        )
        .where(
            listening_events.c.source != "setlistfm",
            listening_events.c.album_name.isnot(None),
            listening_events.c.album_name != "",
            ~sa.func.lower(listening_events.c.album_name).like("live at %"),
        )
        .group_by(
            listening_events.c.user_id,
            listening_events.c.artist_name,
            listening_events.c.track_name,
            listening_events.c.album_name,
        )
        .order_by(sa.func.count(listening_events.c.id).desc())
    ).all()

    best_album: dict[tuple[int, str, str], str] = {}
    for user_id, artist_name, track_name, album_name, _plays in non_live_rows:
        if artist_name and track_name and album_name:
            best_album.setdefault((user_id, artist_name.lower(), track_name.lower()), album_name)

    live_targets = bind.execute(
        sa.select(
            listening_events.c.user_id,
            listening_events.c.artist_name,
            listening_events.c.track_name,
        )
        .where(
            listening_events.c.source == "setlistfm",
            sa.or_(
                listening_events.c.album_name.is_(None),
                sa.func.lower(listening_events.c.album_name).like("live at %"),
            ),
        )
        .distinct()
    ).all()

    for user_id, artist_name, track_name in live_targets:
        matched = best_album.get((user_id, (artist_name or "").lower(), (track_name or "").lower()))
        bind.execute(
            sa.update(listening_events)
            .where(
                listening_events.c.user_id == user_id,
                listening_events.c.source == "setlistfm",
                listening_events.c.artist_name == artist_name,
                listening_events.c.track_name == track_name,
                sa.or_(
                    listening_events.c.album_name.is_(None),
                    sa.func.lower(listening_events.c.album_name).like("live at %"),
                ),
            )
            .values(album_name=matched)
        )


def downgrade() -> None:
    pass
