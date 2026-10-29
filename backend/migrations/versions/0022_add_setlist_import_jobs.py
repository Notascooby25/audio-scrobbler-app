"""add_setlist_import_jobs

Revision ID: 0022_add_setlist_import_jobs
Revises: 0021_add_notes_to_attended_concerts
Create Date: 2026-10-29 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0022_add_setlist_import_jobs"
down_revision: Union[str, None] = "0021_add_notes_to_attended_concerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "setlist_import_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("setlist_username", sa.String(length=128), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("next_page", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="paused"),
        sa.Column("imported_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("resume_after", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_setlist_import_jobs_id"), "setlist_import_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_setlist_import_jobs_user_id"), "setlist_import_jobs", ["user_id"], unique=False)
    op.create_index(op.f("ix_setlist_import_jobs_status"), "setlist_import_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_setlist_import_jobs_resume_after"), "setlist_import_jobs", ["resume_after"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_setlist_import_jobs_resume_after"), table_name="setlist_import_jobs")
    op.drop_index(op.f("ix_setlist_import_jobs_status"), table_name="setlist_import_jobs")
    op.drop_index(op.f("ix_setlist_import_jobs_user_id"), table_name="setlist_import_jobs")
    op.drop_index(op.f("ix_setlist_import_jobs_id"), table_name="setlist_import_jobs")
    op.drop_table("setlist_import_jobs")
