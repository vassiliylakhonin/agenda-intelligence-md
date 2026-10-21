"""Coverage and failure cases for offline rescoring of saved memo outputs."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from agenda_intelligence import memo_replay

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests/fixtures/memo_quality/manifest.json"


@pytest.fixture
def saved(tmp_path):
    run = tmp_path / "run"
    memo_replay.capture(FIXTURES, run, revision="capture-revision")
    return run


def rewrite(run, records, *, update_digest=True):
    raw = ("\n".join(json.dumps(row) if isinstance(row, dict) else row for row in records) + "\n").encode()
    (run / "raw.jsonl").write_bytes(raw)
    if update_digest:
        meta = json.loads((run / "meta.json").read_text())
        meta["raw_sha256"] = hashlib.sha256(raw).hexdigest()
        (run / "meta.json").write_text(json.dumps(meta))


def records(run):
    return [json.loads(line) for line in (run / "raw.jsonl").read_text().splitlines()]


def test_existing_corpus_can_be_captured_and_rescored_without_changing_raw(saved):
    before = {name: (saved / name).read_bytes() for name in ["raw.jsonl", "meta.json"]}
    result = memo_replay.rescore(saved, revision="new-scorer-revision")
    assert result["coverage_complete"] and result["all_expectations_met"]
    assert result["expectation_match_pct"] == 100
    assert result["scorer_revision"] == "new-scorer-revision"
    assert result["capture_provenance"]["model"] == "none"
    assert result["expected_records"] == len(json.loads(FIXTURES.read_text())["fixtures"])
    assert before == {name: (saved / name).read_bytes() for name in before}


def test_same_count_duplicate_cannot_mask_missing_sample(saved):
    rows = records(saved)
    rows[1] = rows[0]
    rewrite(saved, rows)
    result = memo_replay.rescore(saved, revision="test")
    assert result["observed_records"] == result["expected_records"]
    assert result["duplicates"] and result["missing"]
    assert not result["coverage_complete"]
    assert result["expectation_match_pct"] is None and result["all_expectations_met"] is None


@pytest.mark.parametrize("change", ["missing", "unexpected", "invalid_line", "bad_status", "bad_digest", "bool_sample"])
def test_incomplete_or_invalid_corpus_cannot_publish_score(saved, change):
    rows = records(saved)
    if change == "missing":
        rows.pop()
    elif change == "unexpected":
        rows[0]["case_id"] = "not-in-manifest"
    elif change == "invalid_line":
        rows[0] = "not JSON"
    elif change == "bad_status":
        rows[0]["status"] = []
    elif change == "bad_digest":
        rows[0]["raw_sha256"] = "wrong"
    else:
        rows[0]["sample_id"] = False
    rewrite(saved, rows)
    result = memo_replay.rescore(saved, revision="test")
    assert result["coverage_complete"] is False
    assert result["expectation_match_pct"] is None


def test_modified_artifact_is_reported_even_when_keys_are_complete(saved):
    rows = records(saved)
    rows.reverse()
    rewrite(saved, rows, update_digest=False)
    result = memo_replay.rescore(saved, revision="test")
    assert result["raw_integrity_ok"] is False
    assert result["expectation_match_pct"] is None


@pytest.mark.parametrize("status", ["truncated", "refused", "error"])
def test_technical_failures_count_as_failures_not_successful_rejections(saved, status):
    rows = records(saved)
    rows[0]["status"] = status
    rewrite(saved, rows)
    result = memo_replay.rescore(saved, revision="test")
    assert result["coverage_complete"] is True
    assert result["technical_failures"] == 1
    assert result["all_expectations_met"] is False
    assert result["expectation_match_pct"] < 100


def test_rescore_uses_current_checker_not_stored_verdict(saved, monkeypatch):
    monkeypatch.setattr(
        memo_replay, "check_memo_quality", lambda memo: {"schema_valid": True, "ok": False, "errors": ["new guardrail"]}
    )
    result = memo_replay.rescore(saved, revision="changed-policy")
    assert result["all_expectations_met"] is False
    assert all(row["quality_errors"] == ["new guardrail"] for row in result["cases"])


def test_capture_never_overwrites_an_existing_run(saved):
    original = (saved / "meta.json").read_bytes()
    with pytest.raises(FileExistsError):
        memo_replay.capture(FIXTURES, saved, revision="different")
    assert (saved / "meta.json").read_bytes() == original


def test_capture_rejects_duplicate_expected_keys_before_writing(tmp_path):
    case = {"case_id": "same", "sample_id": 0, "expected_schema_valid": True, "expected_quality_ok": True}
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {"cases": [case, case], "provenance": {"producer": "test", "model": "none", "prompt_revision": "none"}}
        )
    )
    with pytest.raises(ValueError, match="Duplicate"):
        memo_replay.capture(manifest, tmp_path / "run", revision="test")
    assert not (tmp_path / "run").exists()


def test_cli_returns_failure_with_null_score_for_incomplete_run(saved, tmp_path):
    rewrite(saved, records(saved)[:-1])
    output = tmp_path / "summary.json"
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/memo_replay.py"),
            "score",
            "--run-dir",
            str(saved),
            "--output",
            str(output),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert json.loads(output.read_text())["expectation_match_pct"] is None


@pytest.mark.parametrize("filename", ["raw.jsonl", "meta.json"])
def test_cli_cannot_overwrite_capture_with_its_summary(saved, filename):
    original = (saved / filename).read_bytes()
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/memo_replay.py"),
            "score",
            "--run-dir",
            str(saved),
            "--output",
            str(saved / filename),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 2
    assert (saved / filename).read_bytes() == original
