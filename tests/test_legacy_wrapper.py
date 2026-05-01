import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "agenda_intelligence.py"


def run_script(args):
    return subprocess.run([sys.executable, str(SCRIPT)] + args, capture_output=True, text=True)


def test_wrapper_help():
    res = run_script(["--help"])
    assert res.returncode == 0
    # should contain one of our sub‑commands in the help output
    assert "validate-brief" in res.stdout


def test_wrapper_validate_brief_valid():
    path = ROOT / "examples" / "agenda-brief.json"
    res = run_script(["validate-brief", str(path)])
    assert res.returncode == 0
    assert "OK" in res.stdout


def test_wrapper_validate_brief_invalid(tmp_path):
    # minimal invalid brief – missing required keys
    bad = {"bottom_line": "test"}
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    res = run_script(["validate-brief", str(p)])
    assert res.returncode != 0
    # error should be printed to stderr
    assert "ERROR" in res.stderr
