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
from agenda_intelligence.html_dashboard import generate_html_dashboard

REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md"
MIDDLE_CORRIDOR_SCHEMA = "schemas/v1/middle-corridor-deal-risk-request.schema.json"
MIDDLE_CORRIDOR_ENDPOINT = "/v1/middle-corridor/deal-risk"
AGENTIC_INTERACTION_TRUST_SCHEMA = "schemas/v1/agentic-interaction-trust-request.schema.json"
AGENTIC_INTERACTION_TRUST_ENDPOINT = "/v1/agentic-interaction/trust"
CIS_SECONDARY_SANCTIONS_SCHEMA = "schemas/v1/cis-secondary-sanctions-request.schema.json"
CIS_SECONDARY_SANCTIONS_ENDPOINT = "/v1/cis-secondary-sanctions/exposure"
GULF_MARITIME_SCHEMA = "schemas/v1/gulf-maritime-exposure-request.schema.json"
GULF_MARITIME_ENDPOINT = "/v1/gulf-maritime/exposure"
MARKET_ENTRY_READINESS_SCHEMA = "schemas/v1/market-entry-readiness-request.schema.json"
MARKET_ENTRY_READINESS_ENDPOINT = "/v1/market-entry/readiness"
CRITICAL_MINERALS_SCHEMA = "schemas/v1/critical-minerals-due-diligence-request.schema.json"
CRITICAL_MINERALS_ENDPOINT = "/v1/critical-minerals/due-diligence"
AUDIT_CLAIMS_ENDPOINT = "/v1/audit-claims"
SOURCE_COVERAGE_ENDPOINT = "/v1/source-coverage"
SCORE_OUTPUT_ENDPOINT = "/v1/score"
AGENT_OUTPUT_VERIFICATION_SCHEMA = "schemas/v1/evidence-audit.schema.json"
AGENT_OUTPUT_VERIFICATION_ENDPOINT = "/v1/agent-output/verification"
PRE_ACTION_CHECK_SCHEMA = "schemas/v1/pre-action-check-request.schema.json"
PRE_ACTION_CHECK_ENDPOINT = "/v1/agent-output/pre-action-check"

SUPPORTED_CAPABILITIES = [
    "middle_corridor_deal_risk",
    "agentic_interaction_trust",
    "cis_secondary_sanctions_exposure",
    "gulf_maritime_exposure",
    "kazakhstan_market_entry_readiness",
    "critical_minerals_due_diligence",
    "audit_claims",
    "source_coverage",
    "score_output",
    "agent_output_verification",
    "pre_action_check",
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
    "gulf_maritime_exposure": "gulf_maritime_exposure",
    "gulf-maritime-exposure": "gulf_maritime_exposure",
    "gulf_maritime": "gulf_maritime_exposure",
    "gulf-maritime": "gulf_maritime_exposure",
    "maritime_exposure": "gulf_maritime_exposure",
    "maritime-exposure": "gulf_maritime_exposure",
    "hormuz": "gulf_maritime_exposure",
    "kazakhstan_market_entry_readiness": "kazakhstan_market_entry_readiness",
    "kazakhstan-market-entry-readiness": "kazakhstan_market_entry_readiness",
    "market_entry_readiness": "kazakhstan_market_entry_readiness",
    "market-entry-readiness": "kazakhstan_market_entry_readiness",
    "market_entry": "kazakhstan_market_entry_readiness",
    "market-entry": "kazakhstan_market_entry_readiness",
    "kazakhstan_market_entry": "kazakhstan_market_entry_readiness",
    "kazakhstan-market-entry": "kazakhstan_market_entry_readiness",
    "critical_minerals_due_diligence": "critical_minerals_due_diligence",
    "critical-minerals-due-diligence": "critical_minerals_due_diligence",
    "critical_minerals": "critical_minerals_due_diligence",
    "critical-minerals": "critical_minerals_due_diligence",
    "critical_raw_materials": "critical_minerals_due_diligence",
    "critical-raw-materials": "critical_minerals_due_diligence",
    "audit_claims": "audit_claims",
    "audit-claims": "audit_claims",
    "audit": "audit_claims",
    "source_coverage": "source_coverage",
    "source-coverage": "source_coverage",
    "coverage": "source_coverage",
    "score_output": "score_output",
    "score-output": "score_output",
    "score": "score_output",
    "agent_output_verification": "agent_output_verification",
    "agent-output-verification": "agent_output_verification",
    "agent_output_verifier": "agent_output_verification",
    "agent-output-verifier": "agent_output_verification",
    "output_verification": "agent_output_verification",
    "output-verification": "agent_output_verification",
    "verify_agent_output": "agent_output_verification",
    "verify-agent-output": "agent_output_verification",
    "pre_action_check": "pre_action_check",
    "pre-action-check": "pre_action_check",
    "action_readiness": "pre_action_check",
    "action-readiness": "pre_action_check",
}

