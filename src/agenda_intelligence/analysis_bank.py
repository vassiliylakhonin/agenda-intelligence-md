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
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_SEARCH_FIELD_WEIGHTS = {
    "lesson_id": 4,
    "title": 4,
    "trigger": 5,
    "pattern": 3,
    "better_reasoning": 3,
    "apply_when": 3,
    "do_not_apply_when": 1,
    "watch_indicators": 2,
    "evidence_basis": 1,
}


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


@dataclass
class MemoryRetrievalBenchResult:
    manifest_errors: list[str]
    cases: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return not self.manifest_errors and all(case["ok"] for case in self.cases)

    def to_dict(self) -> dict[str, Any]:
        passed = sum(1 for case in self.cases if case["ok"])
        return {
            "ok": self.ok,
            "summary": {
                "cases": len(self.cases),
                "passed": passed,
                "failed": len(self.cases) - passed,
                "manifest_errors": self.manifest_errors,
            },
            "cases": self.cases,
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
    results: list[dict[str, Any]] = []
    for path in discover_memory_cards(bank_path):
        card = parse_memory_card(path, bank_path)
        score = score_memory_card(card, query)
        if score > 0 and (include_inactive or is_usable_lesson(card, today=today)):
            results.append(
                {
                    "file": path.name,
                    "path": card["file"],
                    "lesson_id": card["lesson_id"],
                    "status": card["status"],
                    "last_validated_at": card["last_validated_at"],
                    "confidence": card["confidence"],
                    "title": card["title"],
                    "score": score,
                }
            )
    return sorted(results, key=lambda item: (-item["score"], item["lesson_id"]))


def score_memory_card(card: dict[str, Any], query: str) -> int:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return 0

    score = 0
    normalized_query = " ".join(query_tokens)
    for field, weight in _SEARCH_FIELD_WEIGHTS.items():
        value = card.get(field)
        text = _searchable_text(value)
        if not text:
            continue
        field_tokens = _tokenize(text)
        if normalized_query and normalized_query in " ".join(field_tokens):
            score += weight * 3
        for token in query_tokens:
            token_count = field_tokens.count(token)
            if token_count:
                score += weight * min(token_count, 3)
    return score


def run_memory_retrieval_bench(
    bank_path: Path, manifest_path: Path, *, today: date | None = None
) -> MemoryRetrievalBenchResult:
    manifest_errors: list[str] = []
    manifest = _load_retrieval_manifest(manifest_path, manifest_errors)
    if manifest is None:
        return MemoryRetrievalBenchResult(manifest_errors, [])

    top_n = manifest.get("top_n", 3)
    if not isinstance(top_n, int) or top_n < 1:
        manifest_errors.append("manifest.top_n must be a positive integer")
        top_n = 3

    cases_value = manifest.get("cases")
    if not isinstance(cases_value, list) or not cases_value:
        manifest_errors.append("manifest.cases must be a non-empty list")
        return MemoryRetrievalBenchResult(manifest_errors, [])

    cases: list[dict[str, Any]] = []
    for raw_case in cases_value:
        case_errors = _validate_retrieval_case(raw_case)
        if case_errors:
            case_id = raw_case.get("case_id") if isinstance(raw_case, dict) else "<invalid>"
            manifest_errors.extend(f"{case_id}: {error}" for error in case_errors)
            continue
        case = _run_retrieval_case(bank_path, raw_case, top_n=top_n, today=today)
        cases.append(case)

    return MemoryRetrievalBenchResult(manifest_errors, cases)


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


def format_retrieval_bench_text(result: MemoryRetrievalBenchResult) -> str:
    summary = result.to_dict()["summary"]
    lines = [
        f"AnalysisBank retrieval bench: {'ok' if result.ok else 'failed'}",
        f"Cases: {summary['passed']}/{summary['cases']} passed",
    ]
    if result.manifest_errors:
        lines.append("Manifest errors:")
        lines.extend(f"- {error}" for error in result.manifest_errors)
    for case in result.cases:
        status = "PASS" if case["ok"] else "FAIL"
        lines.append(f"- {status} {case['case_id']}: top={case['actual_top'] or 'none'}")
        if case["errors"]:
            lines.extend(f"  - {error}" for error in case["errors"])
    return "\n".join(lines)


def _parse_title(markdown: str) -> str:
    for line in markdown.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def _tokenize(value: str) -> list[str]:
    return _TOKEN_RE.findall(value.lower())


def _searchable_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(str(item) for item in value)
    if isinstance(value, dict):
        return " ".join(str(item) for item in value.values())
    return ""


def _load_retrieval_manifest(manifest_path: Path, errors: list[str]) -> dict[str, Any] | None:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"retrieval manifest not found: {manifest_path}")
        return None
    except json.JSONDecodeError as exc:
        errors.append(f"retrieval manifest is invalid JSON: {exc}")
        return None
    if not isinstance(manifest, dict):
        errors.append("retrieval manifest must be a JSON object")
        return None
    if manifest.get("version") != 1:
        errors.append("retrieval manifest version must be 1")
    return manifest


def _validate_retrieval_case(raw_case: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(raw_case, dict):
        return ["case must be an object"]
    for key in ("case_id", "query", "expected_top", "why_it_exists"):
        if not isinstance(raw_case.get(key), str) or not raw_case.get(key):
            errors.append(f"{key} must be a non-empty string")
    for key in ("expected_within_top_n", "forbidden_within_top_n"):
        value = raw_case.get(key, [])
        if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
            errors.append(f"{key} must be a list of non-empty strings")
    return errors


def _run_retrieval_case(
    bank_path: Path, case: dict[str, Any], *, top_n: int, today: date | None = None
) -> dict[str, Any]:
    results = search_memory_cards(bank_path, case["query"], today=today)
    result_ids = [item["lesson_id"] for item in results]
    top_ids = result_ids[:top_n]
    expected_top = case["expected_top"]
    expected_within_top_n = case.get("expected_within_top_n", [])
    forbidden_within_top_n = case.get("forbidden_within_top_n", [])

    errors: list[str] = []
    actual_top = result_ids[0] if result_ids else None
    if actual_top != expected_top:
        errors.append(f"expected top {expected_top!r}, got {actual_top!r}")

    missing_expected = [lesson_id for lesson_id in expected_within_top_n if lesson_id not in top_ids]
    if missing_expected:
        errors.append(f"expected within top {top_n}: {missing_expected}")

    present_forbidden = [lesson_id for lesson_id in forbidden_within_top_n if lesson_id in top_ids]
    if present_forbidden:
        errors.append(f"forbidden within top {top_n}: {present_forbidden}")

    return {
        "case_id": case["case_id"],
        "query": case["query"],
        "ok": not errors,
        "errors": errors,
        "expected_top": expected_top,
        "actual_top": actual_top,
        "top_n": top_n,
        "top_results": top_ids,
        "scores": {item["lesson_id"]: item["score"] for item in results[:top_n]},
        "why_it_exists": case["why_it_exists"],
    }


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
