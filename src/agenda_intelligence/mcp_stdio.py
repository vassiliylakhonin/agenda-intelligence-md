"""Minimal stdio MCP transport for Agenda Intelligence tools.

Speaks the 2026-07-28 stateless core: no session, no initialize handshake, per
request protocol version in `_meta`, `server/discover` for capability discovery.
The removed handshake methods are still answered so that clients on earlier
revisions keep working — see SUPPORTED_PROTOCOL_VERSIONS.
"""

import copy
import json
import sys
from typing import Any, Callable, Optional

from agenda_intelligence import __version__, mcp_server

PROTOCOL_VERSION = "2026-07-28"

# Revisions this server still answers. 2026-07-28 made the protocol stateless and
# dropped the initialize handshake, sessions, and ping — but shipped clients still
# open with them, so the legacy methods stay served until those clients move. The
# tool surface is identical across revisions because every tool here is a pure
# function over its arguments: there is no per-connection state to negotiate.
SUPPORTED_PROTOCOL_VERSIONS = ("2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26")

# _meta keys defined by the 2026-07-28 core. The client states its protocol
# version on every request instead of once at handshake time; the server states
# its identity on every result.
META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion"
META_CLIENT_INFO = "io.modelcontextprotocol/clientInfo"
META_SERVER_INFO = "io.modelcontextprotocol/serverInfo"

# -32020..-32099 is the range the spec reserved for itself in 2026-07-28.
UNSUPPORTED_PROTOCOL_VERSION = -32022

SERVER_NAME = "agenda-intelligence-md"
INSTRUCTIONS = "Use these tools for agenda-analysis protocol, evidence discipline, lenses, and schemas."

# The listing is assembled from packaged data that cannot change while the process
# runs, so a client may hold it for an hour rather than re-listing per turn. The
# scope is public because the listing carries no caller data.
TOOL_LIST_TTL_MS = 3_600_000
TOOL_LIST_CACHE_SCOPE = "public"

JsonDict = dict[str, Any]


def _schema(properties: JsonDict, required: Optional[list[str]] = None) -> JsonDict:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


# How many levels of a bundled request schema to inline in the tool listing.
# Two keeps the field names, their types, enum values, and the required list —
# enough to build a first payload — while leaving deep nesting to get_schema.
_REQUEST_SHAPE_DEPTH = 2
_SHAPE_KEYWORDS = ("type", "enum", "format", "minimum", "maximum", "minItems", "minLength")


def _resolve_ref(node: Any, root: JsonDict) -> Any:
    """Follow local #/$defs/... references so the shape shows real fields.

    The request schemas keep their object definitions in $defs and reference
    them from the top level. Leaving the $ref unresolved renders as an empty
    object — exactly the guessing game this whole helper exists to remove.
    """
    for _ in range(5):
        if not isinstance(node, dict) or "$ref" not in node:
            return node
        ref = node["$ref"]
        if not isinstance(ref, str) or not ref.startswith("#/"):
            return node
        target: Any = root
        for part in ref[2:].split("/"):
            if not isinstance(target, dict) or part not in target:
                return node
            target = target[part]
        node = target
    return node


def _prune_schema_node(node: Any, depth: int, root: JsonDict) -> JsonDict:
    """Copy a schema node, keeping structure only down to *depth* levels."""
    node = _resolve_ref(node, root)
    if not isinstance(node, dict):
        return {}
    pruned: JsonDict = {key: node[key] for key in _SHAPE_KEYWORDS if key in node}
    if depth <= 0:
        return pruned
    if isinstance(node.get("properties"), dict):
        pruned["properties"] = {
            name: _prune_schema_node(value, depth - 1, root) for name, value in node["properties"].items()
        }
        if node.get("required"):
            pruned["required"] = list(node["required"])
    if "items" in node:
        pruned["items"] = _prune_schema_node(node["items"], depth - 1, root)
    return pruned


def _request_shape(schema_name: str, description: str) -> JsonDict:
    """Inline a bundled request schema's shape into a tool parameter.

    An agent chooses and fills a tool from the listing alone. A bare
    {"type": "object"} that points at a schema file name the agent has never
    read forces it to guess the payload, fail validation, and drop the tool for
    good. Inlining the full schema is not an option either — the vertical
    request schemas are 6-7 KB each and every connected session would pay for
    all of them. So the listing carries the top two levels (field names, types,
    enum values, required list) and get_schema serves the rest on demand.

    Falls back to the opaque object if the packaged schema cannot be read, so a
    packaging problem degrades the hint rather than breaking the server.
    """
    result = mcp_server.get_schema(schema_name)
    schema = result.get("schema") if isinstance(result, dict) else None
    if not isinstance(schema, dict):
        return {"type": "object", "description": description}
    shape = _prune_schema_node(schema, _REQUEST_SHAPE_DEPTH, schema)
    shape["type"] = "object"
    shape["description"] = f"{description} Call get_schema('{schema_name}') for the full nested contract."
    # The bundled schemas carry a worked example. A payload the caller can copy
    # and adapt beats any field list, so it travels with the tool definition.
    examples = schema.get("examples")
    if isinstance(examples, list) and examples:
        shape["examples"] = [examples[0]]
    return shape


