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

// One deployment serves one profile and a fixed, small tool set. The names match
// the stdio server's tool names for the same contract, so an agent that learned
// the tool locally can call the hosted one without relearning it.
const PROFILE_TOOLS = {
  kazakhstan: {
    name: "middle_corridor_deal_risk",
    argKey: "request",
    summary:
      "Screen a Kazakhstan / Middle Corridor (Trans-Caspian) trade deal for sanctions-adjacent and corridor risk " +
      "before signature, shipment, insurer handoff, or committee review. Returns a triage recommendation, risk " +
      "signal, decision-readiness score, supplied vs. minimum-required source categories, and evidence gaps."
  },
  cis_secondary_sanctions: {
    name: "cis_secondary_sanctions_exposure",
    argKey: "request",
    summary:
      "Triage secondary-sanctions exposure for a CIS-domiciled counterparty against OFAC EO 14114, the EU " +
      "sanctions package, UK OFSI, and FATF / EAG typologies. Returns a triage recommendation, exposure " +
      "dimensions, missing evidence, and mandatory human-review routing. A name match is not identity verification."
  },
  agentic_interaction_trust: {
    name: "agentic_interaction_trust",
    argKey: "request",
    summary:
      "Triage the trust evidence for an agent-mediated interaction (identity, operator or principal " +
      "authorization, tool scope, session authentication, action intent) before a high-stakes action executes. " +
      "Returns a triage recommendation, trust signal, and the specific missing trust evidence."
  },
  agent_output_verification: [
    {
      name: "agent_output_verification",
      argKey: "request",
      summary:
        "Decide whether another agent's claim-backed output is safe to relay onward. Returns a relay verdict with " +
        "per-claim findings, orphaned evidence references, and owner actions. It does not fetch or validate the " +
        "cited sources."
    },
    {
      name: "pre_action_check",
      argKey: "request",
      requestSchema:
        "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/schemas/v1/pre-action-check-request.schema.json",
      summary:
        "Route a caller-controlled action to continue, request_evidence, require_approval, or stop using supplied " +
        "claim evidence, risk tier, policy checks, and an optional external approval reference. Resubmit the same " +
        "run_id after adding evidence or approval. The caller remains responsible for enforcement."
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
        "perform the action."
    }
  ],
  gulf_maritime_exposure: {
    name: "gulf_maritime_exposure",
    argKey: "request",
    summary:
      "Triage maritime sanctions and chokepoint-disruption exposure for a vessel/voyage transiting the Strait of " +
      "Hormuz, the Gulf, Bab-el-Mandeb, or the Red Sea. Returns an exposure signal, decision-readiness score, " +
      "supplied vs. minimum-required sources, and evidence gaps. It does not resolve vessel ownership."
  },
  market_entry_readiness: {
    name: "kazakhstan_market_entry_readiness",
    argKey: "request",
    summary:
      "Grade a Kazakhstan market-entry file against a staged source-requirement taxonomy before a launch, budget, " +
      "or partner commitment. Returns a gate decision, readiness label, evidence gaps, claim audit, owner " +
      "actions, and watch-next indicators."
  },
  corridor_sanctions_assistant: {
    name: "corridor_sanctions_assistant",
    argKey: "text",
    summary:
      "Route a free-text Middle Corridor sanctions question to the matching structured contract and explain what " +
      "evidence the caller still has to supply. Orientation only: it does not itself triage a deal."
  },
  agenda: {
    name: "strategic_risk_triage",
    argKey: "text",
    summary:
      "Triage a free-text strategic-risk question: route it to the relevant regional and sector modules and " +
      "report which evidence categories a defensible answer would require."
  }
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
  if (spec.argKey === "text") {
    return {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The question in plain language."
        }
      },
      required: ["text"],
      additionalProperties: false
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
      description: `${spec.summary} ${NOT_ADVICE}`,
      inputSchema: inputSchemaFor(spec, profile),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: spec.idempotent !== false,
        openWorldHint: profile === "cis_secondary_sanctions"
      }
    };
    if (contract) tool.outputSchema = contract.outputSchema;
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
