"""Regression tests for the sanctions-index source downloader."""

from __future__ import annotations

import importlib.util
import io
import urllib.error
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "sanctions_name_index.py"
SPEC = importlib.util.spec_from_file_location("sanctions_name_index", SCRIPT)
assert SPEC and SPEC.loader
INDEX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INDEX)


class FakeResponse(io.BytesIO):
    status = 200
    headers = {"Content-Type": "application/xml"}

    def __init__(self, url: str, body: bytes):
        super().__init__(body)
        self.url = url

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()

    def geturl(self) -> str:
        return self.url


def source() -> dict[str, object]:
    return {
        "id": "eu_test",
        "authority": "European Union",
        "list_name": "EU test list",
        "url": "https://example.test/eu.xml?token=redacted",
        "format": "eu_xml",
        "min_bytes": 0,
    }


def test_download_retries_a_temporary_server_error(monkeypatch):
    attempts = 0

    def flaky_urlopen(request, timeout):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise urllib.error.HTTPError(request.full_url, 500, "Internal Server Error", {}, None)
        return FakeResponse(request.full_url, b"<root />")

    monkeypatch.setattr(INDEX, "urlopen", flaky_urlopen)
    path, meta = INDEX.download(source(), timeout=1, max_bytes=1024, retries=2, retry_delay_seconds=0)
    try:
        assert attempts == 2
        assert path.read_bytes() == b"<root />"
        assert meta["size_bytes"] == 8
    finally:
        path.unlink(missing_ok=True)


def test_download_reports_source_after_retryable_errors_are_exhausted(monkeypatch):
    attempts = 0

    def unavailable_urlopen(request, timeout):
        nonlocal attempts
        attempts += 1
        raise urllib.error.HTTPError(request.full_url, 500, "Internal Server Error", {}, None)

    monkeypatch.setattr(INDEX, "urlopen", unavailable_urlopen)

    with pytest.raises(INDEX.SourceError, match=r"source eu_test .* after 3 attempts.*HTTP 500"):
        INDEX.download(source(), timeout=1, max_bytes=1024, retries=3, retry_delay_seconds=0)

    assert attempts == 3
