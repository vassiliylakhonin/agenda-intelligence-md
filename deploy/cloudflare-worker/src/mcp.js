// MCP surface for the deployed workers.
//
// Until the 2026-07-28 revision, serving MCP over HTTP meant holding a session
// per client (Mcp-Session-Id, the initialize handshake, a resumable SSE stream)
// — state a Cloudflare Worker can only fake with Durable Objects. That revision
// removed all of it: every request states its own protocol version in _meta and
// carries everything the server needs. A stateless triage worker can therefore
// answer MCP on the same request/response path it already uses for A2A, with no
// new infrastructure and no new binding.
//
// This module owns the protocol constants and the per-profile tool catalog.
// Execution stays in index.js so both transports go through one dispatch.

import { PROFILE_REGISTRY } from "./profiles.js";
import { MCP_TOOL_CONTRACTS } from "./mcp-tool-contracts.js";

export const MCP_PROTOCOL_VERSION = "2026-07-28";

// Older revisions still answered, so a client that predates the stateless core
// keeps working. The tool surface does not vary by revision: each tool is a pure
// function of its arguments, so there is nothing to negotiate.
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26"
]);

export const MCP_META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";
export const MCP_META_CLIENT_INFO = "io.modelcontextprotocol/clientInfo";
export const MCP_META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

// -32020..-32099 is the range 2026-07-28 reserved for the specification.
export const MCP_UNSUPPORTED_PROTOCOL_VERSION = -32022;

// The catalog is derived at import time from frozen profile metadata, so it
// cannot change while the isolate lives. An hour of client-side caching removes
// a tools/list round trip per turn; the listing carries no caller data, so the
// scope is public.
export const MCP_TOOL_LIST_TTL_MS = 3_600_000;
export const MCP_TOOL_LIST_CACHE_SCOPE = "public";

export const MCP_ENDPOINT_PATH = "/mcp";

const NOT_ADVICE =
  "Evidence triage only: no factual-truth verification, no legal, compliance, sanctions, or financial advice. " +
  "Human review is required before any commercial action.";

// A summary says what comes back. It does not say what the caller has to bring,
// and these gates will not answer without it — each one requires the caller's
// own evidence up front. An agent reading "returns ... evidence gaps" while
// holding only a question reasonably concludes it can ask what it is missing,
// calls, and is refused. Measured over the 72h to 2026-09-02: 18,048
// tools/list calls across the ten gates, one genuine tools/call, and that one
// went to a tool whose only argument is text.
//
// So the precondition is stated where it is read, next to the promise it
// qualifies, and the caller who has nothing yet is sent somewhere that can take
// them. Marked per tool rather than inferred from argKey: decision_policies_list
// takes no arguments and decision_verify takes a receipt, and neither grades
// evidence.
const BRING_EVIDENCE =
  "Grades the evidence you supply and names what is still missing; it does not retrieve sources, so a call that " +
  "brings none is refused. With only a question and no evidence yet, start at corridor_sanctions_assistant.";

export const CORRIDOR_BANKABILITY_SPEC = {
  name: "corridor_bankability_screen",
  bringsEvidence: false,
  argKey: "request",
  legacyWrapper: false,
  summary:
    "Evaluate project finance bankability and IFI covenants (EBRD, ADB, EU Global Gateway) for Trans-Caspian and Middle Corridor infrastructure projects. " +
    "Evaluates minimum DSCR floor (1.20x), non-sovereign margin (1.30x), leverage ceiling (<=80%), Caspian hydrological water-level constraints (-1.20m Baltic datum), " +
    "and FX currency mismatch. Returns a free Decision Teaser with covenant pass/fail matrix, bottleneck analysis, and an x402 micropayment invoice to unlock the full 15-year debt waterfall model and IFI memo.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["project_name", "corridor_leg", "capex_usd_m", "ifi_debt_usd_m", "dscr_min"],
    properties: {
      project_name: {
        type: "string",
        minLength: 2,
        description: "Name of the corridor infrastructure project (e.g. 'Aktau Port Container Hub Expansion')."
      },
      corridor_leg: {
        type: "string",
        enum: ["Khorgos-Aktau", "Aktau-Baku", "Baku-Poti", "Poti-Constanta", "MULTI_LEG"],
        description: "Corridor transit leg under review."
      },
      capex_usd_m: {
        type: "number",
        minimum: 0.1,
        description: "Total project capital expenditure in millions USD."
      },
      ifi_debt_usd_m: {
        type: "number",
        minimum: 0.1,
        description: "Target IFI senior debt financing in millions USD."
      },
      dscr_min: {
        type: "number",
        minimum: 0.5,
        maximum: 5.0,
        description: "Projected minimum Debt Service Coverage Ratio (DSCR)."
      },
      has_sovereign_guarantee: {
        type: "boolean",
        description: "Whether an official sovereign loan guarantee is provided."
      },
      currency_mismatch: {
        type: "boolean",
        description: "Whether tariff revenues are collected in local currency (KZT/AZN/GEL) while debt is in USD/EUR."
      },
      evidence_sources: {
        type: "array",
        items: { type: "string" },
        description: "List of feasibility study references, decrees, or project files."
      }
    }
  },
  outputSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["project_name", "bankability_status", "covenant_checks", "unlocked_full_dossier"],
    properties: {
      project_name: { type: "string" },
      corridor_leg: { type: "string" },
      bankability_status: { type: "string" },
      unlocked_full_dossier: { type: "boolean" }
    }
  }
};

