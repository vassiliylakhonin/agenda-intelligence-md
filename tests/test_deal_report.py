"""Contract tests for the deal-risk report renderer (agenda_intelligence.reporting).

Markdown and HTML render with no third-party dependencies and are exercised on
every golden Middle Corridor response. PDF rendering is guarded by the optional
``pdf`` extra (fpdf2): skipped when not installed, asserted to emit a real PDF
when it is.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agenda_intelligence import reporting

CONTRACT_DIR = Path(__file__).resolve().parents[1] / "examples" / "kazakhstan-middle-corridor" / "contract"
GOLDEN = sorted(CONTRACT_DIR.glob("*.response.json"))


def _load(name: str) -> dict:
    return json.loads((CONTRACT_DIR / name).read_text())


def test_golden_responses_present():
    assert GOLDEN, "expected at least one golden Middle Corridor response fixture"


@pytest.mark.parametrize("path", GOLDEN, ids=lambda p: p.name)
def test_markdown_and_html_render_every_golden(path):
    response = json.loads(path.read_text())
    md = reporting.render_markdown(response)
    html = reporting.render_html(response)
    # Markdown: branded header, the read, score, and the disclaimer ride along.
    assert "Deal Risk Gate" in md
    assert "## Read —" in md
    assert f"{response['decision_readiness_score']}/100" in md
    assert response["not_advice_notice"] in md
    assert "Human review required" in md
    # HTML: well-formed document carrying the same disclaimer + the brand mark.
    assert html.startswith("<!doctype html")
    assert html.count("<body") == 1 and "</html>" in html
    assert "Human review is required" in html
    assert 'stroke="#0f766e"' in html  # gate mark


def test_escalate_response_drives_red_verdict():
    response = _load("pre_signature_escalate.response.json")
    md = reporting.render_markdown(response)
    html = reporting.render_html(response)
    assert "## Read — ESCALATE" in md
    assert "No beneficial ownership source supplied." in md  # a real gap surfaces
    assert "#b91c1c" in html  # escalate = red, brand verdict system


def test_ready_response_drives_green_verdict():
    response = _load("ready_for_human_review.response.json")
    html = reporting.render_html(response)
    assert "PROCEED" in reporting.render_markdown(response)
    assert "#15803d" in html  # proceed = green


def test_operational_decision_is_preferred_when_present():
    response = _load("pre_signature_escalate.response.json")
    response["operational_decision"] = {
        "decision": "proceed_with_conditions",
        "applies_to": "quote / sign the booking",
        "rationale": "Close the two open gaps and assign an owner first.",
    }
    md = reporting.render_markdown(response)
    assert "PROCEED WITH CONDITIONS" in md
    assert "Close the two open gaps" in md


def test_service_result_wrapper_is_unwrapped():
    inner = _load("pre_signature_escalate.response.json")
    wrapped = {"valid": True, "response": inner}
    assert inner["route"] in reporting.render_markdown(wrapped)


def test_render_report_dispatch_and_unknown_format():
    response = _load("pre_signature_escalate.response.json")
    before = json.loads(json.dumps(response))
    assert reporting.render_report(response, "md") == reporting.render_markdown(response)
    assert reporting.render_report(response, "html") == reporting.render_html(response)
    assert response == before
    with pytest.raises(ValueError):
        reporting.render_report(response, "docx")


def test_render_report_guard_rejects_structured_response_mutation(monkeypatch):
    response = _load("pre_signature_escalate.response.json")

    def mutating_renderer(payload):
        payload["decision_readiness_score"] = 100
        return "changed"

    monkeypatch.setattr(reporting, "render_markdown", mutating_renderer)

    with pytest.raises(RuntimeError, match="mutated structured response fields"):
        reporting.render_report(response, "md")


def test_pdf_renders_when_extra_installed():
    pytest.importorskip("fpdf", reason="optional 'pdf' extra (fpdf2) not installed")
    response = _load("pre_signature_escalate.response.json")
    pdf = reporting.render_report(response, "pdf")
    assert isinstance(pdf, (bytes, bytearray))
    assert bytes(pdf).startswith(b"%PDF")
    assert len(pdf) > 1000
