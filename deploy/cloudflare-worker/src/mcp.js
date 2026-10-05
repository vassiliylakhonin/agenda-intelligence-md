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
import { hostedAccessNote } from "./hosted-access.js";

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

// Onboarding is derived from the same schemas the dispatcher publishes.
// Examples are illustrative caller data, never evidence or authority to act.
const AUDIT_EXAMPLE = {
  claims: [{ claim_id: "c1", claim: "The example record says registration is active.",
    support_level: "direct", evidence_ids: ["e1"],
    supporting_quotes: [{ evidence_id: "e1", quote: "Registration active" }] }],
  evidence: [{ evidence_id: "e1", name: "Synthetic registry excerpt", source_type: "official_document",
    content: "Registration active" }]
};

function onboardingExample(spec, inputSchema, example) {
  if (spec.name === "decision_verify") return null;
  if (spec.argKey === "none") return {};
  if (spec.argKey === "text") return { text: spec.name === "corridor_sanctions_assistant"
    ? "What evidence is needed before shipping industrial equipment from Aktau to Baku?"
    : "What evidence is needed before entering the Kazakhstan market?" };
  if (spec.name === "corridor_bankability_screen") return {
    project_name: "Synthetic Aktau project", corridor_leg: "Aktau-Baku", capex_usd_m: 100,
    ifi_debt_usd_m: 60, dscr_min: 1.3
  };
  if (spec.name === "screen_dual_use_hs_code") return { hs_code: "854231" };
  if (spec.name === "agent_output_verification") return structuredClone(AUDIT_EXAMPLE);
  if (["pre_action_check", "decision_check"].includes(spec.name)) return {
    run_id: "synthetic-readiness-001", actor: { id: "example-agent", type: "ai_agent", operator: "Example owner" },
    requested_action: "prepare a supplier recommendation for review",
    target: { id: "example-supplier", type: "counterparty" }, risk_tier: "low",
    ...structuredClone(AUDIT_EXAMPLE)
  };
  const payload = inputSchema.examples?.[0] || example;
  if (!payload) return null;
  if (spec.name === "cis_secondary_sanctions_batch") return { requests: [structuredClone(payload)] };
  return inputSchema.required?.includes("request")
    ? { request: structuredClone(payload) } : structuredClone(payload);
}

function evidenceNextStep(profile, spec) {
  if (spec.name === "decision_verify") return "First obtain a real signed receipt from decision_check. Compute expected_request_hash and expected_action_hash from your own intended request/action; do not copy bindings blindly from the receipt. Never fabricate a receipt.";
  if (spec.name === "decision_check") return "Supply claim evidence and configure the deployment's ES256 signing key; without it the receipt is unavailable. A receipt is not authorization.";
  if (!spec.bringsEvidence) return "Follow inputSchema; this tool does not require a prior evidence packet unless the schema asks for one.";
  if (spec.name === "pre_action_check") return "Before an action, supply the actor, intended action, target, risk tier, actual claim evidence, and any required approval reference. Missing evidence requires collection; do not invent it or treat the result as authorization.";
  if (profile === "agent_output_verification") return "Extract claims from the answer and attach the actual source text, evidence_ids, and matching quotes. If evidence is unavailable, report that gap; do not invent sources or treat the result as permission to relay.";
  const base = "Grades supplied evidence; it does not independently verify source truth. Obtain the source records requested by inputSchema before asking for a decision-ready result. Do not fabricate missing evidence.";
  return ["kazakhstan", "cis_secondary_sanctions", "gulf_maritime_exposure", "dual_use_technology_export", "critical_minerals_due_diligence"].includes(profile)
    ? `${base} For a Middle Corridor sanctions question without evidence, use corridor_sanctions_assistant at https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/mcp for orientation only.`
    : base;
}

