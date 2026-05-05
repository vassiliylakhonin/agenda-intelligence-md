import json  # noqa: F401
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
CLI = ROOT.parent / "src" / "agenda_intelligence" / "cli.py"


def run_cli(args):
    result = subprocess.run([sys.executable, str(CLI)] + args, capture_output=True, text=True)
    return result


def test_validate_brief_valid():
    path = FIXTURES / "valid-agenda-brief.json"
    res = run_cli(["validate-brief", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


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


def test_score_rejects_non_before_after_markdown():
    path = ROOT.parent / "examples" / "compact-brief.md"
    res = run_cli(["score", str(path)])
    assert res.returncode != 0
    assert "Not a before/after example" in res.stderr
