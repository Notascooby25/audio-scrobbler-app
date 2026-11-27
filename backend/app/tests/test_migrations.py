from __future__ import annotations

import os
import subprocess
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _run_migrations(database_url: str) -> None:
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": database_url},
        check=True,
        capture_output=True,
        text=True,
    )


def test_alembic_upgrade_head_creates_canonical_import_schema(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'migration_test.db'}"

    _run_migrations(database_url)

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        columns = {column["name"] for column in inspector.get_columns("listening_events")}
        assert {"source", "play_id", "raw_metadata"}.issubset(columns)

        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO listening_events "
                    "(user_id, track_id, track_name, artist_name, played_at, source, play_id, created_at) "
                    "VALUES (1, 'track-1', 'Track', 'Artist', '2026-01-01 00:00:00', 'spotify', 'play-1', '2026-01-01 00:00:00')"
                )
            )

        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO listening_events "
                        "(user_id, track_id, track_name, artist_name, played_at, source, play_id, created_at) "
                        "VALUES (1, 'track-2', 'Track', 'Artist', '2026-01-02 00:00:00', 'spotify', 'play-1', '2026-01-01 00:00:00')"
                    )
                )
            raise AssertionError("Expected duplicate (user_id, source, play_id) insert to violate the unique constraint")
        except IntegrityError:
            pass
    finally:
        engine.dispose()


def _skin_server_default(engine) -> str:
    columns = {column["name"]: column for column in inspect(engine).get_columns("user_preferences")}
    return str(columns["skin"]["default"])


def test_skin_default_migration_changes_only_the_default_not_existing_rows(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'skin_default_test.db'}"
    subprocess.run(
        ["alembic", "upgrade", "0038_add_year_reviews"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": database_url},
        check=True,
        capture_output=True,
        text=True,
    )
    engine = create_engine(database_url)
    try:
        assert "classic" in _skin_server_default(engine)
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO user_preferences (user_id) VALUES (1)"))
            assert connection.execute(text("SELECT skin FROM user_preferences WHERE user_id = 1")).scalar() == "classic"
    finally:
        engine.dispose()

    _run_migrations(database_url)

    engine = create_engine(database_url)
    try:
        assert "timeline" in _skin_server_default(engine)
        with engine.begin() as connection:
            # An existing account keeps its stored skin; an account created now starts in Timeline.
            assert connection.execute(text("SELECT skin FROM user_preferences WHERE user_id = 1")).scalar() == "classic"
            connection.execute(text("INSERT INTO user_preferences (user_id) VALUES (2)"))
            assert connection.execute(text("SELECT skin FROM user_preferences WHERE user_id = 2")).scalar() == "timeline"
    finally:
        engine.dispose()