export const CORRIDOR_BANKABILITY_SPEC = {
  name: "corridor_bankability_screen",
  bringsEvidence: false,
  argKey: "request",
  legacyWrapper: false,
  summary: "Illustrative corridor project finance screen using supplied financial figures and internal DSCR/leverage thresholds. Mandatory human review; no lender approval, current hydrological verification, or guarantee of financing. Missing financial data is rejected.",
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
        minimum: 0,
        description: "Target IFI senior debt financing in millions USD."
      },
      dscr_min: {
        type: "number",
        minimum: 0,
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
      "signal, decision-readiness score, supplied vs. minimum-required source categories, and evidence gaps. "
  },
  cis_secondary_sanctions: [
    {
      name: "cis_secondary_sanctions_exposure",
      bringsEvidence: true,
      argKey: "request",
      summary:
        "Triage secondary-sanctions exposure for a CIS-domiciled counterparty against OFAC EO 14114, the EU " +
        "sanctions package, UK OFSI, and FATF / EAG typologies. Returns a triage recommendation, exposure " +
        "dimensions, missing evidence, and mandatory human-review routing. A name match is not identity verification. "
    },
    {
      name: "cis_secondary_sanctions_batch",
      bringsEvidence: true,
      argKey: "request",
      summary:
        "Triage up to 10 CIS counterparties as one caller-supplied chain. Returns independent per-item results, " +
        "partial input errors, the highest exposure signal, and mandatory human-review routing. "
    }
  ],
  agentic_interaction_trust: {
    name: "agentic_interaction_trust",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage the trust evidence for an agent-mediated interaction (identity, operator or principal " +
      "authorization, tool scope, session authentication, action intent) before a high-stakes action executes. " +
      "Returns a triage recommendation, trust signal, and the specific missing trust evidence. "
  },
  agent_output_verification: [
    {
      name: "agent_output_verification",
      bringsEvidence: true,
      argKey: "request",
      summary:
        "Lint caller-provided claim evidence for relay-readiness review. Returns a review-only verdict with " +
        "per-claim findings, orphaned evidence references, and owner actions. It does not fetch or validate the " +
        "cited sources; verify_before_relay is the ceiling, never permission to relay, and human review is required " +
        "for every verdict. "
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
        "run_id after adding evidence or approval. The caller remains responsible for enforcement. "
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
        "perform the action. "
    }
  ],
  gulf_maritime_exposure: {
    name: "gulf_maritime_exposure",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage maritime sanctions and chokepoint-disruption exposure for a vessel/voyage transiting the Strait of " +
      "Hormuz, the Gulf, Bab-el-Mandeb, or the Red Sea. Returns an exposure signal, decision-readiness score, " +
      "supplied vs. minimum-required sources, and evidence gaps. It does not resolve vessel ownership. "
  },
  market_entry_readiness: {
    name: "kazakhstan_market_entry_readiness",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Grade a Kazakhstan market-entry file against a staged source-requirement taxonomy before a launch, budget, " +
      "or partner commitment. Returns a gate decision, readiness label, evidence gaps, claim audit, owner " +
      "actions, and watch-next indicators. "
  },
  critical_minerals_due_diligence: {
    name: "critical_minerals_due_diligence",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Review dated, scoped documentary evidence for critical minerals " +
      "(lithium, rare earths, nickel, cobalt, copper, graphite, manganese, tungsten, gallium/germanium) before offtake " +
      "or investment commitment. Returns source-quality issues, stage-specific evidence requests, owner tasks, " +
      "and human-review routing. "
  },
  dual_use_technology_export: {
    name: "dual_use_technology_export",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Triage dual-use technology export controls, ECCN/HS Codes, and transit route risks for unauthorized diversion. "
  },
  agent_financial_guard: {
    name: "agent_financial_pre_sign_check",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Deterministic pre-sign financial transaction firewall for autonomous agents with wallet capabilities. " +
      "Checks local risk rules and intent patterns; spending history and current sanctions status remain unverified. " +
      "Non-rejected requests require human review; this tool does not authorize transactions. "
  },
  m2m_escrow_arbiter: {
    name: "m2m_escrow_arbitration_ruling",
    bringsEvidence: true,
    argKey: "request",
    summary:
      "Deterministic dispute arbitration and delivery verification for Agent-to-Agent escrow transactions. " +
      "Checks supplied hashes, supported offline JSON schemas and deadlines, proposing allocations for human review. No settlement or clearance is issued. "
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
  if (contract?.inputSchema) return contract.inputSchema;
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

export function mcpToolsForProfile(profile, options = {}) {
  return toolSpecsForProfile(profile).map((spec) => {
    const contract = contractFor(spec, profile);
    const inputSchema = inputSchemaFor(spec, profile);
    const example = onboardingExample(spec, inputSchema, options.example);
    const nextStep = evidenceNextStep(profile, spec);
    const summary = spec.summary.trim();
    const required = inputSchema.required || [];
    const tool = {
      name: spec.name,
      description: [summary,
        required.length ? `Required tool arguments: ${required.join(", ")}.` : "No arguments are required.",
        nextStep,
        example === null ? null : `Illustrative example arguments (synthetic; replace with your own data): ${JSON.stringify(example)}.`,
        hostedAccessNote(options.access), NOT_ADVICE]
        .filter(Boolean)
        .join(" "),
      inputSchema,
      _meta: {
        "com.agenda/readiness": {
          schema_version: 1,
          required_arguments: required,
          example_arguments: example,
          example_is_synthetic: true,
          ...(spec.name === "decision_verify" ? { example_from_tool: "decision_check" } : {}),
          next_step: nextStep,
          expected_output_fields: (contract?.outputSchema || spec.outputSchema)?.required || [],
          ...(options.access ? { access: options.access } : {})
        }
      },
      annotations: {
        // Calls for this profile update usage and quota state; decision_check
        // can also issue a receipt. This is a conservative write annotation.
        readOnlyHint: profile !== "agent_output_verification",
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
