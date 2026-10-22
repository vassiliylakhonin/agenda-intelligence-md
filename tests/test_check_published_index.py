"""Tests for the public sanctions-index watchdog."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

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
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout, **kwargs: (json.loads(payload), payload))
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
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout, **kwargs: (published, payload))
    monkeypatch.setattr(sys, "argv", ["check_published_index.py", "--published", "https://example.test/index.json"])

    assert CHECK.main() == 1
    stderr = capsys.readouterr().err
    assert "name_count 100" in stderr
    assert "source_count is 3" in stderr


def test_exact_published_bytes_can_be_required(monkeypatch):
    payload = json.dumps(healthy_index(), separators=(",", ":")).encode()
    digest = hashlib.sha256(payload).hexdigest()
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout, **kwargs: (json.loads(payload), payload))
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
    monkeypatch.setattr(CHECK, "fetch", lambda _url, _timeout, **kwargs: (json.loads(payload), payload))
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


@pytest.fixture
def public_index_server():
    state = {"status": 200, "requests": [], "payload": json.dumps(healthy_index()).encode()}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            state["requests"].append(dict(self.headers))
            self.send_response(state["status"])
            if state["status"] == 302:
                self.send_header("Location", "/redirected-index.json")
            self.end_headers()
            self.wfile.write(state["payload"])

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/index.json", state
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_default_urllib_gate_preserves_identity_and_verifies_exact_bytes(monkeypatch, public_index_server):
    url, state = public_index_server
    digest = hashlib.sha256(state["payload"]).hexdigest()
    monkeypatch.setattr(
        sys, "argv", ["check_published_index.py", "--published", url, "--default-urllib", "--expected-sha256", digest]
    )
    assert CHECK.main() == 0
    assert len(state["requests"]) == 1
    request = state["requests"][0]
    assert request["User-Agent"].startswith("Python-urllib/")
    assert request["X-Client-Id"] == "agenda-owner-sanctions-index-watchdog"


@pytest.mark.parametrize("status", [401, 403])
def test_default_urllib_access_refusal_is_terminal_without_identity_fallback(monkeypatch, public_index_server, status):
    url, state = public_index_server
    state["status"] = status
    monkeypatch.setattr(sys, "argv", ["check_published_index.py", "--published", url, "--default-urllib"])
    assert CHECK.main() == 2
    assert len(state["requests"]) == 1
    assert state["requests"][0]["User-Agent"].startswith("Python-urllib/")


def test_default_urllib_does_not_follow_redirects(monkeypatch, public_index_server):
    url, state = public_index_server
    state["status"] = 302
    monkeypatch.setattr(sys, "argv", ["check_published_index.py", "--published", url, "--default-urllib"])
    assert CHECK.main() == 1
    assert len(state["requests"]) == 1