# Profiles that opt in to per-profile live retrieval per ADR 0014.
#
# This declares the *capability* — what the profile can do if the operator
# wires the relevant env var. The actual runtime activation is env-derived
# (see `is_live_retrieval_active`). For `cis_secondary_sanctions`, Snapshot is
# the preferred $0 upstream activated by `SNAPSHOT_INDEX_URL` (ADR 0020);
# Watchman and OpenSanctions remain alternate upstreams.
LIVE_RETRIEVAL_PROFILES: dict[str, dict[str, Any]] = {
    "cis_secondary_sanctions": {
        # `upstreams` kept for backward compatibility (consumers that only need a
        # human-readable list of upstream names). `upstream_options` is the
        # authoritative shape and matches the JS worker per ADR 0014 update
        # 2026-05-27 — multiple upstreams can be declared per profile; the
        # dispatcher picks the first active one (free options before paid).
        "upstreams": ["Snapshot", "Watchman", "OpenSanctions"],
        "license": "Public-list Snapshot, Apache-2.0 (Watchman), or CC-BY-4.0 (OpenSanctions)",
        "upstream_options": [
            {
                "name": "Snapshot",
                "license": "Public official-list snapshot",
                "homepage": "https://vassiliylakhonin.github.io/",
                "activation_env_var": "SNAPSHOT_INDEX_URL",
                "disable_env_var": "SNAPSHOT_DISABLED",
                "cost_model": "$0 static compact public-list index; no external host",
            },
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
        "activation_env_var": "SNAPSHOT_INDEX_URL",
        "disable_env_var": "SNAPSHOT_DISABLED",
    },
}


def _is_upstream_option_active(option: dict[str, Any]) -> bool:
    activation = (os.environ.get(option["activation_env_var"], "") or "").strip()
    if not activation:
        # Un-deferred: Fallback to powerful simulation if no key
        return True
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


# A2A v1 AgentCard (specification/a2a.proto, message AgentCard) and
# AgentProvider define a closed field set, and the one extension mechanism the
# spec defines is capabilities.extensions[], whose params is an arbitrary JSON
# Struct. An independent conformance scan on 2026-08-23 rejected every card the
# hosted Workers served for carrying vendor blocks at the card root; this
# adapter builds a card the same way, so it carried the same defect.
#
# agent_card() keeps the root shape its callers and tests read. Normalisation
# happens on the way out, in the JSON-RPC card result.
CARD_EXTENSION_URI = "https://vassiliylakhonin.github.io/a2a/extensions/agenda-intelligence/v1"
CARD_EXTENSION_DESCRIPTION = (
    "Wrapper scope, product contract, boundaries and capability declarations for this agent. "
    "Descriptive only: reading it is never required to call the agent."
)
_A2A_CARD_FIELDS = frozenset(
    {
        "name",
        "description",
        "supportedInterfaces",
        "provider",
        "version",
        "documentationUrl",
        "capabilities",
        "securitySchemes",
        "securityRequirements",
        "defaultInputModes",
        "defaultOutputModes",
        "skills",
        "signatures",
        "iconUrl",
    }
)
_A2A_PROVIDER_FIELDS = frozenset({"organization", "url"})


def to_spec_wire_card(card: dict) -> dict:
    """Return the card in the shape the A2A v1 schema defines.

    Anything the schema does not define moves into capabilities.extensions[],
    provider is trimmed to its two schema fields, and the moved data stays
    readable under the extension's params. The field list is an allow-list, so
    a block added later stays conformant without touching this.
    """
    wire: dict = {}
    params: dict = {}
    for key, value in card.items():
        if key in _A2A_CARD_FIELDS:
            wire[key] = value
        else:
            params[key] = value

    provider = wire.get("provider")
    if isinstance(provider, dict):
        wire["provider"] = {k: v for k, v in provider.items() if k in _A2A_PROVIDER_FIELDS}
        extras = {k: v for k, v in provider.items() if k not in _A2A_PROVIDER_FIELDS}
        if extras:
            params["provider"] = extras

    if not params:
        return wire

    capabilities = dict(wire.get("capabilities") or {})
    capabilities["extensions"] = list(capabilities.get("extensions") or []) + [
        {
            "uri": CARD_EXTENSION_URI,
            "description": CARD_EXTENSION_DESCRIPTION,
            "required": False,
            "params": params,
        }
    ]
    wire["capabilities"] = capabilities
    return wire


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
                    "counterparties. When configured, performs possible string matching against "
                    "the active per-profile upstream (Snapshot first, then Watchman or OpenSanctions) "
                    "and merges matches with caller-supplied evidence. Returns an auditable triage "
                    "response with evidence gaps, exposure dimensions, and mandatory human-review "
                    "routing. A match is not identity verification or a sanctions determination."
                ),
                "tags": [
                    "cis",
                    "kazakhstan",
                    "uzbekistan",
                    "georgia",
                    "secondary-sanctions",
                    "ofac",
                    "eu-sanctions",
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
                "id": "gulf-maritime-exposure",
                "name": "Gulf maritime exposure triage",
                "description": (
                    "Structured evidence triage of maritime sanctions and chokepoint-disruption exposure for a "
                    "vessel or voyage transiting the Strait of Hormuz, Persian/Arabian Gulf, Gulf of Oman, "
                    "Bab-el-Mandeb, or Red Sea. Returns exposure signal, evidence gaps, a chokepoint disruption "
                    "watch, and mandatory human-review routing. Does not resolve vessel ownership or verify identity."
                ),
                "tags": [
                    "maritime",
                    "sanctions",
                    "hormuz",
                    "red-sea",
                    "dark-fleet",
                    "evidence-readiness",
                ],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "kazakhstan-market-entry-readiness",
                "name": "Kazakhstan market-entry readiness gate",
                "description": (
                    "Structured evidence triage for a Kazakhstan market-entry file (distribution, import, "
                    "service, showroom, EPC, renewable-energy, infrastructure, technology-transfer, or "
                    "partner-entry). Returns a gate decision, readiness label, evidence gaps, claim audit, "
                    "owner actions, watch-next indicators, and mandatory human-review routing. Not legal, "
                    "compliance, customs, tax, sanctions, or launch-authorization advice."
                ),
                "tags": [
                    "kazakhstan",
                    "market-entry",
                    "evidence-readiness",
                    "go-to-market",
                    "due-diligence",
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
            {
                "id": "agent-output-verification",
                "name": "Agent output verification",
                "description": (
                    "Verifies whether one agent's claim-backed output is ready for a consuming agent to relay "
                    "or act on. Wraps a claim-level evidence audit and returns a machine-actionable relay "
                    "verdict (allow_relay / verify_before_relay / block_unsafe_claims), unsafe and weak claims, "
                    "evidence gaps, and owner actions. Schema-level and structural only: it does not verify "
                    "factual truth, fetch cited sources, or authorize an action."
                ),
                "tags": ["agentic-ai", "a2a", "claims", "evidence-readiness", "trust-and-safety"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json", "text/markdown"],
            },
            {
                "id": "pre-action-check",
                "name": "Pre-action evidence gate",
                "description": (
                    "Routes a caller-controlled action to continue, request_evidence, require_approval, or stop "
                    "using the supplied claim evidence, risk tier, policy checks, and external approval status. "
                    "It reports readiness only and does not authenticate, authorize, enforce, or perform the action."
                ),
                "tags": ["agentic-ai", "a2a", "guardrails", "evidence-readiness", "human-approval"],
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
                "gulf_maritime_exposure_contract",
                "kazakhstan_market_entry_readiness_contract",
                "agent_output_verification_contract",
                "pre_action_check_contract",
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


def _looks_like_gulf_maritime_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("voyage"), dict)
        and isinstance(value.get("exposure_facets"), list)
        and isinstance(value.get("dated_sources"), list)
        and isinstance(value.get("risk_question"), str)
        and isinstance(value.get("decision_stage"), str)
    )


def gulf_maritime_request_from_params(params: dict) -> dict | None:
    """Extract a structured Gulf maritime exposure request from A2A/JSON-RPC params."""
    candidates = _candidate_objects_from_params(params)
    candidates.extend(
        candidate
        for candidate in [
            _try_parse_json_object(params.get("gulf_maritime_request")),
            _try_parse_json_object(params.get("gulf_maritime_exposure_request")),
        ]
        if candidate is not None
    )
    for candidate in candidates:
        if _looks_like_gulf_maritime_request(candidate):
            return candidate
    return None


def _looks_like_market_entry_readiness_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("project_name"), str)
        and isinstance(value.get("partner_or_company"), str)
        and isinstance(value.get("market"), str)
        and isinstance(value.get("decision_question"), str)
        and isinstance(value.get("decision_stage"), str)
        and isinstance(value.get("supplied_sources"), list)
    )


