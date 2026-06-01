"""A2A adapter primitives for Agenda Intelligence.

This module is a protocol adapter over the shared service layer. It does not
perform live retrieval, persist caller payloads, or change MCP behavior.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

from agenda_intelligence import __version__, services

REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md"
MIDDLE_CORRIDOR_SCHEMA = "schemas/v1/middle-corridor-deal-risk-request.schema.json"
MIDDLE_CORRIDOR_ENDPOINT = "/v1/middle-corridor/deal-risk"
AGENTIC_INTERACTION_TRUST_SCHEMA = "schemas/v1/agentic-interaction-trust-request.schema.json"
AGENTIC_INTERACTION_TRUST_ENDPOINT = "/v1/agentic-interaction/trust"
CIS_SECONDARY_SANCTIONS_SCHEMA = "schemas/v1/cis-secondary-sanctions-request.schema.json"
CIS_SECONDARY_SANCTIONS_ENDPOINT = "/v1/cis-secondary-sanctions/exposure"
AUDIT_CLAIMS_ENDPOINT = "/v1/audit-claims"
SOURCE_COVERAGE_ENDPOINT = "/v1/source-coverage"
SCORE_OUTPUT_ENDPOINT = "/v1/score"

SUPPORTED_CAPABILITIES = [
    "middle_corridor_deal_risk",
    "agentic_interaction_trust",
    "cis_secondary_sanctions_exposure",
    "audit_claims",
    "source_coverage",
    "score_output",
]

CAPABILITY_ALIASES = {
    "middle_corridor_deal_risk": "middle_corridor_deal_risk",
    "middle_corridor_deal_risk_gate": "middle_corridor_deal_risk",
    "middle_corridor": "middle_corridor_deal_risk",
    "middle-corridor-deal-risk": "middle_corridor_deal_risk",
    "middle-corridor-deal-risk-gate": "middle_corridor_deal_risk",
    "agentic_interaction_trust": "agentic_interaction_trust",
    "agentic-interaction-trust": "agentic_interaction_trust",
    "agentic_interaction_trust_gate": "agentic_interaction_trust",
    "agentic-interaction-trust-gate": "agentic_interaction_trust",
    "agentic_trust": "agentic_interaction_trust",
    "agentic-trust": "agentic_interaction_trust",
    "cis_secondary_sanctions": "cis_secondary_sanctions_exposure",
    "cis_secondary_sanctions_exposure": "cis_secondary_sanctions_exposure",
    "cis-secondary-sanctions": "cis_secondary_sanctions_exposure",
    "cis-secondary-sanctions-exposure": "cis_secondary_sanctions_exposure",
    "secondary_sanctions": "cis_secondary_sanctions_exposure",
    "secondary-sanctions": "cis_secondary_sanctions_exposure",
    "audit_claims": "audit_claims",
    "audit-claims": "audit_claims",
    "audit": "audit_claims",
    "source_coverage": "source_coverage",
    "source-coverage": "source_coverage",
    "coverage": "source_coverage",
    "score_output": "score_output",
    "score-output": "score_output",
    "score": "score_output",
}

# Profiles that opt in to per-profile live retrieval per ADR 0014.
#
# This declares the *capability* — what the profile can do if the operator
# wires the relevant credentials. The actual runtime activation is env-derived
# (see `is_live_retrieval_active`). Per the 2026-05-27 update to ADR 0014,
# OpenSanctions live retrieval is currently deferred (the hosted API is paid
# €0.10/call and no commitment has been made), so callers see
# `live_retrieval_active: false` until `OPENSANCTIONS_API_KEY` is configured.
LIVE_RETRIEVAL_PROFILES: dict[str, dict[str, Any]] = {
    "cis_secondary_sanctions": {
        # `upstreams` kept for backward compatibility (consumers that only need a
        # human-readable list of upstream names). `upstream_options` is the
        # authoritative shape and matches the JS worker per ADR 0014 update
        # 2026-05-27 — multiple upstreams can be declared per profile; the
        # dispatcher picks the first active one (free options before paid).
        "upstreams": ["Watchman", "OpenSanctions"],
        "license": "Apache-2.0 (Watchman) or CC-BY-4.0 (OpenSanctions)",
        "upstream_options": [
            {
                "name": "Watchman",
                "license": "Apache-2.0",
                "homepage": "https://github.com/moov-io/watchman",
                "activation_env_var": "WATCHMAN_URL",
                "disable_env_var": "WATCHMAN_DISABLED",
                "cost_model": "self-hosted (Apache-2.0); $0/month on free-tier container",
            },
            {
                "name": "OpenSanctions",
                "license": "CC-BY-4.0",
                "homepage": "https://www.opensanctions.org",
                "activation_env_var": "OPENSANCTIONS_API_KEY",
                "disable_env_var": "OPENSANCTIONS_DISABLED",
                "cost_model": "paid €0.10/call (30-day business-email trial)",
            },
        ],
        # Backward-compatibility shims for the prior single-upstream shape.
        "activation_env_var": "OPENSANCTIONS_API_KEY",
        "disable_env_var": "OPENSANCTIONS_DISABLED",
    },
}


def _is_upstream_option_active(option: dict[str, Any]) -> bool:
    activation = (os.environ.get(option["activation_env_var"], "") or "").strip()
    if not activation:
        return False
    disabled = (os.environ.get(option["disable_env_var"], "") or "").strip().lower()
    if disabled in {"1", "true", "yes"}:
        return False
    return True


def active_upstream_option(profile: str) -> dict[str, Any] | None:
    """Return the first active upstream option for the profile, or None."""
    meta = LIVE_RETRIEVAL_PROFILES.get(profile)
    if not meta:
        return None
    for option in meta.get("upstream_options", []):
        if _is_upstream_option_active(option):
            return option
    return None


def is_live_retrieval_active(profile: str) -> bool:
    """Return True iff at least one upstream option for the profile is active in this env."""
    return active_upstream_option(profile) is not None


def _build_per_profile_live_retrieval_block() -> dict[str, Any]:
    block: dict[str, Any] = {}
    for profile, meta in LIVE_RETRIEVAL_PROFILES.items():
        active = active_upstream_option(profile)
        block[profile] = {
            "capability_declared": True,
            "active": active is not None,
            "active_upstream": active["name"] if active else None,
            "upstreams": meta["upstreams"],
            "license": meta["license"],
            "upstream_options": [
                {
                    "name": option["name"],
                    "license": option["license"],
                    "homepage": option["homepage"],
                    "activation_env_var": option["activation_env_var"],
                    "disable_env_var": option["disable_env_var"],
                    "cost_model": option["cost_model"],
                    "active": _is_upstream_option_active(option),
                }
                for option in meta.get("upstream_options", [])
            ],
        }
    return block


def agent_card(base_url: str = "http://localhost:8080") -> dict:
    """Return a minimal A2A-compatible agent card."""
    return {
        "protocolVersion": "1.0",
        "name": "Agenda Intelligence Middle Corridor Deal Risk Gate",
        "description": (
            "A2A adapter for structured Kazakhstan / Middle Corridor deal-risk evidence triage. "
            "Routes structured JSON requests to the Agenda Intelligence service layer."
        ),
        "url": base_url,
        "provider": {
            "organization": "Vassiliy Lakhonin",
            "url": "https://vassiliylakhonin.github.io/",
        },
        "version": __version__,
        "supportedInterfaces": [
            {
                "url": f"{base_url}/message/send",
                "protocolBinding": "JSONRPC",
                "protocolVersion": "1.0",
            }
        ],
        "protocolVersions": ["1.0"],
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
        },
        "defaultInputModes": ["application/json"],
        "defaultOutputModes": ["application/json", "text/markdown"],
        "skills": [
            {
                "id": "middle-corridor-deal-risk-gate",
                "name": "Middle Corridor deal-risk gate",
                "description": (
                    "Converts route, cargo, counterparty, and dated-source inputs into an auditable "
                    "deal-risk readiness response with evidence gaps and human-review routing."
                ),
                "tags": ["kazakhstan", "middle-corridor", "deal-risk", "evidence-readiness"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "cis-secondary-sanctions-exposure",
                "name": "CIS secondary-sanctions exposure",
                "description": (
                    "Structured secondary-sanctions exposure evidence triage for CIS-domiciled "
                    "counterparties. Consults the OpenSanctions consolidated dataset (CC-BY 4.0) "
                    "for direct name matches and merges them with caller-supplied evidence. Returns "
                    "an auditable triage response with evidence gaps, exposure dimensions, and "
                    "mandatory human-review routing."
                ),
                "tags": [
                    "cis",
                    "kazakhstan",
                    "uzbekistan",
                    "georgia",
                    "secondary-sanctions",
                    "ofac",
                    "eu-14th-package",
                    "uk-ofsi",
                    "evidence-readiness",
                ],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "agentic-interaction-trust-gate",
                "name": "Agentic interaction trust gate",
                "description": (
                    "Structured evidence triage for agent-mediated actions across checkout, account, "
                    "API, MCP tool, and A2A endpoint surfaces. Returns trust-routing readiness, "
                    "evidence gaps, watch-next indicators, and mandatory human-review routing."
                ),
                "tags": [
                    "agentic-ai",
                    "a2a",
                    "mcp",
                    "trust-and-safety",
                    "fraud-risk",
                    "evidence-readiness",
                ],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "audit-claims",
                "name": "Audit claims",
                "description": "Validates and summarizes claim-level evidence support without checking factual truth.",
                "tags": ["evidence", "claims", "audit"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "source-coverage",
                "name": "Source coverage",
                "description": "Diagnoses whether an evidence pack covers a configured source-requirement plan.",
                "tags": ["evidence", "sources", "coverage"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "score-output",
                "name": "Score output",
                "description": "Scores a before/after output pair with the Agenda Intelligence rubric.",
                "tags": ["evaluation", "quality", "scoring"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
        ],
        "x_agenda_intelligence": {
            "repository": REPOSITORY_URL,
            "product_profile": "middle_corridor_deal_risk",
            "canonical_http_endpoint": MIDDLE_CORRIDOR_ENDPOINT,
            "schema": MIDDLE_CORRIDOR_SCHEMA,
            "supported_contracts": [
                "middle_corridor_deal_risk_contract",
                "agentic_interaction_trust_contract",
                "cis_secondary_sanctions_exposure_contract",
            ],
            "supported_capabilities": SUPPORTED_CAPABILITIES,
            "per_profile_live_retrieval": _build_per_profile_live_retrieval_block(),
            "boundaries": [
                (
                    "Live source retrieval is off by default. Per-profile capability is declared for "
                    "named vertical-worker profiles (see per_profile_live_retrieval and ADR 0014), "
                    "but activation requires the operator to configure the relevant credential env "
                    "var. When credentials are absent, the profile degrades to user-supplied "
                    "evidence only with live_retrieval_status: disabled."
                ),
                "No factual-truth verification.",
                "No legal, compliance, sanctions, financial, investment, insurance, or trading advice.",
                "Human review is required for high-stakes decisions.",
            ],
            "adr_references": ["docs/adr/0014-per-profile-live-retrieval.md"],
        },
    }


def _try_parse_json_object(value: Any) -> dict | None:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped.startswith("{") or not stripped.endswith("}"):
        return None
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _candidate_objects_from_params(params: dict) -> list[dict]:
    candidates: list[Any] = [
        params.get("request"),
        params.get("input"),
        params,
    ]

    message = params.get("message")
    if isinstance(message, dict):
        if isinstance(message.get("data"), dict):
            candidates.append(message["data"])
        for part in message.get("parts", []) or []:
            if not isinstance(part, dict):
                continue
            candidates.extend([part.get("data"), part.get("json"), part.get("content")])
            parsed_text = _try_parse_json_object(part.get("text"))
            if parsed_text is not None:
                candidates.append(parsed_text)

    parsed_candidates: list[dict] = []
    for candidate in candidates:
        parsed = _try_parse_json_object(candidate)
        if parsed is not None:
            parsed_candidates.append(parsed)
    return parsed_candidates


def _capability_from_params(params: dict) -> str | None:
    for key in ["capability", "tool", "skill"]:
        value = params.get(key)
        if isinstance(value, str):
            return CAPABILITY_ALIASES.get(value.strip().lower().replace(" ", "_"))

    message = params.get("message")
    if isinstance(message, dict):
        metadata = message.get("metadata")
        if isinstance(metadata, dict):
            value = metadata.get("capability")
            if isinstance(value, str):
                return CAPABILITY_ALIASES.get(value.strip().lower().replace(" ", "_"))
    return None


def _looks_like_middle_corridor_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("route"), str)
        and isinstance(value.get("cargo"), str)
        and isinstance(value.get("counterparties"), list)
        and isinstance(value.get("dated_sources"), list)
        and isinstance(value.get("risk_question"), str)
        and isinstance(value.get("decision_stage"), str)
    )


def middle_corridor_request_from_params(params: dict) -> dict | None:
    """Extract a structured Middle Corridor request from A2A/JSON-RPC params."""
    candidates = _candidate_objects_from_params(params)
    candidates.extend(
        candidate
        for candidate in [
            _try_parse_json_object(params.get("middle_corridor_deal_risk_request")),
            _try_parse_json_object(params.get("middle_corridor_request")),
        ]
        if candidate is not None
    )

    for candidate in candidates:
        if _looks_like_middle_corridor_request(candidate):
            return candidate
    return None


def _looks_like_cis_secondary_sanctions_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("counterparty"), dict)
        and isinstance(value.get("exposure_facets"), list)
        and isinstance(value.get("dated_sources"), list)
        and isinstance(value.get("risk_question"), str)
        and isinstance(value.get("decision_stage"), str)
    )


def cis_secondary_sanctions_request_from_params(params: dict) -> dict | None:
    """Extract a structured CIS secondary-sanctions exposure request from A2A/JSON-RPC params."""
    candidates = _candidate_objects_from_params(params)
    candidates.extend(
        candidate
        for candidate in [
            _try_parse_json_object(params.get("cis_secondary_sanctions_request")),
            _try_parse_json_object(params.get("cis_secondary_sanctions_exposure_request")),
        ]
        if candidate is not None
    )
    for candidate in candidates:
        if _looks_like_cis_secondary_sanctions_request(candidate):
            return candidate
    return None


def _looks_like_agentic_interaction_trust_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("actor"), dict)
        and isinstance(value.get("target_surface"), str)
        and isinstance(value.get("requested_action"), str)
        and isinstance(value.get("dated_sources"), list)
        and isinstance(value.get("risk_question"), str)
        and isinstance(value.get("decision_stage"), str)
    )


def agentic_interaction_trust_request_from_params(params: dict) -> dict | None:
    """Extract a structured agentic interaction trust request from A2A/JSON-RPC params."""
    candidates = _candidate_objects_from_params(params)
    candidates.extend(
        candidate
        for candidate in [
            _try_parse_json_object(params.get("agentic_interaction_trust_request")),
            _try_parse_json_object(params.get("agentic_trust_request")),
        ]
        if candidate is not None
    )
    for candidate in candidates:
        if _looks_like_agentic_interaction_trust_request(candidate):
            return candidate
    return None


def audit_claims_request_from_params(params: dict) -> dict | None:
    """Extract a structured audit_claims request without interpreting free text."""
    candidates = _candidate_objects_from_params(params)
    for candidate in candidates:
        audit_json = candidate.get("audit_json")
        if isinstance(audit_json, dict):
            return audit_json
        if isinstance(candidate.get("claims"), list) and isinstance(candidate.get("evidence"), list):
            return candidate
    return None


def source_coverage_request_from_params(params: dict) -> tuple[dict, str | None] | None:
    """Extract a structured source_coverage request without live retrieval."""
    candidates = _candidate_objects_from_params(params)
    default_category = params.get("category") if isinstance(params.get("category"), str) else None

    for candidate in candidates:
        category = candidate.get("category") if isinstance(candidate.get("category"), str) else default_category
        evidence_json = candidate.get("evidence_json")
        if isinstance(evidence_json, dict):
            return evidence_json, category
        if any(isinstance(candidate.get(key), list) for key in ["claims", "sources", "evidence"]):
            return candidate, category
    return None


def score_output_request_from_params(params: dict) -> tuple[str, str] | None:
    """Extract a structured score_output request."""
    candidates = _candidate_objects_from_params(params)
    for candidate in candidates:
        before_text = candidate.get("before_text")
        after_text = candidate.get("after_text")
        if isinstance(before_text, str) and isinstance(after_text, str):
            return before_text, after_text
    return None


def _artifact_text(response: dict) -> str:
    missing = response.get("minimum_sources_before_go", [])
    missing_text = "\n".join(f"- {item}" for item in missing) if missing else "- none"
    return "\n".join(
        [
            "Middle Corridor deal-risk gate response",
            "",
            f"Recommendation: {response['triage_recommendation']}",
            f"Risk signal: {response['risk_signal']}",
            f"Decision readiness: {response['decision_readiness_score']}/100 ({response['decision_readiness_label']})",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Minimum sources before go:",
            missing_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_middle_corridor(request_json: dict) -> dict:
    result = services.middle_corridor_deal_risk(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "middle_corridor_deal_risk",
                "canonical_http_endpoint": MIDDLE_CORRIDOR_ENDPOINT,
                "schema": MIDDLE_CORRIDOR_SCHEMA,
                "valid": False,
                "errors": result.get("errors", []),
            },
        }

    response = result["response"]
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": "TASK_STATE_COMPLETED"},
        "artifacts": [
            {
                "artifactId": "middle-corridor-deal-risk-response",
                "name": "Middle Corridor deal-risk response",
                "parts": [{"text": _artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "middle_corridor_deal_risk",
            "canonical_http_endpoint": MIDDLE_CORRIDOR_ENDPOINT,
            "schema": MIDDLE_CORRIDOR_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["not_advice_notice"],
            "response": response,
        },
    }


def _cis_artifact_text(response: dict, live_retrieval_status: str) -> str:
    missing = response.get("minimum_sources_before_review", [])
    missing_text = "\n".join(f"- {item}" for item in missing) if missing else "- none"
    dims = response.get("top_exposure_dimensions", [])
    dims_text = "\n".join(f"- {item}" for item in dims) if dims else "- none"
    return "\n".join(
        [
            "CIS secondary-sanctions exposure response",
            "",
            f"Recommendation: {response['triage_recommendation']}",
            f"Exposure signal: {response['secondary_exposure_signal']}",
            f"Decision readiness: {response['decision_readiness_score']}/100 ({response['decision_readiness_label']})",
            f"Live retrieval status: {live_retrieval_status}",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Top exposure dimensions:",
            dims_text,
            "",
            "Minimum sources before review:",
            missing_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_cis_secondary_sanctions(request_json: dict) -> dict:
    result = services.cis_secondary_sanctions_exposure(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "cis_secondary_sanctions",
                "canonical_http_endpoint": CIS_SECONDARY_SANCTIONS_ENDPOINT,
                "schema": CIS_SECONDARY_SANCTIONS_SCHEMA,
                "valid": False,
                "errors": result.get("errors", []),
            },
        }

    response = result["response"]
    live_retrieval_status = result.get("live_retrieval_status", "not_attempted")
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": "TASK_STATE_COMPLETED"},
        "artifacts": [
            {
                "artifactId": "cis-secondary-sanctions-exposure-response",
                "name": "CIS secondary-sanctions exposure response",
                "parts": [{"text": _cis_artifact_text(response, live_retrieval_status), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "cis_secondary_sanctions",
            "canonical_http_endpoint": CIS_SECONDARY_SANCTIONS_ENDPOINT,
            "schema": CIS_SECONDARY_SANCTIONS_SCHEMA,
            "live_retrieval_status": live_retrieval_status,
            "auto_fetched_sources": result.get("auto_fetched_sources", []),
            "upstream_attribution": result.get("upstream_attribution"),
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["not_advice_notice"],
            "response": response,
        },
    }


def _agentic_artifact_text(response: dict) -> str:
    missing = response.get("minimum_sources_before_action", [])
    missing_text = "\n".join(f"- {item}" for item in missing) if missing else "- none"
    dims = response.get("top_risk_dimensions", [])
    dims_text = "\n".join(f"- {item}" for item in dims) if dims else "- none"
    return "\n".join(
        [
            "Agentic interaction trust gate response",
            "",
            f"Recommendation: {response['triage_recommendation']}",
            f"Trust signal: {response['trust_signal']}",
            f"Decision readiness: {response['decision_readiness_score']}/100 ({response['decision_readiness_label']})",
            f"Target surface: {response['target_surface']}",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Top risk dimensions:",
            dims_text,
            "",
            "Minimum sources before action:",
            missing_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_agentic_interaction_trust(request_json: dict) -> dict:
    result = services.agentic_interaction_trust(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "agentic_interaction_trust",
                "canonical_http_endpoint": AGENTIC_INTERACTION_TRUST_ENDPOINT,
                "schema": AGENTIC_INTERACTION_TRUST_SCHEMA,
                "valid": False,
                "errors": result.get("errors", []),
            },
        }

    response = result["response"]
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": "TASK_STATE_COMPLETED"},
        "artifacts": [
            {
                "artifactId": "agentic-interaction-trust-response",
                "name": "Agentic interaction trust response",
                "parts": [{"text": _agentic_artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "agentic_interaction_trust",
            "canonical_http_endpoint": AGENTIC_INTERACTION_TRUST_ENDPOINT,
            "schema": AGENTIC_INTERACTION_TRUST_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["not_advice_notice"],
            "response": response,
        },
    }


def _service_artifact_text(title: str, result: dict) -> str:
    return "\n".join([title, "", "```json", json.dumps(result, indent=2, sort_keys=True), "```"])


def a2a_result_for_audit_claims(audit_json: dict) -> dict:
    result = services.audit_claims(audit_json)
    state = "TASK_STATE_COMPLETED" if result.get("valid") else "TASK_STATE_FAILED"
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": state},
        "artifacts": [
            {
                "artifactId": "audit-claims-response",
                "name": "Audit claims response",
                "parts": [
                    {"text": _service_artifact_text("Audit claims response", result), "mediaType": "text/markdown"}
                ],
            }
        ],
        "metadata": {
            "product_profile": "audit_claims",
            "canonical_http_endpoint": AUDIT_CLAIMS_ENDPOINT,
            "valid": result.get("valid"),
            "response": result,
        },
    }


def a2a_result_for_source_coverage(evidence_json: dict, category: str | None) -> dict:
    result = services.source_coverage(evidence_json, category)
    state = "TASK_STATE_COMPLETED" if result.get("valid_category") else "TASK_STATE_FAILED"
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": state},
        "artifacts": [
            {
                "artifactId": "source-coverage-response",
                "name": "Source coverage response",
                "parts": [
                    {"text": _service_artifact_text("Source coverage response", result), "mediaType": "text/markdown"}
                ],
            }
        ],
        "metadata": {
            "product_profile": "source_coverage",
            "canonical_http_endpoint": SOURCE_COVERAGE_ENDPOINT,
            "valid_category": result.get("valid_category"),
            "response": result,
        },
    }


def a2a_result_for_score_output(before_text: str, after_text: str) -> dict:
    result = services.score_output(before_text, after_text)
    state = "TASK_STATE_COMPLETED" if result.get("error") is None else "TASK_STATE_FAILED"
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": state},
        "artifacts": [
            {
                "artifactId": "score-output-response",
                "name": "Score output response",
                "parts": [
                    {"text": _service_artifact_text("Score output response", result), "mediaType": "text/markdown"}
                ],
            }
        ],
        "metadata": {
            "product_profile": "score_output",
            "canonical_http_endpoint": SCORE_OUTPUT_ENDPOINT,
            "response": result,
        },
    }


def jsonrpc_error(id_value: Any, code: int, message: str, data: dict | None = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": id_value, "error": error}


def handle_jsonrpc(payload: dict, base_url: str = "http://localhost:8080") -> dict:
    """Handle the first A2A JSON-RPC slice."""
    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        return jsonrpc_error(None, -32600, "Invalid Request")

    id_value = payload.get("id")
    method = payload.get("method")
    if method in {"agent/card", "agentCard", "GetExtendedAgentCard"}:
        return {"jsonrpc": "2.0", "id": id_value, "result": agent_card(base_url)}

    if method in {"message/send", "tasks/send", "SendMessage"}:
        params = payload.get("params") or {}
        if not isinstance(params, dict):
            return jsonrpc_error(id_value, -32602, "Invalid params")
        capability = _capability_from_params(params)
        if capability is None and any(key in params for key in ["capability", "tool", "skill"]):
            return jsonrpc_error(
                id_value,
                -32602,
                "Unsupported capability",
                {"supported_capabilities": SUPPORTED_CAPABILITIES},
            )

        if capability == "cis_secondary_sanctions_exposure":
            request_json = cis_secondary_sanctions_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured CIS secondary-sanctions exposure request",
                    {
                        "required_shape": {
                            "counterparty": "object",
                            "exposure_facets": "array",
                            "dated_sources": "array",
                            "risk_question": "string",
                            "decision_stage": "string",
                        },
                        "schema": CIS_SECONDARY_SANCTIONS_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_cis_secondary_sanctions(request_json),
            }

        if capability == "agentic_interaction_trust":
            request_json = agentic_interaction_trust_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured agentic interaction trust request",
                    {
                        "required_shape": {
                            "actor": "object",
                            "target_surface": "string",
                            "requested_action": "string",
                            "dated_sources": "array",
                            "risk_question": "string",
                            "decision_stage": "string",
                        },
                        "schema": AGENTIC_INTERACTION_TRUST_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_agentic_interaction_trust(request_json),
            }

        if capability in {None, "middle_corridor_deal_risk"}:
            request_json = middle_corridor_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured Middle Corridor deal-risk request",
                    {
                        "required_shape": {
                            "route": "string",
                            "cargo": "string",
                            "counterparties": "array",
                            "dated_sources": "array",
                            "risk_question": "string",
                            "decision_stage": "string",
                        },
                        "schema": MIDDLE_CORRIDOR_SCHEMA,
                    },
                )
            return {"jsonrpc": "2.0", "id": id_value, "result": a2a_result_for_middle_corridor(request_json)}

        if capability == "audit_claims":
            audit_json = audit_claims_request_from_params(params)
            if audit_json is None:
                return jsonrpc_error(id_value, -32602, "Missing structured audit_claims request")
            return {"jsonrpc": "2.0", "id": id_value, "result": a2a_result_for_audit_claims(audit_json)}

        if capability == "source_coverage":
            source_request = source_coverage_request_from_params(params)
            if source_request is None:
                return jsonrpc_error(id_value, -32602, "Missing structured source_coverage request")
            evidence_json, category = source_request
            return {"jsonrpc": "2.0", "id": id_value, "result": a2a_result_for_source_coverage(evidence_json, category)}

        if capability == "score_output":
            score_request = score_output_request_from_params(params)
            if score_request is None:
                return jsonrpc_error(id_value, -32602, "Missing structured score_output request")
            before_text, after_text = score_request
            return {"jsonrpc": "2.0", "id": id_value, "result": a2a_result_for_score_output(before_text, after_text)}

    return jsonrpc_error(
        id_value,
        -32601,
        "Method not found",
        {"supported_methods": ["message/send", "SendMessage", "agent/card"]},
    )


def handle_stdin_jsonrpc(raw_input: str, base_url: str = "http://localhost:8080") -> dict:
    """Handle one JSON-RPC object read from stdin."""
    if not raw_input.strip():
        return jsonrpc_error(None, -32700, "Parse error", {"detail": "stdin is empty"})
    try:
        payload = json.loads(raw_input)
    except json.JSONDecodeError as error:
        return jsonrpc_error(None, -32700, "Parse error", {"detail": error.msg})
    if not isinstance(payload, dict):
        return jsonrpc_error(None, -32600, "Invalid Request")
    return handle_jsonrpc(payload, base_url)


def main() -> None:
    """Run the A2A JSON-RPC stdio shell."""
    base_url = os.environ.get("AGENDA_INTELLIGENCE_A2A_BASE_URL", "http://localhost:8080")
    response = handle_stdin_jsonrpc(sys.stdin.read(), base_url)
    json.dump(response, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
