"""Minimal stdio MCP transport for Agenda Intelligence tools."""

import copy
import json
import sys
from typing import Any, Callable, Optional

from agenda_intelligence import __version__, mcp_server

PROTOCOL_VERSION = "2025-03-26"

JsonDict = dict[str, Any]


def _schema(properties: JsonDict, required: Optional[list[str]] = None) -> JsonDict:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


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
                "request": {
                    "type": "object",
                    "description": (
                        "Agenda request with question, geography, audience, depth, " "evidence mode, and output format."
                    ),
                }
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
                "deal_risk_request": {
                    "type": "object",
                    "description": (
                        "Structured Middle Corridor deal-risk request matching "
                        "middle-corridor-deal-risk-request.schema.json."
                    ),
                }
            },
            ["deal_risk_request"],
        ),
        "handler": lambda args: mcp_server.middle_corridor_deal_risk(args["deal_risk_request"]),
    },
    "cis_secondary_sanctions_exposure": {
        "description": (
            "Triage secondary-sanctions exposure for a CIS-domiciled counterparty (Kazakhstan, Uzbekistan, "
            "Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova) for EU / UK / UAE / "
            "Singapore enhanced due diligence against OFAC EO 14114, the EU 14th sanctions package, UK OFSI, and "
            "FATF / EAG typologies. Pass a structured exposure_request (counterparty, exposure_facets, "
            "jurisdiction_review_scope, dated_sources, risk_question, decision_stage) matching "
            "cis-secondary-sanctions-request.schema.json. Returns a triage recommendation, decision-readiness "
            "score, exposure dimensions, evidence gaps, and minimum sources before review. Local stdio runs on "
            "user-supplied evidence only (no live retrieval); a name match is not identity verification; human "
            "review is required."
        ),
        "inputSchema": _schema(
            {
                "exposure_request": {
                    "type": "object",
                    "description": (
                        "Structured CIS secondary-sanctions exposure request matching "
                        "cis-secondary-sanctions-request.schema.json."
                    ),
                }
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
                "trust_request": {
                    "type": "object",
                    "description": (
                        "Structured agentic interaction trust request matching "
                        "agentic-interaction-trust-request.schema.json."
                    ),
                }
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
                "exposure_request": {
                    "type": "object",
                    "description": (
                        "Structured Gulf maritime exposure request matching "
                        "gulf-maritime-exposure-request.schema.json."
                    ),
                }
            },
            ["exposure_request"],
        ),
        "handler": lambda args: mcp_server.gulf_maritime_exposure(args["exposure_request"]),
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


def _response(message_id: Any, result: JsonDict) -> JsonDict:
    return {"jsonrpc": "2.0", "id": message_id, "result": result}


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


def _handle_initialize(message_id: Any, params: JsonDict) -> JsonDict:
    requested_version = params.get("protocolVersion")
    protocol_version = requested_version if isinstance(requested_version, str) else PROTOCOL_VERSION
    return _response(
        message_id,
        {
            "protocolVersion": protocol_version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "agenda-intelligence-md", "version": __version__},
            "instructions": "Use these tools for agenda-analysis protocol, evidence discipline, lenses, and schemas.",
        },
    )


def _handle_tools_list(message_id: Any) -> JsonDict:
    return _response(message_id, {"tools": _tool_definitions()})


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

    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return _handle_initialize(message_id, params)
    if method == "ping":
        return _response(message_id, {})
    if method == "tools/list":
        return _handle_tools_list(message_id)
    if method == "tools/call":
        return _handle_tools_call(message_id, params)
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
