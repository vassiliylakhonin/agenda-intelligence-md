import json
import subprocess
import sys

CATEGORIES = ["energy", "cyber-threats", "esg", "supply-chain-resilience"]


def run_cli(category):
    result = subprocess.run(
        [sys.executable, "-m", "agenda_intelligence.cli", "source-plan", category],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"CLI returned {result.returncode}: {result.stderr}"
    return json.loads(result.stdout)


def test_source_plan():
    for cat in CATEGORIES:
        data = run_cli(cat)
        assert "must_check" in data, f"Missing must_check for {cat}"
        assert isinstance(data["must_check"], list), f"must_check not a list for {cat}"
        assert data["must_check"], f"must_check empty for {cat}"
        assert "watch_indicators" in data, f"Missing watch_indicators for {cat}"
        assert isinstance(data["watch_indicators"], list), f"watch_indicators not a list for {cat}"
        assert data["watch_indicators"], f"watch_indicators empty for {cat}"
