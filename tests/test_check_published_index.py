"""Tests for the public sanctions-index watchdog."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check_published_index.py"
SPEC = importlib.util.spec_from_file_location("check_published_index", SCRIPT)
assert SPEC and SPEC.loader
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


def healthy_index() -> dict[str, object]:
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "summary": {"source_count": 4, "name_count": 84_000},
    }


def test_fresh_published_index_can_be_checked_without_a_rebuild(monkeypatch):
    payload = json.dumps(healthy_index()).encode()
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout: (json.loads(payload), payload))
    monkeypatch.setattr(
        sys,
        "argv",
        ["check_published_index.py", "--published", "https://example.test/index.json", "--max-age-days", "7"],
    )

    assert CHECK.main() == 0


def test_published_index_shape_is_checked_without_a_rebuild(monkeypatch, capsys):
    published = healthy_index()
    published["summary"] = {"source_count": 3, "name_count": 100}
    payload = json.dumps(published).encode()
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout: (published, payload))
    monkeypatch.setattr(sys, "argv", ["check_published_index.py", "--published", "https://example.test/index.json"])

    assert CHECK.main() == 1
    stderr = capsys.readouterr().err
    assert "name_count 100" in stderr
    assert "source_count is 3" in stderr


def test_exact_published_bytes_can_be_required(monkeypatch):
    payload = json.dumps(healthy_index(), separators=(",", ":")).encode()
    digest = hashlib.sha256(payload).hexdigest()
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout: (json.loads(payload), payload))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "check_published_index.py",
            "--published",
            "https://example.test/index.json",
            "--expected-sha256",
            digest,
        ],
    )

    assert CHECK.main() == 0


def test_exact_published_bytes_reject_a_different_artifact(monkeypatch, capsys):
    payload = json.dumps(healthy_index(), separators=(",", ":")).encode()
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout: (json.loads(payload), payload))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "check_published_index.py",
            "--published",
            "https://example.test/index.json",
            "--expected-sha256",
            "0" * 64,
        ],
    )

    assert CHECK.main() == 1
    assert "expected the just-built artifact" in capsys.readouterr().err
