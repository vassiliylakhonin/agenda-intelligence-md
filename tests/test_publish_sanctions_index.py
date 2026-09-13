"""Tests for the guarded manual sanctions-index publisher."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "publish_sanctions_index.py"
SPEC = importlib.util.spec_from_file_location("publish_sanctions_index", SCRIPT)
assert SPEC and SPEC.loader
PUBLISH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PUBLISH)


def completed(command: list[str], returncode: int = 0, stdout: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(command, returncode, stdout=stdout, stderr="")


def test_prepare_candidate_runs_build_shape_and_drift_gates_in_order(monkeypatch, tmp_path):
    compact = tmp_path / "compact.json"
    compact.write_bytes(b"candidate\n")
    commands: list[list[str]] = []

    def fake_run(command, **_kwargs):
        commands.append(list(command))
        return completed(list(command))

    monkeypatch.setattr(PUBLISH, "ROOT", tmp_path)
    monkeypatch.setattr(PUBLISH, "COMPACT_INDEX", compact)
    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    digest = PUBLISH.prepare_candidate()

    assert commands[0][1] == "scripts/sanctions_name_index.py"
    assert commands[1][1] == "scripts/verify_sanctions_index.py"
    assert commands[2][1] == "scripts/gate_sanctions_index_publish.py"
    assert digest == hashlib.sha256(b"candidate\n").hexdigest()


@pytest.mark.parametrize(
    ("branch", "dirty", "message"),
    [("feature", "", "expected 'main'"), ("main", " M scripts/example.py", "source changes are present")],
)
def test_publish_requires_a_clean_main_checkout(monkeypatch, branch, dirty, message):
    responses = iter([branch, dirty])

    def fake_run(command, **_kwargs):
        return completed(list(command), stdout=next(responses))

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    with pytest.raises(RuntimeError, match=message):
        PUBLISH.require_clean_main()


def test_publish_uses_pinned_wrangler_then_checks_exact_production_bytes(monkeypatch):
    commands: list[list[str]] = []

    def fake_run(command, **kwargs):
        command = list(command)
        commands.append(command)
        stdout = json.dumps({"accounts": [{"id": "test-account"}]}) if "whoami" in command else ""
        return completed(command, returncode=0, stdout=stdout)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH, "POST_DEPLOY_PAUSE_SECONDS", 0)

    PUBLISH.publish_candidate("a" * 64)

    assert commands[0] == ["npx", "--yes", "wrangler@4.122.0", "--version"]
    assert commands[1] == ["npx", "--yes", "wrangler@4.122.0", "whoami", "--json"]
    assert commands[2][0:5] == ["npx", "--yes", "wrangler@4.122.0", "pages", "deploy"]
    assert "--project-name=sanctions-name-index" in commands[2]
    assert "--expected-sha256" in commands[3]
    assert commands[3][-1] == "a" * 64


def test_publish_fails_when_canonical_url_never_serves_candidate(monkeypatch):
    calls = 0

    def fake_run(command, **kwargs):
        nonlocal calls
        calls += 1
        command = list(command)
        if "whoami" in command:
            return completed(command, stdout=json.dumps({"accounts": [{"id": "test-account"}]}))
        if any(item.endswith("check_published_index.py") for item in command):
            return completed(command, returncode=1)
        return completed(command)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH, "POST_DEPLOY_ATTEMPTS", 2)
    monkeypatch.setattr(PUBLISH, "POST_DEPLOY_PAUSE_SECONDS", 0)

    with pytest.raises(RuntimeError, match="never served the exact gated artifact"):
        PUBLISH.publish_candidate("b" * 64)

    assert calls == 5


def test_publish_rejects_ambiguous_wrangler_account(monkeypatch):
    def fake_run(command, **kwargs):
        command = list(command)
        stdout = json.dumps({"accounts": [{"id": "one"}, {"id": "two"}]}) if "whoami" in command else ""
        return completed(command, stdout=stdout)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    with pytest.raises(RuntimeError, match="exactly one Cloudflare account; found 2"):
        PUBLISH.verify_wrangler_auth()


def test_manual_publisher_uses_the_worker_fleets_pinned_wrangler_version():
    deploy_script = (ROOT / "deploy/cloudflare-worker/scripts/vizier-gated-deploy.js").read_text()

    assert f'const WRANGLER_VERSION = "{PUBLISH.WRANGLER_VERSION}"' in deploy_script
