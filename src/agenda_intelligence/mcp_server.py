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
- ``check_memo_quality``: schema validity plus post-hoc evidence-readiness
  quality guardrails for Agenda memos.
- ``create_brief`` / ``append_evidence``: deterministic assembly of a brief or
  evidence pack from caller-supplied fields, validated on every call. They
  return the document to the caller and write nothing to disk.

Honest scope: schema-level only. None of these tools verify factual truth.
"""

import json
from importlib import resources
from typing import Optional

from agenda_intelligence import services as _services

PACKAGE_NAME = "agenda_intelligence"

# ---------------------------------------------------------------------------
# Validation helpers (re‑use the same schema loading as the CLI)
# ---------------------------------------------------------------------------


def _load_schema(schema_name: str) -> dict:
    """Load a JSON schema from the package data."""
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
    """Validate *data* against the named schema.

    Returns a dict with keys:
        implemented: True
        valid: bool
        errors: list[str]   (empty when valid; when invalid, ALL schema
                             errors are returned — not just the first — so an
                             agent can fix a payload in one pass instead of
                             one round-trip per missing field)
    """
    try:
        from jsonschema.validators import validator_for
    except ImportError:
        return {
            "implemented": False,
            "valid": None,
            "error": "jsonschema is not installed – cannot validate",
        }

    try:
        schema = _load_schema(schema_name)
        validator = validator_for(schema)(schema)
        errors = sorted(validator.iter_errors(data), key=lambda e: ([str(p) for p in e.path], e.message))
        if errors:
            return {"implemented": True, "valid": False, "errors": [e.message for e in errors]}
        return {"implemented": True, "valid": True, "errors": []}
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
    return _services.audit_claims(audit_json)


def get_schema(name: Optional[str] = None) -> dict:
    """Return a packaged JSON Schema so an agent can construct a valid payload.

    ``name`` accepts the manifest schema key (e.g. ``agenda_brief``), the file
    name (``agenda-brief.schema.json``), or the bare stem (``agenda-brief``).
    Call with no ``name`` to list the available schema keys.

    The schema registry is read from ``agent-manifest.json`` (ADR 0013: the
    manifest is the authoritative schema registry), so the set never drifts
    from the packaged ``schemas/v1/`` files. Contract discovery only: it does
    not validate data, fill in a template, or verify factual truth.
    """
    try:
        schemas = _load_manifest().get("schemas", {})
        index: dict[str, tuple[str, dict]] = {}
        for key, entry in schemas.items():
            base = entry["path"].rsplit("/", 1)[-1]
            stem = base.removesuffix(".schema.json")
            for alias in (key, base, stem):
                index[alias] = (key, entry)
        if name is None:
            return {
                "implemented": True,
                "available": [
                    {"name": key, "path": entry["path"], "schema_version": entry.get("schema_version")}
                    for key, entry in sorted(schemas.items())
                ],
                "count": len(schemas),
                "note": "Contract discovery only. Does not validate data or verify factual truth.",
                "error": None,
            }
        if name not in index:
            return {
                "implemented": True,
                "schema": None,
                "available": sorted(schemas),
                "error": f"Unknown schema: {name}",
            }
        key, entry = index[name]
        return {
            "implemented": True,
            "name": key,
            "path": entry["path"],
            "schema_version": entry.get("schema_version"),
            "schema": _load_data_json(entry["path"]),
            "error": None,
        }
    except Exception as e:
        return {"implemented": True, "schema": None, "error": str(e)}


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


def source_coverage(evidence_json: dict, category: Optional[str] = None) -> dict:
    """Diagnose whether an evidence pack covers a category's source plan.

    This is a source-plan coverage diagnostic, not schema validation and not
    factual verification. Missing source types are reported as gaps; callers may
    choose whether to treat gaps as a strict gate.
    """
    return _services.source_coverage(evidence_json, category)


def verify_quotes(pack_json: dict, texts: Optional[dict] = None) -> dict:
    """Verify that quoted fragments are present in the provided source texts.

    Checks two shapes against ``texts``:

    - evidence-pack ``sources`` / ``evidence`` items that carry a ``quote``;
    - span-level ``supporting_quotes`` ``{evidence_id, quote}`` harvested from
      the ``claims`` of an evidence-audit-shaped doc — each result carries the
      originating ``claim_id``.

    ``texts`` is an optional dict mapping ``evidence_id`` → plain text content.
    Quotes whose evidence has no matching entry in ``texts`` are reported as
    ``missing_source_text``.

    Scope: local-text only. Does not make outbound network requests, discover
    sources, score source reputation, gather live news, or verify factual truth.
    """
    import re
    import unicodedata

    def _normalize(s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        return re.sub(r"\s+", " ", s).strip().lower()

    resolved_texts: dict = texts or {}

    def _check(ident: str, quote: str) -> dict:
        source_text = resolved_texts.get(ident)
        if source_text is None:
            return {"id": ident, "status": "missing_source_text"}
        match = _normalize(quote) in _normalize(source_text)
        return {"id": ident, "status": "present" if match else "absent"}

    sources = pack_json.get("sources") or pack_json.get("evidence") or []
    results: list[dict] = []

    for source in sources:
        quote = source.get("quote") or source.get("quote_or_excerpt")
        if not quote:
            continue
        ident = source.get("evidence_id") or source.get("name", "source")
        results.append(_check(ident, quote))

    span_count = 0
    for claim in pack_json.get("claims", []) or []:
        claim_id = claim.get("claim_id")
        for sq in claim.get("supporting_quotes", []) or []:
            quote = sq.get("quote")
            ident = sq.get("evidence_id")
            if not quote or not ident:
                continue
            result = _check(ident, quote)
            result["claim_id"] = claim_id
            results.append(result)
            span_count += 1

    summary = {
        "total_quotes": len(results),
        "present": sum(1 for r in results if r["status"] == "present"),
        "absent": sum(1 for r in results if r["status"] == "absent"),
        "missing_source_text": sum(1 for r in results if r["status"] == "missing_source_text"),
        "from_supporting_quotes": span_count,
        "note": (
            "Local-text mode only. Does not fetch URLs, discover sources, score source reputation, "
            "gather live news, or verify factual truth."
        ),
    }
    return {"implemented": True, "summary": summary, "results": results}


def grounded_check(request_json: dict) -> dict:
    """Check whether a caller-supplied corpus lexically supports each claim.

    Deterministic term-overlap and verbatim-quote matching against caller-provided
    corpus documents (``grounded-check-request.schema.json``). Returns per-claim
    grounding status (grounded / weakly_grounded / ungrounded), best-matching
    passage, unmatched numeric values, quote checks, and owner actions.

    Scope: local-text claim-to-corpus consistency only. No outbound requests, no
    source discovery, no source-reliability scoring, no factual-truth
    verification. Human review is required before acting on any result.
    """
    return _services.grounded_check(request_json)


def verify_claims(request_json: dict) -> dict:
    """Return bounded factual verdicts from structured, supplied evidence."""
    return _services.verify_claims(request_json)


def score_output(before_text: str, after_text: str) -> dict:
    """Score a before/after output pair with the same marker rubric used by examples."""
    return _services.score_output(before_text, after_text)


def create_brief(fields: Optional[dict] = None) -> dict:
    """Assemble an agenda brief from supplied fields and report what is still missing.

    Returns the assembled document to the caller. It does not write files,
    retrieve sources, draft content, or verify factual truth.
    """
    return _services.create_brief(fields)


def append_evidence(request_json: Optional[dict] = None) -> dict:
    """Append a claim and its sources to an evidence pack, then re-validate.

    Returns the updated pack to the caller. It does not write files, fetch URLs,
    verify quotes, score source reliability, or verify factual truth.
    """
    return _services.append_evidence(request_json)


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


def check_memo_quality(memo_json: dict) -> dict:
    """Check a memo against schema validity plus post-hoc quality guardrails."""
    result = _product.check_memo_quality(memo_json)
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


def middle_corridor_deal_risk(request_json: dict) -> dict:
    """Run the Middle Corridor deal-risk gate on a structured request.

    Pre-compliance evidence triage only: no live retrieval, no factual-truth
    verification, no legal/compliance/sanctions advice. Human review required.
    """
    return _services.middle_corridor_deal_risk(request_json)


def cis_secondary_sanctions_exposure(request_json: dict) -> dict:
    """Run the CIS secondary-sanctions exposure triage on a structured request.

    Local stdio MCP does not wire live retrieval, so this operates on
    user-supplied evidence only. A name match is not identity verification.
    Pre-compliance evidence triage; human review required.
    """
    return _services.cis_secondary_sanctions_exposure(request_json, allow_live_retrieval=False)


def agentic_interaction_trust(request_json: dict) -> dict:
    """Run the agentic interaction trust gate on a structured request.

    Evidence triage for agent-mediated interactions only; not identity
    verification or authorization. Human review required.
    """
    return _services.agentic_interaction_trust(request_json)


def gulf_maritime_exposure(request_json: dict) -> dict:
    """Run the Gulf maritime exposure triage on a structured request.

    Evidence triage of maritime sanctions and chokepoint-disruption exposure
    for a vessel/voyage only. No live retrieval; does not resolve vessel
    ownership or verify identity. Human review required.
    """
    return _services.gulf_maritime_exposure(request_json)
