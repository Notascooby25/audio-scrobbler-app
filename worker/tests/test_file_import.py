from __future__ import annotations

import json

import pytest

import file_import


def test_parse_entries_accepts_bare_list():
    assert file_import.parse_entries(json.dumps([{"trackName": "Slow Show"}])) == [{"trackName": "Slow Show"}]


def test_parse_entries_accepts_history_wrapper():
    payload = json.dumps({"history": [{"trackName": "Slow Show"}]})
    assert file_import.parse_entries(payload) == [{"trackName": "Slow Show"}]


def test_parse_entries_accepts_entries_wrapper():
    payload = json.dumps({"entries": [{"title": "Midnight City"}]})
    assert file_import.parse_entries(payload) == [{"title": "Midnight City"}]


def test_parse_entries_rejects_unrecognized_shape():
    with pytest.raises(ValueError):
        file_import.parse_entries(json.dumps({"unexpected": "shape"}))


def test_process_import_directory_returns_zero_counts_when_directory_missing(tmp_path):
    result = file_import.process_import_directory(str(tmp_path / "missing"), "http://backend:8000", "token")
    assert result == {"processed": 0, "failed": 0}


def test_process_import_directory_moves_successful_files_to_processed(tmp_path, monkeypatch):
    import_dir = tmp_path
    (import_dir / "user-1-spotify.json").write_text(json.dumps([{"trackName": "Slow Show"}]))

    monkeypatch.setattr(
        file_import,
        "submit_import_with_retries",
        lambda backend_url, worker_token, user_id, source, entries: {"summary": {"inserted": 1}},
    )

    result = file_import.process_import_directory(str(import_dir), "http://backend:8000", "token")

    assert result == {"processed": 1, "failed": 0}
    assert (import_dir / "processed" / "user-1-spotify.json").exists()
    assert not (import_dir / "user-1-spotify.json").exists()


def test_process_import_directory_moves_unrecognized_filenames_to_failed(tmp_path):
    import_dir = tmp_path
    (import_dir / "not-a-valid-name.json").write_text("[]")

    result = file_import.process_import_directory(str(import_dir), "http://backend:8000", "token")

    assert result == {"processed": 0, "failed": 1}
    assert (import_dir / "failed" / "not-a-valid-name.json").exists()


def test_process_import_directory_moves_submission_failures_to_failed(tmp_path, monkeypatch):
    import_dir = tmp_path
    (import_dir / "user-1-spotify.json").write_text(json.dumps([{"trackName": "Slow Show"}]))

    def raise_error(*args, **kwargs):
        raise RuntimeError("backend unavailable")

    monkeypatch.setattr(file_import, "submit_import_with_retries", raise_error)

    result = file_import.process_import_directory(str(import_dir), "http://backend:8000", "token")

    assert result == {"processed": 0, "failed": 1}
    assert (import_dir / "failed" / "user-1-spotify.json").exists()