// One deployment serves one profile and a fixed, small tool set. The names match
// the stdio server's tool names for the same contract, so an agent that learned
// the tool locally can call the hosted one without relearning it.
const PROFILE_TOOLS = {
  kazakhstan: {
    name: "middle_corridor_deal_risk",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Screen a Kazakhstan / Middle Corridor (Trans-Caspian) trade deal for sanctions-adjacent and corridor risk " +
      "before signature, shipment, insurer handoff, or committee review. Returns a triage recommendation, risk " +
      "signal, decision-readiness score, supplied vs. minimum-required source categories, and evidence gaps. " +
      "Required fields in 'request': route, cargo, counterparties, dated_sources, risk_question, decision_stage."
  },
  cis_secondary_sanctions: [
    {
      name: "cis_secondary_sanctions_exposure",
      bringsEvidence: true,
      argKey: "request",
      summary:
        "Triage secondary-sanctions exposure for a CIS-domiciled counterparty against OFAC EO 14114, the EU " +
        "sanctions package, UK OFSI, and FATF / EAG typologies. Returns a triage recommendation, exposure " +
        "dimensions, missing evidence, and mandatory human-review routing. A name match is not identity verification. " +
        "Required fields in 'request': counterparty, risk_question, decision_stage, dated_sources."
    },
    {
      name: "cis_secondary_sanctions_batch",
      bringsEvidence: true,
      argKey: "request",
      summary:
        "Triage up to 10 CIS counterparties as one caller-supplied chain. Returns independent per-item results, " +
        "partial input errors, the highest exposure signal, and mandatory human-review routing. " +
        "Required fields in 'request': items."
    }
  ],
  agentic_interaction_trust: {
    name: "agentic_interaction_trust",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage the trust evidence for an agent-mediated interaction (identity, operator or principal " +
      "authorization, tool scope, session authentication, action intent) before a high-stakes action executes. " +
      "Returns a triage recommendation, trust signal, and the specific missing trust evidence. " +
      "Required fields in 'request': interaction_id, initiating_agent, target_surface, decision_question, decision_stage, dated_sources."
  },
  agent_output_verification: [
    {
      name: "agent_output_verification",
      bringsEvidence: true,
      argKey: "request",
      summary:
        "Decide whether another agent's claim-backed output is safe to relay onward. Returns a relay verdict with " +
        "per-claim findings, orphaned evidence references, and owner actions. It does not fetch or validate the " +
        "cited sources. Required fields in 'request': output_under_review, claims."
    },
    {
      name: "pre_action_check",
      bringsEvidence: true,
      argKey: "request",
      requestSchema:
        "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/schemas/v1/pre-action-check-request.schema.json",
      summary:
        "Route a caller-controlled action to continue, request_evidence, require_approval, or stop using supplied " +
        "claim evidence, risk tier, policy checks, and an optional external approval reference. Resubmit the same " +
        "run_id after adding evidence or approval. The caller remains responsible for enforcement. " +
        "Required fields in 'request': run_id, proposed_action, risk_tier, claims, dated_sources, policy_context."
    },
    {
      name: "decision_policies_list",
      argKey: "none",
      summary:
        "List the bounded readiness policies exposed by the hosted decision Gate, including the decision and " +
        "verification tools, possible outcomes, positive outcome, input schema, receipt lifetime, and exact " +
        "machine-readable request/action hash binding."
    },
    {
      name: "decision_check",
      bringsEvidence: true,
      argKey: "request",
      legacyWrapper: false,
      idempotent: false,
      requestSchema:
        "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/schemas/v1/pre-action-check-request.schema.json",
      summary:
        "Run pre_action_check and attach a short-lived ES256 readiness receipt bound to the exact request and " +
        "action hashes. The receipt is evidence of this Gate result, not authorization. Require decision_verify " +
        "to return gate_passed before using it in an enforcement path."
    },
    {
      name: "decision_verify",
      argKey: "request",
      legacyWrapper: false,
      summary:
        "Verify a signed readiness receipt against the caller's expected request and action hashes. Returns " +
        "gate_passed only for a valid, unexpired, exactly bound continue decision. This does not authorize or " +
        "perform the action. Required fields in 'request': receipt, expected_request_sha256, expected_action_sha256."
    }
  ],
  gulf_maritime_exposure: {
    name: "gulf_maritime_exposure",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage maritime sanctions and chokepoint-disruption exposure for a vessel/voyage transiting the Strait of " +
      "Hormuz, the Gulf, Bab-el-Mandeb, or the Red Sea. Returns an exposure signal, decision-readiness score, " +
      "supplied vs. minimum-required sources, and evidence gaps. It does not resolve vessel ownership. " +
      "Required fields in 'request': vessel_name, imo_number, flag, voyage_path, cargo, risk_question, decision_stage, dated_sources."
  },
  market_entry_readiness: {
    name: "kazakhstan_market_entry_readiness",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Grade a Kazakhstan market-entry file against a staged source-requirement taxonomy before a launch, budget, " +
      "or partner commitment. Returns a gate decision, readiness label, evidence gaps, claim audit, owner " +
      "actions, and watch-next indicators. " +
      "Required fields in 'request': market, sector, entry_mode, decision_question, decision_stage, dated_sources."
  },
  critical_minerals_due_diligence: {
    name: "critical_minerals_due_diligence",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage origin tracing, export quota restrictions, and CSDDD supply-chain due diligence for critical minerals " +
      "(lithium, rare earths, nickel, cobalt, copper, graphite, manganese, tungsten, gallium/germanium) before offtake " +
      "or investment commitment. Returns origin traceability status, export quota flags, top supply-chain risks, " +
      "and evidence gaps. " +
      "Required fields in 'request': project_name, commodity, origin_jurisdiction, decision_question, decision_stage, supplied_sources."
  },
  dual_use_technology_export: {
    name: "dual_use_technology_export",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage dual-use technology export controls, ECCN/HS Codes, and transit route risks for unauthorized diversion. " +
      "Required fields in 'request': item_description, destination_country, parties, transit_countries, risk_question, decision_stage, dated_sources."
  },
  agent_financial_guard: {
    name: "agent_financial_pre_sign_check",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Deterministic pre-sign financial transaction firewall for autonomous agents with wallet capabilities. " +
      "Checks local risk rules and intent patterns; spending history and current sanctions status remain unverified. " +
      "Non-rejected requests require human review; this tool does not authorize transactions. " +
      "Required fields in 'request': run_id, transaction, intent."
  },
  m2m_escrow_arbiter: {
    name: "m2m_escrow_arbitration_ruling",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Deterministic dispute arbitration and delivery verification for Agent-to-Agent escrow transactions. " +
      "Checks supplied hashes, supported offline JSON schemas and deadlines, proposing allocations for human review. No settlement or clearance is issued. " +
      "Required fields in 'request': escrow_id, deal_terms, specification, delivery_submission."
  },

  corridor_sanctions_assistant: [
    {
      name: "corridor_sanctions_assistant",
      argKey: "text",
      answersWithoutInput: true,
      summary:
        "Route a free-text Middle Corridor sanctions question to the matching structured contract and explain what " +
        "evidence the caller still has to supply. Orientation only: it does not itself triage a deal."
    },
    {
      name: "screen_dual_use_hs_code",
      bringsEvidence: false,
      argKey: "request",
      legacyWrapper: false,
      summary:
        "Screen 6-digit Harmonized System (HS) commodity codes (e.g. 8542 integrated circuits, 8541 semiconductors, 8471 processing units) against the Common High Priority Items List (CHPL Tier 1-4) and export control diversion risk along the Middle Corridor / Central Asia transit routes."
    }
  ],
  agenda: [
    {
      name: "strategic_risk_triage",
      argKey: "text",
      summary:
        "Triage a free-text strategic-risk question: route it to the relevant regional and sector modules and " +
        "report which evidence categories a defensible answer would require."
    },
    {
      name: "fleet_directory",
      argKey: "none",
      summary:
        "List all 11 specialized risk triage and verification gates in the Agenda Intelligence fleet, " +
        "including their MCP/A2A endpoints, supported profiles, primary tool names, input schemas, and required fields."
    },
    CORRIDOR_BANKABILITY_SPEC
  ]
};

function requestSchemaUrl(profile) {
  const entry = PROFILE_REGISTRY[profile];
  return (entry && entry.product_contract && entry.product_contract.request_schema) || null;
}

function contractFor(spec, profile) {
  return MCP_TOOL_CONTRACTS[profile]?.[spec.name] || null;
}

function inputSchemaFor(spec, profile) {
  const contract = contractFor(spec, profile);
  if (contract) return contract.inputSchema;
  if (spec.inputSchema) return spec.inputSchema;
  if (spec.argKey === "none") {
    return {
      type: "object",
      properties: {},
      additionalProperties: false
    };
  }
  if (spec.argKey === "text") {
    return {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: spec.answersWithoutInput
            ? "The question in plain language. Optional: with none, this returns the gate list."
            : "The question in plain language."
        }
      },
      ...(spec.answersWithoutInput ? {} : { required: ["text"] }),
      additionalProperties: Boolean(spec.answersWithoutInput)
    };
  }
  const schemaUrl = spec.requestSchema || requestSchemaUrl(profile);
  return {
    type: "object",
    properties: {
      request: {
        type: "object",
        description: schemaUrl
          ? `Structured request object. Full contract: ${schemaUrl}`
          : "Structured request object matching the profile's published request schema.",
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  };
}

function toolSpecsForProfile(profile) {
  const value = PROFILE_TOOLS[profile] || PROFILE_TOOLS.agenda;
  return Array.isArray(value) ? value : [value];
}

export function mcpToolSpecForProfile(profile, name) {
  const specs = toolSpecsForProfile(profile);
  return name ? specs.find((spec) => spec.name === name) : specs[0];
}

export function mcpToolsForProfile(profile) {
  return toolSpecsForProfile(profile).map((spec) => {
    const contract = contractFor(spec, profile);
    const tool = {
      name: spec.name,
      description: [spec.summary, spec.bringsEvidence ? BRING_EVIDENCE : null, NOT_ADVICE]
        .filter(Boolean)
        .join(" "),
      inputSchema: inputSchemaFor(spec, profile),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: spec.idempotent !== false,
        openWorldHint: profile === "cis_secondary_sanctions"
      }
    };
    if (contract) tool.outputSchema = contract.outputSchema;
    else if (spec.outputSchema) tool.outputSchema = spec.outputSchema;
    return tool;
  });
}

