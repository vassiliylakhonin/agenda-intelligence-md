"""Tests for deterministic repository-verification evidence."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "verify_repository.py"
SPEC = importlib.util.spec_from_file_location("verify_repository", SCRIPT)
assert SPEC and SPEC.loader
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)


def test_contract_manifest_is_deterministic_and_uses_relative_paths():
    first = VERIFY.build_contract_manifest()
    second = VERIFY.build_contract_manifest()

    assert first == second
    assert len(first["digest"]) == 64
    assert all(not Path(item["path"]).is_absolute() for item in first["files"])


def test_report_excludes_volatile_and_commercial_claims():
    checks = [{"id": "example", "command": ["true"], "exitCode": 0, "status": "passed"}]
    report = VERIFY.build_report(checks, {"algorithm": "sha256", "digest": "0" * 64, "files": []})

    assert report["result"] == "passed"
    assert report["executionBoundary"] == {"networkRequired": False, "paidApiCalls": 0}
    assert report["claimBoundary"]["level"] == "INTERNAL_TECHNICAL_ONLY"
    assert "generatedAt" not in report
    assert "duration" not in str(report)


def test_failed_check_fails_report():
    checks = [{"id": "example", "command": ["false"], "exitCode": 1, "status": "failed"}]

    assert VERIFY.build_report(checks, {})["result"] == "failed"