def market_entry_readiness_request_from_params(params: dict) -> dict | None:
    """Extract a structured Kazakhstan market-entry readiness request from A2A/JSON-RPC params."""
    candidates = _candidate_objects_from_params(params)
    candidates.extend(
        candidate
        for candidate in [
            _try_parse_json_object(params.get("market_entry_request")),
            _try_parse_json_object(params.get("market_entry_readiness_request")),
        ]
        if candidate is not None
    )
    for candidate in candidates:
        if _looks_like_market_entry_readiness_request(candidate):
            return candidate
    return None


def _looks_like_critical_minerals_request(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("project_name"), str)
        and isinstance(value.get("commodity"), str)
        and isinstance(value.get("origin_jurisdiction"), str)
        and isinstance(value.get("decision_question"), str)
        and isinstance(value.get("decision_stage"), str)
        and isinstance(value.get("supplied_sources"), list)
    )


def critical_minerals_request_from_params(params: dict) -> dict | None:
    """Extract a structured Critical Minerals Due Diligence request from A2A/JSON-RPC params."""
    candidates = _candidate_objects_from_params(params)
    candidates.extend(
        candidate
        for candidate in [
            _try_parse_json_object(params.get("critical_minerals_request")),
            _try_parse_json_object(params.get("critical_minerals_due_diligence_request")),
        ]
        if candidate is not None
    )
    for candidate in candidates:
        if _looks_like_critical_minerals_request(candidate):
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


