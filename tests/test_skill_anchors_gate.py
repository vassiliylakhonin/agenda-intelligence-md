"""Tests for the structural skill-anchor gate.

The gate is the last step of every skill-improvement iteration: it catches
the predictable failure mode where an LLM-driven skill editor silently
removes discipline anchors that the rubric depends on. These tests pin the
contract so a future refactor doesn't loosen the rejection criteria.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GATE = REPO_ROOT / "evals" / "skill-improvement" / "tools" / "eval_gate.py"
ANCHORS = REPO_ROOT / "evals" / "skill-improvement" / "anchors" / "agenda-intelligence.json"
SKILL = REPO_ROOT / "skills" / "agenda-intelligence" / "SKILL.md"


def run_gate(skill_path: Path) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(GATE), "--anchors", str(ANCHORS), "--skill", str(skill_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    payload = json.loads(proc.stdout) if proc.stdout.strip() else {}
    return proc.returncode, payload


def test_anchors_config_is_well_formed():
    data = json.loads(ANCHORS.read_text())
    assert data["skill_path"] == "skills/agenda-intelligence/SKILL.md"
    assert isinstance(data["anchors"], list) and data["anchors"]
    for anchor in data["anchors"]:
        assert anchor["id"]
        assert anchor["severity"] in {"critical", "soft"}
        assert isinstance(anchor.get("rubric_dimensions"), list)
        assert anchor.get("any_of") or anchor.get("all_of")
        assert anchor.get("rationale")


def test_current_skill_passes_all_anchors():
    code, payload = run_gate(SKILL)
    assert code == 0, f"current SKILL.md must pass the gate; missing: {payload.get('critical_missing')}"
    assert payload["decision"] == "accept"
    assert payload["critical_missing_count"] == 0
    assert payload["anchors_present"] == payload["anchors_total"]


def test_stripping_boundary_anchor_triggers_rejection(tmp_path):
    """Removing all evidence-of-no-live-retrieval phrases must reject."""
    text = SKILL.read_text()
    for pattern in [
        r"Never imply live verification[^.]*\.",
        r"no live (source )?retrieval",
        r"live retrieval (is )?(unavailable|off|disabled)",
        r"if live retrieval is unavailable[^.]*\.",
    ]:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    broken = tmp_path / "SKILL.md"
    broken.write_text(text)

    code, payload = run_gate(broken)
    assert code == 1
    assert payload["decision"] == "reject"
    missing_ids = {m["id"] for m in payload["critical_missing"]}
    assert "no-implied-live-verification" in missing_ids


def test_stripping_signal_enum_value_triggers_rejection(tmp_path):
    """Removing 'trigger event' from the signal-classification enum must reject."""
    text = SKILL.read_text().replace("trigger event", "")
    broken = tmp_path / "SKILL.md"
    broken.write_text(text)

    code, payload = run_gate(broken)
    assert code == 1
    missing_ids = {m["id"] for m in payload["critical_missing"]}
    assert "signal-classification-enum" in missing_ids


def test_stripping_default_output_field_triggers_rejection(tmp_path):
    """Removing 'Watch next' from the default output template must reject."""
    text = SKILL.read_text().replace("Watch next", "Future signals")
    broken = tmp_path / "SKILL.md"
    broken.write_text(text)

    code, payload = run_gate(broken)
    assert code == 1
    missing_ids = {m["id"] for m in payload["critical_missing"]}
    assert "default-output-shape" in missing_ids or "watch-next-required" in missing_ids


def test_stripping_signal_markers_collapse_warning_triggers_rejection(tmp_path):
    """Removing 'Do not collapse' must reject — most common silent drift."""
    text = SKILL.read_text().replace("Do not collapse", "Sometimes mix")
    broken = tmp_path / "SKILL.md"
    broken.write_text(text)

    code, payload = run_gate(broken)
    assert code == 1
    missing_ids = {m["id"] for m in payload["critical_missing"]}
    assert "signal-markers-distinct-from-classification" in missing_ids


def test_quiet_mode_suppresses_output_on_accept(tmp_path):
    """--quiet must suppress stdout on accept (exit 0) but still print on reject."""
    proc = subprocess.run(
        [sys.executable, str(GATE), "--anchors", str(ANCHORS), "--skill", str(SKILL), "--quiet"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0
    assert proc.stdout.strip() == ""
