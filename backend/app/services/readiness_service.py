from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

REQUIRED_TABLES = {"users", "listening_events", "ingestion_checkpoints"}


def check_backend_readiness(engine: Engine) -> tuple[bool, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
            tables = set(inspect(connection).get_table_names())
            missing_tables = REQUIRED_TABLES - tables
            if missing_tables:
                return False, "required schema is incomplete"
            revision = connection.execute(text("select version_num from alembic_version limit 1")).scalar_one_or_none()
            if not revision:
                return False, "database migration state is unavailable"
    except Exception:
        return False, "database is unavailable"
    return True, "ready"