TOOLS: dict[str, dict[str, Any]] = {
    "validate_brief": {
        "description": (
            "Validate a caller-provided agenda brief against agenda-brief.schema.json. "
            "Use before running scoring, evidence audit, or publication steps to catch missing "
            "sections and schema drift. Pass the parsed brief object as brief_json. "
            "Returns validation status and schema errors only; it does not judge factual truth, "
            "retrieve sources, or improve the brief."
        ),
        "inputSchema": _schema(
            {
                "brief_json": {
                    "type": "object",
                    "description": "Parsed agenda brief JSON object to validate against the bundled schema.",
                }
            },
            ["brief_json"],
        ),
        "handler": lambda args: mcp_server.validate_brief(args["brief_json"]),
    },
    "validate_evidence": {
        "description": (
            "Validate a caller-provided evidence pack against evidence-pack.schema.json. "
            "Use when you need to confirm that claims, evidence IDs, provenance fields, and "
            "optional source_category metadata are structurally usable by Agenda Intelligence. "
            "Pass the parsed evidence pack as evidence_json. Returns schema validity and errors; "
            "it does not verify whether evidence is true, current, or sufficient."
        ),
        "inputSchema": _schema(
            {
                "evidence_json": {
                    "type": "object",
                    "description": "Parsed evidence-pack JSON object to validate against the bundled schema.",
                }
            },
            ["evidence_json"],
        ),
        "handler": lambda args: mcp_server.validate_evidence(args["evidence_json"]),
    },
    "check_evidence_packet": {
        "description": (
            "Check a caller-provided evidence packet before human review. Use when an AI output "
            "declares claims, source IDs, optional verbatim quotes, and the full supplied source "
            "text. Returns packet_complete, source_review_required, or packet_incomplete per claim "
            "and overall, with broken references, quote mismatches, lexical-support gaps, unmatched "
            "numbers, and owner actions. Deterministic and local-text only: it does not retrieve "
            "sources, score source authority, assess factual truth, or authorize an action."
        ),
        "inputSchema": _schema(
            {
                "packet_json": _request_shape(
                    "evidence_packet_request",
                    "Claims plus the complete source texts those claims reference.",
                )
            },
            ["packet_json"],
        ),
        "handler": lambda args: mcp_server.check_evidence_packet(args["packet_json"]),
    },
    "audit_claims": {
        "description": (
            "Validate a claim-level evidence audit and summarize support quality. "
            "Use after drafting or receiving a memo to check whether important claims point "
            "to evidence IDs with explicit support levels, uncertainty hooks, and risk-if-wrong "
            "notes. Pass audit_json matching evidence-audit.schema.json. Returns validity, "
            "support-level distribution, orphan evidence references, and unsupported-claim "
            "counts. It does not verify factual truth or source reputation."
        ),
        "inputSchema": _schema(
            {
                "audit_json": {
                    "type": "object",
                    "description": "Parsed claim-level evidence-audit object to validate and summarize.",
                }
            },
            ["audit_json"],
        ),
        "handler": lambda args: mcp_server.audit_claims(args["audit_json"]),
    },
    "get_protocol": {
        "description": (
            "Return packaged Agenda Intelligence protocol markdown. Use when an agent needs "
            "the reasoning contract, evidence-discipline rules, or operating instructions "
            "before producing strategic-risk analysis. Pass name='entrypoint' for the main "
            "protocol. Returns markdown text from the installed package; it does not analyze "
            "a question or validate user data."
        ),
        "inputSchema": _schema(
            {
                "name": {
                    "type": "string",
                    "description": "Protocol document name. Use 'entrypoint' for the main Agenda-Intelligence.md.",
                }
            },
            ["name"],
        ),
        "handler": lambda args: mcp_server.get_protocol(args["name"]),
    },
    "list_lenses": {
        "description": (
            "List packaged regional and sector lens IDs available to Agenda Intelligence. "
            "Use before get_lens when an agent needs to discover which geography or sector "
            "reference packs can be loaded. Optionally filter by lens_type='regional' or "
            "'sector'. Returns metadata only; it does not return full lens markdown or run "
            "analysis."
        ),
        "inputSchema": _schema(
            {
                "lens_type": {
                    "type": "string",
                    "enum": ["regional", "sector"],
                    "description": (
                        "Optional filter. Use 'regional' for geography lenses or " "'sector' for sector lenses."
                    ),
                }
            }
        ),
        "handler": lambda args: mcp_server.list_lenses(args.get("lens_type")),
    },
    "get_lens": {
        "description": (
            "Return the full markdown for one packaged regional or sector lens. Use after "
            "list_lenses when an agent needs the actual specialist context, such as the "
            "Central Asia/Caspian or sanctions lens, for a strategic-risk task. Pass lens_type "
            "and lens_id exactly as listed. Returns static markdown; it does not retrieve live "
            "events or decide which lens should be used."
        ),
        "inputSchema": _schema(
            {
                "lens_type": {
                    "type": "string",
                    "enum": ["regional", "sector"],
                    "description": "Lens family from list_lenses: 'regional' or 'sector'.",
                },
                "lens_id": {
                    "type": "string",
                    "description": "Specific lens identifier returned by list_lenses.",
                },
            },
            ["lens_type", "lens_id"],
        ),
        "handler": lambda args: mcp_server.get_lens(args["lens_type"], args["lens_id"]),
    },
    "source_plan": {
        "description": (
            "Return required source categories for a strategic-risk evidence pack. Use before "
            "collection or review to know which source types should be checked for a domain "
            "such as sanctions, elections, conflict, cyber, or energy. Pass the source category "
            "slug as category. Returns a checklist of must_check and optional source types; it "
            "does not search the web, fetch documents, or validate an evidence pack."
        ),
        "inputSchema": _schema(
            {
                "category": {
                    "type": "string",
                    "description": (
                        "Source requirement category slug, for example sanctions, "
                        "elections, or energy. Call list_source_categories for the full set."
                    ),
                }
            },
            ["category"],
        ),
        "handler": lambda args: mcp_server.source_plan(args["category"]),
    },
    "list_source_categories": {
        "description": (
            "List source requirement category slugs packaged with Agenda Intelligence. "
            "Use this first when you do not know which category to pass to source_plan or "
            "source_coverage. Returns category IDs and per-pack counts. Discovery only: it does "
            "not discover sources, validate coverage, or verify factual truth."
        ),
        "inputSchema": _schema({}),
        "handler": lambda args: mcp_server.list_source_categories(),
    },
    "source_coverage": {
        "description": (
            "Diagnose whether an evidence pack covers the must_check source types for a "
            "category. Use after collecting evidence to find source gaps before relying on a "
            "memo. Pass evidence_json and optionally category; if category is omitted, the tool "
            "uses evidence_json.source_category. Returns matched and missing source types. It "
            "does not discover new sources, verify truth, or change validate_evidence results."
        ),
        "inputSchema": _schema(
            {
                "evidence_json": {
                    "type": "object",
                    "description": "Parsed evidence pack to compare against source requirements.",
                },
                "category": {
                    "type": "string",
                    "description": (
                        "Optional source requirement category slug; overrides " "evidence_json.source_category."
                    ),
                },
            },
            ["evidence_json"],
        ),
        "handler": lambda args: mcp_server.source_coverage(args["evidence_json"], args.get("category")),
    },
    "score_output": {
        "description": (
            "Score a before/after pair of agenda-analysis text with the bundled heuristic "
            "rubric. Use in evals or demos to compare whether an Agenda Intelligence rewrite "
            "improved structure, evidence labeling, uncertainty handling, and decision-readiness. "
            "Pass before_text and after_text as plain strings. Returns a heuristic score and "
            "breakdown; it is not a factuality, legal, compliance, or investment judgment."
        ),
        "inputSchema": _schema(
            {
                "before_text": {
                    "type": "string",
                    "description": "Original analysis text before Agenda Intelligence processing.",
                },
                "after_text": {
                    "type": "string",
                    "description": "Revised analysis text to score against the protocol rubric.",
                },
            },
            ["before_text", "after_text"],
        ),
        "handler": lambda args: mcp_server.score_output(args["before_text"], args["after_text"]),
    },
    "verify_quotes": {
        "description": (
            "Check whether quoted fragments appear in caller-provided source text. Use when you "
            "have local excerpts and need to catch citation drift or misquoted snippets. Accepts an "
            "evidence pack (sources/evidence items with a quote) or an evidence-audit doc with "
            "claims[].supporting_quotes; span checks carry the originating claim_id. Pass pack_json "
            "plus texts mapping evidence_id to plain text. Returns present, absent, and "
            "missing_source_text results. Local-text only: it does not make outbound requests, "
            "discover sources, score source reputation, gather news, or verify factual truth."
        ),
        "inputSchema": _schema(
            {
                "pack_json": {
                    "type": "object",
                    "description": (
                        "Evidence pack (evidence IDs + quote fragments) or evidence-audit doc "
                        "(claims with supporting_quotes) to check."
                    ),
                },
                "texts": {
                    "type": "object",
                    "description": "Optional mapping from evidence_id to caller-provided plain source text.",
                },
            },
            ["pack_json"],
        ),
        "handler": lambda args: mcp_server.verify_quotes(args["pack_json"], args.get("texts")),
    },
    "grounded_check": {
        "description": (
            "Check whether a caller-supplied corpus of source texts lexically supports each claim. "
            "Use when you have claims plus the full text of the sources they should rest on and need "
            "a deterministic grounded/weakly_grounded/ungrounded verdict per claim before human "
            "review. Pass request_json matching grounded-check-request.schema.json (claims with "
            "claim_id/claim_text and optional verbatim quotes, corpus documents with corpus_id/text). "
            "Returns per-claim grounding status, coverage, best-matching passage, unmatched numeric "
            "values, quote checks, and owner actions. Local-text only: no outbound requests, no source "
            "discovery, no source-reliability scoring, and no factual-truth verification — grounding "
            "in a wrong corpus does not make a claim true."
        ),
        "inputSchema": _schema(
            {
                "request_json": {
                    "type": "object",
                    "description": (
                        "Grounded-check request: claims (claim_id, claim_text, optional quotes) "
                        "plus corpus documents (corpus_id, text)."
                    ),
                }
            },
            ["request_json"],
        ),
        "handler": lambda args: mcp_server.grounded_check(args["request_json"]),
    },
    "verify_claims": {
        "description": (
            "Issue a bounded factual Claim Verdict from caller-supplied evidence records. "
            "Evaluates freshness, authoritative source class, independent source groups, "
            "conflicts, jurisdiction, and exact subject identifiers as of a declared date. "
            "Returns verified, contradicted, partially_supported, unresolved, or not_verifiable. "
            "No source discovery or live retrieval; verified means the declared evidence threshold "
            "is met, not absolute truth. Human review remains required."
        ),
        "inputSchema": _schema(
            {
                "request_json": _request_shape(
                    "claim_verification_request",
                    "Claim verification request.",
                )
            },
            ["request_json"],
        ),
        "handler": lambda args: mcp_server.verify_claims(args["request_json"]),
    },
    "analyze": {
        "description": (
            "Generate an auditable strategic-risk memo from a structured Agenda request. "
            "Use for sanctions, regulatory, geopolitical, trade, corridor, or policy-risk "
            "questions where the agent needs a memo with assumptions, scenarios, evidence "
            "discipline, and regional routing. Pass request matching agenda-request.schema.json. "
            "Returns a validated agenda-memo; when ANTHROPIC_API_KEY is unset it returns the "
            "assembled system_prompt for the host model to complete. No live source retrieval "
            "and no legal, compliance, financial, or investment advice."
        ),
        "inputSchema": _schema(
            {
                "request": _request_shape(
                    "agenda_request",
                    "Agenda request with question, geography, audience, depth, evidence mode, and output format.",
                )
            },
            ["request"],
        ),
        "handler": lambda args: mcp_server.analyze(args["request"]),
    },
    "validate_memo": {
        "description": (
            "Validate an Agenda memo against agenda-memo.schema.json. Use after a host model "
            "or external process drafts a memo and before treating it as an Agenda Intelligence "
            "artifact. Pass the parsed memo as memo_json. Returns validity and schema errors; "
            "it does not score truthfulness, retrieve sources, or rewrite the memo."
        ),
        "inputSchema": _schema(
            {
                "memo_json": {
                    "type": "object",
                    "description": "Parsed Agenda memo JSON object to validate against the output schema.",
                }
            },
            ["memo_json"],
        ),
        "handler": lambda args: mcp_server.validate_memo(args["memo_json"]),
    },
    "check_memo_quality": {
        "description": (
            "Check a schema-shaped Agenda memo against post-hoc evidence-readiness quality "
            "guardrails. Use after validate_memo or on any external model memo to catch "
            "schema-valid but unsafe output: approval/clearance overreach, hidden evidence "
            "gaps, generic monitoring, weak owner actions, or evidence-mode discipline "
            "failures. Returns schema_valid separately from ok; it does not verify factual truth."
        ),
        "inputSchema": _schema(
            {
                "memo_json": {
                    "type": "object",
                    "description": "Parsed Agenda memo JSON object to check for evidence-readiness quality.",
                }
            },
            ["memo_json"],
        ),
        "handler": lambda args: mcp_server.check_memo_quality(args["memo_json"]),
    },
    "list_signals": {
        "description": (
            "List packaged strategic-risk signal records vendored from Global Think Tank "
            "Analyst. Use to discover available signal IDs before calling get_signal, or to "
            "show a static archive index inside an agent workflow. Returns the packaged "
            "signals/index.json snapshot. Read-only and offline: it does not fetch live news "
            "or update the archive."
        ),
        "inputSchema": _schema({}),
        "handler": lambda args: mcp_server.list_signals(),
    },
    "get_signal": {
        "description": (
            "Return one packaged strategic-risk signal markdown file by ID. Use after "
            "list_signals when an agent needs the full text of a specific archived signal for "
            "context or examples. Pass signal_id without the .md extension. Returns static "
            "markdown from the installed package; it does not fetch live updates."
        ),
        "inputSchema": _schema(
            {
                "signal_id": {
                    "type": "string",
                    "description": "Signal identifier returned by list_signals, without a file extension.",
                }
            },
            ["signal_id"],
        ),
        "handler": lambda args: mcp_server.get_signal(args["signal_id"]),
    },
    "deep_dive": {
        "description": (
            "Reserved placeholder for a future Agenda Intelligence v2 deep-dive workflow. "
            "Do not use for current detailed analysis. For production work today, call analyze "
            "with request.depth set to scenario or red_team. This tool only returns a planned "
            "status message and performs no analysis."
        ),
        "inputSchema": _schema(
            {
                "aspect": {
                    "type": "string",
                    "description": "Optional future deep-dive aspect. Currently ignored because the tool is reserved.",
                }
            }
        ),
        "handler": lambda args: mcp_server.deep_dive(args.get("aspect")),
    },
    "middle_corridor_deal_risk": {
        "description": (
            "Screen a Kazakhstan / Middle Corridor (Trans-Caspian) trade deal for sanctions-adjacent and "
            "corridor risk before signature, shipment, insurer handoff, or committee review. Pass a structured "
            "deal_risk_request (route, cargo, counterparties, dated_sources, risk_question, decision_stage) "
            "matching middle-corridor-deal-risk-request.schema.json. Returns a triage recommendation, risk "
            "signal, decision-readiness score, supplied vs. minimum-required source categories, evidence gaps, "
            "and a high-risk-jurisdiction presence flag. Pre-compliance evidence triage only: no live retrieval, "
            "no factual-truth verification, no legal or sanctions advice; human review is required."
        ),
        "inputSchema": _schema(
            {
                "deal_risk_request": _request_shape(
                    "middle_corridor_deal_risk_request",
                    "Structured Middle Corridor deal-risk request.",
                )
            },
            ["deal_risk_request"],
        ),
        "handler": lambda args: mcp_server.middle_corridor_deal_risk(args["deal_risk_request"]),
    },
    "cis_secondary_sanctions_exposure": {
        "description": (
            "Triage secondary-sanctions exposure for a CIS-domiciled counterparty (Kazakhstan, Uzbekistan, "
            "Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova) for EU / UK / UAE / "
            "Singapore enhanced due diligence against OFAC EO 14114, the EU sanctions package, UK OFSI, and "
            "FATF / EAG typologies. Pass a structured exposure_request (counterparty, exposure_facets, "
            "jurisdiction_review_scope, dated_sources, risk_question, decision_stage) matching "
            "cis-secondary-sanctions-request.schema.json. Returns a triage recommendation, decision-readiness "
            "score, exposure dimensions, evidence gaps, and minimum sources before review. Local stdio runs on "
            "user-supplied evidence only (no live retrieval); a name match is not identity verification; human "
            "review is required."
        ),
        "inputSchema": _schema(
            {
                "exposure_request": _request_shape(
                    "cis_secondary_sanctions_request",
                    "Structured CIS secondary-sanctions exposure request.",
                )
            },
            ["exposure_request"],
        ),
        "handler": lambda args: mcp_server.cis_secondary_sanctions_exposure(args["exposure_request"]),
    },
    "agentic_interaction_trust": {
        "description": (
            "Triage the trust evidence for an agent-mediated interaction (identity, operator or principal "
            "authorization, tool scope, session authentication, action intent) before a high-stakes action "
            "executes. Pass a structured trust_request (actor, target_surface, requested_action, dated_sources, "
            "risk_question, decision_stage) matching agentic-interaction-trust-request.schema.json. Returns a "
            "triage recommendation, trust signal, decision-readiness score, and the specific missing trust "
            "evidence. Evidence triage only: not cybersecurity monitoring, identity verification, or "
            "authorization; human review is required."
        ),
        "inputSchema": _schema(
            {
                "trust_request": _request_shape(
                    "agentic_interaction_trust_request",
                    "Structured agentic interaction trust request.",
                )
            },
            ["trust_request"],
        ),
        "handler": lambda args: mcp_server.agentic_interaction_trust(args["trust_request"]),
    },
    "gulf_maritime_exposure": {
        "description": (
            "Triage maritime sanctions and chokepoint-disruption exposure for a vessel/voyage transiting the "
            "Strait of Hormuz, Persian/Arabian Gulf, Gulf of Oman, Bab-el-Mandeb, or Red Sea (Iran-oil, Russia "
            "price-cap, dark-fleet, STS transfer, flag-hopping, P&I gap, AIS manipulation). Pass a structured "
            "exposure_request (vessel/voyage, route, cargo, counterparties, dated_sources, risk_question, "
            "decision_stage) matching gulf-maritime-exposure-request.schema.json. Returns a triage "
            "recommendation, exposure signal, decision-readiness score, supplied vs. minimum-required sources, "
            "and evidence gaps. Pre-compliance evidence triage only: no live retrieval, does not resolve vessel "
            "ownership or verify identity, no legal or sanctions advice; human review is required."
        ),
        "inputSchema": _schema(
            {
                "exposure_request": _request_shape(
                    "gulf_maritime_exposure_request",
                    "Structured Gulf maritime exposure request.",
                )
            },
            ["exposure_request"],
        ),
        "handler": lambda args: mcp_server.gulf_maritime_exposure(args["exposure_request"]),
    },
    "kazakhstan_market_entry_readiness": {
        "description": (
            "Grade a Kazakhstan market-entry file (distribution, import, service, showroom, EPC, "
            "renewable-energy, infrastructure, technology-transfer, or partner-entry) against a staged "
            "source-requirement taxonomy before a launch, budget, or partner commitment. Pass a structured "
            "readiness_request (entry_mode, sector, market_entry_file, dated_sources, decision_stage) "
            "matching market-entry-readiness-request.schema.json. Returns a gate decision, readiness label, "
            "evidence gaps, claim audit, owner actions, and watch-next indicators. Evidence triage only: not "
            "legal, compliance, customs, tax, sanctions, or launch-authorization advice; no live retrieval; "
            "human review is required."
        ),
        "inputSchema": _schema(
            {
                "readiness_request": _request_shape(
                    "market_entry_readiness_request",
                    "Structured Kazakhstan market-entry readiness request.",
                )
            },
            ["readiness_request"],
        ),
        "handler": lambda args: mcp_server.kazakhstan_market_entry_readiness(args["readiness_request"]),
    },
    "agent_output_verification": {
        "description": (
            "Decide whether another agent's claim-backed output is safe to relay onward. Use before "
            "forwarding, publishing, or acting on a downstream agent's answer that cites evidence: it "
            "reports which claims are grounded, which are unsafe to relay, and which evidence references "
            "are orphaned. Pass audit_json matching evidence-audit.schema.json (claims, evidence records, "
            "optional unsupported_claims). Returns a relay verdict with per-claim findings and owner "
            "actions. Evidence-readiness only: it does not verify factual truth, fetch or validate cited "
            "sources, or authorize an action."
        ),
        "inputSchema": _schema(
            {
                "audit_json": _request_shape(
                    "evidence_audit",
                    "Claim-level evidence audit of the output being relayed.",
                )
            },
            ["audit_json"],
        ),
        "handler": lambda args: mcp_server.agent_output_verification(args["audit_json"]),
    },
    "pre_action_check": {
        "description": (
            "Route a caller-controlled action to continue, request_evidence, require_approval, or stop using "
            "caller-supplied claim evidence, risk tier, policy checks, and an optional external approval "
            "reference. Resubmit the same run_id after adding evidence or approval. Readiness only: the tool "
            "does not authenticate, authorize, enforce, persist state, or perform the action."
        ),
        "inputSchema": _schema(
            {
                "action_request": _request_shape(
                    "pre_action_check_request",
                    "Structured pre-action check request.",
                )
            },
            ["action_request"],
        ),
        "handler": lambda args: mcp_server.pre_action_check(args["action_request"]),
    },
    "get_schema": {
        "description": (
            "Return a packaged Agenda Intelligence JSON Schema so an agent can construct a valid payload "
            "before calling validate_brief, validate_evidence, validate_memo, analyze, or a vertical worker. "
            "Pass name as the schema key (for example agenda_brief, evidence_pack, agenda_memo, "
            "middle_corridor_deal_risk_request), its file name, or its bare stem; omit name to list the "
            "available schema keys. Returns the schema document and its version. Contract discovery only: it "
            "does not validate data, fill in a template, or verify factual truth."
        ),
        "inputSchema": _schema(
            {
                "name": {
                    "type": "string",
                    "description": ("Schema key, file name, or bare stem. Omit to list all available schema names."),
                }
            }
        ),
        "handler": lambda args: mcp_server.get_schema(args.get("name")),
    },
    "create_brief": {
        "description": (
            "Assemble an agenda brief from supplied fields and report which required fields are "
            "still missing. Use when producing a brief inside the protocol instead of hand-building "
            "JSON: call it with whatever is known so far, read missing_required, and call again with "
            "the remaining fields. Call with no arguments to get an empty scaffold plus the required "
            "field list. evidence_mode defaults to reasoning_only. Returns the assembled brief object "
            "and its schema errors to the caller; it does not write files, retrieve sources, draft "
            "prose, or verify factual truth."
        ),
        "inputSchema": _schema(
            {
                "bottom_line": {
                    "type": "string",
                    "description": "One-line decision-relevant conclusion.",
                },
                "signal_classification": {
                    "type": "string",
                    "description": (
                        "Signal class from agenda-brief.schema.json (for example signal, "
                        "weak_signal, structural_shift). Call get_schema('agenda_brief') for the "
                        "full enum."
                    ),
                },
                "what_changed": {
                    "type": "string",
                    "description": "What is materially different now versus the prior state.",
                },
                "main_uncertainty": {
                    "type": "string",
                    "description": "The premise that would most change the conclusion if false.",
                },
                "watch_next": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Observable indicators to monitor next. At least one is required.",
                },
                "why_it_matters": {"type": "string", "description": "Optional consequence framing."},
                "affected_actors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of actors materially affected.",
                },
                "scenarios": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Optional scenario objects with name, description, and indicators.",
                },
                "signal_markers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional qualifying markers that do not replace signal_classification.",
                },
                "data_integrity_notes": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "Optional surfaced concerns about prompt injection, source anomalies, or "
                        "retrieval limits. Records a concern; it is not an automated trust verdict."
                    ),
                },
                "evidence_mode": {
                    "type": "string",
                    "description": (
                        "How the brief was sourced. Defaults to reasoning_only; set explicitly when "
                        "sources were actually supplied."
                    ),
                },
                "confidence": {
                    "description": "Optional confidence as a level string or a level/score/reasoning object.",
                },
            }
        ),
        "handler": lambda args: mcp_server.create_brief(args),
    },
    "append_evidence": {
        "description": (
            "Append a claim and its sources to an evidence pack and re-validate the result. Use when "
            "building an evidence pack incrementally as sources are read, instead of assembling the "
            "whole document by hand. Omit pack_json to start a new pack (topic is then required). A "
            "claim whose text already exists gains the new sources instead of being duplicated, and "
            "unsupported_claims is kept consistent with per-claim support_status. support_status is "
            "never inferred as supported: omitted it defaults to unsupported (no sources) or "
            "partially_supported (sources supplied). Returns the updated pack to the caller; it does "
            "not write files, fetch URLs, verify quotes, score source reliability, or verify factual "
            "truth."
        ),
        "inputSchema": _schema(
            {
                "claim": {
                    "type": "string",
                    "description": "Claim text to add, or the exact text of an existing claim to extend.",
                },
                "pack_json": {
                    "type": "object",
                    "description": ("Existing evidence-pack object to extend. Omit to create a new pack from topic."),
                },
                "topic": {
                    "type": "string",
                    "description": "Pack topic. Required only when pack_json is omitted.",
                },
                "sources": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "Source objects matching evidence-pack.schema.json: name, source_type, "
                        "freshness, supports, limits, and optional url."
                    ),
                },
                "support_status": {
                    "type": "string",
                    "enum": ["supported", "partially_supported", "unsupported"],
                    "description": (
                        "Analyst judgement of claim support. Omit to take the conservative default; "
                        "pass it explicitly to upgrade a claim or to change an existing one."
                    ),
                },
                "evidence_mode": {
                    "type": "string",
                    "description": (
                        "How the pack was sourced. Defaults to reasoning_only for a new pack; when "
                        "supplied it overwrites the value on an existing pack."
                    ),
                },
            },
            ["claim"],
        ),
        "handler": lambda args: mcp_server.append_evidence(args),
    },
    "generate_repair_prompt": {
        "description": (
            "Generate actionable self-correction instructions for an LLM agent from an evidence packet "
            "request. Inspects validation and claim-level issues (missing sources, misquoted excerpts, "
            "unmatched numbers, polarity/negation mismatches, weak lexical support) and formats a structured "
            "markdown prompt for the agent to revise its claims and citations."
        ),
        "inputSchema": _schema(
            {
                "packet_json": _request_shape(
                    "evidence_packet_request",
                    "Evidence packet request JSON to analyze and generate repair instructions for.",
                )
            },
            ["packet_json"],
        ),
        "handler": lambda args: mcp_server.generate_repair_prompt(args["packet_json"]),
    },
}


