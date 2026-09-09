from __future__ import annotations

from threading import Lock

_lock = Lock()
_ingestion_events = 0
_ingestion_duplicates = 0


def record_ingestion(duplicate: bool) -> None:
    global _ingestion_events, _ingestion_duplicates
    with _lock:
        _ingestion_events += 1
        if duplicate:
            _ingestion_duplicates += 1


def snapshot() -> dict[str, int]:
    with _lock:
        return {
            "ingestion_events": _ingestion_events,
            "ingestion_duplicates": _ingestion_duplicates,
        }
