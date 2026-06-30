import json
import os
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

from agenda_intelligence.analysis_bank import (
    lifecycle_fields,
    lint_analysis_bank,
    search_memory_cards,
)

ROOT = Path(__file__).resolve().parents[1]
MEMORY_DIRS = [ROOT / "analysis-bank" / "successes", ROOT / "analysis-bank" / "failures"]
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
REQUIRED_SECTIONS = [
    "Lifecycle",
    "Trigger",
    "Pattern",
    "Better reasoning",
    "Apply when",
    "Do not apply when",
    "Watch indicators",
    "Example rewrite",
]


def test_analysis_bank_memory_index_tracks_lifecycle_fields():
    index = json.loads((ROOT / "analysis-bank" / "memory_index.json").read_text(encoding="utf-8"))

    assert index["version"] == "2.0.0"
    assert index["lesson_lifecycle"]["active_statuses"] == ["active"]
    assert index["lesson_lifecycle"]["stale_statuses"] == ["stale", "superseded", "rejected"]


def test_analysis_bank_memory_index_matches_cards():
    index = json.loads((ROOT / "analysis-bank" / "memory_index.json").read_text(encoding="utf-8"))
    entries = {entry["file"]: entry for entry in index["entries"]}
    cards = [path for directory in MEMORY_DIRS for path in sorted(directory.glob("*.md"))]
    card_files = {str(path.relative_to(ROOT / "analysis-bank")) for path in cards}

    assert set(entries) == card_files
    for path in cards:
        relative = str(path.relative_to(ROOT / "analysis-bank"))
        fields = lifecycle_fields(path.read_text(encoding="utf-8"))
        entry = entries[relative]

        assert entry["lesson_id"] == fields["lesson_id"]
        assert entry["status"] == fields["status"]
        assert entry["last_validated_at"] == fields["last_validated_at"]
        assert entry["stale_after_days"] == int(fields["stale_after_days"])


def test_all_analysis_bank_cards_have_lifecycle_metadata():
    cards = [path for directory in MEMORY_DIRS for path in sorted(directory.glob("*.md"))]
    assert cards

    for path in cards:
        markdown = path.read_text(encoding="utf-8")
        for section in REQUIRED_SECTIONS:
            assert f"## {section}\n" in markdown, f"{path.relative_to(ROOT)} missing section {section}"

        fields = lifecycle_fields(markdown)
        for key in [
            "lesson_id",
            "version",
            "status",
            "created_at",
            "last_validated_at",
            "stale_after_days",
            "supersedes",
            "confidence",
            "evidence_basis",
        ]:
            assert fields.get(key), f"{path.relative_to(ROOT)} missing lifecycle field {key}"

        assert fields["status"] in {"active", "stale", "superseded", "rejected"}
        assert fields["confidence"] in {"high", "medium", "low"}

        last_validated = date.fromisoformat(fields["last_validated_at"])
        stale_after = int(fields["stale_after_days"])
        if fields["status"] == "active":
            assert (
                last_validated + timedelta(days=stale_after) >= date.today()
            ), f"{path.relative_to(ROOT)} is active but stale by lifecycle metadata"


def test_analysis_bank_linter_passes_on_current_bank():
    result = lint_analysis_bank(
        ROOT / "analysis-bank",
        schema_path=ROOT / "schemas" / "v1" / "memory-card.schema.json",
        today=date(2026, 6, 30),
    )

    assert result.ok, result.to_dict()
    assert result.to_dict()["summary"]["active_cards"] == 4


def test_analysis_bank_linter_rejects_stale_active_card(tmp_path: Path):
    bank = tmp_path / "analysis-bank"
    (bank / "successes").mkdir(parents=True)
    (bank / "failures").mkdir()
    (bank / "memory_index.json").write_text(
        (ROOT / "analysis-bank" / "memory_index.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    stale_card = (ROOT / "analysis-bank" / "failures" / "vague-monitoring.md").read_text(encoding="utf-8")
    stale_card = stale_card.replace("last_validated_at: 2026-06-30", "last_validated_at: 2024-01-01")
    (bank / "failures" / "vague-monitoring.md").write_text(stale_card, encoding="utf-8")

    result = lint_analysis_bank(
        bank,
        schema_path=ROOT / "schemas" / "v1" / "memory-card.schema.json",
        today=date(2026, 6, 30),
    )

    assert not result.ok
    assert any("active lesson is stale" in error for error in result.errors)


def test_memory_search_returns_only_usable_lessons_by_default(tmp_path: Path):
    bank = tmp_path / "analysis-bank"
    (bank / "successes").mkdir(parents=True)
    (bank / "failures").mkdir()
    stale_card = (ROOT / "analysis-bank" / "failures" / "vague-monitoring.md").read_text(encoding="utf-8")
    stale_card = stale_card.replace("status: active", "status: stale")
    (bank / "failures" / "vague-monitoring.md").write_text(stale_card, encoding="utf-8")

    assert search_memory_cards(bank, "monitoring", today=date(2026, 6, 30)) == []
    assert (
        search_memory_cards(bank, "monitoring", include_inactive=True, today=date(2026, 6, 30))[0]["status"] == "stale"
    )


def test_memory_lint_cli_json_smoke():
    res = subprocess.run(
        CLI + ["memory-lint", str(ROOT / "analysis-bank"), "--format", "json"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=ENV,
    )

    assert res.returncode == 0, f"{res.stderr}\n{res.stdout}"
    payload = json.loads(res.stdout)
    assert payload["ok"] is True
    assert payload["summary"]["cards"] == 4


def test_memory_search_cli_uses_packaged_analysis_bank():
    res = subprocess.run(
        CLI + ["memory-search", "sanctions"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=ENV,
    )

    assert res.returncode == 0, f"{res.stderr}\n{res.stdout}"
    payload = json.loads(res.stdout)
    assert any(item["lesson_id"] == "overconfident-sanctions-upgrade" for item in payload)