def _source_category_enum() -> list[str]:
    """Packaged source-requirement category slugs, or [] if unavailable.

    Computed from the same data source as list_source_categories so the
    constraint never drifts from the source-requirements/ files — no hardcoded
    list to keep in sync.
    """
    try:
        cats = mcp_server.list_source_categories()
        ids = cats.get("category_ids") if isinstance(cats, dict) else None
        return sorted(ids) if isinstance(ids, list) and ids else []
    except Exception:
        return []


def _tool_definitions() -> list[JsonDict]:
    """Tool listing in a fixed order.

    2026-07-28 asks servers to keep tools/list stable across calls so clients can
    cache it and so the LLM prompt prefix stays byte-identical between turns. The
    order here is the TOOLS insertion order, which is source order — stable as
    long as nobody rebuilds the dict from an unordered set.
    """
    category_enum = _source_category_enum()
    tools = []
    for name, spec in TOOLS.items():
        schema = spec["inputSchema"]
        # Constrain any free-form `category` slug to the packaged set so the
        # model cannot pass a hallucinated category. Injected on a copy at the
        # live surface only; the static TOOLS dict (mirrored into
        # agent-manifest.json under the ADR 0012 parity invariant) stays a
        # lighter catalog without the data-derived enum.
        if category_enum and isinstance(schema.get("properties"), dict) and "category" in schema["properties"]:
            schema = copy.deepcopy(schema)
            schema["properties"]["category"]["enum"] = category_enum
        tools.append(
            {
                "name": name,
                "description": spec["description"],
                "inputSchema": schema,
            }
        )
    return tools


