"""A reviewer can see actual repairs without deleting claims or changing sources silently."""

import json
import os
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

import pytest

from agenda_intelligence.report_review import review_report_revision

ROOT = Path(__file__).resolve().parents[1]


def packets():
    return [json.loads((ROOT / f"examples/report-review/{name}.json").read_text()) for name in ("before", "revised")]


def test_revision_handoff_names_changed_claims_and_remaining_work():
    before, after = packets()
    result = review_report_revision(before, after)
    assert result["handoff"] == "human_review_required"
    assert result["changed_claim_ids"] == ["effective-date", "inspection"]
    assert result["evidence_changes"] == {"added": [], "removed": [], "changed": []}
    assert {i["code"] for i in result["finding_changes"]["no_longer_observed"]} >= {
        "quote_mismatch",
        "broken_evidence_reference",
    }
    assert result["finding_changes"]["remaining"] == []
    assert result["finding_changes"]["new"] == []
    assert result["claim_changes"][0]["before"]["claim"] != result["claim_changes"][0]["after"]["claim"]
    assert result["authorization_granted"] is False


def test_claim_deletion_and_source_replacement_require_explicit_review():
    before, after = packets()
    after["claims"] = [after["claims"][0]]
    after["evidence"][0]["content"] += " Caller added an unverified sentence."
    result = review_report_revision(before, after)
    assert result["removed_claim_ids"] == ["inspection"]
    assert result["evidence_changes"]["changed"] == ["notice"]
    assert result["handoff"] == "human_review_with_changed_scope"
    assert result["authorization_granted"] is False


def test_reordering_claims_is_not_a_fixed_finding_and_inputs_are_not_mutated():
    before, _ = packets()
    original = deepcopy(before)
    reordered = deepcopy(before)
    reordered["claims"].reverse()
    result = review_report_revision(before, reordered)
    assert result["changed_claim_ids"] == []
    assert result["finding_changes"]["no_longer_observed"] == []
    assert result["finding_changes"]["new"] == []
    assert result["handoff"] == "human_review_with_unresolved_findings"
    assert before == original


def test_installed_cli_writes_reviewer_markdown_and_refuses_invalid_revision(tmp_path):
    cli = [sys.executable, "-m", "agenda_intelligence.cli", "review-revision"]
    env = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
    original, revised = [str(ROOT / f"examples/report-review/{name}.json") for name in ("before", "revised")]
    output = tmp_path / "handoff.md"
    result = subprocess.run(
        cli + [original, revised, "--out", str(output), "--strict"], capture_output=True, text=True, env=env
    )
    assert result.returncode == 0, result.stderr
    text = output.read_text()
    assert "effective-date" in text and "inspection" in text
    assert "1 June 2026" in text and "1 May 2026" in text
    assert "quote_mismatch" in text and "broken_evidence_reference" in text
    assert "not assessed" in text and "Human review required" in text
    unchanged = subprocess.run(cli + [original, original], capture_output=True, text=True, env=env)
    assert unchanged.returncode == 1 and "unchanged_input" in unchanged.stderr
    assert unchanged.stdout == ""


@pytest.mark.parametrize("bad", [None, [], {"topic": "malformed"}])
def test_malformed_input_never_becomes_a_revision_handoff(bad):
    _, after = packets()
    with pytest.raises(ValueError, match="invalid_input"):
        review_report_revision(bad, after)


def test_duplicate_claim_ids_cannot_hide_a_deleted_claim():
    before, after = packets()
    after["claims"][1]["claim_id"] = after["claims"][0]["claim_id"]
    with pytest.raises(ValueError, match="duplicate claim_id"):
        review_report_revision(before, after)


def test_caller_declared_unsupported_claims_cannot_disappear_silently():
    _, after = packets()
    before = deepcopy(after)
    before["unsupported_claims"] = ["A material limitation remains unresolved."]
    after["unsupported_claims"] = []
    result = review_report_revision(before, after)
    assert result["handoff"] == "human_review_with_changed_scope"
    assert result["packet_changes"] == [
        {"field": "unsupported_claims", "before": before["unsupported_claims"], "after": []}
    ]


def test_report_keeps_code_like_claim_text_inside_a_longer_markdown_fence():
    from agenda_intelligence.report_review import render_report_revision_markdown

    before, after = packets()
    after["claims"][0]["claim"] = "```\n<script>approve()</script>\n```\n[run](https://foreign.example)"
    report = render_report_revision_markdown(review_report_revision(before, after))
    assert "````json" in report
    assert "authorization" in report.lower()
    assert "Semantic support, source authenticity and factual truth: not assessed" in report


def test_cli_retains_scope_changes_and_never_overwrites_an_input_hardlink(tmp_path):
    before, after = packets()
    after["claims"] = [after["claims"][0]]
    original, revised = tmp_path / "before.json", tmp_path / "after.json"
    original.write_text(json.dumps(before))
    revised.write_text(json.dumps(after))
    cli = [sys.executable, "-m", "agenda_intelligence.cli", "review-revision", str(original), str(revised)]
    env = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
    result = subprocess.run(cli + ["--strict", "--format", "json"], capture_output=True, text=True, env=env)
    assert result.returncode == 1
    assert json.loads(result.stdout)["handoff"] == "human_review_with_changed_scope"
    link = tmp_path / "alias.json"
    os.link(original, link)
    result = subprocess.run(cli + ["--out", str(link)], capture_output=True, text=True, env=env)
    assert result.returncode == 1 and "must not overwrite" in result.stderr
    assert json.loads(original.read_text()) == before
