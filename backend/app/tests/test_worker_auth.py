from __future__ import annotations

from dataclasses import replace
import pytest
from fastapi import HTTPException

from backend.app.api.ingestion import require_worker_token
import backend.app.api.ingestion as ingestion_module
from backend.app.config import settings


def test_require_worker_token_accepts_valid_token(monkeypatch):
    mocked = replace(settings, worker_ingestion_token="secret-token-xyz")
    monkeypatch.setattr(ingestion_module, "settings", mocked)
    # Should not raise
    require_worker_token(x_worker_token="secret-token-xyz")


def test_require_worker_token_rejects_invalid_token(monkeypatch):
    mocked = replace(settings, worker_ingestion_token="secret-token-xyz")
    monkeypatch.setattr(ingestion_module, "settings", mocked)
    with pytest.raises(HTTPException) as exc_info:
        require_worker_token(x_worker_token="wrong-token")
    assert exc_info.value.status_code == 401


def test_require_worker_token_rejects_empty_or_none(monkeypatch):
    mocked = replace(settings, worker_ingestion_token="secret-token-xyz")
    monkeypatch.setattr(ingestion_module, "settings", mocked)
    with pytest.raises(HTTPException) as exc_info:
        require_worker_token(x_worker_token="")
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        require_worker_token(x_worker_token=None)
    assert exc_info.value.status_code == 401


def test_require_worker_token_rejects_when_server_token_unset(monkeypatch):
    mocked = replace(settings, worker_ingestion_token="")
    monkeypatch.setattr(ingestion_module, "settings", mocked)
    with pytest.raises(HTTPException) as exc_info:
        require_worker_token(x_worker_token="")
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        require_worker_token(x_worker_token="any")
    assert exc_info.value.status_code == 401