def _server_info() -> JsonDict:
    return {"name": SERVER_NAME, "version": __version__}


def _response(message_id: Any, result: JsonDict) -> JsonDict:
    """Wrap a result in the 2026-07-28 envelope.

    Every result carries `resultType` (this server never returns the
    `input_required` interim result — no tool here needs to ask the human
    anything mid-call) and identifies the server in `_meta`, which is where
    identity moved once the initialize handshake was removed. Clients on older
    revisions ignore both fields.
    """
    enveloped: JsonDict = dict(result)
    enveloped.setdefault("resultType", "complete")
    meta = dict(enveloped.get("_meta") or {})
    meta.setdefault(META_SERVER_INFO, _server_info())
    enveloped["_meta"] = meta
    return {"jsonrpc": "2.0", "id": message_id, "result": enveloped}


def _error(message_id: Any, code: int, message: str, data: Any = None) -> JsonDict:
    error: JsonDict = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": message_id, "error": error}


def _tool_result(payload: JsonDict, is_error: bool = False) -> JsonDict:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)}],
        "isError": is_error,
    }


def _capabilities() -> JsonDict:
    # No listChanged: the tool set is fixed at import time from packaged data, so
    # there is nothing to subscribe to via subscriptions/listen.
    return {
        "tools": {"listChanged": False},
        "resources": {"subscribe": False, "listChanged": False},
        "prompts": {"listChanged": False},
    }


