import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "src" / "agenda_intelligence" / "cli.py"

def run_cli(args):
    result = subprocess.run([sys.executable, str(CLI)] + args, capture_output=True, text=True)
    return result


def test_validate_brief_valid():
    path = ROOT / "examples" / "agenda-brief.json"
    res = run_cli(["validate-brief", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_validate_brief_invalid(tmp_path):
    # create a minimal invalid brief (missing required field)
    invalid = {"bottom_line": "test"}
    p = tmp_path / "invalid.json"
    p.write_text(json.dumps(invalid))
    res = run_cli(["validate-brief", str(p)])
    assert res.returncode != 0
    assert "ERROR" in res.stderr


def test_validate_evidence_valid():
    path = ROOT / "examples" / "source" / "evidence-pack.json"
    res = run_cli(["validate-evidence", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_validate_evidence_invalid(tmp_path):
    invalid = {"topic": "test", "evidence_mode": "live_source_backed", "claims": [], "unsupported_claims": []}
    p = tmp_path / "invalid_evidence.json"
    p.write_text(json.dumps(invalid))
    res = run_cli(["validate-evidence", str(p)])
    assert res.returncode != 0
    assert "ERROR" in res.stderr
