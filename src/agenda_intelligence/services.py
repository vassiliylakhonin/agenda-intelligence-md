"""Shared service-layer functions for Agenda Intelligence.

These functions contain reusable product behavior that can be called by MCP,
CLI, and a future HTTP API shell without making those adapters depend on each
other. They are stateless and do not persist caller payloads.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Optional

from agenda_intelligence.eval import score_before_after

PACKAGE_NAME = "agenda_intelligence"


def _load_schema(schema_name: str) -> dict:
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / schema_name
    if not schema_path.is_file():
        raise FileNotFoundError(f"Schema not found in package data: {schema_name}")
    return json.loads(schema_path.read_text())


def _load_manifest() -> dict:
    manifest_path = resources.files(PACKAGE_NAME) / "data" / "agent-manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError("agent-manifest.json not found in package data")
    return json.loads(manifest_path.read_text())


def _read_data_file(relative_path: str) -> str:
    resource_path = resources.files(PACKAGE_NAME) / "data" / relative_path
    if not resource_path.is_file():
        raise FileNotFoundError(f"Resource not found in package data: {relative_path}")
    return resource_path.read_text()


def _load_data_json(relative_path: str) -> dict:
    return json.loads(_read_data_file(relative_path))


def _validate_json(data: dict, schema_name: str) -> dict:
    try:
        from jsonschema import ValidationError, validate
    except ImportError:
        return {
            "implemented": False,
            "valid": None,
            "error": "jsonschema is not installed – cannot validate",
        }

    try:
        schema = _load_schema(schema_name)
        validate(instance=data, schema=schema)
        return {"implemented": True, "valid": True, "errors": []}
    except ValidationError as e:
        return {"implemented": True, "valid": False, "errors": [e.message]}
    except Exception as e:
        return {"implemented": True, "valid": None, "errors": [str(e)]}


def audit_claims(audit_json: dict) -> dict:
    """Validate and summarize a claim-level evidence audit.

    Honest scope: schema-level only. Does not verify factual truth.
    """
    base = _validate_json(audit_json, "evidence-audit.schema.json")
    if not base.get("valid"):
        return {
            "implemented": True,
            "valid": False,
            "errors": base.get("errors", []),
            "summary": None,
        }

    claims = audit_json.get("claims", []) or []
    evidence = audit_json.get("evidence", []) or []
    evidence_ids = {e.get("evidence_id") for e in evidence}

    levels: dict = {}
    orphans: list = []
    for claim in claims:
        levels[claim["support_level"]] = levels.get(claim["support_level"], 0) + 1
        missing = [eid for eid in claim.get("evidence_ids", []) if eid not in evidence_ids]
        if missing:
            orphans.append({"claim_id": claim["claim_id"], "missing_evidence_ids": missing})

    return {
        "implemented": True,
        "valid": True,
        "errors": [],
        "summary": {
            "claim_count": len(claims),
            "evidence_count": len(evidence),
            "support_levels": levels,
            "orphan_evidence_refs": orphans,
            "unsupported_claims_listed": len(audit_json.get("unsupported_claims", []) or []),
        },
        "note": "Schema-level only. Does not verify factual truth.",
    }


def _source_plan(category: str) -> dict:
    try:
        requirements = _load_manifest().get("source_acquisition", {}).get("requirements", {})
        if category not in requirements:
            return {
                "implemented": True,
                "category": category,
                "plan": None,
                "error": f"Unknown source category: {category}",
            }
        relative_path = requirements[category]
        return {
            "implemented": True,
            "category": category,
            "path": relative_path,
            "plan": _load_data_json(relative_path),
            "error": None,
        }
    except Exception as e:
        return {"implemented": True, "category": category, "plan": None, "error": str(e)}


SOURCE_COVERAGE_ALIASES = {
    "sanctions_list": [
        "sanctions list",
        "sdn list",
        "ofac",
        "eu consolidated list",
        "consolidated list",
        "designation list",
    ],
    "legal_text": ["legal", "legal text", "law", "regulation", "legal instrument"],
    "legal_or_policy_text": ["legal", "policy text", "legal text", "law", "regulation"],
    "legal_or_regulatory_text": ["legal", "regulatory text", "legal text", "law", "regulation"],
    "regulator_guidance": ["regulator", "guidance", "faq"],
    "license_or_general_authorization": ["license", "licence", "general authorization", "general licence"],
    "official_government_source": ["official", "government", "ministry"],
    "official_statement": ["official", "statement"],
    "company_filing": ["filing", "company filing"],
    "market_price_data": ["market", "price", "price data"],
    "technical_standard": ["technical", "standard"],
}


def _normalize_source_term(value: object) -> str:
    import re
    import unicodedata

    text = unicodedata.normalize("NFKC", str(value or "")).lower().replace("_", " ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _term_matches_text(term: str, text: str) -> bool:
    normalized = _normalize_source_term(term)
    if not normalized:
        return False
    if normalized in text:
        return True
    tokens = [token for token in normalized.split() if token not in {"or", "and"}]
    return bool(tokens) and all(token in text for token in tokens)


def _source_match_terms(required_source: str, source_text: str) -> list[str]:
    terms = [required_source] + SOURCE_COVERAGE_ALIASES.get(required_source, [])
    return [term for term in terms if _term_matches_text(term, source_text)]


def _source_text(source: dict) -> str:
    parts: list[str] = []
    for key in ["name", "url", "source_type", "freshness"]:
        if source.get(key):
            parts.append(str(source[key]))
    supports = source.get("supports") or []
    if isinstance(supports, list):
        parts.extend(str(value) for value in supports)
    return _normalize_source_term(" ".join(parts))


def _source_ref(source: dict, source_index: int) -> dict:
    return {
        "source_index": source_index,
        "evidence_id": source.get("evidence_id"),
        "name": source.get("name"),
        "url": source.get("url"),
        "source_type": source.get("source_type"),
    }


def _evidence_sources(evidence_json: dict) -> list[dict]:
    sources: list[dict] = []
    for claim in evidence_json.get("claims", []) or []:
        sources.extend(source for source in claim.get("sources", []) or [] if isinstance(source, dict))
    for key in ["sources", "evidence"]:
        sources.extend(source for source in evidence_json.get(key, []) or [] if isinstance(source, dict))
    return sources


def source_coverage(evidence_json: dict, category: Optional[str] = None) -> dict:
    """Diagnose whether an evidence pack covers a category's source plan.

    This is a source-plan coverage diagnostic, not schema validation and not
    factual verification.
    """
    category = category or evidence_json.get("source_category")
    if not category:
        return {
            "implemented": True,
            "category": None,
            "valid_category": False,
            "error": "Missing source category: pass category or set evidence_json.source_category",
        }

    plan_result = _source_plan(category)
    if plan_result.get("error"):
        return {
            "implemented": True,
            "category": category,
            "valid_category": False,
            "error": plan_result["error"],
        }

    plan = plan_result["plan"]
    required = plan.get("must_check", []) or []
    supporting = plan.get("supporting_sources", []) or []
    sources = _evidence_sources(evidence_json)
    combined_text = " ".join(part for part in (_source_text(source) for source in sources) if part)

    explicit_missing = evidence_json.get("required_but_missing_sources", []) or []
    explicit_missing_text = " ".join(_normalize_source_term(item) for item in explicit_missing)

    covered_required: list[str] = []
    missing_required: list[str] = []
    required_source_details: list[dict] = []
    for required_source in required:
        aliases = SOURCE_COVERAGE_ALIASES.get(required_source, [])
        is_explicitly_missing = _term_matches_text(required_source, explicit_missing_text) or any(
            _term_matches_text(alias, explicit_missing_text) for alias in aliases
        )
        matched_sources = []
        for source_index, source in enumerate(sources):
            matched_terms = _source_match_terms(required_source, _source_text(source))
            if matched_terms:
                matched_sources.append({**_source_ref(source, source_index), "matched_terms": matched_terms})
        is_covered = bool(matched_sources)
        if is_covered and not is_explicitly_missing:
            covered_required.append(required_source)
            status = "covered"
        else:
            missing_required.append(required_source)
            status = "explicitly_missing" if is_explicitly_missing else "missing"
        required_source_details.append(
            {
                "required_source": required_source,
                "status": status,
                "matched_sources": matched_sources,
            }
        )

    covered_supporting = [
        source
        for source in supporting
        if _term_matches_text(source, combined_text)
        or any(_term_matches_text(alias, combined_text) for alias in SOURCE_COVERAGE_ALIASES.get(source, []))
    ]
    coverage_pct = round((len(covered_required) / len(required)) * 100, 1) if required else 100.0

    return {
        "implemented": True,
        "category": category,
        "valid_category": True,
        "required_sources": required,
        "covered_required_sources": covered_required,
        "missing_required_sources": missing_required,
        "required_source_details": required_source_details,
        "supporting_sources_present": covered_supporting,
        "coverage_pct": coverage_pct,
        "source_count": len(sources),
        "explicit_missing_sources": explicit_missing,
        "strict_gate_passed": not missing_required,
        "note": (
            "Source-plan coverage diagnostic only. Does not validate factual truth, "
            "discover sources, or change base validate-evidence schema semantics."
        ),
        "error": None,
    }


def score_output(before_text: str, after_text: str) -> dict:
    """Score a before/after output pair with the marker rubric used by examples."""
    if not before_text.strip():
        return {"implemented": True, "score": None, "error": "before_text must not be empty"}
    if not after_text.strip():
        return {"implemented": True, "score": None, "error": "after_text must not be empty"}
    result = score_before_after(before_text, after_text)
    result["error"] = None
    return result