def _handle_discover(message_id: Any) -> JsonDict:
    """Answer `server/discover`, mandatory since 2026-07-28.

    This is also the backward-compatibility probe on stdio: a client that gets a
    result here knows it is talking to a stateless server and can skip initialize.
    """
    return _response(
        message_id,
        {
            "protocolVersions": list(SUPPORTED_PROTOCOL_VERSIONS),
            "capabilities": _capabilities(),
            "serverInfo": _server_info(),
            "instructions": INSTRUCTIONS,
        },
    )


def _handle_initialize(message_id: Any, params: JsonDict) -> JsonDict:
    """Legacy handshake, kept for clients that predate the stateless core.

    Removed from the protocol in 2026-07-28. It is still answered because the
    server holds no session state either way — echoing the client's revision costs
    nothing and keeps older desktop hosts working.
    """
    requested_version = params.get("protocolVersion")
    protocol_version = requested_version if isinstance(requested_version, str) else PROTOCOL_VERSION
    return _response(
        message_id,
        {
            "protocolVersion": protocol_version,
            "capabilities": _capabilities(),
            "serverInfo": _server_info(),
            "instructions": INSTRUCTIONS,
        },
    )


def _handle_tools_list(message_id: Any) -> JsonDict:
    return _response(
        message_id,
        {
            "tools": _tool_definitions(),
            "ttlMs": TOOL_LIST_TTL_MS,
            "cacheScope": TOOL_LIST_CACHE_SCOPE,
        },
    )


