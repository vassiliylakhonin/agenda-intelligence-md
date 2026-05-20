"""
MCP-compatible tool functions for Agenda-Intelligence.md.

This module exposes pure Python functions over the packaged data and
schemas. The stdio server in :mod:`agenda_intelligence.mcp_stdio` registers
these as MCP tools.

Implemented (return ``implemented=True``):

- ``validate_brief`` / ``validate_evidence`` / ``audit_claims``: schema
  checks against the bundled JSON schemas. ``audit_claims`` additionally
  reports support-level distribution and orphan ``evidence_id`` refs.
- ``get_protocol`` / ``list_lenses`` / ``get_lens`` /
  ``list_source_categories`` / ``source_plan`` / ``source_coverage``:
  read-only access to packaged protocol, lens, and source-plan data.
- ``score_output``: heuristic before/after marker rubric.
- ``verify_quotes``: checks that cited quote fragments appear in caller-supplied
  source texts. Local-text only; does not make outbound network requests.

Honest scope: schema-level only. None of these tools verify factual truth.
"""

import json
from importlib import resources
from typing import Optional

from agenda_intelligence.eval import score_before_after

PACKAGE_NAME = "agenda_intelligence"

# ---------------------------------------------------------------------------
# Validation helpers (re‑use the same schema loading as the CLI)
# ---------------------------------------------------------------------------


def _load_schema(schema_name: str) -> dict:
    """Load a JSON schema from the package data."""
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / schema_name
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
    """Validate *data* against the named schema.

    Returns a dict with keys:
        implemented: True
        valid: bool
        errors: list[str]   (empty when valid)
    """
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


# ---------------------------------------------------------------------------
# MCP tool functions
# ---------------------------------------------------------------------------


def validate_brief(brief_json: dict) -> dict:
    """Validate an agenda‑brief dict against agenda‑brief.schema.json."""
    return _validate_json(brief_json, "agenda-brief.schema.json")


def validate_evidence(evidence_json: dict) -> dict:
    """Validate an evidence‑pack dict against evidence‑pack.schema.json."""
    return _validate_json(evidence_json, "evidence-pack.schema.json")


def audit_claims(audit_json: dict) -> dict:
    """Validate a claim-level evidence-audit dict against
    evidence-audit.schema.json and report a small summary:
    distribution of `support_level`, orphan evidence_id refs, and the
    count of explicitly listed `unsupported_claims`.

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
    for c in claims:
        levels[c["support_level"]] = levels.get(c["support_level"], 0) + 1
        missing = [eid for eid in c.get("evidence_ids", []) if eid not in evidence_ids]
        if missing:
            orphans.append({"claim_id": c["claim_id"], "missing_evidence_ids": missing})

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


def get_protocol(name: str) -> dict:
    """Return the requested protocol markdown."""
    try:
        manifest = _load_manifest()
        if name == "entrypoint":
            relative_path = manifest["entrypoint"]
        else:
            matches = [
                path
                for path in manifest["protocols"]
                if path.rsplit("/", 1)[-1] == name or path.rsplit("/", 1)[-1].removesuffix(".md") == name
            ]
            if not matches:
                return {
                    "implemented": True,
                    "protocol": None,
                    "error": f"Unknown protocol: {name}",
                }
            relative_path = matches[0]
        return {
            "implemented": True,
            "name": name,
            "path": relative_path,
            "protocol": _read_data_file(relative_path),
            "error": None,
        }
    except Exception as e:
        return {"implemented": True, "protocol": None, "error": str(e)}


def list_lenses(lens_type: Optional[str] = None) -> dict:
    """List available lenses."""
    try:
        lenses = _load_manifest()["lenses"]
        if lens_type is not None:
            if lens_type not in lenses:
                return {
                    "implemented": True,
                    "lenses": {},
                    "error": f"Unknown lens type: {lens_type}",
                }
            lenses = {lens_type: lenses[lens_type]}
        return {"implemented": True, "lenses": lenses, "error": None}
    except Exception as e:
        return {"implemented": True, "lenses": None, "error": str(e)}


def get_lens(lens_type: str, lens_id: str) -> dict:
    """Return a specific lens."""
    try:
        lenses = _load_manifest()["lenses"]
        relative_path = lenses[lens_type][lens_id]
        return {
            "implemented": True,
            "type": lens_type,
            "id": lens_id,
            "path": relative_path,
            "lens": _read_data_file(relative_path),
            "error": None,
        }
    except KeyError:
        return {
            "implemented": True,
            "lens": None,
            "error": f"Unknown lens: {lens_type}/{lens_id}",
        }
    except Exception as e:
        return {"implemented": True, "lens": None, "error": str(e)}


def source_plan(category: str) -> dict:
    """Return source requirements for a category."""
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


def list_source_categories() -> dict:
    """List packaged source requirement categories.

    This is category discovery for agents and CI configuration. It does not
    fetch sources, evaluate evidence coverage, or verify factual truth.
    """
    try:
        requirements = _load_manifest().get("source_acquisition", {}).get("requirements", {})
        categories = []
        for category in sorted(requirements):
            relative_path = requirements[category]
            plan = _load_data_json(relative_path)
            categories.append(
                {
                    "category": category,
                    "path": relative_path,
                    "must_check_count": len(plan.get("must_check", []) or []),
                    "supporting_sources_count": len(plan.get("supporting_sources", []) or []),
                    "watch_indicators_count": len(plan.get("watch_indicators", []) or []),
                }
            )
        return {
            "implemented": True,
            "category_ids": [item["category"] for item in categories],
            "categories": categories,
            "count": len(categories),
            "note": (
                "Source category discovery only. Does not discover sources, validate coverage, "
                "or verify factual truth."
            ),
            "error": None,
        }
    except Exception as e:
        return {"implemented": True, "category_ids": [], "categories": [], "count": 0, "error": str(e)}


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
    factual verification. Missing source types are reported as gaps; callers may
    choose whether to treat gaps as a strict gate.
    """
    category = category or evidence_json.get("source_category")
    if not category:
        return {
            "implemented": True,
            "category": None,
            "valid_category": False,
            "error": "Missing source category: pass category or set evidence_json.source_category",
        }

    plan_result = source_plan(category)
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


