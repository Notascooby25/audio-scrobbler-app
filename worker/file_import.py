from __future__ import annotations

import json
import logging
import re
import shutil
import time
from pathlib import Path

import requests

logger = logging.getLogger("audio-scrobbler-worker")

FILENAME_PATTERN = re.compile(r"^user-(?P<user_id>\d+)-(?P<source>[a-zA-Z]+)\.json$")


def parse_entries(raw_text: str) -> list[dict[str, object]]:
    parsed = json.loads(raw_text)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        entries = parsed.get("history", parsed.get("entries"))
        if isinstance(entries, list):
            return entries
    raise ValueError("Import file does not contain a recognizable entries list")


def submit_import_with_retries(
    backend_url: str,
    worker_token: str,
    user_id: int,
    source: str,
    entries: list[dict[str, object]],
) -> dict[str, object]:
    for attempt in range(3):
        response = requests.post(
            f"{backend_url}/import/internal/scrobbles",
            json={"user_id": user_id, "source": source, "entries": entries},
            headers={"X-Worker-Token": worker_token},
            timeout=30,
        )
        if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            time.sleep(2 ** attempt)
            continue
        response.raise_for_status()
        return response.json()
    raise requests.HTTPError("Backend import failed after retries")


def process_import_directory(import_dir: str, backend_url: str, worker_token: str) -> dict[str, int]:
    directory = Path(import_dir)
    if not directory.is_dir():
        return {"processed": 0, "failed": 0}

    processed_dir = directory / "processed"
    failed_dir = directory / "failed"

    processed = 0
    failed = 0

    for file_path in sorted(directory.glob("*.json")):
        match = FILENAME_PATTERN.match(file_path.name)
        if match is None:
            logger.warning("Skipping import file with unrecognized name: %s", file_path.name)
            failed_dir.mkdir(exist_ok=True)
            shutil.move(str(file_path), str(failed_dir / file_path.name))
            failed += 1
            continue

        user_id = int(match.group("user_id"))
        source = match.group("source").lower()

        try:
            entries = parse_entries(file_path.read_text())
            submit_import_with_retries(backend_url, worker_token, user_id, source, entries)
        except Exception:
            logger.exception("Failed to import file %s", file_path.name)
            failed_dir.mkdir(exist_ok=True)
            shutil.move(str(file_path), str(failed_dir / file_path.name))
            failed += 1
            continue

        processed_dir.mkdir(exist_ok=True)
        shutil.move(str(file_path), str(processed_dir / file_path.name))
        processed += 1

    return {"processed": processed, "failed": failed}