def _handle_resources_list(message_id: Any) -> JsonDict:
    return _response(message_id, {"resources": mcp_server.list_resources()})


def _handle_resources_read(message_id: Any, params: JsonDict) -> JsonDict:
    uri = params.get("uri")
    if not isinstance(uri, str):
        return _error(message_id, -32602, "resources/read requires a string uri.")
    try:
        content = mcp_server.read_resource(uri)
        return _response(message_id, {"contents": [content]})
    except ValueError as exc:
        return _error(message_id, -32602, str(exc))
    except Exception as exc:
        return _error(message_id, -32603, f"Internal error reading resource: {exc}")


def _handle_prompts_list(message_id: Any) -> JsonDict:
    return _response(message_id, {"prompts": mcp_server.list_prompts()})


def _handle_prompts_get(message_id: Any, params: JsonDict) -> JsonDict:
    name = params.get("name")
    args = params.get("arguments") or {}
    if not isinstance(name, str):
        return _error(message_id, -32602, "prompts/get requires a string prompt name.")
    if not isinstance(args, dict):
        return _error(message_id, -32602, "prompts/get arguments must be an object.")
    try:
        prompt_res = mcp_server.get_prompt(name, args)
        return _response(message_id, prompt_res)
    except ValueError as exc:
        return _error(message_id, -32602, str(exc))
    except Exception as exc:
        return _error(message_id, -32603, f"Internal error generating prompt: {exc}")