def verify_quotes(pack_json: dict, texts: Optional[dict] = None) -> dict:
    """Verify that quoted fragments in an evidence pack are present in the provided source texts.

    ``texts`` is an optional dict mapping ``evidence_id`` → plain text content.
    Sources without a matching entry in ``texts`` are reported as ``missing_source_text``.

    Scope: local-text only. Does not make outbound network requests, discover
    sources, score source reputation, gather live news, or verify factual truth.
    """
    import re
    import unicodedata

    def _normalize(s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        return re.sub(r"\s+", " ", s).strip().lower()

    sources = pack_json.get("sources") or pack_json.get("evidence") or []
    resolved_texts: dict = texts or {}
    results: list[dict] = []

    for source in sources:
        quote = source.get("quote") or source.get("quote_or_excerpt")
        if not quote:
            continue
        ident = source.get("evidence_id") or source.get("name", "source")
        source_text = resolved_texts.get(ident)
        if source_text is None:
            results.append({"id": ident, "status": "missing_source_text"})
            continue
        match = _normalize(quote) in _normalize(source_text)
        results.append({"id": ident, "status": "present" if match else "absent"})

    summary = {
        "total_quotes": len(results),
        "present": sum(1 for r in results if r["status"] == "present"),
        "absent": sum(1 for r in results if r["status"] == "absent"),
        "missing_source_text": sum(1 for r in results if r["status"] == "missing_source_text"),
        "note": (
            "Local-text mode only. Does not fetch URLs, discover sources, score source reputation, "
            "gather live news, or verify factual truth."
        ),
    }
    return {"implemented": True, "summary": summary, "results": results}


def score_output(before_text: str, after_text: str) -> dict:
    """Score a before/after output pair with the same marker rubric used by examples."""
    if not before_text.strip():
        return {"implemented": True, "score": None, "error": "before_text must not be empty"}
    if not after_text.strip():
        return {"implemented": True, "score": None, "error": "after_text must not be empty"}
    result = score_before_after(before_text, after_text)
    result["error"] = None
    return result


# ---------------------------------------------------------------------------
# Product-shell tools (Agenda Intelligence MCP product layer)
# ---------------------------------------------------------------------------

from agenda_intelligence import product as _product  # noqa: E402


def analyze(request: dict) -> dict:
    """Run the product-shell analyze pipeline.

    Validates the request against agenda-request.schema.json, routes the
    geography to in-repo regional / sector references, assembles a system
    prompt, optionally calls the Anthropic API when ANTHROPIC_API_KEY is
    set and the anthropic SDK is installed, then validates the returned
    memo against agenda-memo.schema.json. No live source retrieval.
    """
    return _product.analyze(request)


def validate_memo(memo_json: dict) -> dict:
    """Validate a memo dict against agenda-memo.schema.json."""
    result = _product.validate_memo(memo_json)
    return {"implemented": True, **result}


def list_signals() -> dict:
    """List vendored GTTA signals from the packaged index.json."""
    return _product.list_signals()


def get_signal(signal_id: str) -> dict:
    """Return a vendored signal markdown file by id."""
    return _product.get_signal(signal_id)


def deep_dive(aspect: Optional[str] = None) -> dict:
    """Reserved for v2. Returns a planned-status message."""
    return _product.deep_dive(aspect)
