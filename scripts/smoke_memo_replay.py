"""Verify an installed wheel's memo replay module with private synthetic copies."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import agenda_intelligence
from agenda_intelligence.memo_generation import generation_schema

ROOT = Path(__file__).resolve().parents[1]


def call(directory: Path, expected: int, *args: str) -> dict:
    result = subprocess.run(
        [sys.executable, "-I", "-m", "agenda_intelligence.memo_replay", *args],
        cwd=directory,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == expected, result.stderr + result.stdout
    return json.loads(result.stdout)


def main() -> None:
    assert "site-packages" in Path(agenda_intelligence.__file__).resolve().parts, "Use an installed wheel"
    assert "machine_verified" not in generation_schema()["properties"]["audit"]["properties"]
    manifest = ROOT / "tests/fixtures/memo_quality/manifest.json"
    expected = len(json.loads(manifest.read_text())["fixtures"])
    with tempfile.TemporaryDirectory(prefix="agenda-memo-replay-smoke-") as directory:
        path = Path(directory)
        run = path / "run"
        captured = call(path, 0, "capture", "--manifest", str(manifest), "--run-dir", str(run))
        assert captured == {"captured_records": expected, "model_invoked": False}
        summary = path / "summary.json"
        full = call(path, 0, "score", "--run-dir", str(run), "--output", str(summary))
        assert full["coverage_complete"] and full["all_expectations_met"]
        report = json.loads(summary.read_text())
        assert report["expected_records"] == report["observed_records"] == expected
        assert report["scorer_revision"].startswith(f"package:{agenda_intelligence.__version__};scorer_sha256:")
        raw = run / "raw.jsonl"
        raw.write_text("\n".join(raw.read_text().splitlines()[:-1]) + "\n")
        meta_path = run / "meta.json"
        meta = json.loads(meta_path.read_text())
        meta["raw_sha256"] = hashlib.sha256(raw.read_bytes()).hexdigest()
        meta_path.write_text(json.dumps(meta))
        partial = call(path, 1, "score", "--run-dir", str(run), "--output", str(summary))
        assert not partial["coverage_complete"]
        assert partial["expectation_match_pct"] is partial["all_expectations_met"] is None
        assert json.loads(summary.read_text())["missing"]
    print(f"Installed memo replay passed: {expected} synthetic cases and incomplete-coverage refusal; no model calls.")


if __name__ == "__main__":
    main()