def _protocol_version_error(message_id: Any, requested: str) -> JsonDict:
    return _error(
        message_id,
        UNSUPPORTED_PROTOCOL_VERSION,
        f"Unsupported protocol version: {requested}",
        {"supported": list(SUPPORTED_PROTOCOL_VERSIONS)},
    )


def _requested_protocol_version(params: JsonDict) -> Optional[str]:
    """Read the per-request protocol version from `_meta`.

    Since the handshake was removed there is no negotiated version to remember,
    so each request states its own. Absent means an older client that never sends
    it — treated as compatible rather than rejected.
    """
    meta = params.get("_meta")
    if isinstance(meta, dict):
        requested = meta.get(META_PROTOCOL_VERSION)
        if isinstance(requested, str):
            return requested
    return None


def _handle_tools_call(message_id: Any, params: JsonDict) -> JsonDict:
    name = params.get("name")
    args = params.get("arguments") or {}
    if not isinstance(name, str):
        return _error(message_id, -32602, "tools/call requires a string tool name.")
    if not isinstance(args, dict):
        return _error(message_id, -32602, "tools/call arguments must be an object.")
    if name not in TOOLS:
        return _response(message_id, _tool_result({"error": f"Unknown tool: {name}"}, is_error=True))

    handler: Callable[[JsonDict], JsonDict] = TOOLS[name]["handler"]
    try:
        payload = handler(args)
        is_error = bool(payload.get("error")) or payload.get("valid") is False
        return _response(message_id, _tool_result(payload, is_error=is_error))
    except KeyError as exc:
        return _response(
            message_id, _tool_result({"error": f"Missing required argument: {exc.args[0]}"}, is_error=True)
        )
    except Exception as exc:
        return _response(message_id, _tool_result({"error": str(exc)}, is_error=True))


