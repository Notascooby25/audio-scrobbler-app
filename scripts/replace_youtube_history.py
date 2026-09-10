#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.app.db import SessionLocal
from backend.app.services.youtube_replace_service import replace_youtube_history


def main() -> int:
    parser = argparse.ArgumentParser(description="Replace one user's YouTube history safely.")
    parser.add_argument("--file", required=True, type=Path, help="Corrected YouTube JSON export")
    parser.add_argument("--user-id", required=True, type=int)
    parser.add_argument("--confirm-replace", action="store_true", help="Required to delete existing YouTube rows")
    args = parser.parse_args()

    if not args.confirm_replace:
        parser.error("--confirm-replace is required; this operation deletes existing YouTube rows for the selected user")
    if not args.file.is_file():
        parser.error(f"File not found: {args.file}")

    try:
        entries = json.loads(args.file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        parser.error(f"Could not read JSON file: {exc}")
    if not isinstance(entries, list):
        parser.error("The JSON root must be an array of history entries")

    db = SessionLocal()
    try:
        result = replace_youtube_history(db, args.user_id, entries)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())