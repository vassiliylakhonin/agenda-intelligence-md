import json  # noqa: F401
import subprocess
import sys
from pathlib import Path

import agenda_intelligence

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
CLI = ROOT.parent / "src" / "agenda_intelligence" / "cli.py"


def run_cli(args):
    result = subprocess.run([sys.executable, str(CLI)] + args, capture_output=True, text=True)
    return result


def test_version_flag():
    res = run_cli(["--version"])
    assert res.returncode == 0
    assert res.stdout.strip() == f"agenda-intelligence {agenda_intelligence.__version__}"


def test_mcp_config_prints_stdio_server_config():
    res = run_cli(["mcp-config"])
    assert res.returncode == 0
    data = json.loads(res.stdout)
    assert data["mcpServers"]["agenda-intelligence"]["command"] == "agenda-intelligence-mcp"
    assert "type" not in data["mcpServers"]["agenda-intelligence"]


def test_mcp_config_prints_claude_desktop_config():
    res = run_cli(["mcp-config", "--client", "claude-desktop"])
    assert res.returncode == 0
    data = json.loads(res.stdout)
    server = data["mcpServers"]["agenda-intelligence"]
    assert server["type"] == "stdio"
    assert server["command"] == "agenda-intelligence-mcp"
    assert server["args"] == []
    assert server["env"] == {}


def test_mcp_config_prints_cursor_config():
    res = run_cli(["mcp-config", "--client", "cursor"])
    assert res.returncode == 0
    data = json.loads(res.stdout)
    server = data["mcpServers"]["agenda-intelligence"]
    assert server["type"] == "stdio"
    assert server["command"] == "agenda-intelligence-mcp"


def test_mcp_config_prints_codex_toml_config():
    res = run_cli(["mcp-config", "--client", "codex"])
    assert res.returncode == 0
    assert "[mcp_servers.agenda-intelligence]" in res.stdout
    assert 'command = "agenda-intelligence-mcp"' in res.stdout
    assert "enabled = true" in res.stdout


def test_doctor_json_reports_checks():
    res = run_cli(["doctor", "--json", "--mcp-command", f"{sys.executable} -m agenda_intelligence.mcp_stdio"])
    assert res.returncode == 0
    data = json.loads(res.stdout)
    assert data["version"] == agenda_intelligence.__version__
    assert {check["name"] for check in data["checks"]} >= {
        "package version",
        "packaged manifest",
        "mcp-config generic",
        "mcp-config codex",
        "mcp command",
        "mcp tools/list",
    }


def test_doctor_human_output_includes_checklist():
    res = run_cli(["doctor", "--mcp-command", f"{sys.executable} -m agenda_intelligence.mcp_stdio"])
    assert res.returncode == 0
    assert "Agenda Intelligence doctor:" in res.stdout
    assert "package version" in res.stdout
    assert "mcp tools/list" in res.stdout


def test_validate_brief_valid():
    path = FIXTURES / "valid-agenda-brief.json"
    res = run_cli(["validate-brief", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_validate_brief_accepts_signal_markers(tmp_path):
    data = json.loads((FIXTURES / "valid-agenda-brief.json").read_text())
    data["signal_classification"] = "signal"
    data["signal_markers"] = ["compliance_relevant_development", "enforcement_marker"]
    path = tmp_path / "brief-with-markers.json"
    path.write_text(json.dumps(data))

    res = run_cli(["validate-brief", str(path)])

    assert res.returncode == 0
    assert "OK" in res.stdout


def test_validate_brief_rejects_unknown_signal_marker(tmp_path):
    data = json.loads((FIXTURES / "valid-agenda-brief.json").read_text())
    data["signal_markers"] = ["reputational_risk_development"]
    path = tmp_path / "brief-with-invalid-marker.json"
    path.write_text(json.dumps(data))

    res = run_cli(["validate-brief", str(path)])

    assert res.returncode != 0
    assert "ERROR" in res.stderr


def test_validate_brief_invalid(tmp_path):
    p = FIXTURES / "invalid-agenda-brief.json"
    res = run_cli(["validate-brief", str(p)])
    assert res.returncode != 0
    assert "ERROR" in res.stderr


def test_validate_evidence_valid():
    path = FIXTURES / "valid-evidence-pack.json"
    res = run_cli(["validate-evidence", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_validate_evidence_invalid(tmp_path):
    p = FIXTURES / "invalid-evidence-pack.json"
    res = run_cli(["validate-evidence", str(p)])
    assert res.returncode != 0
    assert "ERROR" in res.stderr


def test_validate_manifest_valid():
    res = run_cli(["validate-manifest"])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_score_json_brief():
    path = FIXTURES / "valid-agenda-brief.json"
    res = run_cli(["score", str(path)])
    assert res.returncode == 0
    assert "score:" in res.stdout
    assert "evidence_support:" in res.stdout


def test_score_json_brief_with_evidence_pack():
    path = FIXTURES / "valid-agenda-brief.json"
    evidence_path = FIXTURES / "valid-evidence-pack.json"
    res = run_cli(["score", str(path), "--evidence", str(evidence_path)])
    assert res.returncode == 0
    assert "claims supported:" in res.stdout


def test_score_rejects_evidence_for_markdown():
    path = ROOT.parent / "examples" / "before-after" / "eu-ai-act.md"
    evidence_path = FIXTURES / "valid-evidence-pack.json"
    res = run_cli(["score", str(path), "--evidence", str(evidence_path)])
    assert res.returncode != 0
    assert "--evidence can only be used" in res.stderr


def test_score_rejects_non_before_after_markdown():
    path = ROOT.parent / "examples" / "compact-brief.md"
    res = run_cli(["score", str(path)])
    assert res.returncode != 0
    assert "Not a before/after example" in res.stderr


# ---------------------------------------------------------------------------
# Adversarial fixtures — document threat-model gaps in pytest.
#
# Each fixture below is well-formed against the schema but contains content
# that a downstream reader should not trust. The validators correctly pass
# these inputs because structural validation does not assess content quality;
# the tests assert this behavior so the gap is visible and any future change
# (e.g., adding detection) will require updating the test alongside the code.
#
# See docs/threat-model.md for the full mapping. Each test cites the gap
# class it documents.
# ---------------------------------------------------------------------------


def test_adversarial_prompt_injection_in_watch_next_passes_structural_validation():
    """Documents threat-model gap #7: prompt-injection inside processed
    content is not detected by structural validation. The brief is
    well-formed; the injection lives inside a watch_next item."""
    path = FIXTURES / "adversarial-prompt-injection-in-watch-next.json"
    res = run_cli(["validate-brief", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_adversarial_score_gaming_empty_fields_passes_structural_validation():
    """Documents threat-model gaps #5 (score gaming via stripped /
    semantically-empty content) and #2 (semantic provenance correctness):
    required fields are present at the minimum length the schema demands
    but carry no analytical content. validate-brief passes; score returns
    a number; neither catches the emptiness."""
    path = FIXTURES / "adversarial-score-gaming-empty-fields.json"
    res = run_cli(["validate-brief", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout
    res_score = run_cli(["score", str(path)])
    assert res_score.returncode == 0
    assert "score:" in res_score.stdout


def test_adversarial_injection_in_evidence_source_passes_structural_validation():
    """Documents threat-model gap #7: prompt-injection inside an
    evidence pack's `sources[].supports[]` string is not detected.
    The pack validates; the injection text travels with the source."""
    path = FIXTURES / "adversarial-injection-in-evidence-source.json"
    res = run_cli(["validate-evidence", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout
