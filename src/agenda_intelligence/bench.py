"""Reproducible self-contained benchmark over a directory of briefs.

Given a directory containing one or more `*.brief.json` (and optionally
matching `*.evidence.json`, `*.audit.json`), this module runs:

- agenda-brief schema validation
- evidence-pack schema validation (if present)
- source-plan coverage diagnostic (if evidence has source_category)
- evidence-audit schema validation + orphan-ref check (if present)
- heuristic 0-100 brief scoring (with evidence pack if present)

It does **not** call any LLM. It does not verify factual truth. It
produces a deterministic table of structural / decision-readiness
signals across the inputs.

Output formats: a list of per-case dicts, plus a small summary dict
(mean score, % schema-valid, % with evidence, % with audit, etc.).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path
from typing import Any

from jsonschema import ValidationError, validate

from agenda_intelligence.eval import score_brief
from agenda_intelligence.mcp_server import source_coverage

PACKAGE_NAME = "agenda_intelligence"


def _data(rel: str):
    return resources.files(PACKAGE_NAME) / "data" / rel


def _load_schema(name: str) -> dict:
    return json.loads(_data(f"schemas/{name}").read_text())


@dataclass
class CaseResult:
    case: str
    brief_path: str
    evidence_path: str | None
    audit_path: str | None
    schema_valid: bool
    schema_error: str | None
    evidence_valid: bool | None
    evidence_error: str | None
    audit_valid: bool | None
    audit_error: str | None
    audit_orphans: int
    source_category: str | None
    source_coverage_pct: float | None
    source_coverage_missing: int | None
    source_coverage_error: str | None
    score: int | None
    score_breakdown: dict[str, Any] = field(default_factory=dict)


def _validate(data: dict, schema: dict) -> tuple[bool, str | None]:
    try:
        validate(data, schema)
        return True, None
    except ValidationError as e:
        return False, e.message


def _audit_orphans(audit: dict) -> int:
    evidence_ids = {e.get("evidence_id") for e in audit.get("evidence", [])}
    count = 0
    for c in audit.get("claims", []):
        for eid in c.get("evidence_ids", []):
            if eid not in evidence_ids:
                count += 1
    return count


def discover_cases(root: Path) -> list[dict[str, Any]]:
    """Find brief.json files and pair them with sibling evidence/audit files."""
    cases: list[dict[str, Any]] = []
    for brief in sorted(root.rglob("*.brief.json")):
        stem = brief.name[: -len(".brief.json")]
        parent = brief.parent
        evidence = parent / f"{stem}.evidence.json"
        audit = parent / f"{stem}.audit.json"
        cases.append(
            {
                "name": stem,
                "brief": brief,
                "evidence": evidence if evidence.is_file() else None,
                "audit": audit if audit.is_file() else None,
            }
        )
    return cases


def run_case(brief: Path, evidence: Path | None, audit: Path | None) -> CaseResult:
    brief_schema = _load_schema("agenda-brief.schema.json")
    evidence_schema = _load_schema("evidence-pack.schema.json")
    audit_schema = _load_schema("evidence-audit.schema.json")

    brief_data = json.loads(brief.read_text())
    schema_valid, schema_err = _validate(brief_data, brief_schema)

    evidence_data = json.loads(evidence.read_text()) if evidence else None
    if evidence_data is not None:
        evidence_valid, evidence_err = _validate(evidence_data, evidence_schema)
    else:
        evidence_valid, evidence_err = None, None

    source_category = evidence_data.get("source_category") if evidence_data else None
    coverage_pct: float | None = None
    coverage_missing: int | None = None
    coverage_error: str | None = None
    if evidence_data is not None and evidence_valid and source_category:
        coverage = source_coverage(evidence_data)
        coverage_error = coverage.get("error")
        if not coverage_error:
            coverage_pct = coverage.get("coverage_pct")
            coverage_missing = len(coverage.get("missing_required_sources", []))

    audit_data = json.loads(audit.read_text()) if audit else None
    if audit_data is not None:
        audit_valid, audit_err = _validate(audit_data, audit_schema)
        orphans = _audit_orphans(audit_data) if audit_valid else 0
    else:
        audit_valid, audit_err, orphans = None, None, 0

    score: int | None = None
    breakdown: dict[str, Any] = {}
    if schema_valid:
        result = score_brief(brief_data, evidence_pack=evidence_data)
        score = result["score"]
        breakdown = {k: v["score"] for k, v in result["dimensions"].items()}

    cwd = Path.cwd()

    def _rel(p: Path | None) -> str | None:
        if p is None:
            return None
        try:
            return str(p.resolve().relative_to(cwd))
        except ValueError:
            return str(p)

    return CaseResult(
        case=brief.stem.replace(".brief", ""),
        brief_path=_rel(brief) or str(brief),
        evidence_path=_rel(evidence),
        audit_path=_rel(audit),
        schema_valid=schema_valid,
        schema_error=schema_err,
        evidence_valid=evidence_valid,
        evidence_error=evidence_err,
        audit_valid=audit_valid,
        audit_error=audit_err,
        audit_orphans=orphans,
        source_category=source_category,
        source_coverage_pct=coverage_pct,
        source_coverage_missing=coverage_missing,
        source_coverage_error=coverage_error,
        score=score,
        score_breakdown=breakdown,
    )


def summarize(results: list[CaseResult]) -> dict[str, Any]:
    n = len(results)
    if n == 0:
        return {"cases": 0, "note": "no cases found"}
    schema_valid = sum(1 for r in results if r.schema_valid)
    with_evidence = sum(1 for r in results if r.evidence_path)
    with_audit = sum(1 for r in results if r.audit_path)
    audit_orphan_total = sum(r.audit_orphans for r in results)
    with_source_category = sum(1 for r in results if r.source_category)
    source_coverage_cases = [r for r in results if r.source_coverage_pct is not None]
    source_coverage_missing_total = sum(r.source_coverage_missing or 0 for r in results)
    source_coverage_gaps = sum(1 for r in results if (r.source_coverage_missing or 0) > 0)
    scores = [r.score for r in results if r.score is not None]
    return {
        "cases": n,
        "schema_valid_pct": round(100 * schema_valid / n, 1),
        "with_evidence_pct": round(100 * with_evidence / n, 1),
        "with_audit_pct": round(100 * with_audit / n, 1),
        "with_source_category_pct": round(100 * with_source_category / n, 1),
        "source_coverage_mean_pct": (
            round(sum(r.source_coverage_pct or 0 for r in source_coverage_cases) / len(source_coverage_cases), 1)
            if source_coverage_cases
            else None
        ),
        "source_coverage_missing_total": source_coverage_missing_total,
        "source_coverage_gap_cases": source_coverage_gaps,
        "mean_score": round(sum(scores) / len(scores), 1) if scores else None,
        "min_score": min(scores) if scores else None,
        "max_score": max(scores) if scores else None,
        "audit_orphan_total": audit_orphan_total,
        "note": (
            "Heuristic structural / evidence-discipline metrics. Source coverage is diagnostic. "
            "Does not verify factual truth."
        ),
    }


def render_markdown(results: list[CaseResult], summary: dict[str, Any]) -> str:
    lines = [
        "# Bench report",
        "",
        f"- cases: {summary['cases']}",
        f"- schema-valid: {summary.get('schema_valid_pct')}%",
        f"- with evidence pack: {summary.get('with_evidence_pct')}%",
        f"- with claim-level audit: {summary.get('with_audit_pct')}%",
        f"- with source category: {summary.get('with_source_category_pct')}%",
        f"- mean source coverage: {summary.get('source_coverage_mean_pct')}%",
        f"- source coverage gap cases: {summary.get('source_coverage_gap_cases')}",
        f"- missing required source types: {summary.get('source_coverage_missing_total')}",
        f"- mean score: {summary.get('mean_score')}",
        f"- min / max score: {summary.get('min_score')} / {summary.get('max_score')}",
        f"- audit orphan refs: {summary.get('audit_orphan_total')}",
        "",
        "> " + summary.get("note", ""),
        "",
        "| case | schema | evidence | audit | source cat | source cov | gaps | orphans | score |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            f"| {r.case} | "
            f"{'pass' if r.schema_valid else 'FAIL'} | "
            f"{'pass' if r.evidence_valid else ('FAIL' if r.evidence_valid is False else '-')} | "
            f"{'pass' if r.audit_valid else ('FAIL' if r.audit_valid is False else '-')} | "
            f"{r.source_category or '-'} | "
            f"{r.source_coverage_pct if r.source_coverage_pct is not None else '-'} | "
            f"{r.source_coverage_missing if r.source_coverage_missing is not None else '-'} | "
            f"{r.audit_orphans} | "
            f"{r.score if r.score is not None else '-'} |"
        )
    return "\n".join(lines) + "\n"


def to_json(results: list[CaseResult], summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": summary,
        "cases": [r.__dict__ for r in results],
    }