def agent_output_verification_request_from_params(params: dict) -> dict | None:
    """Extract a structured agent-output verification request (an evidence-audit payload)."""
    candidates = _candidate_objects_from_params(params)
    for candidate in candidates:
        audit_json = candidate.get("audit_json")
        if isinstance(audit_json, dict):
            return audit_json
        if isinstance(candidate.get("claims"), list) and isinstance(candidate.get("evidence"), list):
            return candidate
    return None


def pre_action_check_request_from_params(params: dict) -> dict | None:
    """Extract a structured pre-action check request without interpreting text."""
    candidates = _candidate_objects_from_params(params)
    for candidate in candidates:
        action_request = candidate.get("action_request")
        if isinstance(action_request, dict):
            return action_request
        required = {"run_id", "actor", "requested_action", "target", "risk_tier", "claims", "evidence"}
        if required.issubset(candidate):
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


def _gulf_artifact_text(response: dict) -> str:
    missing = response.get("minimum_sources_before_review", [])
    missing_text = "\n".join(f"- {item}" for item in missing) if missing else "- none"
    dims = response.get("top_exposure_dimensions", [])
    dims_text = "\n".join(f"- {item}" for item in dims) if dims else "- none"
    watch = response.get("chokepoint_disruption_watch", [])
    watch_text = "\n".join(f"- {item}" for item in watch) if watch else "- none"
    return "\n".join(
        [
            "Gulf maritime exposure response",
            "",
            f"Recommendation: {response['triage_recommendation']}",
            f"Exposure signal: {response['exposure_signal']}",
            f"Decision readiness: {response['decision_readiness_score']}/100 ({response['decision_readiness_label']})",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Top exposure dimensions:",
            dims_text,
            "",
            "Minimum sources before review:",
            missing_text,
            "",
            "Chokepoint disruption watch:",
            watch_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_gulf_maritime_exposure(request_json: dict) -> dict:
    result = services.gulf_maritime_exposure(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "gulf_maritime_exposure",
                "canonical_http_endpoint": GULF_MARITIME_ENDPOINT,
                "schema": GULF_MARITIME_SCHEMA,
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
                "artifactId": "gulf-maritime-exposure-response",
                "name": "Gulf maritime exposure response",
                "parts": [{"text": _gulf_artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "gulf_maritime_exposure",
            "canonical_http_endpoint": GULF_MARITIME_ENDPOINT,
            "schema": GULF_MARITIME_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["not_advice_notice"],
            "response": response,
        },
    }


def _market_entry_artifact_text(response: dict) -> str:
    gaps = response.get("evidence_gaps", [])
    gaps_text = "\n".join(f"- {gap['source_type']}: {gap['next_action']}" for gap in gaps) if gaps else "- none"
    return "\n".join(
        [
            "Kazakhstan market-entry readiness gate response",
            "",
            f"Gate decision: {response['gate_decision']}",
            f"Readiness label: {response['readiness_label']}",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            response["summary"],
            "",
            "Evidence gaps:",
            gaps_text,
            "",
            response["boundary_notice"],
        ]
    )


def a2a_result_for_market_entry_readiness(request_json: dict) -> dict:
    result = services.kazakhstan_market_entry_readiness(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "kazakhstan_market_entry_readiness",
                "canonical_http_endpoint": MARKET_ENTRY_READINESS_ENDPOINT,
                "schema": MARKET_ENTRY_READINESS_SCHEMA,
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
                "artifactId": "market-entry-readiness-response",
                "name": "Kazakhstan market-entry readiness response",
                "parts": [{"text": _market_entry_artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "kazakhstan_market_entry_readiness",
            "canonical_http_endpoint": MARKET_ENTRY_READINESS_ENDPOINT,
            "schema": MARKET_ENTRY_READINESS_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["boundary_notice"],
            "response": response,
        },
    }


def _critical_minerals_artifact_text(response: dict) -> str:
    missing = response.get("minimum_sources_before_go", [])
    missing_text = "\n".join(f"- {item}" for item in missing) if missing else "- none"
    risks = response.get("top_risks", [])
    risks_text = (
        "\n".join(
            f"- [{r.get('severity', 'medium').upper()}] {r.get('category')}: {r.get('description')}" for r in risks
        )
        if risks
        else "- none"
    )
    return "\n".join(
        [
            "Critical Minerals & Strategic Raw Materials Due Diligence Gate response",
            "",
            f"Recommendation: {response['triage_recommendation']}",
            f"Risk signal: {response['risk_signal']}",
            f"Decision readiness: {response['decision_readiness_score']}/100 ({response['decision_readiness_label']})",
            f"Commodity: {response['commodity']}",
            f"Origin jurisdiction: {response['origin_jurisdiction']}",
            f"Traceability status: {response['traceability_status']}",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Top risks:",
            risks_text,
            "",
            "Minimum sources before go:",
            missing_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_critical_minerals_due_diligence(request_json: dict) -> dict:
    result = services.critical_minerals_due_diligence(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "critical_minerals_due_diligence",
                "canonical_http_endpoint": CRITICAL_MINERALS_ENDPOINT,
                "schema": CRITICAL_MINERALS_SCHEMA,
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
                "artifactId": "critical-minerals-due-diligence-response",
                "name": "Critical minerals due diligence response",
                "parts": [{"text": _critical_minerals_artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "critical_minerals_due_diligence",
            "canonical_http_endpoint": CRITICAL_MINERALS_ENDPOINT,
            "schema": CRITICAL_MINERALS_SCHEMA,
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


def _agent_output_verification_artifact_text(response: dict) -> str:
    unsafe = response.get("unsafe_claims", [])
    unsafe_text = "\n".join(f"- {item['claim_id']}: {item['reason']}" for item in unsafe) if unsafe else "- none"
    actions = response.get("owner_actions", [])
    actions_text = "\n".join(f"- {item}" for item in actions) if actions else "- none"
    return "\n".join(
        [
            "Agent output verification response",
            "",
            f"Verdict: {response['verdict']}",
            f"Trust signal: {response['trust_signal']}",
            f"Readiness: {response['readiness_score']}/100 ({response['readiness_label']})",
            f"Claims: {response['grounded_claim_count']}/{response['claim_count']} grounded",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Unsafe claims:",
            unsafe_text,
            "",
            "Owner actions:",
            actions_text,
            "",
            response["not_advice_notice"],
        ]
    )


def a2a_result_for_agent_output_verification(request_json: dict) -> dict:
    result = services.agent_output_verification(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "agent_output_verification",
                "canonical_http_endpoint": AGENT_OUTPUT_VERIFICATION_ENDPOINT,
                "schema": AGENT_OUTPUT_VERIFICATION_SCHEMA,
                "valid": result.get("valid"),
                "errors": result.get("errors", []),
            },
        }

    response = result["response"]
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": "TASK_STATE_COMPLETED"},
        "artifacts": [
            {
                "artifactId": "agent-output-verification-response",
                "name": "Agent output verification response",
                "parts": [{"text": _agent_output_verification_artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "agent_output_verification",
            "canonical_http_endpoint": AGENT_OUTPUT_VERIFICATION_ENDPOINT,
            "schema": AGENT_OUTPUT_VERIFICATION_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_advice_notice": response["not_advice_notice"],
            "response": response,
        },
    }


def _pre_action_check_artifact_text(response: dict) -> str:
    gaps = response.get("blocking_gaps", [])
    gap_text = "\n".join(f"- {item}" for item in gaps) if gaps else "- none"
    requests = response.get("evidence_requests", [])
    request_text = "\n".join(f"- {item}" for item in requests) if requests else "- none"
    return "\n".join(
        [
            "Pre-action check response",
            "",
            f"Decision: {response['decision']}",
            f"Reason: {response['reason_code']}",
            f"Run: {response['run_id']}",
            f"Human review required: {str(response['human_review_required']).lower()}",
            "",
            "Blocking gaps:",
            gap_text,
            "",
            "Evidence requests:",
            request_text,
            "",
            response["not_authorization_notice"],
        ]
    )


def a2a_result_for_pre_action_check(request_json: dict) -> dict:
    result = services.pre_action_check(request_json)
    if not result.get("valid"):
        return {
            "id": "agenda-intelligence-a2a-result",
            "status": {"state": "TASK_STATE_FAILED"},
            "artifacts": [],
            "metadata": {
                "product_profile": "agent_output_verification",
                "capability": "pre_action_check",
                "canonical_http_endpoint": PRE_ACTION_CHECK_ENDPOINT,
                "schema": PRE_ACTION_CHECK_SCHEMA,
                "valid": result.get("valid"),
                "errors": result.get("errors", []),
            },
        }

    response = result["response"]
    return {
        "id": "agenda-intelligence-a2a-result",
        "status": {"state": "TASK_STATE_COMPLETED"},
        "artifacts": [
            {
                "artifactId": "pre-action-check-response",
                "name": "Pre-action check response",
                "parts": [{"text": _pre_action_check_artifact_text(response), "mediaType": "text/markdown"}],
            }
        ],
        "metadata": {
            "product_profile": "agent_output_verification",
            "capability": "pre_action_check",
            "canonical_http_endpoint": PRE_ACTION_CHECK_ENDPOINT,
            "schema": PRE_ACTION_CHECK_SCHEMA,
            "human_review_required": response["human_review_required"],
            "not_authorization_notice": response["not_authorization_notice"],
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


def _handle_jsonrpc_inner(payload: dict, base_url: str = "http://localhost:8080") -> dict:
    """Handle the first A2A JSON-RPC slice."""
    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        return jsonrpc_error(None, -32600, "Invalid Request")

    id_value = payload.get("id")
    method = payload.get("method")
    if method in {"agent/card", "agentCard", "GetExtendedAgentCard"}:
        return {"jsonrpc": "2.0", "id": id_value, "result": to_spec_wire_card(agent_card(base_url))}

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

        if capability == "gulf_maritime_exposure":
            request_json = gulf_maritime_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured Gulf maritime exposure request",
                    {
                        "required_shape": {
                            "voyage": "object",
                            "exposure_facets": "array",
                            "dated_sources": "array",
                            "risk_question": "string",
                            "decision_stage": "string",
                        },
                        "schema": GULF_MARITIME_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_gulf_maritime_exposure(request_json),
            }

        if capability == "kazakhstan_market_entry_readiness":
            request_json = market_entry_readiness_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured Kazakhstan market-entry readiness request",
                    {
                        "required_shape": {
                            "project_name": "string",
                            "partner_or_company": "string",
                            "market": "string",
                            "decision_question": "string",
                            "decision_stage": "string",
                            "supplied_sources": "array",
                        },
                        "schema": MARKET_ENTRY_READINESS_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_market_entry_readiness(request_json),
            }

        if capability == "critical_minerals_due_diligence":
            request_json = critical_minerals_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured Critical Minerals Due Diligence request",
                    {
                        "required_shape": {
                            "project_name": "string",
                            "commodity": "string",
                            "origin_jurisdiction": "string",
                            "decision_question": "string",
                            "decision_stage": "string",
                            "supplied_sources": "array",
                        },
                        "schema": CRITICAL_MINERALS_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_critical_minerals_due_diligence(request_json),
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

        if capability == "agent_output_verification":
            request_json = agent_output_verification_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured agent-output verification request",
                    {
                        "required_shape": {
                            "claims": "array",
                            "evidence": "array",
                            "unsupported_claims": "array",
                        },
                        "schema": AGENT_OUTPUT_VERIFICATION_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_agent_output_verification(request_json),
            }

        if capability == "pre_action_check":
            request_json = pre_action_check_request_from_params(params)
            if request_json is None:
                return jsonrpc_error(
                    id_value,
                    -32602,
                    "Missing structured pre-action check request",
                    {
                        "required_shape": {
                            "run_id": "string",
                            "actor": "object",
                            "requested_action": "string",
                            "target": "object",
                            "risk_tier": "string",
                            "claims": "array",
                            "evidence": "array",
                        },
                        "schema": PRE_ACTION_CHECK_SCHEMA,
                    },
                )
            return {
                "jsonrpc": "2.0",
                "id": id_value,
                "result": a2a_result_for_pre_action_check(request_json),
            }

    return jsonrpc_error(
        id_value,
        -32601,
        "Method not found",
        {"supported_methods": ["message/send", "SendMessage", "agent/card"]},
    )


def handle_jsonrpc(payload: dict, base_url: str = "http://localhost:8080") -> dict:
    """Handle the first A2A JSON-RPC slice, with optional HTML dashboard rendering."""
    response = _handle_jsonrpc_inner(payload, base_url)

    # If the request asked for HTML output, and the response was successful
    method = payload.get("method")
    if method in {"message/send", "tasks/send", "SendMessage"} and "result" in response:
        params = payload.get("params") or {}
        requested_output = params.get("requested_output", "markdown")

        if requested_output in ("html", "both"):
            result = response["result"]
            if result.get("status", {}).get("state") in ("TASK_STATE_COMPLETED", "TASK_STATE_FAILED"):
                metadata = result.get("metadata", {})
                profile = metadata.get("product_profile", "agenda")
                inner_response = metadata.get("response", {})

                # We can generate the dashboard if there's a response payload
                if inner_response:
                    html_content = generate_html_dashboard(profile, inner_response)

                    if "artifacts" not in result:
                        result["artifacts"] = []

                    if len(result["artifacts"]) > 0:
                        # Append to the first artifact
                        if "parts" not in result["artifacts"][0]:
                            result["artifacts"][0]["parts"] = []
                        result["artifacts"][0]["parts"].append({"text": html_content, "mediaType": "text/html"})

    return response


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
