"""Shared service-layer functions for Agenda Intelligence.

These functions contain reusable product behavior that can be called by MCP,
CLI, and a future HTTP API shell without making those adapters depend on each
other. They are stateless and do not persist caller payloads.
"""

from __future__ import annotations

import hashlib
import json
import re
from importlib import resources
from typing import Optional
from urllib.parse import urlparse

from agenda_intelligence import __version__, upstream_opensanctions
from agenda_intelligence.eval import score_before_after

PACKAGE_NAME = "agenda_intelligence"

SCHEMA_ID_BASE = "https://github.com/vassiliylakhonin/agenda-intelligence-md/schemas/v1"


def _input_digest(request_json: dict) -> str:
    """sha256 of the canonicalized request JSON.

    Canonical form: UTF-8, keys sorted, no insignificant whitespace. Same input
    reproduces the same digest, across runs and (by spec) across language ports.
    """
    canonical = json.dumps(request_json, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _run_provenance(request_json: dict, response_schema_name: str) -> dict:
    """Deterministic content-provenance stamp for a structured response.

    Records which contract version and response schema produced the output and a
    digest of the exact request input, so a downstream reviewer can confirm the
    artifact is reproducible. Reproducibility only — not a signature of
    authenticity, factuality, or clearance.
    """
    return {
        "contract_version": __version__,
        "schema_id": f"{SCHEMA_ID_BASE}/{response_schema_name}",
        "input_digest": _input_digest(request_json),
    }


MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO = [
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "sanctions_list_extract",
    "customs_or_regulatory_source",
    "insurance_clause_or_underwriter_note",
    "vessel_or_carrier_history",
]

MIDDLE_CORRIDOR_READINESS_CONTEXT = ["port_operator_notice", "carrier_note"]

CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW = [
    "ofac_sdn_extract",
    "eu_consolidated_extract",
    "ownership_chain_evidence",
    "bank_correspondent_evidence",
    "transit_or_invoice_evidence",
]

CIS_SECONDARY_SANCTIONS_READINESS_CONTEXT = [
    "uk_ofsi_extract",
    "dual_use_export_evidence",
    "adverse_media_evidence",
    "typology_reference",
    "customs_data_evidence",
]

AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION = [
    "agent_identity_claim",
    "operator_or_principal_authorization",
    "agent_card_or_manifest",
    "tool_scope_or_permission_evidence",
    "session_authentication_evidence",
    "action_intent_evidence",
    "transaction_or_target_action_evidence",
]

AGENTIC_INTERACTION_TRUST_READINESS_CONTEXT = [
    "mcp_or_a2a_endpoint_metadata",
    "rate_limit_or_abuse_signal",
    "fraud_or_account_takeover_signal",
    "device_or_infrastructure_evidence",
    "provider_policy_or_allowlist",
    "prior_interaction_history",
    "incident_report_or_threat_intel",
    "human_review_note",
]

GULF_MARITIME_REQUIRED_BEFORE_REVIEW = [
    "vessel_registry_extract",
    "pi_insurance_certificate",
    "ownership_or_control_evidence",
    "sanctions_list_extract",
    "ais_track_record",
]

GULF_MARITIME_READINESS_CONTEXT = [
    "flag_registry_record",
    "sts_transfer_evidence",
    "classification_society_record",
    "port_state_control_record",
    "cargo_or_bl_evidence",
    "adverse_media_evidence",
]

NOT_ADVICE_NOTICE = (
    "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, "
    "insurance, or trading advice."
)

GULF_NOT_ADVICE_NOTICE = (
    "Maritime sanctions and chokepoint-disruption evidence triage only. Not legal, sanctions, compliance, "
    "financial, investment, insurance, or trading advice. Does not resolve vessel ownership or verify identity."
)

AGENTIC_TRUST_NOT_ADVICE_NOTICE = (
    "Agentic interaction evidence triage only. Not cybersecurity monitoring, fraud adjudication, "
    "identity verification, transaction authorization, legal advice, compliance advice, or financial advice."
)


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
        from jsonschema.validators import validator_for
    except ImportError:
        return {
            "implemented": False,
            "valid": None,
            "errors": ["jsonschema is not installed – cannot validate"],
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


def _validation_failure(validation: dict) -> dict | None:
    """Build a service-envelope failure dict when validation did not pass.

    Returns ``None`` when the data is valid. Otherwise it distinguishes a
    schema-invalid payload (``valid`` is ``False``) from validation being
    unavailable (``valid`` is ``None`` — e.g. jsonschema is not installed or the
    schema failed to load) so callers and transports can separate a bad request
    from a server-side failure. The reason always rides along in ``errors``;
    previously a missing-dependency failure surfaced as ``valid: False`` with an
    empty ``errors`` list, which read like "invalid request, no reason given".
    """
    if validation.get("valid"):
        return None
    return {
        "implemented": validation.get("implemented", True),
        "valid": validation.get("valid"),
        "errors": validation.get("errors", []),
        "response": None,
    }


def audit_claims(audit_json: dict) -> dict:
    """Validate and summarize a claim-level evidence audit.

    Honest scope: schema-level only. Does not verify factual truth.
    """
    base = _validate_json(audit_json, "evidence-audit.schema.json")
    if not base.get("valid"):
        return {
            "implemented": base.get("implemented", True),
            "valid": base.get("valid"),
            "errors": base.get("errors", []),
            "summary": None,
        }

    claims = audit_json.get("claims", []) or []
    evidence = audit_json.get("evidence", []) or []
    evidence_ids = {e.get("evidence_id") for e in evidence}

    levels: dict = {}
    orphans: list = []
    span_orphans: list = []
    grounded_claim_count = 0
    for claim in claims:
        levels[claim["support_level"]] = levels.get(claim["support_level"], 0) + 1
        declared_ids = claim.get("evidence_ids", []) or []
        missing = [eid for eid in declared_ids if eid not in evidence_ids]
        if missing:
            orphans.append({"claim_id": claim["claim_id"], "missing_evidence_ids": missing})

        supporting_quotes = claim.get("supporting_quotes", []) or []
        if supporting_quotes:
            grounded_claim_count += 1
        declared_set = set(declared_ids)
        for sq in supporting_quotes:
            eid = sq.get("evidence_id")
            if eid not in declared_set:
                if eid in evidence_ids:
                    reason = "evidence_id not in claim.evidence_ids"
                else:
                    reason = "evidence_id not in evidence"
                span_orphans.append({"claim_id": claim["claim_id"], "evidence_id": eid, "reason": reason})

    return {
        "implemented": True,
        "valid": True,
        "errors": [],
        "summary": {
            "claim_count": len(claims),
            "evidence_count": len(evidence),
            "support_levels": levels,
            "orphan_evidence_refs": orphans,
            "grounded_claim_count": grounded_claim_count,
            "span_orphans": span_orphans,
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


_RESERVED_LINK_HOSTS = {"example.com", "example.org", "example.net", "localhost"}
_RESERVED_LINK_TLDS = (".example", ".test", ".invalid", ".localhost")
_LINK_PLACEHOLDER_TOKENS = {"tbd", "n/a", "na", "none", "xxx", "todo", "pending", "url"}


def _classify_source_url(url: str) -> str:
    """Classify a cited source URL by structural well-formedness.

    Returns ``well_formed``, ``illustrative`` (a documented placeholder host
    such as example.com — the repo's own example convention, not a defect), or
    ``malformed``. Structural lint only: it does not fetch the URL, verify that
    a page exists, perform live retrieval, or check content.
    """
    raw = (url or "").strip()
    if not raw or raw.lower() in _LINK_PLACEHOLDER_TOKENS:
        return "malformed"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "malformed"
    host = (parsed.hostname or "").lower()
    if host in _RESERVED_LINK_HOSTS or host.endswith(_RESERVED_LINK_TLDS):
        return "illustrative"
    return "well_formed"


def _link_integrity(sources: list[dict]) -> Optional[dict]:
    """Observe-only structural lint of cited source URLs.

    Returns a diagnostic block only when at least one supplied source carries a
    malformed URL; returns ``None`` otherwise so callers omit the field and
    leave existing output byte-identical. Never fetches URLs, never performs
    live retrieval, and never changes a triage recommendation or evidence gap.
    """
    checked = 0
    well_formed = 0
    illustrative = 0
    flagged: list[dict] = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        url = source.get("url")
        if not isinstance(url, str) or not url.strip():
            continue
        checked += 1
        verdict = _classify_source_url(url)
        if verdict == "well_formed":
            well_formed += 1
        elif verdict == "illustrative":
            illustrative += 1
        else:
            entry: dict = {"url": url, "reason": "url is not a well-formed http(s) link"}
            if isinstance(source.get("id"), str):
                entry["source_id"] = source["id"]
            if isinstance(source.get("source_type"), str):
                entry["source_type"] = source["source_type"]
            flagged.append(entry)
    if not flagged:
        return None
    return {
        "checked": checked,
        "well_formed": well_formed,
        "illustrative": illustrative,
        "flagged": flagged,
    }


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


WEEKLY_DELTA_RULES = [
    {
        "id": "lender_follow_up",
        "workstream": "Financing / lenders",
        "keywords": ["lender", "bank", "financing", "follow-up", "follow up", "term sheet", "term-sheet"],
        "proves": "Financing workstream activity or lender interaction is present.",
        "does_not_prove": "Committed capital, term-sheet readiness, credit approval, or financial close.",
        "evidence_state": "activity-only",
        "claim_type": "financing",
        "unsafe_claim": "Financing is progressing well.",
        "evidence_required": "Lender requirements checklist, term-sheet path, conditions precedent, and next evidence requested.",
        "owner": "CFO / M&A",
    },
    {
        "id": "customer_interest",
        "workstream": "Demand / offtake",
        "keywords": ["loi", "letter of intent", "customer", "client", "offtake", "prepayment", "demand"],
        "proves": "A demand signal or customer interaction exists.",
        "does_not_prove": "Binding demand, volume, term, pricing, credit support, or budget-owner approval.",
        "evidence_state": "weak evidence",
        "claim_type": "demand",
        "unsafe_claim": "Demand is secured.",
        "evidence_required": "Redacted customer evidence with volume, term, pricing logic, budget owner, and binding status.",
        "owner": "Commercial / CFO",
    },
    {
        "id": "vendor_procurement",
        "workstream": "Procurement / RFP",
        "keywords": ["rfp", "proposal", "vendor", "integrator", "oem", "tco", "shortlist"],
        "proves": "Procurement workstream activity or vendor evidence is present.",
        "does_not_prove": "Comparable pricing, deliverability, warranty, service model, or restriction clearance.",
        "evidence_state": "partial",
        "claim_type": "procurement",
        "unsafe_claim": "Procurement is ready for shortlist.",
        "evidence_required": "Comparable proposal matrix, TCO, delivery terms, warranties, service model, and restriction review.",
        "owner": "Procurement / CTO",
    },
    {
        "id": "partner_jv",
        "workstream": "Vendor / partner diligence",
        "keywords": ["partner", "jv", "joint venture", "localization", "lower capex", "cheaper", "cost reduction"],
        "proves": "A partner route or alternative structure was introduced.",
        "does_not_prove": "Deliverability, customer commitments, economics, references, or restriction clearance.",
        "evidence_state": "new weak evidence",
        "claim_type": "partner-diligence",
        "unsafe_claim": "The partner route improves economics or reduces CAPEX.",
        "evidence_required": "Written offer, scope, exclusions, references, customer proof, TCO comparison, and restriction assumptions.",
        "owner": "PMO / procurement",
    },
    {
        "id": "tax_customs",
        "workstream": "Tax / customs / incentives",
        "keywords": ["tax", "customs", "vat", "import duty", "incentive", "exemption", "offset"],
        "proves": "A tax, customs, or incentive workstream is active.",
        "does_not_prove": "Applicability, clearance, final treatment, or model-ready benefit.",
        "evidence_state": "unresolved",
        "claim_type": "tax-customs",
        "unsafe_claim": "Tax or customs treatment improves economics.",
        "evidence_required": "Adviser-reviewed memo or official-source-backed applicability analysis plus model sensitivity.",
        "owner": "Tax / legal",
    },
    {
        "id": "authority_governance",
        "workstream": "Governance / public authority",
        "keywords": ["public authority", "public-authority", "ministry", "government", "resolution", "regulator"],
        "proves": "Governance or public-authority engagement is active.",
        "does_not_prove": "Approved framework, final mandate, or resolved regulatory position.",
        "evidence_state": "activity-only",
        "claim_type": "governance",
        "unsafe_claim": "Public-authority support is resolved.",
        "evidence_required": "Approved decision log, final comments, signed mandate, or source-backed position.",
        "owner": "PMO / legal",
    },
    {
        "id": "risk_register",
        "workstream": "Risk register",
        "keywords": ["risk", "risk register", "mitigation", "contingency", "cost increase", "delay"],
        "proves": "A risk topic is visible.",
        "does_not_prove": "Risk ownership, mitigation, trigger, contingency, or committee-ready treatment.",
        "evidence_state": "partial",
        "claim_type": "risk",
        "unsafe_claim": "Project risks are mitigated.",
        "evidence_required": "Owner, trigger, mitigation, deadline, contingency, and evidence required for each material risk.",
        "owner": "PMO / risk owner",
    },
    {
        "id": "committee_readiness",
        "workstream": "Committee / FID readiness",
        "keywords": ["committee", "fid", "ready for", "board", "investment committee"],
        "proves": "A decision moment is being discussed.",
        "does_not_prove": "Decision readiness or evidence sufficiency.",
        "evidence_state": "decision-pressure",
        "claim_type": "decision-readiness",
        "unsafe_claim": "The project is ready for committee or FID approval.",
        "evidence_required": "Completed owner-action table, source pack, unresolved-blocker list, and unsafe-claims review.",
        "owner": "PMO / committee secretary",
    },
]


def _status_lines(status_text: str) -> list[str]:
    lines: list[str] = []
    for raw in status_text.splitlines():
        stripped = raw.strip(" \t-*•")
        if not stripped:
            continue
        lowered = stripped.lower()
        if "this input is synthetic" in lowered or "not based on a real project" in lowered:
            continue
        if len(stripped) > 220:
            parts = re.split(r"(?<=[.!?])\s+", stripped)
            lines.extend(part.strip() for part in parts if part.strip())
        else:
            lines.append(stripped)
    if not lines and status_text.strip():
        lines = [part.strip() for part in re.split(r"(?<=[.!?])\s+", status_text.strip()) if part.strip()]
    return lines


def _line_matches_rule(line: str, rule: dict) -> bool:
    lowered = line.lower()
    return any(keyword in lowered for keyword in rule["keywords"])


def _weekly_delta_bucket(matched_rule_ids: set[str], missing_required_sources: list[str]) -> tuple[str, str]:
    if not matched_rule_ids:
        return "unclear_due_to_missing_evidence", "insufficient_redacted_evidence"
    if {"committee_readiness", "customer_interest", "lender_follow_up"} <= matched_rule_ids:
        return "unclear_due_to_missing_evidence", "escalate_before_committee"
    if "committee_readiness" in matched_rule_ids:
        return "unclear_due_to_missing_evidence", "escalate_before_committee"
    if "vendor_procurement" in matched_rule_ids and ("customer_interest" in matched_rule_ids or "partner_jv" in matched_rule_ids):
        return "improved", "escalate_before_RFP_shortlist"
    if missing_required_sources:
        return "unchanged", "not_decision_ready"
    return "improved", "ready_for_human_review"


def _render_weekly_delta_markdown(payload: dict) -> str:
    def table(headers: list[str], rows: list[list[str]]) -> str:
        out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
        for row in rows:
            out.append("| " + " | ".join(str(cell).replace("\n", " ") for cell in row) + " |")
        return "\n".join(out)

    rows = payload["status_to_evidence"]
    claims = payload["new_claims"]
    actions = payload["owner_actions"]
    unsafe = payload["unsafe_to_repeat_claims"]

    parts = [
        "# Weekly Status Decision-Readiness Delta",
        "",
        f"Project alias: {payload['project_alias']}",
        f"Decision moment: {payload['decision_moment']}",
        f"Source category: {payload['category']}",
        f"Readiness delta: `{payload['readiness_delta']}`",
        f"Next decision route: `{payload['next_decision_route']}`",
        "",
        "Boundary: evidence-readiness only. Not legal, compliance, procurement, tax, customs, financial, "
        "sanctions, export-control, or investment advice. Does not verify factual truth.",
        "",
        "## Status-To-Evidence Conversion",
        "",
        table(
            ["Status update", "What it proves", "What it does not prove", "Evidence state"],
            [
                [row["status_update"], row["proves"], row["does_not_prove"], row["evidence_state"]]
                for row in rows[:12]
            ]
            or [["No matching status phrases found.", "Input was received.", "Decision readiness.", "insufficient"]],
        ),
        "",
        "## New Claims Introduced",
        "",
        table(
            ["Claim", "Claim type", "Evidence present", "Evidence gap", "Readiness"],
            [
                [
                    claim["claim"],
                    claim["claim_type"],
                    claim["evidence_present"],
                    claim["evidence_gap"],
                    claim["readiness"],
                ]
                for claim in claims
            ]
            or [["No claim candidates detected.", "unknown", "status text", "manual review required", "not assessable"]],
        ),
        "",
        "## Unsafe-To-Repeat Claims",
        "",
        table(
            ["Claim", "Why unsafe", "Evidence required before reuse", "Owner"],
            [
                [item["claim"], item["why_unsafe"], item["evidence_required_before_reuse"], item["owner"]]
                for item in unsafe
            ]
            or [["No unsafe claim pattern detected.", "Manual review still required.", "Source pack.", "PMO"]],
        ),
        "",
        "## Owner Actions",
        "",
        table(
            ["Priority", "Owner", "Action", "Evidence output expected"],
            [[item["priority"], item["owner"], item["action"], item["evidence_output_expected"]] for item in actions],
        ),
        "",
        "## Source-Plan Gaps",
        "",
    ]
    if payload["missing_required_sources"]:
        parts.extend(f"- {source}" for source in payload["missing_required_sources"])
    else:
        parts.append("- No source-plan gaps detected by this deterministic pass.")
    parts.extend(
        [
            "",
            "## Notes",
            "",
            "- Deterministic pass: keyword-based status-to-evidence conversion, not full semantic analysis.",
            "- Use this as a reviewer scaffold before committee, lender, RFP, or FID decisions.",
            "- Replace aliases and source IDs only inside private workflows; public examples must remain synthetic or redacted.",
        ]
    )
    return "\n".join(parts)


def weekly_status_delta(
    status_text: str,
    category: str = "ai-infrastructure-bankability",
    project_alias: str = "ProjectCo",
    decision_moment: str = "committee review",
    source_type: str = "weekly status",
) -> dict:
    """Convert a redacted weekly/status note into a decision-readiness scaffold.

    Deterministic and stateless. It does not call an LLM, verify factual truth,
    or decide whether the project should proceed.
    """
    if not status_text.strip():
        return {"implemented": True, "valid": False, "error": "status_text must not be empty"}

    plan_result = _source_plan(category)
    if plan_result.get("error"):
        return {"implemented": True, "valid": False, "error": plan_result["error"]}
    plan = plan_result["plan"]

    status_rows: list[dict] = []
    claims_by_rule: dict[str, dict] = {}
    unsafe_by_rule: dict[str, dict] = {}
    matched_rule_ids: set[str] = set()

    for line in _status_lines(status_text):
        for rule in WEEKLY_DELTA_RULES:
            if not _line_matches_rule(line, rule):
                continue
            matched_rule_ids.add(rule["id"])
            status_rows.append(
                {
                    "status_update": line,
                    "rule_id": rule["id"],
                    "workstream": rule["workstream"],
                    "proves": rule["proves"],
                    "does_not_prove": rule["does_not_prove"],
                    "evidence_state": rule["evidence_state"],
                }
            )
            claims_by_rule.setdefault(
                rule["id"],
                {
                    "claim": rule["unsafe_claim"],
                    "claim_type": rule["claim_type"],
                    "evidence_present": f"{source_type} phrase matched: {rule['id']}",
                    "evidence_gap": rule["evidence_required"],
                    "risk_if_repeated": rule["does_not_prove"],
                    "readiness": "weak" if rule["evidence_state"] != "missing" else "missing",
                    "owner": rule["owner"],
                },
            )
            unsafe_by_rule.setdefault(
                rule["id"],
                {
                    "claim": rule["unsafe_claim"],
                    "why_unsafe": rule["does_not_prove"],
                    "evidence_required_before_reuse": rule["evidence_required"],
                    "owner": rule["owner"],
                },
            )

    detected_source_terms = {
        "lender_follow_up": "financing_or_lender_requirements",
        "vendor_procurement": "procurement_or_rfp",
        "partner_jv": "vendor_oem_integrator_delivery_evidence",
        "customer_interest": "demand_or_offtake_evidence",
        "tax_customs": "tax_customs_incentives",
        "authority_governance": "project_mandate_or_decision_moment",
        "risk_register": "risk_register",
    }
    covered_required = sorted(
        {
            detected_source_terms[rule_id]
            for rule_id in matched_rule_ids
            if rule_id in detected_source_terms and detected_source_terms[rule_id] in (plan.get("must_check", []) or [])
        }
    )
    missing_required = [source for source in (plan.get("must_check", []) or []) if source not in covered_required]
    readiness_delta, next_route = _weekly_delta_bucket(matched_rule_ids, missing_required)

    owner_actions = []
    for rule in WEEKLY_DELTA_RULES:
        if rule["id"] not in matched_rule_ids:
            continue
        owner_actions.append(
            {
                "priority": "P0" if rule["id"] in {"customer_interest", "tax_customs", "committee_readiness"} else "P1",
                "owner": rule["owner"],
                "action": f"Convert {rule['workstream']} status into source-backed evidence.",
                "evidence_output_expected": rule["evidence_required"],
            }
        )
    if not owner_actions:
        owner_actions.append(
            {
                "priority": "P0",
                "owner": "PMO",
                "action": "Reformat the status note with explicit workstreams, source IDs, and owner actions.",
                "evidence_output_expected": "Redacted source pack with claim, source, support level, evidence gap, and owner.",
            }
        )

    payload = {
        "implemented": True,
        "valid": True,
        "error": None,
        "project_alias": project_alias,
        "decision_moment": decision_moment,
        "source_type": source_type,
        "category": category,
        "readiness_delta": readiness_delta,
        "next_decision_route": next_route,
        "status_to_evidence": status_rows,
        "new_claims": list(claims_by_rule.values()),
        "unsafe_to_repeat_claims": list(unsafe_by_rule.values()),
        "owner_actions": owner_actions,
        "covered_required_sources": covered_required,
        "missing_required_sources": missing_required,
        "source_plan_red_flags": plan.get("red_flags", []),
        "note": (
            "Deterministic evidence-readiness scaffold only. Does not verify factual truth, "
            "discover sources, or provide legal/compliance/procurement/tax/financial advice."
        ),
    }
    payload["markdown"] = _render_weekly_delta_markdown(payload)
    return payload


def _supplied_source_types(request_json: dict) -> list[str]:
    source_types: list[str] = []
    for source in request_json.get("dated_sources", []):
        if not isinstance(source, dict):
            continue
        source_type = source.get("source_type")
        if isinstance(source_type, str):
            source_types.append(source_type)
    return list(dict.fromkeys(source_types))


def _evidence_gap_for_source(source_type: str) -> str:
    gaps = {
        "counterparty_registry_extract": "No counterparty registry extract supplied.",
        "beneficial_ownership_source": "No beneficial ownership source supplied.",
        "sanctions_list_extract": "No sanctions screening result supplied.",
        "customs_or_regulatory_source": "No customs or regulatory source supplied.",
        "insurance_clause_or_underwriter_note": "No insurance clause or underwriter note supplied.",
        "vessel_or_carrier_history": "No carrier, vessel, or rail-operator history supplied.",
    }
    return gaps.get(source_type, f"No {source_type} supplied.")


def _middle_corridor_triage_recommendation(request_json: dict, missing_sources: list[str]) -> str:
    if not request_json.get("dated_sources"):
        return "insufficient_information"
    if not missing_sources:
        return "ready_for_human_review"
    if request_json.get("decision_stage") == "pre_signature":
        return "escalate_before_signature"
    if request_json.get("decision_stage") == "pre_shipment":
        return "escalate_before_shipment"
    return "not_decision_ready"


def _middle_corridor_risk_signal(request_json: dict, missing_sources: list[str]) -> str:
    if not request_json.get("dated_sources"):
        return "unknown"
    if len(missing_sources) >= 4:
        return "medium_high"
    if missing_sources:
        return "medium"
    return "low"


def _middle_corridor_readiness(request_json: dict, supplied_sources: list[str]) -> tuple[int, str]:
    if not request_json.get("dated_sources") or not supplied_sources:
        return 0, "insufficient_information"

    required_present = len(
        [source_type for source_type in MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO if source_type in supplied_sources]
    )
    context_present = len(
        [source_type for source_type in MIDDLE_CORRIDOR_READINESS_CONTEXT if source_type in supplied_sources]
    )
    score = min(
        100,
        round(
            10
            + (required_present / len(MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO)) * 70
            + (context_present / len(MIDDLE_CORRIDOR_READINESS_CONTEXT)) * 20
        ),
    )
    if score >= 85:
        return score, "review_ready"
    if score >= 50:
        return score, "partial"
    return score, "not_decision_ready"


def _middle_corridor_operational_decision(
    request_json: dict, triage_recommendation: str, risk_signal: str, readiness_score: int
) -> dict:
    """Logistics/ops-facing booking decision derived from the readiness score, risk signal, and stage.

    Restates the existing triage as the booking verb a forwarder/ops reader needs (quote, hold, or
    escalate?). Triage routing only - not clearance, approval, a sanctions determination, or advice.
    It never issues a hard reject (a compliance/legal call); it stops at hold or escalate. Human
    review remains required before any commercial action.
    """
    gate = {
        "pre_signature": "quote / sign the booking",
        "pre_shipment": "accept the booking and release for loading",
        "in_transit": "let the shipment continue",
        "post_incident": "clear the shipment post-incident",
        "committee_review": "take the committee decision",
    }.get(request_json.get("decision_stage", ""), "take the next commercial step")
    if "escalate" in triage_recommendation or "high" in risk_signal:
        decision = "escalate"
        rationale = f"Route to compliance or legal before you {gate}."
    elif readiness_score < 40:
        decision = "hold"
        rationale = f"Do not {gate} yet; request the missing evidence first."
    elif readiness_score < 70:
        decision = "proceed_with_conditions"
        rationale = f"Only {gate} after the evidence gaps are closed and assigned an owner."
    else:
        decision = "proceed"
        rationale = f"Evidence set looks complete; you may {gate}, subject to human sign-off."
    return {"decision": decision, "applies_to": gate, "rationale": rationale}


# Sanctions-relevant / high-risk jurisdictions for presence-flagging per ADR 0015.
# This is an escalation flag (route to human review), NOT a designation or legal
# conclusion. Comprehensively or sectorally sanctioned jurisdictions whose presence
# in a Middle Corridor counterparty set is a near-automatic human-review trigger.
# Lowercased; matched as substring against the counterparty jurisdiction field.
HIGH_RISK_JURISDICTIONS = {
    "russia": "Russia",
    "russian federation": "Russia",
    "belarus": "Belarus",
    "iran": "Iran",
    "north korea": "North Korea",
    "dprk": "North Korea",
    "syria": "Syria",
    "crimea": "Crimea",
    "donetsk": "Donetsk (non-government-controlled)",
    "luhansk": "Luhansk (non-government-controlled)",
}


# Re-export / circumvention-watch jurisdictions (ADR 0015 follow-up).
# These are NOT comprehensively or sectorally sanctioned. Their presence in a
# Middle Corridor counterparty set is a re-export / diversion watch item — verify
# end-use and onward destination — distinct from HIGH_RISK_JURISDICTIONS above and
# carrying a deliberately softer flag. Seeded with the most frequently cited
# parallel-import / transshipment corridors for sanctioned-origin goods.
# Lowercased; matched as substring against the counterparty jurisdiction field.
CIRCUMVENTION_WATCH_JURISDICTIONS = {
    "armenia": "Armenia",
    "georgia": "Georgia",
    "kyrgyzstan": "Kyrgyzstan",
    "uzbekistan": "Uzbekistan",
    "turkey": "Turkey",
    "turkiye": "Turkey",
    "united arab emirates": "United Arab Emirates",
    "uae": "United Arab Emirates",
}

# Jurisdictions where the EU has ACTUALLY activated its country-level
# anti-circumvention tool (Art. 12i-style country listing), as opposed to the
# broader circumvention-watch set above. Kyrgyzstan is the first activation, in
# the 20th sanctions package (2026-04): specific item categories (metalworking /
# CNC machining centres, telecom equipment) are restricted to the country to
# prevent onward re-export to Russia, and several regional financial institutions
# were transaction-banned in the same package. Sharper than circumvention-watch
# because a country-level restriction plus regional FI designations is live.
# Presence-flagging only; not a sanctions determination. Lowercased; substring
# match against the counterparty jurisdiction field.
COUNTRY_LEVEL_ANTI_CIRCUMVENTION = {
    "kyrgyzstan": "Kyrgyzstan",
}

# OFAC FAQ 1148 / 1151 named sectors of the Russian Federation economy. A
# counterparty operating in any of these (other than "other") is an FFI
# sanctions-exposure point under EO 14024 as amended by EO 14114. Presence-
# flagging based on the counterparty's declared sector(s); not a sanctions
# determination.
NAMED_SECTORS = {
    "technology": "technology",
    "defense_and_related_materiel": "defense and related materiel",
    "construction": "construction",
    "aerospace": "aerospace",
    "manufacturing": "manufacturing",
}

# Cutoff date for the OFAC FFI advisory "newly formed" red flag. Russia's
# further invasion of Ukraine on 2022-02-24 marked the start of the
# transshipment-hub pattern flagged in the advisory ("EXAMPLE OF HIGHER RISK
# CUSTOMER: A microelectronics exporter formed in March 2022 located in a
# high-risk jurisdiction"). Presence-flagging only; not a sanctions
# determination.
NEWLY_FORMED_COUNTERPARTY_CUTOFF = "2022-02-24"

# Additional transshipment-hub jurisdictions for the OFAC FFI advisory
# newly-formed red flag, drawn from the third-country hubs named across U.S.
# Treasury / BIS / partner advisories on Russia sanctions evasion (Miller &
# Chevalier and FPRI cite Kazakhstan, China, Hong Kong, and Cyprus as common
# transshipment points beyond the circumvention-watch list above). Used only
# by _newly_formed_counterparties, deliberately disjoint from HIGH_RISK and
# CIRCUMVENTION_WATCH so the existing presence / diversion flags are
# unaffected. Lowercased; substring match against counterparty jurisdiction.
TRANSSHIPMENT_HUB_JURISDICTIONS = {
    "kazakhstan": "Kazakhstan",
    "china": "China",
    "hong kong": "Hong Kong",
    "cyprus": "Cyprus",
}

# Deceptive-shipping-practice (DSP) indicators a maritime-leg sanctions review
# checks for, drawn from OFAC maritime guidance. Surfaced as a verification
# checklist when vessel / carrier history is not yet supplied. This is an
# evidence-gap checklist routed to human review — NOT vessel adjudication, AIS
# analysis, live retrieval, or insurance advice (ADR 0015 boundary).
VESSEL_DUE_DILIGENCE_INDICATORS = [
    "AIS continuity: check for extended transmission gaps or disablement over the voyage.",
    "Vessel identity consistency: check for MMSI / name / IMO manipulation or misclassification.",
    "Certificate-of-origin integrity: confirm shipping documents match declared cargo origin and destination.",
    "Ship-to-ship transfer history: check for undisclosed STS transfers along the route.",
    "Flag history: check for recent flag changes or registration with a high-risk registry.",
]

REEXPORT_CONTROL_INDICATORS = [
    "End-user statement: obtain a signed end-user / end-use statement naming the ultimate consignee.",
    "No-re-export clause: confirm the counterparty accepts a no-re-export / no-diversion contract clause.",
    "End-use consistency: check the stated end-use is consistent with the cargo type and the ordering party.",
    "Onward destination: confirm disclosure of any onward destination beyond the first delivery point.",
    "Order-vs-destination match: flag a stated end-user in a different country from the order origin.",
]

SOURCE_OF_FUNDS_INDICATORS = [
    "Source of funds: obtain evidence of the funds used for this deal (bank statement, loan or sale proceeds).",
    "Source of wealth: obtain evidence of the counterparty's overall wealth origin (business, prior trade).",
    "Consistency: check the declared source of funds fits the counterparty profile and the deal size.",
    "Payer match: confirm the paying entity and account match the contracting counterparty.",
    "Funds-jurisdiction flag: flag funds routed through a high-risk or sanctions-relevant jurisdiction.",
]

PEP_SCREENING_INDICATORS = [
    "PEP screening: screen each counterparty and its beneficial owners against PEP lists.",
    "Family and close associates: extend screening to immediate family and known close associates.",
    "Senior-management approval: confirm sign-off where a PEP relationship is identified.",
    "Source of funds/wealth: apply enhanced SOF/SOW checks for any identified PEP.",
    "Ongoing monitoring: apply enhanced monitoring for the duration of any PEP relationship.",
]

FRONT_COMPANY_INDICATORS = [
    "Business substance: confirm the counterparty is a real operating business, not a recently formed shell.",
    "Web and registry footprint: check for a verifiable web presence and a registry record that predates the deal.",
    "Address integrity: flag an address shared with multiple unrelated companies or with a sanctioned entity.",
    "Line-of-business fit: confirm the goods or service fit the counterparty's stated line of business.",
    "Representation: flag contact only via an intermediary with broad power of attorney, principals unavailable.",
]

# Middle Corridor connections that carry elevated sanctions-program exposure
# (OFAC Iran and Russia programs; sanctioned Caspian ports, operators, or
# vessels). Surfaced as a standing route-screening checklist. Presence-flagging
# routed to human review — NOT a sanctions determination, live screening, or
# legal advice (ADR 0015 boundary).
MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_CONNECTIONS = [
    "Iran transit legs (Rasht-Astara rail, Bandar Abbas / Chabahar sea): screen for OFAC Iran-program exposure.",
    "Russia Northern Corridor overlaps (Russian rail or territory as a leg or fallback): screen for diversion.",
    "Sanctioned Caspian ports, operators, or flagged vessels: screen operator and vessel against designations.",
    "Onward connection into a sanctions-relevant jurisdiction: confirm ultimate consignee and destination first.",
]

# Substring triggers that presence-flag a sanctions-exposed segment named in the
# free-text route. Match on the declared route string only — presence-flagging,
# not adjudication or live screening (ADR 0015 boundary).
MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_ROUTE_TERMS = [
    ("rasht", "Rasht-Astara (Iran) leg"),
    ("astara", "Rasht-Astara (Iran) leg"),
    ("bandar abbas", "Bandar Abbas (Iran) leg"),
    ("chabahar", "Chabahar (Iran) leg"),
    ("iran", "Iran transit leg"),
    ("northern corridor", "Russia Northern Corridor overlap"),
    ("russia", "Russia Northern Corridor overlap"),
    ("russian", "Russia Northern Corridor overlap"),
]

# Substring triggers that presence-flag a potential dual-use / export-controlled
# item named in the free-text cargo. Terms follow the BIS/EU Common High Priority
# List (CHPL) pattern of goods most diverted to sanctioned end-users. Match on the
# declared cargo string only — presence-flagging routed to human review, NOT an
# export-control classification, licensing determination, or live screening. This
# is the cargo-string dual-use flag deferred in ADR 0015, on the allowed side of
# its boundary.
MIDDLE_CORRIDOR_DUAL_USE_CARGO_TERMS = [
    ("microcontroller", "microcontrollers"),
    ("microprocessor", "microprocessors"),
    ("integrated circuit", "integrated circuits"),
    ("semiconductor", "semiconductors"),
    ("microelectronic", "microelectronics"),
    ("fpga", "FPGAs / programmable logic"),
    ("transceiver", "RF transceivers"),
    ("rf module", "RF modules"),
    ("rf amplifier", "RF amplifiers"),
    ("oscillator", "oscillators"),
    ("gnss", "GNSS / navigation modules"),
    ("gps module", "GPS / navigation modules"),
    ("gyroscope", "gyroscopes / inertial sensors"),
    ("accelerometer", "accelerometers / inertial sensors"),
    ("inertial measurement", "inertial measurement units"),
    ("cnc", "CNC / machine tools"),
    ("machine tool", "machine tools"),
    ("ball bearing", "precision bearings"),
    ("uav", "UAV / drone components"),
    ("drone", "UAV / drone components"),
    ("thermal imaging", "thermal-imaging / night-vision optics"),
    ("night vision", "thermal-imaging / night-vision optics"),
    ("carbon fiber", "carbon-fibre materials"),
    ("carbon fibre", "carbon-fibre materials"),
]

# Customs-regime review items for the Middle Corridor: harmonized digital-customs
# transit (eTIR; adopted by Organization of Turkic States members) versus
# unharmonized national permitting, which remains a recurring barrier to
# private-sector corridor use. Surfaced as evidence-gap review prompts — NOT
# customs, legal, or compliance advice (ADR 0015 boundary).
MIDDLE_CORRIDOR_CUSTOMS_HARMONIZATION_INDICATORS = [
    "Permitting clarity: confirm licenses and permits needed at each crossing; flag any unharmonized leg.",
    "Harmonized transit: check which crossings run under eTIR or another harmonized digital-customs regime.",
    "Document acceptance: confirm transit documents are accepted at all crossings without re-declaration.",
    "Tariff consistency: confirm cargo tariff classification and duties are consistent across corridor states.",
    "Customs-rule change watch: flag recent customs-rule or enforcement changes at any crossing on the route.",
    "Rail gauge-change points: confirm transloading and gauge-change handling and capacity at Khorgos / Altynkol "
    "and at the Caspian rail-ferry interchange (the corridor is rail-dominant, not maritime).",
    "Caspian dwell exposure: flag demurrage, wagon-detention, and ferry-slot risk at Aktau / Kuryk and onward "
    "Black Sea ports.",
]


def _matched_sanctions_exposed_segments(route_text: str) -> list[str]:
    """Presence-flag sanctions-exposed corridor segments named in the route text.

    Case-insensitive substring match on the declared route string only. Per ADR
    0015 this is presence-flagging routed to human review, NOT a sanctions
    determination, live screening, or legal advice.
    """
    text = (route_text or "").lower()
    matched: list[str] = []
    for term, label in MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_ROUTE_TERMS:
        if term in text and label not in matched:
            matched.append(label)
    return matched


def _matched_dual_use_cargo_terms(cargo_text: str) -> list[str]:
    """Presence-flag potential dual-use / export-controlled items named in the cargo text.

    Case-insensitive substring match on the declared cargo string only. Per ADR 0015
    (cargo-string dual-use detection) this is presence-flagging routed to human review,
    NOT an export-control classification, licensing determination, or live screening.
    """
    text = (cargo_text or "").lower()
    matched: list[str] = []
    for term, label in MIDDLE_CORRIDOR_DUAL_USE_CARGO_TERMS:
        if term in text and label not in matched:
            matched.append(label)
    return matched


def _high_risk_jurisdiction_counterparties(request_json: dict) -> list[dict]:
    """Flag counterparties domiciled in a sanctions-relevant / high-risk jurisdiction.

    Per ADR 0015 this is presence-flagging, not adjudication: it surfaces that a
    counterparty's declared jurisdiction matches a known high-risk list and routes
    to human review. It does not determine that a sanction applies.
    """
    flagged: list[dict] = []
    for cp in request_json.get("counterparties", []) or []:
        if not isinstance(cp, dict):
            continue
        jurisdiction = cp.get("jurisdiction")
        if not isinstance(jurisdiction, str):
            continue
        lowered = jurisdiction.lower()
        for token, label in HIGH_RISK_JURISDICTIONS.items():
            if token in lowered:
                flagged.append(
                    {
                        "name": cp.get("name", "unnamed counterparty"),
                        "role": cp.get("role", "unknown"),
                        "jurisdiction": jurisdiction,
                        "matched": label,
                    }
                )
                break
    return flagged


def _circumvention_watch_counterparties(request_json: dict) -> list[dict]:
    """Flag counterparties in a re-export / circumvention-watch jurisdiction.

    Softer sibling of _high_risk_jurisdiction_counterparties: these jurisdictions
    are not comprehensively sanctioned, but their presence is a re-export /
    diversion watch item. Presence-flagging only, not adjudication.
    """
    flagged: list[dict] = []
    for cp in request_json.get("counterparties", []) or []:
        if not isinstance(cp, dict):
            continue
        jurisdiction = cp.get("jurisdiction")
        if not isinstance(jurisdiction, str):
            continue
        lowered = jurisdiction.lower()
        # A comprehensively high-risk jurisdiction takes precedence over the
        # softer watch flag; do not double-flag the same counterparty.
        if any(token in lowered for token in HIGH_RISK_JURISDICTIONS):
            continue
        for token, label in CIRCUMVENTION_WATCH_JURISDICTIONS.items():
            if token in lowered:
                flagged.append(
                    {
                        "name": cp.get("name", "unnamed counterparty"),
                        "role": cp.get("role", "unknown"),
                        "jurisdiction": jurisdiction,
                        "matched": label,
                    }
                )
                break
    return flagged


def _named_sector_counterparties(request_json: dict) -> list[dict]:
    """Flag counterparties operating in an OFAC-named sector (FAQ 1148 / 1151).

    Per OFAC, foreign financial institutions are exposed to sanctions under
    EO 14024 as amended by EO 14114 for facilitating transactions involving
    persons operating in the technology, defense and related materiel,
    construction, aerospace, or manufacturing sectors of the Russian
    Federation economy. This is presence-flagging based on the counterparty's
    declared sector(s); it does not adjudicate whether a sanction applies.
    """
    flagged: list[dict] = []
    for cp in request_json.get("counterparties", []) or []:
        if not isinstance(cp, dict):
            continue
        sectors = cp.get("specified_sectors") or []
        if not isinstance(sectors, list):
            continue
        named = [NAMED_SECTORS[s] for s in sectors if isinstance(s, str) and s in NAMED_SECTORS]
        if not named:
            continue
        flagged.append(
            {
                "name": cp.get("name", "unnamed counterparty"),
                "role": cp.get("role", "unknown"),
                "sectors": named,
            }
        )
    return flagged


def _newly_formed_counterparties(request_json: dict) -> list[dict]:
    """Flag counterparties newly formed on or after 2022-02-24 in a high-risk
    or circumvention-watch jurisdiction.

    Mirrors the OFAC FFI advisory red flag: "EXAMPLE OF HIGHER RISK CUSTOMER:
    A microelectronics exporter formed in March 2022 located in a high-risk
    jurisdiction". Presence-flagging only; not a sanctions determination.
    """
    flagged: list[dict] = []
    for cp in request_json.get("counterparties", []) or []:
        if not isinstance(cp, dict):
            continue
        date_of_formation = cp.get("date_of_formation")
        if not isinstance(date_of_formation, str) or date_of_formation < NEWLY_FORMED_COUNTERPARTY_CUTOFF:
            continue
        jurisdiction = cp.get("jurisdiction")
        if not isinstance(jurisdiction, str):
            continue
        lowered = jurisdiction.lower()
        matched_label = None
        for source in (HIGH_RISK_JURISDICTIONS, CIRCUMVENTION_WATCH_JURISDICTIONS, TRANSSHIPMENT_HUB_JURISDICTIONS):
            for token, label in source.items():
                if token in lowered:
                    matched_label = label
                    break
            if matched_label is not None:
                break
        if matched_label is None:
            continue
        flagged.append(
            {
                "name": cp.get("name", "unnamed counterparty"),
                "role": cp.get("role", "unknown"),
                "jurisdiction": jurisdiction,
                "date_of_formation": date_of_formation,
                "matched": matched_label,
            }
        )
    return flagged


def _middle_corridor_top_risks(
    missing_sources: list[str],
    high_risk_jurisdictions: bool = False,
    circumvention_watch: bool = False,
    named_sector_present: bool = False,
    newly_formed_present: bool = False,
    dual_use_present: bool = False,
) -> list[str]:
    risks = ["sanctions adjacency", "Caspian crossing capacity and draft exposure"]
    if high_risk_jurisdictions:
        risks.insert(0, "counterparty in a sanctions-relevant / high-risk jurisdiction")
    if dual_use_present:
        risks.insert(0, "cargo includes a potential dual-use / export-controlled item")
    if circumvention_watch:
        risks.append("counterparty in a re-export / circumvention-watch jurisdiction")
    if named_sector_present:
        risks.append("counterparty operates in an OFAC-named sector under EO 14024")
    if newly_formed_present:
        risks.append("counterparty newly formed in a transshipment-risk jurisdiction")
    if "customs_or_regulatory_source" in missing_sources:
        risks.append("customs and documentation uncertainty")
    if "insurance_clause_or_underwriter_note" in missing_sources:
        risks.append("insurance exclusions or coverage limitations")
    if "counterparty_registry_extract" in missing_sources or "beneficial_ownership_source" in missing_sources:
        risks.append("counterparty and ownership uncertainty")
    if "vessel_or_carrier_history" in missing_sources:
        risks.append("carrier / vessel / rail-operator history gap")
    return list(dict.fromkeys(risks))


def _middle_corridor_exposure_layers(
    missing_sources: list[str],
    high_risk_jurisdictions: bool = False,
    circumvention_watch: bool = False,
    named_sector_present: bool = False,
    newly_formed_present: bool = False,
) -> dict:
    """Decompose the risk picture into the two layers a practitioner separates:
    home-jurisdiction legal / documentation posture (not assessed here) versus
    foreign / secondary-sanctions exposure. Structural decomposition only; not a
    legal or sanctions determination.
    """
    domestic_legal_layer = [
        (
            "Home-jurisdiction legal and licensing posture not assessed here "
            "(this product does not verify export-control licensing or documentation); "
            "confirm with qualified review."
        )
    ]
    if "customs_or_regulatory_source" in missing_sources:
        domestic_legal_layer.append("No customs or regulatory source supplied to review documentation posture.")

    foreign_sanctions_exposure_layer = [
        "Secondary / extraterritorial sanctions adjacency present; exposure not adjudicated."
    ]
    if high_risk_jurisdictions:
        foreign_sanctions_exposure_layer.append(
            "Counterparty in a sanctions-relevant / high-risk jurisdiction — escalation flag, not a determination."
        )
    if circumvention_watch:
        foreign_sanctions_exposure_layer.append(
            "Counterparty in a re-export / circumvention-watch jurisdiction — verify end-use and onward destination."
        )
    if named_sector_present:
        foreign_sanctions_exposure_layer.append(
            "Counterparty operates in an OFAC-named sector (FAQ 1148 / 1151) — FFI sanctions-exposure flag under "
            "EO 14024 / EO 14114, not a determination."
        )
    if newly_formed_present:
        foreign_sanctions_exposure_layer.append(
            "Counterparty newly formed in a transshipment-risk jurisdiction (OFAC FFI advisory red flag) — "
            "escalation flag for human review, not a determination."
        )
    if "sanctions_list_extract" in missing_sources:
        foreign_sanctions_exposure_layer.append(
            "No sanctions screening result supplied to review listed-party exposure."
        )
    if "beneficial_ownership_source" in missing_sources:
        foreign_sanctions_exposure_layer.append(
            "No beneficial ownership source — indirect / ownership-based exposure cannot be reviewed; the "
            "OFAC/EU 50 Percent Rule (aggregate blocked-person ownership) is a human-review step the file is "
            "not yet ready for."
        )
    return {
        "domestic_legal_layer": domestic_legal_layer,
        "foreign_sanctions_exposure_layer": foreign_sanctions_exposure_layer,
    }


def _middle_corridor_counterparty_readiness(
    request_json: dict, supplied_sources: list[str], missing_sources: list[str]
) -> dict:
    """Outward-facing reframe of the same evidence-gap picture, for the party that must
    PRESENT a due-diligence dossier to a bank, insurer, or counterparty under enhanced
    due diligence -- not the internal analyst deciding whether to escalate.

    Derived entirely from the required-before-go contract and supplied sources. Reports
    dossier-completeness only; not clearance, approval, sanctions advice, or compliance advice.
    """
    required_total = len(MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO)
    outstanding = [s for s in missing_sources if s in MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO]
    missing_count = len(outstanding)
    supplied_count = required_total - missing_count
    if not request_json.get("dated_sources") or not supplied_sources:
        status = "insufficient_information"
    elif missing_count == 0:
        status = "complete_for_review"
    elif supplied_count > 0:
        status = "partial"
    else:
        status = "incomplete"
    # Per-document ledger: EDD guidance prescribes tracking each required item with the
    # date it was received (chain-of-custody / "date requested, date received" practice).
    # date_received is the earliest supplied dated_source of that type, when present.
    received_dates: dict[str, str] = {}
    for source in request_json.get("dated_sources") or []:
        source_type = source.get("source_type")
        date = source.get("date")
        if source_type and date and (source_type not in received_dates or date < received_dates[source_type]):
            received_dates[source_type] = date
    document_ledger = []
    for source_type in MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO:
        entry = {
            "source_type": source_type,
            "status": "received" if source_type in supplied_sources else "missing",
        }
        if source_type in received_dates:
            entry["date_received"] = received_dates[source_type]
        document_ledger.append(entry)
    return {
        "status": status,
        "required_total": required_total,
        "supplied_count": supplied_count,
        "missing_count": missing_count,
        "outstanding_documents": outstanding,
        "document_ledger": document_ledger,
        "presentable_note": (
            "Dossier-completeness view for presenting enhanced-due-diligence evidence to a bank, "
            "insurer, or counterparty. Tracks completeness of the required-before-go evidence set only; "
            "it is not clearance, approval, a sanctions determination, or compliance advice. Human review "
            "is required before any commercial action."
        ),
    }


def middle_corridor_deal_risk(request_json: dict) -> dict:
    """Build a structured Middle Corridor deal-risk response.

    This is pre-compliance evidence triage only. It does not perform live
    retrieval, factual-truth verification, or legal/compliance/sanctions advice.
    """
    request_failure = _validation_failure(_validate_json(request_json, "middle-corridor-deal-risk-request.schema.json"))
    if request_failure is not None:
        return request_failure

    supplied_sources = _supplied_source_types(request_json)
    missing_sources = [
        source_type for source_type in MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO if source_type not in supplied_sources
    ]
    flagged_jurisdictions = _high_risk_jurisdiction_counterparties(request_json)
    flagged_circumvention = _circumvention_watch_counterparties(request_json)
    flagged_named_sectors = _named_sector_counterparties(request_json)
    flagged_newly_formed = _newly_formed_counterparties(request_json)
    readiness_score, readiness_label = _middle_corridor_readiness(request_json, supplied_sources)
    triage_recommendation = _middle_corridor_triage_recommendation(request_json, missing_sources)
    risk_signal = _middle_corridor_risk_signal(request_json, missing_sources)
    matched_sanctions_segments = _matched_sanctions_exposed_segments(request_json.get("route", ""))
    matched_dual_use = _matched_dual_use_cargo_terms(request_json.get("cargo", ""))
    response = {
        "triage_recommendation": triage_recommendation,
        "risk_signal": risk_signal,
        "decision_readiness_score": readiness_score,
        "decision_readiness_label": readiness_label,
        "operational_decision": _middle_corridor_operational_decision(
            request_json, triage_recommendation, risk_signal, readiness_score
        ),
        "route": request_json["route"],
        "cargo": request_json["cargo"],
        "counterparties": request_json["counterparties"],
        "supplied_sources": supplied_sources,
        "minimum_sources_before_go": missing_sources,
        "evidence_gaps": [_evidence_gap_for_source(source_type) for source_type in missing_sources],
        "top_risks": _middle_corridor_top_risks(
            missing_sources,
            bool(flagged_jurisdictions),
            bool(flagged_circumvention),
            bool(flagged_named_sectors),
            bool(flagged_newly_formed),
            bool(matched_dual_use),
        ),
        "exposure_layers": _middle_corridor_exposure_layers(
            missing_sources,
            bool(flagged_jurisdictions),
            bool(flagged_circumvention),
            bool(flagged_named_sectors),
            bool(flagged_newly_formed),
        ),
        "watch_next": [
            "new sanctions designations",
            "Caspian ferry-slot, tonnage, or draft notice",
            "port delays or operator notices",
            "customs rule or enforcement changes",
            "carrier or vessel history updates",
            "insurance term changes",
        ],
        "human_review_required": True,
        "not_advice_notice": NOT_ADVICE_NOTICE,
        "counterparty_readiness": _middle_corridor_counterparty_readiness(
            request_json, supplied_sources, missing_sources
        ),
        "route_sanctions_exposure_indicators": list(MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_CONNECTIONS),
        "customs_harmonization_indicators": list(MIDDLE_CORRIDOR_CUSTOMS_HARMONIZATION_INDICATORS),
        "run_provenance": _run_provenance(request_json, "middle-corridor-deal-risk-response.schema.json"),
    }
    limitations: list[str] = []
    if flagged_jurisdictions:
        named = ", ".join(f"{c['name']} ({c['role']}, {c['jurisdiction']})" for c in flagged_jurisdictions)
        limitations.append(
            "One or more counterparties are domiciled in a sanctions-relevant / high-risk jurisdiction "
            f"({named}); this is an escalation flag for human review, not a sanctions determination. "
            "Confirm end-use, ownership, and applicable restrictions before any commercial action."
        )
    if flagged_circumvention:
        named_cw = ", ".join(f"{c['name']} ({c['role']}, {c['jurisdiction']})" for c in flagged_circumvention)
        limitations.append(
            "One or more counterparties are domiciled in a re-export / circumvention-watch jurisdiction "
            f"({named_cw}); this is a diversion watch item for human review, not a sanctions determination. "
            "Verify end-use and onward destination before any commercial action."
        )
    if flagged_named_sectors:
        named_ns = ", ".join(
            f"{c['name']} ({c['role']}, sectors: {'/'.join(c['sectors'])})" for c in flagged_named_sectors
        )
        limitations.append(
            "One or more counterparties operate in an OFAC-named sector of the Russian Federation economy "
            f"({named_ns}); this is an FFI sanctions-exposure escalation flag under EO 14024 as amended by "
            "EO 14114, not a sanctions determination. Confirm end-use and applicable restrictions before any "
            "commercial action."
        )
    if flagged_newly_formed:
        named_nf = ", ".join(
            f"{c['name']} ({c['role']}, {c['jurisdiction']}, formed {c['date_of_formation']})"
            for c in flagged_newly_formed
        )
        limitations.append(
            "One or more counterparties were newly formed in a transshipment-risk jurisdiction "
            f"({named_nf}); this matches an OFAC FFI advisory red-flag pattern and is an escalation flag for "
            "human review, not a sanctions determination."
        )
    if matched_sanctions_segments:
        named_seg = ", ".join(matched_sanctions_segments)
        limitations.append(
            "The declared route references one or more connections flagged as sanctions-exposed "
            f"({named_seg}); this is a route-screening escalation flag for human review, not a sanctions "
            "determination. Screen the specific connection, its operators, and any onward destination "
            "before any commercial action."
        )
    if matched_dual_use:
        named_du = ", ".join(matched_dual_use)
        limitations.append(
            "The declared cargo references one or more potential dual-use / export-controlled items "
            f"({named_du}); under the BIS/EU Common High Priority List pattern this is an export-control "
            "escalation flag for human review, not a classification or licensing determination. Obtain an "
            "end-use / end-user statement and confirm export-control classification before any commercial "
            "action."
        )
    if matched_dual_use and "end_user_or_reexport_evidence" not in supplied_sources:
        limitations.append(
            "The file presents a potential dual-use / export-controlled cargo but no end-user / re-export "
            "evidence is on hand; obtain a signed end-user statement before signature. This is an "
            "evidence-readiness gap for human review, not a licensing determination."
        )
    if limitations:
        response["limitations"] = limitations
    if matched_sanctions_segments:
        response["route_sanctions_matched_segments"] = list(matched_sanctions_segments)
    if "vessel_or_carrier_history" in missing_sources:
        response["vessel_due_diligence_indicators"] = list(VESSEL_DUE_DILIGENCE_INDICATORS)
    if matched_dual_use or "end_user_or_reexport_evidence" not in supplied_sources:
        response["reexport_control_indicators"] = list(REEXPORT_CONTROL_INDICATORS)
    if "source_of_funds_or_wealth_evidence" not in supplied_sources:
        response["source_of_funds_indicators"] = list(SOURCE_OF_FUNDS_INDICATORS)
    if "pep_screening_evidence" not in supplied_sources:
        response["pep_screening_indicators"] = list(PEP_SCREENING_INDICATORS)
    if "business_substance_evidence" not in supplied_sources:
        response["front_company_indicators"] = list(FRONT_COMPANY_INDICATORS)
    if "shipment_value" in request_json:
        response["shipment_value"] = request_json["shipment_value"]
    link_integrity = _link_integrity(request_json.get("dated_sources", []) or [])
    if link_integrity is not None:
        response["link_integrity"] = link_integrity

    response_validation = _validate_json(response, "middle-corridor-deal-risk-response.schema.json")
    return {
        "implemented": response_validation.get("implemented", True),
        "valid": response_validation.get("valid"),
        "errors": response_validation.get("errors", []),
        "response": response,
    }


# ---------------------------------------------------------------------------
# Agentic interaction trust (vertical worker)
# ---------------------------------------------------------------------------


def _agentic_evidence_gap_for_source(source_type: str) -> str:
    gaps = {
        "agent_identity_claim": "No agent identity claim supplied.",
        "operator_or_principal_authorization": "No operator or principal authorization supplied.",
        "agent_card_or_manifest": "No agent card or signed manifest supplied.",
        "tool_scope_or_permission_evidence": "No tool-scope or permission evidence supplied.",
        "session_authentication_evidence": "No session authentication evidence supplied.",
        "action_intent_evidence": "No action-intent evidence supplied.",
        "transaction_or_target_action_evidence": "No transaction or target-action evidence supplied.",
        "provider_policy_or_allowlist": "No provider policy or allowlist record supplied.",
    }
    return gaps.get(source_type, f"No {source_type} supplied.")


def _agentic_trust_readiness(request_json: dict, supplied_sources: list[str]) -> tuple[int, str]:
    if not request_json.get("dated_sources") or not supplied_sources:
        return 0, "insufficient_information"

    required_present = len([s for s in AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION if s in supplied_sources])
    context_present = len([s for s in AGENTIC_INTERACTION_TRUST_READINESS_CONTEXT if s in supplied_sources])
    score = min(
        100,
        round(
            10
            + (required_present / len(AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION)) * 70
            + (context_present / len(AGENTIC_INTERACTION_TRUST_READINESS_CONTEXT)) * 20
        ),
    )
    if score >= 85:
        return score, "review_ready"
    if score >= 50:
        return score, "partial"
    return score, "not_decision_ready"


def _agentic_trust_signal(request_json: dict, supplied_sources: list[str], missing_sources: list[str]) -> str:
    if not request_json.get("dated_sources"):
        return "unknown"
    if "fraud_or_account_takeover_signal" in supplied_sources:
        return "low"
    if "rate_limit_or_abuse_signal" in supplied_sources and len(missing_sources) >= 4:
        return "unknown"
    if len(missing_sources) >= 5:
        return "unknown"
    if len(missing_sources) >= 3:
        return "medium"
    if missing_sources:
        return "medium_high"
    return "high"


def _agentic_triage_recommendation(request_json: dict, supplied_sources: list[str], missing_sources: list[str]) -> str:
    if not request_json.get("dated_sources"):
        return "insufficient_information"
    if "fraud_or_account_takeover_signal" in supplied_sources:
        return "block_until_verified"

    target_surface = request_json.get("target_surface")
    decision_stage = request_json.get("decision_stage")
    if not missing_sources:
        return "allow_low_risk"
    if target_surface in {"checkout", "auth_flow", "account"} and len(missing_sources) <= 4:
        return "require_step_up"
    if target_surface in {"a2a_endpoint", "mcp_tool"} or "rate_limit_or_abuse_signal" in supplied_sources:
        return "escalate_to_human_review"
    if decision_stage in {"policy_review", "committee_review"}:
        return "not_decision_ready"
    return "escalate_to_human_review"


def _agentic_top_risk_dimensions(
    request_json: dict, supplied_sources: list[str], missing_sources: list[str]
) -> list[str]:
    dims: list[str] = []
    target_surface = request_json.get("target_surface")
    if "operator_or_principal_authorization" in missing_sources:
        dims.append("delegated action authority is not evidenced")
    if "agent_card_or_manifest" in missing_sources:
        dims.append("agent identity is declared but not independently anchored")
    if "tool_scope_or_permission_evidence" in missing_sources:
        dims.append("requested tool or action scope is not evidenced")
    if "action_intent_evidence" in missing_sources:
        dims.append("action intent is not evidenced")
    if target_surface == "checkout":
        dims.append("checkout action may need step-up before completion")
    if target_surface in {"a2a_endpoint", "mcp_tool"}:
        dims.append("agent endpoint invocation requires capability-scope review")
    if "rate_limit_or_abuse_signal" in supplied_sources:
        dims.append("abuse or burst pattern requires review before continued access")
    if "fraud_or_account_takeover_signal" in supplied_sources:
        dims.append("fraud or account-takeover signal requires verification before action")
    return list(dict.fromkeys(dims))


def agentic_interaction_trust(request_json: dict) -> dict:
    """Build a structured agentic interaction trust response.

    This is evidence-readiness triage for agent-mediated actions. It does not
    perform live retrieval, identity verification, fraud adjudication,
    cybersecurity monitoring, transaction authorization, or autonomous
    allow/block decisions.
    """
    request_failure = _validation_failure(_validate_json(request_json, "agentic-interaction-trust-request.schema.json"))
    if request_failure is not None:
        return request_failure

    supplied_sources = _supplied_source_types(request_json)
    missing_sources = [
        source_type
        for source_type in AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION
        if source_type not in supplied_sources
    ]
    readiness_score, readiness_label = _agentic_trust_readiness(request_json, supplied_sources)
    response = {
        "triage_recommendation": _agentic_triage_recommendation(request_json, supplied_sources, missing_sources),
        "trust_signal": _agentic_trust_signal(request_json, supplied_sources, missing_sources),
        "decision_readiness_score": readiness_score,
        "decision_readiness_label": readiness_label,
        "actor": request_json["actor"],
        "target_surface": request_json["target_surface"],
        "requested_action": request_json["requested_action"],
        "supplied_sources": supplied_sources,
        "minimum_sources_before_action": missing_sources,
        "evidence_gaps": [_agentic_evidence_gap_for_source(source_type) for source_type in missing_sources],
        "top_risk_dimensions": _agentic_top_risk_dimensions(request_json, supplied_sources, missing_sources),
        "watch_next": [
            "agent identity spoofing pattern",
            "unexpected tool-scope expansion",
            "checkout or transaction anomaly",
            "account takeover signal",
            "rate-limit or scraping burst",
            "provider allowlist or policy change",
            "mcp or a2a endpoint metadata change",
            "credential leakage or secret exposure report",
        ],
        "human_review_required": True,
        "not_advice_notice": AGENTIC_TRUST_NOT_ADVICE_NOTICE,
        "limitations": [
            "This response does not verify the identity of the actor, operator, or principal.",
            "This response does not authorize, approve, deny, or block the requested action.",
        ],
    }
    if "asset_or_resource" in request_json:
        response["asset_or_resource"] = request_json["asset_or_resource"]

    response_validation = _validate_json(response, "agentic-interaction-trust-response.schema.json")
    return {
        "implemented": response_validation.get("implemented", True),
        "valid": response_validation.get("valid"),
        "errors": response_validation.get("errors", []),
        "response": response,
    }


# ---------------------------------------------------------------------------
# CIS secondary-sanctions exposure (vertical worker)
# ---------------------------------------------------------------------------


def _cis_evidence_gap_for_source(source_type: str) -> str:
    gaps = {
        "ofac_sdn_extract": "No OFAC SDN list extract supplied.",
        "eu_consolidated_extract": "No EU consolidated sanctions list extract supplied.",
        "uk_ofsi_extract": "No UK OFSI sanctions list extract supplied.",
        "un_security_council_extract": "No UN Security Council sanctions extract supplied.",
        "ownership_chain_evidence": "No ownership chain evidence supplied.",
        "bank_correspondent_evidence": "No bank correspondent evidence supplied.",
        "transit_or_invoice_evidence": "No transit or invoice evidence supplied.",
        "dual_use_export_evidence": "No dual-use export evidence supplied.",
        "customs_data_evidence": "No customs data evidence supplied.",
        "adverse_media_evidence": "No adverse media evidence supplied.",
        "typology_reference": "No typology reference supplied.",
    }
    return gaps.get(source_type, f"No {source_type} supplied.")


def _cis_triage_recommendation(request_json: dict, missing_sources: list[str], exposure_signal: str) -> str:
    if not request_json.get("dated_sources"):
        return "insufficient_information"
    if not missing_sources and exposure_signal in {"low"}:
        return "ready_for_human_review"
    decision_stage = request_json.get("decision_stage")
    if decision_stage == "onboarding":
        return "escalate_before_onboarding"
    if decision_stage == "pre_transaction":
        return "escalate_before_transaction"
    return "not_decision_ready"


def _cis_exposure_signal(request_json: dict, missing_sources: list[str], opensanctions_matches: int) -> str:
    if not request_json.get("dated_sources"):
        return "unknown"
    if opensanctions_matches >= 1:
        return "high"
    if len(missing_sources) >= 4:
        return "medium_high"
    if missing_sources:
        return "medium"
    return "low"


def _cis_readiness(request_json: dict, supplied_sources: list[str]) -> tuple[int, str]:
    if not request_json.get("dated_sources") or not supplied_sources:
        return 0, "insufficient_information"

    required_present = len([s for s in CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW if s in supplied_sources])
    context_present = len([s for s in CIS_SECONDARY_SANCTIONS_READINESS_CONTEXT if s in supplied_sources])
    score = min(
        100,
        round(
            10
            + (required_present / len(CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW)) * 70
            + (context_present / len(CIS_SECONDARY_SANCTIONS_READINESS_CONTEXT)) * 20
        ),
    )
    if score >= 85:
        return score, "review_ready"
    if score >= 50:
        return score, "partial"
    return score, "not_decision_ready"


_UNDISCLOSED_UBO_TOKENS = (
    "undisclosed",
    "unknown",
    "not disclosed",
    "undetermined",
    "unverified",
    "unidentified",
    "tbd",
    "to be determined",
    "nominee",
)


def _cis_has_undisclosed_ubo(request_json: dict) -> bool:
    """Detect an undisclosed / unverified ultimate beneficial owner in the
    declared ownership chain.

    Stays within the pre-compliance triage boundary: this flags an evidence
    gap (the UBO cannot be confirmed from the supplied chain), it does not
    analyze or attribute ownership. Scans the free-text ``ownership_layers``
    entries for tokens that signal the chain terminates in an unresolved owner.
    """
    counterparty = request_json.get("counterparty", {}) or {}
    layers = counterparty.get("ownership_layers")
    if not isinstance(layers, list):
        return False
    for layer in layers:
        if not isinstance(layer, str):
            continue
        lowered = layer.lower()
        if any(token in lowered for token in _UNDISCLOSED_UBO_TOKENS):
            return True
    return False


def _cis_top_exposure_dimensions(
    facets: list[str], missing_sources: list[str], opensanctions_matches: list[dict], undisclosed_ubo: bool = False
) -> list[str]:
    dims: list[str] = []
    if opensanctions_matches:
        dims.append("direct or near-direct match in OpenSanctions consolidated dataset")
    if undisclosed_ubo:
        dims.append("undisclosed or unverified ultimate beneficial owner")
    if "ownership_or_control" in facets:
        dims.append("indirect ownership or control exposure")
    if "transit_or_re_export" in facets:
        dims.append("transit or re-export exposure under EU sanctions package / OFAC EO 14114")
    if "ict_or_dual_use_goods" in facets:
        dims.append("ICT or dual-use goods diversion exposure")
    if "correspondent_banking" in facets:
        dims.append("correspondent banking exposure")
    if "shell_or_layered_structure" in facets:
        dims.append("shell or layered structure exposure")
    if "professional_enablers" in facets:
        dims.append("professional-enabler exposure")
    if "ownership_chain_evidence" in missing_sources:
        dims.append("ownership chain not yet documented")
    return list(dict.fromkeys(dims))


def cis_secondary_sanctions_exposure(request_json: dict, *, allow_live_retrieval: bool = True) -> dict:
    """Build a structured CIS secondary-sanctions exposure response.

    This is pre-compliance evidence triage only. It does not perform factual-truth
    verification or provide legal / compliance / sanctions / financial /
    investment / insurance / trading advice.

    When ``allow_live_retrieval`` is True (default), the service queries the
    OpenSanctions consolidated dataset for the supplied counterparty name and
    merges matches into the evidence pack as auto-fetched dated sources.
    Upstream failures degrade gracefully: the response is returned with
    ``live_retrieval_status: degraded`` and triage is based on user-supplied
    evidence only.
    """
    request_failure = _validation_failure(_validate_json(request_json, "cis-secondary-sanctions-request.schema.json"))
    if request_failure is not None:
        return request_failure

    supplied_sources = _supplied_source_types(request_json)
    auto_fetched_sources: list[dict] = []
    live_retrieval_status = "not_attempted"
    upstream_attribution: dict | None = None

    if allow_live_retrieval:
        counterparty = request_json.get("counterparty", {}) or {}
        name = counterparty.get("name", "")
        jurisdiction = counterparty.get("jurisdiction")
        os_result = upstream_opensanctions.match_counterparty(name=name, jurisdiction=jurisdiction)
        live_retrieval_status = os_result["status"]
        upstream_attribution = os_result.get("attribution")
        for match in os_result.get("matches", []):
            mapped_type = match.get("source_type") or "user_provided_note"
            if mapped_type not in supplied_sources:
                supplied_sources.append(mapped_type)
            auto_fetched_sources.append(
                {
                    "source_type": mapped_type,
                    "title": match.get("name") or "OpenSanctions match",
                    "datasets": match.get("datasets", []),
                    "opensanctions_id": match.get("opensanctions_id"),
                    "score": match.get("score"),
                    "topics": match.get("topics", []),
                    "jurisdictions": match.get("jurisdictions", []),
                    "notes": "Auto-fetched from OpenSanctions; CC-BY 4.0 attribution required.",
                }
            )

    missing_sources = [s for s in CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW if s not in supplied_sources]
    undisclosed_ubo = _cis_has_undisclosed_ubo(request_json)
    readiness_score, readiness_label = _cis_readiness(request_json, supplied_sources)
    exposure_signal = _cis_exposure_signal(request_json, missing_sources, len(auto_fetched_sources))
    triage = _cis_triage_recommendation(request_json, missing_sources, exposure_signal)

    limitations: list[str] = []
    # CC-BY / source attribution is only required — and only honest — when upstream
    # data was actually merged into the evidence pack. On the disabled / degraded /
    # zero-match paths nothing was fetched, so surfacing the attribution notice would
    # imply a sanctions-list match via OpenSanctions that never happened.
    if upstream_attribution is not None and auto_fetched_sources:
        limitations.append(upstream_attribution["notice"])
    # User-facing degrade note: derive from status, never echo internal env-var
    # names or stack details (degrade_reason is kept on live_retrieval_status
    # for operators, not surfaced verbatim to callers).
    if live_retrieval_status == "disabled":
        limitations.append(
            "Live sanctions-list retrieval is not currently enabled; triage is based on user-supplied evidence only."
        )
    elif live_retrieval_status == "degraded":
        limitations.append(
            "Live sanctions-list retrieval was unavailable; triage is based on user-supplied evidence only."
        )
    if undisclosed_ubo:
        limitations.append(
            "Ultimate beneficial owner is undisclosed or unverified in the supplied ownership chain; "
            "the counterparty cannot be fully screened until the UBO is resolved."
        )
    cp_jurisdiction = (request_json.get("counterparty") or {}).get("jurisdiction")
    if isinstance(cp_jurisdiction, str):
        cp_jur_lowered = cp_jurisdiction.lower()
        for token, label in COUNTRY_LEVEL_ANTI_CIRCUMVENTION.items():
            if token in cp_jur_lowered:
                limitations.append(
                    f"Counterparty domiciled in {label}, now subject to EU country-level anti-circumvention "
                    "measures (first activated in the 20th sanctions package): confirm the specific restricted "
                    "item categories and onward destination, and check correspondent-banking exposure to any "
                    "regional financial institution designated in that package. Escalation flag for human "
                    "review, not a sanctions determination."
                )
                break
    limitations.append(
        "Name match against a sanctions list is not legal-entity identity verification. " "Human review is required."
    )

    response = {
        "triage_recommendation": triage,
        "secondary_exposure_signal": exposure_signal,
        "decision_readiness_score": readiness_score,
        "decision_readiness_label": readiness_label,
        "counterparty": request_json["counterparty"],
        "exposure_facets": list(request_json.get("exposure_facets", [])),
        "supplied_sources": list(dict.fromkeys(supplied_sources)),
        "minimum_sources_before_review": missing_sources,
        "evidence_gaps": [_cis_evidence_gap_for_source(s) for s in missing_sources],
        "top_exposure_dimensions": _cis_top_exposure_dimensions(
            list(request_json.get("exposure_facets", [])), missing_sources, auto_fetched_sources, undisclosed_ubo
        ),
        "watch_next": [
            "new OFAC SDN designations",
            "new EU sanctions package",
            "new UK OFSI listing",
            "new EAG typology report",
            "FATF grey-list or black-list update",
            "national regulator enforcement update",
        ],
        "human_review_required": True,
        "not_advice_notice": NOT_ADVICE_NOTICE,
        "limitations": limitations,
    }

    response_validation = _validate_json(response, "cis-secondary-sanctions-response.schema.json")
    return {
        "implemented": response_validation.get("implemented", True),
        "valid": response_validation.get("valid"),
        "errors": response_validation.get("errors", []),
        "response": response,
        "live_retrieval_status": live_retrieval_status,
        "auto_fetched_sources": auto_fetched_sources,
        "upstream_attribution": upstream_attribution,
    }


def _gulf_evidence_gap_for_source(source_type: str) -> str:
    gaps = {
        "vessel_registry_extract": "No vessel registry extract supplied.",
        "flag_registry_record": "No flag registry record supplied.",
        "pi_insurance_certificate": "No P&I insurance certificate supplied.",
        "ais_track_record": "No AIS track record supplied.",
        "sts_transfer_evidence": "No ship-to-ship transfer evidence supplied.",
        "ownership_or_control_evidence": "No ownership or control evidence supplied.",
        "sanctions_list_extract": "No sanctions list extract supplied.",
        "cargo_or_bl_evidence": "No cargo or bill-of-lading evidence supplied.",
        "classification_society_record": "No classification society record supplied.",
        "port_state_control_record": "No port state control record supplied.",
        "charterer_kyc_evidence": "No charterer KYC evidence supplied.",
        "adverse_media_evidence": "No adverse media evidence supplied.",
        "prior_incident_or_detention": "No prior incident or detention record supplied.",
        "price_cap_attestation_or_recordkeeping": (
            "No price-cap attestation or itemized ancillary-cost recordkeeping supplied."
        ),
    }
    return gaps.get(source_type, f"No {source_type} supplied.")


def _gulf_triage_recommendation(request_json: dict, missing_sources: list[str], exposure_signal: str) -> str:
    if not request_json.get("dated_sources"):
        return "insufficient_information"
    if not missing_sources and exposure_signal == "low":
        return "ready_for_human_review"
    decision_stage = request_json.get("decision_stage")
    if decision_stage == "pre_fixture":
        return "escalate_before_fixture"
    if decision_stage in {"pre_voyage", "pre_port_call"}:
        return "escalate_before_voyage"
    return "not_decision_ready"


def _gulf_exposure_signal(request_json: dict, missing_sources: list[str]) -> str:
    if not request_json.get("dated_sources"):
        return "unknown"
    facets = list(request_json.get("exposure_facets", []))
    high_risk_facets = {"iran_oil_exposure", "russia_oil_price_cap", "dark_fleet_indicators", "ais_manipulation"}
    if "sanctions_list_extract" in missing_sources and high_risk_facets.intersection(facets):
        return "high"
    if len(missing_sources) >= 4:
        return "medium_high"
    if missing_sources:
        return "medium"
    return "low"


def _gulf_readiness(request_json: dict, supplied_sources: list[str]) -> tuple[int, str]:
    if not request_json.get("dated_sources") or not supplied_sources:
        return 0, "insufficient_information"
    required_present = len([s for s in GULF_MARITIME_REQUIRED_BEFORE_REVIEW if s in supplied_sources])
    context_present = len([s for s in GULF_MARITIME_READINESS_CONTEXT if s in supplied_sources])
    score = min(
        100,
        round(
            10
            + (required_present / len(GULF_MARITIME_REQUIRED_BEFORE_REVIEW)) * 70
            + (context_present / len(GULF_MARITIME_READINESS_CONTEXT)) * 20
        ),
    )
    if score >= 85:
        return score, "review_ready"
    if score >= 50:
        return score, "partial"
    return score, "not_decision_ready"


def _gulf_top_exposure_dimensions(
    facets: list[str], missing_sources: list[str], supplied_sources: list[str]
) -> list[str]:
    dims: list[str] = []
    facet_dims = {
        "iran_oil_exposure": "Iran-origin oil sanctions exposure (OFAC / EU)",
        "russia_oil_price_cap": "Russia oil price-cap / attestation exposure",
        "dark_fleet_indicators": "dark-fleet indicators (aged tanker, opaque ownership, no mainstream P&I)",
        "sts_transfer": "ship-to-ship transfer concealment exposure",
        "flag_hopping": "flag-hopping or convenience-flag exposure",
        "insurance_or_pi_gap": "insurance or P&I cover gap",
        "ais_manipulation": "AIS gap, spoofing, or manipulation exposure",
        "ownership_or_control": "indirect ownership or control exposure",
        "dual_use_cargo": "dual-use cargo diversion exposure",
        "chokepoint_disruption": "chokepoint security or disruption exposure",
    }
    for facet in facets:
        if facet in facet_dims:
            dims.append(facet_dims[facet])
    if "ownership_or_control_evidence" in missing_sources:
        dims.append("vessel ownership or control not yet documented")
    if "pi_insurance_certificate" in missing_sources:
        dims.append("P&I cover not yet confirmed")
    if "russia_oil_price_cap" in facets and "price_cap_attestation_or_recordkeeping" not in supplied_sources:
        dims.append(
            "per-loading price-cap attestation and itemized ancillary-cost recordkeeping "
            "not yet evidenced (OFAC tiered safe-harbor)"
        )
    return list(dict.fromkeys(dims))


_GULF_CHOKEPOINT_WATCH = {
    "strait_of_hormuz": [
        "Strait of Hormuz transit advisory or security incident",
        "Iran IRGC interdiction or detention report",
    ],
    "persian_gulf": ["Persian/Arabian Gulf security incident or escalation notice"],
    "gulf_of_oman": ["Gulf of Oman ship-to-ship-area attack or seizure report"],
    "bab_el_mandeb": ["Bab-el-Mandeb attack or transit-advisory notice"],
    "red_sea": ["Red Sea attack, rerouting notice, or Cape-of-Good-Hope diversion update"],
    "suez_canal": ["Suez Canal transit disruption or rerouting notice"],
}


def _gulf_chokepoint_disruption_watch(request_json: dict) -> list[str]:
    voyage = request_json.get("voyage", {}) or {}
    chokepoint = str(voyage.get("chokepoint") or "")
    watch = list(_GULF_CHOKEPOINT_WATCH.get(chokepoint, []))
    watch.append("war-risk premium or underwriter advisory change for the transit area")
    return watch


def gulf_maritime_exposure(request_json: dict) -> dict:
    """Build a structured Gulf maritime sanctions and chokepoint-disruption exposure response.

    Pre-compliance evidence triage only on caller-supplied evidence. No live retrieval.
    Does not resolve vessel ownership, verify identity, perform factual-truth verification,
    or provide legal / sanctions / compliance / financial / investment / insurance / trading advice.
    """
    request_failure = _validation_failure(_validate_json(request_json, "gulf-maritime-exposure-request.schema.json"))
    if request_failure is not None:
        return request_failure

    supplied_sources = _supplied_source_types(request_json)
    missing_sources = [s for s in GULF_MARITIME_REQUIRED_BEFORE_REVIEW if s not in supplied_sources]
    readiness_score, readiness_label = _gulf_readiness(request_json, supplied_sources)
    exposure_signal = _gulf_exposure_signal(request_json, missing_sources)
    triage = _gulf_triage_recommendation(request_json, missing_sources, exposure_signal)
    facets = list(request_json.get("exposure_facets", []))

    limitations = [
        "Triage is based on caller-supplied evidence only; this service does not retrieve sources, "
        "resolve vessel ownership, or verify vessel identity.",
        "A name match against a sanctions list is not legal-entity or vessel-identity verification. "
        "Human review is required.",
    ]

    watch_next = [
        "new OFAC vessel or entity designation",
        "new EU or UK OFSI shipping-related listing",
        "P&I club cover withdrawal or confirmation change",
        "flag-registry deregistration or flag-hopping report",
        "AIS gap, spoofing, or dark-activity report on the vessel",
    ]
    if "russia_oil_price_cap" in facets:
        watch_next.append("price-cap attestation refusal, withdrawal, or itemized ancillary-cost gap")

    response = {
        "triage_recommendation": triage,
        "exposure_signal": exposure_signal,
        "decision_readiness_score": readiness_score,
        "decision_readiness_label": readiness_label,
        "voyage": request_json["voyage"],
        "exposure_facets": facets,
        "supplied_sources": list(dict.fromkeys(supplied_sources)),
        "minimum_sources_before_review": missing_sources,
        "evidence_gaps": [_gulf_evidence_gap_for_source(s) for s in missing_sources],
        "top_exposure_dimensions": _gulf_top_exposure_dimensions(facets, missing_sources, supplied_sources),
        "chokepoint_disruption_watch": _gulf_chokepoint_disruption_watch(request_json),
        "watch_next": watch_next,
        "human_review_required": True,
        "not_advice_notice": GULF_NOT_ADVICE_NOTICE,
        "limitations": limitations,
    }
    if "vessel" in request_json:
        response["vessel"] = request_json["vessel"]
    if "cargo" in request_json:
        response["cargo"] = request_json["cargo"]

    response_validation = _validate_json(response, "gulf-maritime-exposure-response.schema.json")
    return {
        "implemented": response_validation.get("implemented", True),
        "valid": response_validation.get("valid"),
        "errors": response_validation.get("errors", []),
        "response": response,
    }


# ---------------------------------------------------------------------------
# Kazakhstan market-entry readiness gate (vertical worker)
# ---------------------------------------------------------------------------

MARKET_ENTRY_BOUNDARY_NOTICE = (
    "Internal evidence triage only. Not legal, compliance, customs, tax, financial, investment, "
    "insurance, sanctions, or launch-authorization advice."
)

# decision_stage values that imply the caller is approaching a binding commitment,
# not just exploring. Used to harden the gate decision when evidence is thin.
MARKET_ENTRY_COMMITMENT_STAGES = {
    "pre_entity_setup",
    "pre_signature",
    "pre_import",
    "pre_certification",
    "pre_showroom_lease",
    "pre_first_batch_order",
    "pre_ad_spend",
    "pre_dealer_contract",
    "committee_review",
}

# decision_stage -> the source-requirement tier key the decision is gated on.
MARKET_ENTRY_STAGE_TIER = {
    "concept_review": "required_before_validation",
    "pre_entity_setup": "required_before_signature",
    "pre_signature": "required_before_signature",
    "committee_review": "required_before_signature",
    "pre_import": "required_before_import_or_first_batch",
    "pre_certification": "required_before_import_or_first_batch",
    "pre_first_batch_order": "required_before_import_or_first_batch",
    "pre_showroom_lease": "required_before_showroom_or_public_launch",
    "pre_ad_spend": "required_before_showroom_or_public_launch",
    "pre_dealer_contract": "required_before_dealer_or_fleet_expansion",
    "other": "required_before_signature",
}

# Curated evidence-gap copy for the signature tier (the most common gate). Tuple
# order: (evidence_needed, why_it_matters, owner, next_action, decision_blocked).
# Source types outside this map fall back to a generic, schema-valid gap.
MARKET_ENTRY_EVIDENCE_GAP_DETAILS: dict[str, tuple[str, str, str, str, str]] = {
    "law_firm_opinion": (
        "Written recommendation on branch, representative office, LLP, distributor, importer, or dealer structure.",
        "The legal form affects sales, import, service, tax, contracting, and liability.",
        "Kazakhstan legal counsel",
        "Request a short legal-structure memo.",
        "Signature or entity setup.",
    ),
    "counterparty_registry_extract": (
        "Current registry extract for the partner and any local counterparty (status, directors, address).",
        "A live registry extract confirms the counterparty exists and who can bind it before any contract.",
        "Legal counsel",
        "Pull a fresh registry extract for each named counterparty.",
        "Partner appointment and signature.",
    ),
    "beneficial_ownership_source": (
        "Beneficial-ownership record showing who ultimately owns and controls the counterparty.",
        "Ownership drives integrity, sanctions, and conflict exposure; an unknown UBO is an unmanaged risk.",
        "Compliance / legal counsel",
        "Obtain a UBO declaration or registry source for each counterparty.",
        "Partner appointment and signature.",
    ),
    "counterparty_integrity_due_diligence": (
        "Integrity / anti-corruption due diligence on the distributor, agents, and any government-facing "
        "intermediaries (ownership, embedded officials, adverse media, sanctions and PEP screening).",
        "Under FCPA / UK Bribery Act the foreign parent can be liable for an intermediary's conduct; engaging "
        "a partner who touches customs, certification, or akimat without integrity DD is an unmanaged exposure.",
        "Compliance / legal counsel",
        "Run integrity DD before appointing or contracting any local partner or agent.",
        "Partner appointment and signature.",
    ),
    "bank_account_and_kyc_onboarding": (
        "Bank-account opening readiness: full UBO pack (apostilled), source-of-funds and expected-turnover "
        "statement, and the presence / timeline the chosen bank requires.",
        "Account opening for a foreign-owned entity is document-heavy and slow; until it clears, the entity "
        "cannot pay suppliers or receive revenue.",
        "Finance lead",
        "Confirm the bank's KYC checklist and start onboarding in parallel with entity setup.",
        "Supplier payment and revenue collection.",
    ),
    "business_substance_evidence": (
        "Evidence the entry vehicle has real substance (office, staff, local decision-making) appropriate to "
        "the chosen model.",
        "Thin substance undermines tax treatment, banking onboarding, and counterparty trust.",
        "Operations lead",
        "Document the planned substance for the chosen entry model.",
        "Entity model choice and signature.",
    ),
    "authority_to_sign_evidence": (
        "Evidence that the individual signing for each counterparty has authority to bind it.",
        "A contract signed without authority is unenforceable and a fraud vector.",
        "Legal counsel",
        "Collect powers of attorney or board authorizations for the signatories.",
        "Signature.",
    ),
    "contract_or_term_sheet_draft": (
        "Draft contract or term sheet covering scope, pricing, territory, exclusivity, term, and exit.",
        "Commercial terms must be on paper before signature so they can be reviewed and negotiated.",
        "Commercial lead / legal counsel",
        "Produce a term sheet or draft contract for review.",
        "Signature.",
    ),
    "tax_accounting_note": (
        "Note on VAT, corporate tax, withholding, and accounting treatment for the chosen entry model.",
        "Tax and accounting treatment change the real cost and reporting load of the entry model.",
        "Tax advisor",
        "Request a tax and accounting memo for each candidate entry model.",
        "Entity model choice and signature.",
    ),
    "permanent_establishment_or_tax_residency_assessment": (
        "Assessment of whether the chosen entry model (branch, representative office, LLP, or direct "
        "contracting) creates a taxable permanent establishment or resident status.",
        "Permanent-establishment and residency treatment drive tax registration, reporting load, and the "
        "real cost of the entry model.",
        "Tax advisor",
        "Request a permanent-establishment and tax-residency memo for each candidate entry model.",
        "Entity model choice and signature.",
    ),
    "currency_control_and_repatriation_note": (
        "Note on currency-contract registration (mandatory at the USD 50,000 threshold for legal entities under "
        "the 2026 currency-control rules), repatriation reporting, and how supplier payments, intercompany flows, "
        "and profit repatriation will clear local banks.",
        "Under the 2026 currency-control regime local banks can delay or refuse cross-border intercompany "
        "transfers (capital, shareholder loans, royalties, management fees) that lack demonstrable economic "
        "substance, so substance evidence affects how, and how quickly, money moves after commitment.",
        "Treasury / banking advisor",
        "Confirm currency-contract registration at the USD 50,000 threshold and prepare economic-substance "
        "evidence for intercompany flows with the servicing bank.",
        "Cross-border payment, intercompany-flow, and profit-repatriation planning.",
    ),
    "work_permit_and_local_employment_quota_note": (
        "Note on work-permit requirements and local-employment ratio / quota obligations for the planned "
        "expatriate and local headcount.",
        "Foreign-worker quotas and local-employment ratios constrain who can be deployed and when.",
        "HR / legal counsel",
        "Confirm work-permit and local-employment quota requirements for the staffing plan.",
        "Staffing and entity operation.",
    ),
    "grid_connection_and_offtake_evidence": (
        "Grid-connection study or technical conditions plus the offtake or power-purchase basis (PPA term "
        "sheet, settlement route, or anchor-customer load commitment).",
        "Without a connection path and a buyer for the output, the project's revenue and bankability are "
        "unproven and any commitment is premature.",
        "Project / technical lead",
        "Obtain the grid-connection conditions and the offtake or PPA basis before any binding step.",
        "Investment commitment and signature.",
    ),
    "land_or_site_control_evidence": (
        "Evidence of site control: land lease, allocation decision, or ownership for the project footprint, "
        "with zoning / land-use suitability.",
        "A project without secured, correctly-zoned land cannot be built, financed, or committed to.",
        "Project lead / legal counsel",
        "Secure and document land or site control with a zoning suitability check.",
        "Investment commitment and signature.",
    ),
    "ip_ownership_and_licensing_evidence": (
        "Evidence of who owns the transferred technology and on what licensing terms, with freedom-to-operate "
        "and any third-party or background-IP constraints.",
        "Transferring or licensing technology without clear ownership and freedom to operate exposes both "
        "sides to infringement and enforceability disputes.",
        "IP counsel",
        "Confirm IP ownership, licensing scope, and freedom to operate before the transfer agreement.",
        "Technology-transfer signature.",
    ),
    "export_control_classification_note": (
        "Classification of the technology against applicable export-control / dual-use regimes and whether a "
        "license or authorization is required to transfer it to Kazakhstan.",
        "Transferring controlled or dual-use technology without classification can breach export-control law "
        "in the origin jurisdiction regardless of Kazakhstan-side approvals.",
        "Export-control / trade counsel",
        "Classify the technology and confirm whether an export license is required before transfer.",
        "Technology-transfer signature.",
    ),
}


def _market_entry_taxonomy() -> dict:
    return _load_data_json("source-requirements/kazakhstan-market-entry-readiness.json")


def _market_entry_supplied_types(request_json: dict) -> list[str]:
    sources = request_json.get("supplied_sources", []) or []
    return [s["source_type"] for s in sources if isinstance(s, dict) and s.get("source_type")]


def _market_entry_satisfied(request_json: dict, supplied: list[str]) -> set[str]:
    """Validation-tier coverage, generous about evidence carried in the request body.

    The request body itself supplies the commercial objective and the Kazakhstan
    use case (market + decision question are required fields), and at least one
    supplied source counts as the initial source links / documents.
    """
    satisfied = set(supplied)
    if request_json.get("commercial_objective"):
        satisfied.add("commercial_objective")
    if request_json.get("market") and request_json.get("decision_question"):
        satisfied.add("kazakhstan_use_case")
    if supplied:
        satisfied.add("initial_source_links_or_documents")
    return satisfied


def _market_entry_sector_required(taxonomy: dict, sector: str | None) -> list[str]:
    """Sector-specific required evidence beyond the universal tiers.

    Folded into the launch-commitment ceiling and the gap list so the advertised
    sector breadth is real, not cosmetic. Unknown / missing sector -> no extra.
    """
    sector_map = taxonomy.get("sector_requirements", {})
    return list(sector_map.get(sector or "other", []))


def _market_entry_readiness(taxonomy: dict, satisfied: set[str], stage_tier: str, sector_missing: list[str]) -> str:
    core_validation = {
        "partner_company_profile",
        "product_or_project_description",
        "initial_source_links_or_documents",
        "commercial_objective",
    }
    core_present = len(core_validation & satisfied)
    validation_missing = [s for s in taxonomy.get("required_before_validation", []) if s not in satisfied]
    signature_missing = [s for s in taxonomy.get("required_before_signature", []) if s not in satisfied]
    operational_missing = [s for s in taxonomy.get(stage_tier, []) if s not in satisfied]
    if core_present == 0:
        return "insufficient_information"
    if validation_missing:
        return "concept_ready"
    if signature_missing:
        return "validation_ready"
    if operational_missing or sector_missing:
        return "committee_review_ready"
    return "launch_commitment_ready"


def _market_entry_watch_next(taxonomy: dict, sector: str | None, satisfied: set[str], stage_tier: str) -> list[str]:
    """Build a watch list tailored to the sector and the still-open tiers.

    Replaces the prior static dump of every indicator: only the sector's
    indicators, the indicators for tiers that still have gaps, and a single
    always-on regulator signal are surfaced, de-duplicated in insertion order.
    """
    out: list[str] = []

    def add(item: str) -> None:
        if item and item not in out:
            out.append(item)

    for item in taxonomy.get("sector_watch_indicators", {}).get(sector or "other", []):
        add(item)
    tier_watch = taxonomy.get("tier_watch_indicators", {})
    open_tier_keys = []
    for tier_key in ("required_before_validation", "required_before_signature", stage_tier):
        if tier_key in open_tier_keys:
            continue
        if any(s not in satisfied for s in taxonomy.get(tier_key, [])):
            open_tier_keys.append(tier_key)
    for tier_key in open_tier_keys:
        for item in tier_watch.get(tier_key, []):
            add(item)
    add("government or regulator signal")
    return out


def _market_entry_gate_decision(readiness: str, stage: str) -> str:
    if readiness == "insufficient_information":
        return "stop" if stage in MARKET_ENTRY_COMMITMENT_STAGES else "not_decision_ready"
    if readiness == "concept_ready":
        return "pause_for_evidence"
    if readiness == "validation_ready":
        return "proceed_to_validation"
    if readiness == "committee_review_ready":
        return "route_to_committee"
    return "escalate_before_signature"


def _market_entry_evidence_gap(source_type: str) -> dict:
    detail = MARKET_ENTRY_EVIDENCE_GAP_DETAILS.get(source_type)
    label = source_type.replace("_", " ")
    if detail is None:
        return {
            "source_type": source_type,
            "evidence_needed": f"Supply the {label} for this market-entry file.",
            "why_it_matters": f"The {label} is a required gate input that is not yet in the evidence pack.",
            "owner": "Project lead",
            "next_action": f"Request or produce the {label}.",
            "decision_blocked": "Progression to the next market-entry commitment.",
        }
    needed, why, owner, action, blocked = detail
    return {
        "source_type": source_type,
        "evidence_needed": needed,
        "why_it_matters": why,
        "owner": owner,
        "next_action": action,
        "decision_blocked": blocked,
    }


MARKET_ENTRY_SUMMARY = {
    "insufficient_information": (
        "Not enough has been supplied to assess Kazakhstan market-entry readiness; the gate cannot return a "
        "meaningful decision yet."
    ),
    "concept_ready": (
        "The concept is taking shape, but the validation-tier evidence is incomplete, so the file is not yet "
        "ready for controlled validation."
    ),
    "validation_ready": (
        "The concept is coherent enough for controlled validation, but it is not signature-, import-, lease-, "
        "or launch-ready until the flagged legal, tax, banking, customs, certification, and operational gaps "
        "are closed."
    ),
    "committee_review_ready": (
        "Validation and signature-tier evidence are largely in place; the remaining operational gaps for this "
        "stage should go to committee review before the binding commitment."
    ),
    "launch_commitment_ready": (
        "The evidence pack covers the validation, signature, and stage-relevant operational tiers; route to "
        "committee for the binding launch-commitment decision with human sign-off."
    ),
}


def kazakhstan_market_entry_readiness(request_json: dict) -> dict:
    """Build a structured Kazakhstan market-entry readiness response.

    Internal evidence triage only: it grades how decision-ready a market-entry
    file is against a staged source-requirement taxonomy and routes every output
    through mandatory human review. It performs no live retrieval, factual-truth
    verification, or legal / compliance / customs / tax / sanctions advice.
    """
    request_failure = _validation_failure(_validate_json(request_json, "market-entry-readiness-request.schema.json"))
    if request_failure is not None:
        return request_failure

    taxonomy = _market_entry_taxonomy()
    stage = request_json["decision_stage"]
    sector = request_json.get("sector")
    stage_tier = MARKET_ENTRY_STAGE_TIER.get(stage, "required_before_signature")
    supplied = _market_entry_supplied_types(request_json)
    satisfied = _market_entry_satisfied(request_json, supplied)
    sector_required = _market_entry_sector_required(taxonomy, sector)
    sector_missing = [s for s in sector_required if s not in satisfied]
    readiness_label = _market_entry_readiness(taxonomy, satisfied, stage_tier, sector_missing)
    gate_decision = _market_entry_gate_decision(readiness_label, stage)

    gap_source_types: list[str] = []
    for tier_key in ("required_before_validation", "required_before_signature", stage_tier):
        for source_type in taxonomy.get(tier_key, []):
            if source_type not in satisfied and source_type not in gap_source_types:
                gap_source_types.append(source_type)
    for source_type in sector_missing:
        if source_type not in gap_source_types:
            gap_source_types.append(source_type)
    evidence_gaps = [_market_entry_evidence_gap(source_type) for source_type in gap_source_types]

    confirmed_facts: list[str] = []
    if "partner_company_profile" in satisfied:
        confirmed_facts.append("A partner or company profile was supplied.")
    if "product_or_project_description" in satisfied:
        confirmed_facts.append("A product or project description was supplied.")
    confirmed_facts.append(f"The decision is at {stage.replace('_', ' ')} stage.")
    if request_json.get("known_blockers"):
        confirmed_facts.append("The caller has already named open blockers on the file.")

    assumptions = list(request_json.get("known_assumptions") or [])
    if not assumptions:
        assumptions = [
            "Public cost benchmarks are not signed quotes.",
            "Supplier prices are not Kazakhstan landed costs.",
            "The final commercial structure depends on local legal, tax, customs, and operational review.",
        ]

    ready_to_validate = readiness_label in {"validation_ready", "committee_review_ready", "launch_commitment_ready"}
    ready_to_commit = readiness_label == "launch_commitment_ready"
    claim_audit = [
        {
            "claim": "The project can move into controlled validation.",
            "status": "supported" if ready_to_validate else "needs_professional_confirmation",
            "how_to_use_now": (
                "Use for advisor requests, quotes, and structured partner or customer interviews."
                if ready_to_validate
                else "Do not rely on this yet; close the validation-tier evidence first."
            ),
        },
        {
            "claim": "The project is ready for launch commitment.",
            "status": "supported" if ready_to_commit else "unsupported",
            "how_to_use_now": (
                "Route to committee for the binding decision with human sign-off."
                if ready_to_commit
                else "Do not use. Replace with the current readiness label until the evidence gaps are closed."
            ),
        },
    ]
    blockers = list(request_json.get("known_blockers") or [])
    if blockers:
        claim_audit.append(
            {
                "claim": "The blockers the caller named on this file are resolved.",
                "status": "unsupported",
                "how_to_use_now": (
                    f"Do not treat as resolved: the caller listed {len(blockers)} open blocker(s) "
                    f'(e.g. "{blockers[0]}"). Close each one and re-run the gate.'
                ),
            }
        )
    if request_json.get("known_assumptions"):
        claim_audit.append(
            {
                "claim": "The caller-supplied cost, price, and structure assumptions are decision-grade.",
                "status": "assumption_only",
                "how_to_use_now": (
                    "Treat the caller's assumptions as planning inputs only; confirm with signed quotes, "
                    "landed-cost models, and local legal / tax review before any commitment."
                ),
            }
        )

    owner_actions = [
        {
            "timeframe": "48_hours",
            "owner": "Project lead",
            "action": "Send the missing-evidence request to the partner and named advisors.",
            "output": "Evidence-request pack and missing-document checklist.",
        },
        {
            "timeframe": "7_days",
            "owner": "Project lead",
            "action": (
                "Collect the legal, tax, banking, customs, certification, and operational inputs the gate flagged."
            ),
            "output": "Gate evidence pack.",
        },
        {
            "timeframe": "30_days",
            "owner": "Project lead",
            "action": "Convert the validation evidence into a committee-ready entry decision memo.",
            "output": "Committee-ready gate memo.",
        },
    ]

    response = {
        "gate_decision": gate_decision,
        "readiness_label": readiness_label,
        "human_review_required": True,
        "summary": MARKET_ENTRY_SUMMARY[readiness_label],
        "confirmed_facts": confirmed_facts,
        "assumptions": assumptions,
        "evidence_gaps": evidence_gaps,
        "claim_audit": claim_audit,
        "owner_actions": owner_actions,
        "watch_next": _market_entry_watch_next(taxonomy, sector, satisfied, stage_tier),
        "boundary_notice": MARKET_ENTRY_BOUNDARY_NOTICE,
        "run_provenance": _run_provenance(request_json, "market-entry-readiness-response.schema.json"),
    }
    if readiness_label != "insufficient_information":
        response["strongest_reason_to_proceed"] = (
            "The Kazakhstan use case and commercial objective are specific enough to start advisor requests, "
            "quote collection, and partner validation."
        )
    if evidence_gaps:
        response["strongest_reason_to_pause"] = (
            "The current evidence pack is not sufficient for signature, import, lease, first-batch order, "
            "advertising spend, or partner appointment."
        )
        response["management_note"] = (
            "The opportunity can move at the level of its readiness label, but should not move to launch "
            "commitment until the flagged legal, customs, certification, landed-cost, service, lease, and "
            "partner evidence gaps are closed."
        )

    response_validation = _validate_json(response, "market-entry-readiness-response.schema.json")
    return {
        "implemented": response_validation.get("implemented", True),
        "valid": response_validation.get("valid"),
        "errors": response_validation.get("errors", []),
        "response": response,
    }
