from __future__ import annotations

from .runtime_metrics import snapshot


def prometheus_metrics() -> str:
    values = snapshot()
    lines = [
        "# HELP audio_scrobbler_ingestion_events_total Accepted listening events.",
        "# TYPE audio_scrobbler_ingestion_events_total counter",
        f"audio_scrobbler_ingestion_events_total {values['ingestion_events']}",
        "# HELP audio_scrobbler_ingestion_duplicates_total Duplicate listening events.",
        "# TYPE audio_scrobbler_ingestion_duplicates_total counter",
        f"audio_scrobbler_ingestion_duplicates_total {values['ingestion_duplicates']}",
    ]
    return "\n".join(lines) + "\n"
