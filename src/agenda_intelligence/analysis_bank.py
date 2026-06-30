from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

ACTIVE_STATUSES = ["active"]
STALE_STATUSES = ["stale", "superseded", "rejected"]
VALID_STATUSES = set(ACTIVE_STATUSES + STALE_STATUSES)
VALID_CONFIDENCE = {"high", "medium", "low"}
REQUIRED_LIFECYCLE_FIELDS = [
    "lesson_id",
    "version",
    "status",
    "created_at",
    "last_validated_at",
    "stale_after_days",
    "supersedes",
    "confidence",
    "evidence_basis",
]
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
CARD_DIRECTORIES = ("successes", "failures")

_LESSON_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


@dataclass
class AnalysisBankLintResult:
    errors: list[str]
    warnings: list[str]
    cards: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": {
                "cards": len(self.cards),
                "active_cards": sum(1 for card in self.cards if card.get("status") == "active"),
                "inactive_cards": sum(1 for card in self.cards if card.get("status") != "active"),
            },
            "cards": self.cards,
        }


def section_body(markdown: str, heading: str) -> str:
    match = re.search(rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", markdown, flags=re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else ""


def lifecycle_fields(markdown: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in section_body(markdown, "Lifecycle").splitlines():
        if not line.startswith("- ") or ":" not in line:
            continue
        key, value = line[2:].split(":", 1)
        fields[key.strip()] = value.strip()
    return fields


def discover_memory_cards(bank_path: Path) -> list[Path]:
    cards: list[Path] = []
    for directory in CARD_DIRECTORIES:
        cards.extend(sorted((bank_path / directory).glob("*.md")))
    return cards


def load_memory_index(bank_path: Path) -> dict[str, Any]:
    return json.loads((bank_path / "memory_index.json").read_text(encoding="utf-8"))


def parse_memory_card(path: Path, bank_path: Path) -> dict[str, Any]:
    markdown = path.read_text(encoding="utf-8")
    fields = lifecycle_fields(markdown)
    title = _parse_title(markdown)
    return {
        "file": str(path.relative_to(bank_path)),
        "lesson_id": fields.get("lesson_id", ""),
        "version": _parse_int(fields.get("version", "")),
        "status": fields.get("status", ""),
        "created_at": fields.get("created_at", ""),
        "last_validated_at": fields.get("last_validated_at", ""),
        "stale_after_days": _parse_int(fields.get("stale_after_days", "")),
        "supersedes": _normalise_supersedes(fields.get("supersedes", "")),
        "confidence": fields.get("confidence", ""),
        "evidence_basis": fields.get("evidence_basis", ""),
        "title": title,
        "trigger": section_body(markdown, "Trigger"),
        "pattern": section_body(markdown, "Pattern"),
        "better_reasoning": section_body(markdown, "Better reasoning"),
        "apply_when": section_body(markdown, "Apply when"),
        "do_not_apply_when": section_body(markdown, "Do not apply when"),
        "watch_indicators": _parse_watch_indicators(section_body(markdown, "Watch indicators")),
        "example_rewrite": _parse_example_rewrite(section_body(markdown, "Example rewrite")),
    }


def is_usable_lesson(card: dict[str, Any], today: date | None = None) -> bool:
    if card.get("status") != "active":
        return False
    validated_at = _parse_date(card.get("last_validated_at"))
    stale_after_days = card.get("stale_after_days")
    if validated_at is None or not isinstance(stale_after_days, int):
        return False
    return validated_at + timedelta(days=stale_after_days) >= (today or date.today())


def search_memory_cards(
    bank_path: Path, query: str, *, include_inactive: bool = False, today: date | None = None
) -> list[dict[str, Any]]:
    normalized_query = query.lower()
    results: list[dict[str, Any]] = []
    for path in discover_memory_cards(bank_path):
        text = path.read_text(encoding="utf-8")
        if normalized_query not in text.lower():
            continue
        card = parse_memory_card(path, bank_path)
        if include_inactive or is_usable_lesson(card, today=today):
            results.append(
                {
                    "file": path.name,
                    "path": card["file"],
                    "lesson_id": card["lesson_id"],
                    "status": card["status"],
                    "last_validated_at": card["last_validated_at"],
                    "confidence": card["confidence"],
                    "title": card["title"],
                }
            )
    return results


def lint_analysis_bank(
    bank_path: Path, schema_path: Path | None = None, *, today: date | None = None
) -> AnalysisBankLintResult:
    today = today or date.today()
    errors: list[str] = []
    warnings: list[str] = []
    cards: list[dict[str, Any]] = []

    if not bank_path.is_dir():
        return AnalysisBankLintResult([f"AnalysisBank directory not found: {bank_path}"], [], [])

    index = _load_index(bank_path, errors)
    schema = _load_schema(schema_path, errors) if schema_path else None
    validator = Draft202012Validator(schema, format_checker=FormatChecker()) if schema else None

    card_paths = discover_memory_cards(bank_path)
    if not card_paths:
        errors.append("AnalysisBank has no memory cards in successes/ or failures/")

    seen_lesson_ids: dict[str, str] = {}
    for path in card_paths:
        markdown = path.read_text(encoding="utf-8")
        relative = str(path.relative_to(bank_path))
        for section in REQUIRED_SECTIONS:
            if f"## {section}\n" not in markdown:
                errors.append(f"{relative}: missing section {section}")

        card = parse_memory_card(path, bank_path)
        cards.append(card)
        _lint_card_metadata(card, path, relative, seen_lesson_ids, today, errors, warnings)

        if validator:
            schema_card = {key: value for key, value in card.items() if key != "file"}
            for error in sorted(validator.iter_errors(schema_card), key=lambda e: list(e.path)):
                location = ".".join(str(part) for part in error.path) or "<root>"
                errors.append(f"{relative}: schema violation at {location}: {error.message}")

    if index:
        _lint_index(index, cards, errors)

    return AnalysisBankLintResult(errors, warnings, cards)


def format_lint_text(result: AnalysisBankLintResult) -> str:
    lines = [
        f"AnalysisBank lint: {'ok' if result.ok else 'failed'}",
        (
            f"Cards: {len(result.cards)} "
            f"(active: {sum(1 for card in result.cards if card.get('status') == 'active')}, "
            f"inactive: {sum(1 for card in result.cards if card.get('status') != 'active')})"
        ),
    ]
    if result.errors:
        lines.append("Errors:")
        lines.extend(f"- {error}" for error in result.errors)
    if result.warnings:
        lines.append("Warnings:")
        lines.extend(f"- {warning}" for warning in result.warnings)
    return "\n".join(lines)


def _parse_title(markdown: str) -> str:
    for line in markdown.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def _parse_int(value: str) -> int | str:
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def _normalise_supersedes(value: str) -> str | None:
    if value.strip().lower() in {"", "none", "null"}:
        return None
    return value.strip()


def _parse_watch_indicators(body: str) -> list[str]:
    compact = " ".join(body.split())
    if not compact:
        return []
    return [part.strip().removeprefix("and ").strip() for part in compact.split(",") if part.strip()]


def _parse_example_rewrite(body: str) -> dict[str, str]:
    before = ""
    after = ""
    for line in body.splitlines():
        if line.startswith("Before:"):
            before = line.removeprefix("Before:").strip()
        elif line.startswith("After:"):
            after = line.removeprefix("After:").strip()
    return {"before": before, "after": after}


def _load_index(bank_path: Path, errors: list[str]) -> dict[str, Any] | None:
    try:
        return load_memory_index(bank_path)
    except FileNotFoundError:
        errors.append("analysis-bank/memory_index.json is missing")
    except json.JSONDecodeError as exc:
        errors.append(f"analysis-bank/memory_index.json is invalid JSON: {exc}")
    return None


def _load_schema(schema_path: Path | None, errors: list[str]) -> dict[str, Any] | None:
    if schema_path is None:
        return None
    try:
        return json.loads(schema_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"Memory-card schema not found: {schema_path}")
    except json.JSONDecodeError as exc:
        errors.append(f"Memory-card schema is invalid JSON: {exc}")
    return None


def _lint_card_metadata(
    card: dict[str, Any],
    path: Path,
    relative: str,
    seen_lesson_ids: dict[str, str],
    today: date,
    errors: list[str],
    warnings: list[str],
) -> None:
    for key in REQUIRED_LIFECYCLE_FIELDS:
        if card.get(key) in {"", None} and key != "supersedes":
            errors.append(f"{relative}: missing lifecycle field {key}")

    lesson_id = card.get("lesson_id")
    if isinstance(lesson_id, str):
        if not _LESSON_ID_RE.match(lesson_id):
            errors.append(f"{relative}: lesson_id must be lowercase kebab-case")
        if lesson_id != path.stem:
            warnings.append(f"{relative}: lesson_id does not match filename stem")
        if lesson_id in seen_lesson_ids:
            errors.append(f"{relative}: duplicate lesson_id also used by {seen_lesson_ids[lesson_id]}")
        seen_lesson_ids[lesson_id] = relative

    if card.get("status") not in VALID_STATUSES:
        errors.append(f"{relative}: invalid status {card.get('status')!r}")
    if card.get("confidence") not in VALID_CONFIDENCE:
        errors.append(f"{relative}: invalid confidence {card.get('confidence')!r}")

    created_at = _parse_date(card.get("created_at"))
    validated_at = _parse_date(card.get("last_validated_at"))
    if created_at and validated_at and validated_at < created_at:
        errors.append(f"{relative}: last_validated_at is earlier than created_at")
    if card.get("status") == "active" and not is_usable_lesson(card, today=today):
        errors.append(f"{relative}: active lesson is stale by lifecycle metadata")


def _lint_index(index: dict[str, Any], cards: list[dict[str, Any]], errors: list[str]) -> None:
    lifecycle = index.get("lesson_lifecycle", {})
    if lifecycle.get("active_statuses") != ACTIVE_STATUSES:
        errors.append("memory_index.json: lesson_lifecycle.active_statuses must be ['active']")
    if lifecycle.get("stale_statuses") != STALE_STATUSES:
        errors.append("memory_index.json: lesson_lifecycle.stale_statuses must be ['stale', 'superseded', 'rejected']")
    if lifecycle.get("required_fields") != REQUIRED_LIFECYCLE_FIELDS:
        errors.append("memory_index.json: lesson_lifecycle.required_fields is out of sync")

    entries = index.get("entries")
    if not isinstance(entries, list):
        errors.append("memory_index.json: entries must be a list")
        return

    entries_by_file: dict[str, dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("memory_index.json: every entry must be an object")
            continue
        entry_file = entry.get("file")
        if not isinstance(entry_file, str):
            errors.append("memory_index.json: every entry must include a string file")
            continue
        entries_by_file[entry_file] = entry
    cards_by_file = {card["file"]: card for card in cards}
    missing_from_index = sorted(set(cards_by_file) - set(entries_by_file))
    missing_on_disk = sorted(set(entries_by_file) - set(cards_by_file))
    if missing_from_index:
        errors.append(f"memory_index.json: missing cards {missing_from_index}")
    if missing_on_disk:
        errors.append(f"memory_index.json: entries point to missing files {missing_on_disk}")

    for relative, card in cards_by_file.items():
        entry = entries_by_file.get(relative)
        if not entry:
            continue
        for key in ("lesson_id", "status", "last_validated_at", "stale_after_days"):
            if entry.get(key) != card.get(key):
                errors.append(f"memory_index.json: {relative} {key} does not match card")
        if not entry.get("summary"):
            errors.append(f"memory_index.json: {relative} missing summary")


def _parse_date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
