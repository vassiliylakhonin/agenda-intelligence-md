"""Contract tests for the agent-card readiness lint (AGENT_READINESS.md).

One golden card (signed, boundary-declaring, payment-free) and one failure
card (unsigned, payment surface without limits) per the repo change
discipline. The JSON report must validate against
schemas/v1/agent-readiness-report.schema.json.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from jsonschema import validate

from agenda_intelligence.agent_readiness import evaluate_agent_card, format_report_text

ROOT = Path(__file__).resolve().parents[1]
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
GOLDEN_CARD = ROOT / "tests" / "fixtures" / "agent_readiness" / "golden" / "signed-card.json"
FAILURE_CARD = ROOT / "tests" / "fixtures" / "agent_readiness" / "failure" / "unsigned-payment-card.json"
REPORT_SCHEMA = ROOT / "schemas" / "v1" / "agent-readiness-report.schema.json"


def run(*args: str, expect_zero: bool = True) -> subprocess.CompletedProcess[str]:
    res = subprocess.run(CLI + list(args), capture_output=True, text=True, cwd=ROOT, env=ENV)
    if expect_zero:
        assert res.returncode == 0, f"cmd failed ({res.returncode}): {res.stderr}\n{res.stdout}"
    return res


def _statuses(checks: list[dict]) -> dict[str, str]:
    return {check["id"]: check["status"] for check in checks}


def test_golden_card_report_validates_and_is_clean():
    card = json.loads(GOLDEN_CARD.read_text())
    report = evaluate_agent_card(card)
    validate(report, json.loads(REPORT_SCHEMA.read_text()))

    preflight = _statuses(report["preflight"])
    assert preflight["valid_card_shape"] == "pass"
    assert preflight["protocol_version_string"] == "pass"
    assert preflight["jws_signature_present"] == "pass"
    assert preflight["skills_declared"] == "pass"
    assert preflight["provider_attribution"] == "pass"
    assert preflight["business_identity_declared"] == "pass"
    assert preflight["live_jsonrpc"] == "skipped"
    assert preflight["uptime_track"] == "skipped"
    assert preflight["freshness"] == "skipped"

    readiness = _statuses(report["readiness"])
    assert readiness["identity_attribution"] == "covered"
    assert readiness["capability_scope"] == "covered"
    assert readiness["interface_contract"] == "covered"
    assert readiness["security_declaration"] == "covered"
    assert readiness["autonomy_boundary"] == "covered"
    assert readiness["payment_permissions"] == "not_applicable"
    assert readiness["operator_contact"] == "covered"

    assert report["summary"]["strict_ok"] is True
    assert "Not a security audit" in report["note"]


def test_failure_card_reports_gaps():
    card = json.loads(FAILURE_CARD.read_text())
    report = evaluate_agent_card(card)
    validate(report, json.loads(REPORT_SCHEMA.read_text()))

    preflight = _statuses(report["preflight"])
    assert preflight["protocol_version_string"] == "gap"
    assert preflight["jws_signature_present"] == "gap"
    assert preflight["provider_attribution"] == "gap"
    assert preflight["business_identity_declared"] == "gap"

    readiness = _statuses(report["readiness"])
    assert readiness["identity_attribution"] == "gap"
    assert readiness["capability_scope"] == "gap"
    assert readiness["security_declaration"] == "gap"
    assert readiness["autonomy_boundary"] == "gap"
    assert readiness["payment_permissions"] == "gap"
    assert readiness["operator_contact"] == "gap"

    assert report["summary"]["strict_ok"] is False


def test_compact_detached_jws_signature_is_accepted():
    card = json.loads(FAILURE_CARD.read_text())
    card["signature"] = "eyJhbGciOiJFUzI1NiJ9..c2lnbmF0dXJl"
    report = evaluate_agent_card(card)
    jws = next(check for check in report["preflight"] if check["id"] == "jws_signature_present")
    assert jws["status"] == "pass"
    assert "compact" in jws["detail"]


def test_payment_surface_with_limits_is_covered():
    card = json.loads(FAILURE_CARD.read_text())
    card["payments"] = {"x402Wallet": "0xabc123", "perCallLimit": "1.00 USDC", "scope": "demo-only"}
    report = evaluate_agent_card(card)
    assert _statuses(report["readiness"])["payment_permissions"] == "covered"


def test_text_output_format():
    report = evaluate_agent_card(json.loads(GOLDEN_CARD.read_text()))
    text = format_report_text(report)
    assert text.startswith("agent card readiness: Example Evidence-Readiness Agent")
    assert "registry conformance preflight (static subset):" in text
    assert "delegation readiness:" in text
    assert "summary: preflight 6 pass / 0 gap / 3 skipped" in text


def test_cli_golden_text_and_json():
    res = run("validate-agent-card", str(GOLDEN_CARD))
    assert "agent card readiness: Example Evidence-Readiness Agent" in res.stdout

    res = run("validate-agent-card", str(GOLDEN_CARD), "--format", "json", "--strict")
    payload = json.loads(res.stdout)
    assert payload["summary"]["strict_ok"] is True


def test_cli_failure_strict_exits_nonzero():
    # Without --strict: gaps are reported, exit 0.
    run("validate-agent-card", str(FAILURE_CARD))
    # With --strict: exit 1.
    res = run("validate-agent-card", str(FAILURE_CARD), "--strict", expect_zero=False)
    assert res.returncode == 1
