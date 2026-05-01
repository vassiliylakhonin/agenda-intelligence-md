import json
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
