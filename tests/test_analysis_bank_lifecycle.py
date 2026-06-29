import json
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMORY_DIRS = [ROOT / "analysis-bank" / "successes", ROOT / "analysis-bank" / "failures"]
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


def section_body(markdown: str, heading: str) -> str:
    match = re.search(rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", markdown, flags=re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else ""


def lifecycle_fields(markdown: str) -> dict[str, str]:
    fields = {}
    for line in section_body(markdown, "Lifecycle").splitlines():
        if not line.startswith("- ") or ":" not in line:
            continue
        key, value = line[2:].split(":", 1)
        fields[key.strip()] = value.strip()
    return fields


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