def handle_message(message: JsonDict) -> Optional[JsonDict]:
    message_id = message.get("id")
    method = message.get("method")
    params = message.get("params") or {}
    if params and not isinstance(params, dict):
        return _error(message_id, -32602, "Request params must be an object.")

    requested_version = _requested_protocol_version(params)
    if requested_version is not None and requested_version not in SUPPORTED_PROTOCOL_VERSIONS:
        return _protocol_version_error(message_id, requested_version)

    if method == "notifications/initialized":
        return None
    if method == "server/discover":
        return _handle_discover(message_id)
    if method == "initialize":
        return _handle_initialize(message_id, params)
    if method == "ping":
        return _response(message_id, {})
    if method == "tools/list":
        return _handle_tools_list(message_id)
    if method == "tools/call":
        return _handle_tools_call(message_id, params)
    if method == "resources/list":
        return _handle_resources_list(message_id)
    if method == "resources/read":
        return _handle_resources_read(message_id, params)
    if method == "prompts/list":
        return _handle_prompts_list(message_id)
    if method == "prompts/get":
        return _handle_prompts_get(message_id, params)
    return _error(message_id, -32601, f"Method not found: {method}")


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            print(json.dumps(_error(None, -32700, "Parse error.", str(exc))), flush=True)
            continue
        if not isinstance(message, dict):
            print(json.dumps(_error(None, -32600, "Invalid request.")), flush=True)
            continue
        response = handle_message(message)
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
