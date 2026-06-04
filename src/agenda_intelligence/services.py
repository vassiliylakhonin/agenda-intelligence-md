"""Shared service-layer functions for Agenda Intelligence.

These functions contain reusable product behavior that can be called by MCP,
CLI, and a future HTTP API shell without making those adapters depend on each
other. They are stateless and do not persist caller payloads.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Optional

from agenda_intelligence import upstream_opensanctions
from agenda_intelligence.eval import score_before_after

PACKAGE_NAME = "agenda_intelligence"

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
        "sanctions_list_extract": "No sanctions list extract supplied.",
        "customs_or_regulatory_source": "No customs or regulatory source supplied.",
        "insurance_clause_or_underwriter_note": "No insurance clause or underwriter note supplied.",
        "vessel_or_carrier_history": "No vessel or carrier history supplied.",
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


def _middle_corridor_top_risks(
    missing_sources: list[str],
    high_risk_jurisdictions: bool = False,
    circumvention_watch: bool = False,
) -> list[str]:
    risks = ["sanctions adjacency", "Caspian chokepoint dependency"]
    if high_risk_jurisdictions:
        risks.insert(0, "counterparty in a sanctions-relevant / high-risk jurisdiction")
    if circumvention_watch:
        risks.append("counterparty in a re-export / circumvention-watch jurisdiction")
    if "customs_or_regulatory_source" in missing_sources:
        risks.append("customs and documentation uncertainty")
    if "insurance_clause_or_underwriter_note" in missing_sources:
        risks.append("insurance exclusions or coverage limitations")
    if "counterparty_registry_extract" in missing_sources or "beneficial_ownership_source" in missing_sources:
        risks.append("counterparty and ownership uncertainty")
    if "vessel_or_carrier_history" in missing_sources:
        risks.append("carrier or vessel history gap")
    return list(dict.fromkeys(risks))


def _middle_corridor_exposure_layers(
    missing_sources: list[str],
    high_risk_jurisdictions: bool = False,
    circumvention_watch: bool = False,
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
    if "sanctions_list_extract" in missing_sources:
        foreign_sanctions_exposure_layer.append("No sanctions list extract supplied to review listed-party exposure.")
    if "beneficial_ownership_source" in missing_sources:
        foreign_sanctions_exposure_layer.append(
            "No beneficial ownership source — indirect / ownership-based exposure cannot be reviewed."
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
    request_validation = _validate_json(request_json, "middle-corridor-deal-risk-request.schema.json")
    if not request_validation.get("valid"):
        return {
            "implemented": True,
            "valid": False,
            "errors": request_validation.get("errors", []),
            "response": None,
        }

    supplied_sources = _supplied_source_types(request_json)
    missing_sources = [
        source_type for source_type in MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO if source_type not in supplied_sources
    ]
    flagged_jurisdictions = _high_risk_jurisdiction_counterparties(request_json)
    flagged_circumvention = _circumvention_watch_counterparties(request_json)
    readiness_score, readiness_label = _middle_corridor_readiness(request_json, supplied_sources)
    response = {
        "triage_recommendation": _middle_corridor_triage_recommendation(request_json, missing_sources),
        "risk_signal": _middle_corridor_risk_signal(request_json, missing_sources),
        "decision_readiness_score": readiness_score,
        "decision_readiness_label": readiness_label,
        "route": request_json["route"],
        "cargo": request_json["cargo"],
        "counterparties": request_json["counterparties"],
        "supplied_sources": supplied_sources,
        "minimum_sources_before_go": missing_sources,
        "evidence_gaps": [_evidence_gap_for_source(source_type) for source_type in missing_sources],
        "top_risks": _middle_corridor_top_risks(
            missing_sources, bool(flagged_jurisdictions), bool(flagged_circumvention)
        ),
        "exposure_layers": _middle_corridor_exposure_layers(
            missing_sources, bool(flagged_jurisdictions), bool(flagged_circumvention)
        ),
        "watch_next": [
            "new sanctions designations",
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
    if limitations:
        response["limitations"] = limitations
    if "vessel_or_carrier_history" in missing_sources:
        response["vessel_due_diligence_indicators"] = list(VESSEL_DUE_DILIGENCE_INDICATORS)
    if "end_user_or_reexport_evidence" not in supplied_sources:
        response["reexport_control_indicators"] = list(REEXPORT_CONTROL_INDICATORS)
    if "source_of_funds_or_wealth_evidence" not in supplied_sources:
        response["source_of_funds_indicators"] = list(SOURCE_OF_FUNDS_INDICATORS)
    if "pep_screening_evidence" not in supplied_sources:
        response["pep_screening_indicators"] = list(PEP_SCREENING_INDICATORS)
    if "business_substance_evidence" not in supplied_sources:
        response["front_company_indicators"] = list(FRONT_COMPANY_INDICATORS)
    if "shipment_value" in request_json:
        response["shipment_value"] = request_json["shipment_value"]

    response_validation = _validate_json(response, "middle-corridor-deal-risk-response.schema.json")
    return {
        "implemented": True,
        "valid": bool(response_validation.get("valid")),
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
    request_validation = _validate_json(request_json, "agentic-interaction-trust-request.schema.json")
    if not request_validation.get("valid"):
        return {
            "implemented": True,
            "valid": False,
            "errors": request_validation.get("errors", []),
            "response": None,
        }

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
        "implemented": True,
        "valid": bool(response_validation.get("valid")),
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
        dims.append("transit or re-export exposure under EU 14th package / OFAC EO 14114")
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
    request_validation = _validate_json(request_json, "cis-secondary-sanctions-request.schema.json")
    if not request_validation.get("valid"):
        return {
            "implemented": True,
            "valid": False,
            "errors": request_validation.get("errors", []),
            "response": None,
        }

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
    if upstream_attribution is not None:
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
        "implemented": True,
        "valid": bool(response_validation.get("valid")),
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


def _gulf_top_exposure_dimensions(facets: list[str], missing_sources: list[str]) -> list[str]:
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
    request_validation = _validate_json(request_json, "gulf-maritime-exposure-request.schema.json")
    if not request_validation.get("valid"):
        return {
            "implemented": True,
            "valid": False,
            "errors": request_validation.get("errors", []),
            "response": None,
        }

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
        "top_exposure_dimensions": _gulf_top_exposure_dimensions(facets, missing_sources),
        "chokepoint_disruption_watch": _gulf_chokepoint_disruption_watch(request_json),
        "watch_next": [
            "new OFAC vessel or entity designation",
            "new EU or UK OFSI shipping-related listing",
            "P&I club cover withdrawal or confirmation change",
            "flag-registry deregistration or flag-hopping report",
            "AIS gap, spoofing, or dark-activity report on the vessel",
        ],
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
        "implemented": True,
        "valid": bool(response_validation.get("valid")),
        "errors": response_validation.get("errors", []),
        "response": response,
    }