// tools/call arguments -> the params shape the A2A dispatch already accepts, so
// an MCP call and an A2A call of the same payload land on identical code.
export function mcpUsesLegacyRequestWrapper(profile, args, name) {
  const spec = mcpToolSpecForProfile(profile, name) || mcpToolSpecForProfile(profile);
  const objectArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  return Boolean(
    spec.argKey === "request" &&
      spec.legacyWrapper !== false &&
      Object.keys(objectArgs).length === 1 &&
      objectArgs.request &&
      typeof objectArgs.request === "object" &&
      !Array.isArray(objectArgs.request)
  );
}

export function mcpArgumentsToParams(profile, args, name) {
  const spec = mcpToolSpecForProfile(profile, name) || mcpToolSpecForProfile(profile);
  const objectArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const isLegacyRequestWrapper = mcpUsesLegacyRequestWrapper(profile, objectArgs, name);
  const value =
    spec.argKey === "none"
      ? null
      : spec.argKey === "text"
      ? objectArgs.text
      : isLegacyRequestWrapper
        ? objectArgs.request
        : objectArgs;
  const params =
    spec.argKey === "none"
      ? { request: objectArgs }
      : spec.argKey === "text"
        ? { text: typeof value === "string" ? value : "" }
        : { request: value };
  return name ? { ...params, capability: name } : params;
}
