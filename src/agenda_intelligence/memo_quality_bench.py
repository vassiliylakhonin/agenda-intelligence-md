"""Batch regression harness for memo-quality golden/failure fixtures."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agenda_intelligence.product import check_memo_quality

MEMO_QUALITY_GUARDRAILS = {
    "evidence_mode_discipline",
    "no_approval_or_clearance_overreach",
    "gaps_visible_when_unknowns_exist",
    "owner_actions_are_actionable",
    "watch_next_is_observable",
    "unknowns_connected_to_actions",
}


def failed_guardrails(result: dict[str, Any]) -> set[str]:
    failed: set[str] = set()
    for error in result.get("errors", []):
        if error.startswith("evidence_mode_discipline"):
            failed.add("evidence_mode_discipline")
        if "overreach" in error:
            failed.add("no_approval_or_clearance_overreach")
        if error.startswith("memo has unknowns"):
            failed.add("gaps_visible_when_unknowns_exist")
        if error.startswith("recommended_actions") or error.startswith("memo has no recommended_actions"):
            failed.add("owner_actions_are_actionable")
        if error.startswith("watch_next"):
            failed.add("watch_next_is_observable")
        if error.startswith("unknowns are not connected"):
            failed.add("unknowns_connected_to_actions")
        if error in {"invalid_json", "not_json_object"}:
            failed.add("schema_validity")
    if not result.get("schema_valid", True):
        failed.add("schema_validity")
    return failed


def load_manifest(root: Path) -> dict[str, Any] | None:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid memo-quality manifest JSON: {e}") from e
    if not isinstance(manifest, dict):
        raise ValueError("Memo-quality manifest must be a JSON object")
    fixtures = manifest.get("fixtures")
    if not isinstance(fixtures, list):
        raise ValueError("Memo-quality manifest must contain fixtures[]")
    return manifest


def manifest_errors(root: Path, manifest: dict[str, Any], cases: list[dict[str, Any]]) -> list[str]:
    fixture_entries = manifest.get("fixtures") or []
    entries_by_path: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    for idx, entry in enumerate(fixture_entries):
        if not isinstance(entry, dict):
            errors.append(f"manifest.fixtures[{idx}] must be an object")
            continue
        path = entry.get("path")
        expected_class = entry.get("expected_class")
        target_guardrails = entry.get("target_guardrails")
        why_it_exists = entry.get("why_it_exists")
        if not isinstance(path, str) or not path:
            errors.append(f"manifest.fixtures[{idx}].path must be a non-empty string")
            continue
        if path in entries_by_path:
            errors.append(f"manifest duplicates fixture path: {path}")
        entries_by_path[path] = entry
        if expected_class not in {"golden", "failure"}:
            errors.append(f"manifest fixture {path} has invalid expected_class={expected_class!r}")
        if not isinstance(target_guardrails, list) or not target_guardrails:
            errors.append(f"manifest fixture {path} must list target_guardrails")
        elif unknown := sorted(set(target_guardrails) - MEMO_QUALITY_GUARDRAILS):
            errors.append(f"manifest fixture {path} has unknown target_guardrails: {unknown}")
        if not isinstance(why_it_exists, str) or not why_it_exists.strip():
            errors.append(f"manifest fixture {path} must explain why_it_exists")
        if not (root / path).is_file():
            errors.append(f"manifest fixture missing on disk: {path}")

    case_by_path = {case["path"]: case for case in cases}
    for path in sorted(set(case_by_path) - set(entries_by_path)):
        errors.append(f"fixture missing from manifest: {path}")
    for path in sorted(set(entries_by_path) - set(case_by_path)):
        errors.append(f"manifest fixture was not discovered by bench: {path}")

    for path, case in sorted(case_by_path.items()):
        entry = entries_by_path.get(path)
        if not entry:
            continue
        target_guardrails = set(entry.get("target_guardrails") or [])
        if entry.get("expected_class") != case["expected_class"]:
            errors.append(
                f"manifest fixture {path} expected_class={entry.get('expected_class')!r} "
                f"does not match directory class={case['expected_class']!r}"
            )
        if case["expected_class"] == "golden":
            missing = sorted(target_guardrails - set(case.get("passed", [])))
            if missing:
                errors.append(f"golden fixture {path} did not pass target_guardrails: {missing}")
        else:
            failed = set(case.get("failed_guardrails", []))
            missing = sorted(target_guardrails - failed)
            if missing:
                errors.append(f"failure fixture {path} did not fail target_guardrails: {missing}")

    return errors


def bench_cases(root: Path) -> tuple[list[dict[str, Any]], dict[str, Any] | None, list[str]]:
    manifest = load_manifest(root)
    cases: list[dict[str, Any]] = []
    for expected_class in ("golden", "failure"):
        directory = root / expected_class
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.json")):
            try:
                memo_json = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                result = {
                    "schema_valid": False,
                    "schema_errors": [f"Invalid JSON: {e}"],
                    "ok": False,
                    "errors": ["invalid_json"],
                    "passed": [],
                }
            else:
                if not isinstance(memo_json, dict):
                    result = {
                        "schema_valid": False,
                        "schema_errors": ["Memo quality check expects a JSON object"],
                        "ok": False,
                        "errors": ["not_json_object"],
                        "passed": [],
                    }
                else:
                    result = check_memo_quality(memo_json)

            expected_ok = expected_class == "golden"
            expected_schema_valid = True
            failed = sorted(failed_guardrails(result))
            case_ok = result["schema_valid"] == expected_schema_valid and result["ok"] == expected_ok
            cases.append(
                {
                    "case": path.stem,
                    "path": str(path.relative_to(root)),
                    "expected_class": expected_class,
                    "expected_ok": expected_ok,
                    "schema_valid": result["schema_valid"],
                    "ok": result["ok"],
                    "passed": result["passed"],
                    "errors": result["errors"],
                    "schema_errors": result["schema_errors"],
                    "failed_guardrails": failed,
                    "case_ok": case_ok,
                }
            )
    errors = manifest_errors(root, manifest, cases) if manifest else []
    return cases, manifest, errors


def summarize(cases: list[dict[str, Any]], manifest: dict[str, Any] | None, errors: list[str]) -> dict[str, Any]:
    golden = [case for case in cases if case["expected_class"] == "golden"]
    failure = [case for case in cases if case["expected_class"] == "failure"]
    unexpected_failures = [case for case in golden if not case["case_ok"]]
    unexpected_passes = [case for case in failure if not case["case_ok"]]
    return {
        "cases": len(cases),
        "manifest_present": manifest is not None,
        "manifest_errors": errors,
        "golden_total": len(golden),
        "golden_passed": sum(1 for case in golden if case["case_ok"]),
        "failure_total": len(failure),
        "failure_failed_as_expected": sum(1 for case in failure if case["case_ok"]),
        "unexpected_failures": [case["path"] for case in unexpected_failures],
        "unexpected_passes": [case["path"] for case in unexpected_passes],
        "ok": not unexpected_failures and not unexpected_passes and not errors,
        "note": "Memo quality bench checks structural evidence-readiness guardrails; it does not verify factual truth.",
    }


def run_memo_quality_bench(root: Path) -> dict[str, Any]:
    cases, manifest, errors = bench_cases(root)
    if not cases:
        raise ValueError(f"No memo-quality fixtures found under {root}/golden or {root}/failure")
    return {"summary": summarize(cases, manifest, errors), "cases": cases}


def render_markdown(cases: list[dict[str, Any]], summary: dict[str, Any]) -> str:
    lines = [
        "# Memo Quality Bench",
        "",
        f"cases: {summary['cases']}",
        f"golden passed: {summary['golden_passed']}/{summary['golden_total']}",
        f"failure fixtures failed as expected: {summary['failure_failed_as_expected']}/{summary['failure_total']}",
        f"manifest: {'present' if summary['manifest_present'] else 'absent'}",
        f"status: {'PASS' if summary['ok'] else 'FAIL'}",
        "",
        "| case | class | schema | quality | expected | result |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for case in cases:
        lines.append(
            "| {case} | {klass} | {schema} | {quality} | {expected} | {result} |".format(
                case=case["case"],
                klass=case["expected_class"],
                schema="PASS" if case["schema_valid"] else "FAIL",
                quality="PASS" if case["ok"] else "FAIL",
                expected="PASS" if case["expected_ok"] else "FAIL",
                result="PASS" if case["case_ok"] else "FAIL",
            )
        )
    failures = [case for case in cases if not case["case_ok"]]
    if failures:
        lines.extend(["", "## Drift"])
        for case in failures:
            details = case["errors"] or case["schema_errors"] or ["unexpected memo-quality result"]
            lines.append(f"- `{case['path']}`: {', '.join(details)}")
    if summary["manifest_errors"]:
        lines.extend(["", "## Manifest Errors"])
        for error in summary["manifest_errors"]:
            lines.append(f"- {error}")
    lines.extend(["", f"note: {summary['note']}"])
    return "\n".join(lines)
