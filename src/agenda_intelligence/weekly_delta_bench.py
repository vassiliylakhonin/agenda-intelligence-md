"""Batch regression harness for weekly-delta confidential workflow fixtures."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from agenda_intelligence.services import weekly_status_delta

WEEKLY_DELTA_GUARDRAILS = {
    "route_matches_expected",
    "unsafe_claims_include_expected",
    "owner_actions_cover_expected",
    "missing_sources_include_expected",
    "confidential_alias_discipline",
    "boundary_notice_present",
}

DEFAULT_FORBIDDEN_PATTERNS = [
    r"\b20\d{2}-\d{2}-\d{2}\b",
    r"\b(?:USD|EUR|GBP|AED|\$)\s?\d",
    r"\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,6}\s+"
    r"(?:LLC|Ltd|Limited|Inc|Bank|Holdings|Capital|Partners|Data Centers)\b",
]


def _load_manifest(root: Path) -> dict[str, Any]:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError(f"Missing weekly-delta manifest: {manifest_path}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid weekly-delta manifest JSON: {e}") from e
    if not isinstance(manifest, dict):
        raise ValueError("Weekly-delta manifest must be a JSON object")
    fixtures = manifest.get("fixtures")
    if not isinstance(fixtures, list):
        raise ValueError("Weekly-delta manifest must contain fixtures[]")
    return manifest


def _contains_all(haystack: list[str], needles: list[str]) -> tuple[bool, list[str]]:
    missing = [needle for needle in needles if needle not in haystack]
    return not missing, missing


def _rendered_payload(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _check_case(entry: dict[str, Any], root: Path) -> dict[str, Any]:
    rel_path = entry["path"]
    path = root / rel_path
    text = path.read_text(encoding="utf-8")
    payload = weekly_status_delta(
        text,
        category=entry.get("category", "ai-infrastructure-bankability"),
        project_alias=entry.get("project_alias", "ProjectCo"),
        decision_moment=entry.get("decision_moment", "committee review"),
        source_type=entry.get("source_type", "weekly status"),
    )
    rendered = _rendered_payload(payload)
    errors: list[str] = []
    passed: list[str] = []

    if payload.get("readiness_delta") == entry.get("expected_readiness_delta") and payload.get(
        "next_decision_route"
    ) == entry.get("expected_next_decision_route"):
        passed.append("route_matches_expected")
    else:
        errors.append(
            "route mismatch: expected "
            f"{entry.get('expected_readiness_delta')}/{entry.get('expected_next_decision_route')}, "
            f"got {payload.get('readiness_delta')}/{payload.get('next_decision_route')}"
        )

    unsafe_claims: list[str] = []
    for item in payload.get("unsafe_to_repeat_claims", []):
        if not isinstance(item, dict):
            continue
        claim = item.get("claim")
        if isinstance(claim, str):
            unsafe_claims.append(claim)
    ok, missing = _contains_all(unsafe_claims, entry.get("expected_unsafe_claims") or [])
    if ok:
        passed.append("unsafe_claims_include_expected")
    else:
        errors.append(f"unsafe claims missing expected items: {missing}")

    owner_actions: list[str] = []
    for item in payload.get("owner_actions", []):
        if not isinstance(item, dict) or not item.get("evidence_output_expected"):
            continue
        owner = item.get("owner")
        if isinstance(owner, str):
            owner_actions.append(owner)
    ok, missing = _contains_all(owner_actions, entry.get("expected_owner_actions") or [])
    if ok:
        passed.append("owner_actions_cover_expected")
    else:
        errors.append(f"owner actions missing expected owners or evidence outputs: {missing}")

    ok, missing = _contains_all(
        payload.get("missing_required_sources") or [],
        entry.get("expected_missing_sources") or [],
    )
    if ok:
        passed.append("missing_sources_include_expected")
    else:
        errors.append(f"missing source-plan gaps absent from output: {missing}")

    forbidden_patterns = list(dict.fromkeys(DEFAULT_FORBIDDEN_PATTERNS + list(entry.get("forbidden_patterns") or [])))
    matched_forbidden = [pattern for pattern in forbidden_patterns if re.search(pattern, rendered)]
    if matched_forbidden:
        errors.append(f"confidential alias leaks matched forbidden patterns: {matched_forbidden}")
    else:
        passed.append("confidential_alias_discipline")

    boundary_text = f"{payload.get('note', '')}\n{payload.get('markdown', '')}".lower()
    if "does not verify factual truth" in boundary_text and "not legal" in boundary_text:
        passed.append("boundary_notice_present")
    else:
        errors.append("boundary notice is missing factual-verification or no-advice language")

    failed = sorted(WEEKLY_DELTA_GUARDRAILS - set(passed))
    expected_class = entry.get("expected_class")
    expected_ok = expected_class == "golden"
    ok = not errors
    target_guardrails = set(entry.get("target_guardrails") or [])
    case_ok = ok if expected_ok else bool(target_guardrails & set(failed))

    return {
        "case": Path(rel_path).stem,
        "path": rel_path,
        "expected_class": expected_class,
        "expected_ok": expected_ok,
        "ok": ok,
        "passed": passed,
        "errors": errors,
        "failed_guardrails": failed,
        "case_ok": case_ok,
        "readiness_delta": payload.get("readiness_delta"),
        "next_decision_route": payload.get("next_decision_route"),
    }


def _manifest_errors(root: Path, manifest: dict[str, Any], cases: list[dict[str, Any]]) -> list[str]:
    entries = manifest.get("fixtures") or []
    errors: list[str] = []
    entries_by_path: dict[str, dict[str, Any]] = {}

    for idx, entry in enumerate(entries):
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
        elif unknown := sorted(set(target_guardrails) - WEEKLY_DELTA_GUARDRAILS):
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


def run_weekly_delta_bench(root: Path) -> dict[str, Any]:
    manifest = _load_manifest(root)
    entries_by_path = {entry["path"]: entry for entry in manifest["fixtures"] if isinstance(entry, dict)}
    cases: list[dict[str, Any]] = []
    for expected_class in ("golden", "failure"):
        directory = root / expected_class
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.md")):
            rel_path = str(path.relative_to(root))
            entry = entries_by_path.get(rel_path)
            if entry is None:
                cases.append(
                    {
                        "case": path.stem,
                        "path": rel_path,
                        "expected_class": expected_class,
                        "expected_ok": expected_class == "golden",
                        "ok": False,
                        "passed": [],
                        "errors": ["fixture missing from manifest"],
                        "failed_guardrails": sorted(WEEKLY_DELTA_GUARDRAILS),
                        "case_ok": False,
                    }
                )
                continue
            cases.append(_check_case(entry, root))

    if not cases:
        raise ValueError(f"No weekly-delta fixtures found under {root}/golden or {root}/failure")
    manifest_errors = _manifest_errors(root, manifest, cases)
    golden = [case for case in cases if case["expected_class"] == "golden"]
    failure = [case for case in cases if case["expected_class"] == "failure"]
    unexpected_failures = [case for case in golden if not case["case_ok"]]
    unexpected_passes = [case for case in failure if not case["case_ok"]]
    summary = {
        "cases": len(cases),
        "manifest_present": True,
        "manifest_errors": manifest_errors,
        "golden_total": len(golden),
        "golden_passed": sum(1 for case in golden if case["case_ok"]),
        "failure_total": len(failure),
        "failure_failed_as_expected": sum(1 for case in failure if case["case_ok"]),
        "unexpected_failures": [case["path"] for case in unexpected_failures],
        "unexpected_passes": [case["path"] for case in unexpected_passes],
        "ok": not unexpected_failures and not unexpected_passes and not manifest_errors,
        "note": (
            "Weekly-delta bench checks deterministic confidential workflow guardrails; "
            "it does not verify factual truth."
        ),
    }
    return {"summary": summary, "cases": cases}


def render_markdown(cases: list[dict[str, Any]], summary: dict[str, Any]) -> str:
    lines = [
        "# Weekly Delta Bench",
        "",
        f"cases: {summary['cases']}",
        f"golden passed: {summary['golden_passed']}/{summary['golden_total']}",
        f"failure fixtures failed as expected: {summary['failure_failed_as_expected']}/{summary['failure_total']}",
        f"manifest: {'present' if summary['manifest_present'] else 'absent'}",
        f"status: {'PASS' if summary['ok'] else 'FAIL'}",
        "",
        "| case | class | quality | expected | result | route |",
        "|---|---|---:|---:|---:|---|",
    ]
    for case in cases:
        route = f"{case.get('readiness_delta')}/{case.get('next_decision_route')}"
        lines.append(
            "| {case} | {klass} | {quality} | {expected} | {result} | {route} |".format(
                case=case["case"],
                klass=case["expected_class"],
                quality="PASS" if case["ok"] else "FAIL",
                expected="PASS" if case["expected_ok"] else "FAIL",
                result="PASS" if case["case_ok"] else "FAIL",
                route=route,
            )
        )
    if summary.get("manifest_errors"):
        lines.extend(["", "## Manifest errors", ""])
        lines.extend(f"- {error}" for error in summary["manifest_errors"])
    bad = [case for case in cases if not case["case_ok"]]
    if bad:
        lines.extend(["", "## Unexpected cases", ""])
        for case in bad:
            lines.append(f"- `{case['path']}`: {'; '.join(case['errors'])}")
    return "\n".join(lines)
