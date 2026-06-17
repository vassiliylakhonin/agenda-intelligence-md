import {
  OPENSANCTIONS_ATTRIBUTION,
  OPENSANCTIONS_HOMEPAGE,
  OPENSANCTIONS_LICENSE,
  attributionBlock as openSanctionsAttributionBlock,
  matchCounterparty as matchCounterpartyAgainstOpenSanctions
} from "./upstream_opensanctions.js";

import {
  WATCHMAN_ATTRIBUTION,
  WATCHMAN_LICENSE,
  WATCHMAN_PROJECT_URL,
  attributionBlock as watchmanAttributionBlock,
  baseUrl as watchmanBaseUrl,
  matchCounterparty as matchCounterpartyAgainstWatchman
} from "./upstream_watchman.js";

import { buildJwks, maybeSignCard } from "./jws.js";
import { PROBE_PROMPT_CHAR_THRESHOLD } from "./usage_constants.js";

const SUPPORT_CONTACT_EMAIL = "vassiliy.lakhonin@gmail.com";
const SUPPORT_HOURS_LOCAL = "Mon–Fri 09:00–18:00 Asia/Almaty (UTC+5)";
const SUPPORT_TIMEZONE = "Asia/Almaty";

const VERSION = "1.1.0";
// Canonical input mode shared by the per-profile product_contract blocks and the
// top-level x_agent_contract discoverability extension. Single source of truth so
// the two never drift.
const CANONICAL_INPUT_MODE = "structured_json";
// Versioned independently of the package/card VERSION: this is the discoverability
// contract surfaced to catalogs and agents, not a package release.
const MIDDLE_CORRIDOR_AGENT_CONTRACT_VERSION = "1.0";
// Intent strings the Middle Corridor endpoint can actually emit. Mirrors
// classifyIntent / classifyIntentForProfile / triageForText; verify-agent-card.js
// asserts the primary intent so this list cannot silently drift from routing.
const MIDDLE_CORRIDOR_SUPPORTED_INTENTS = [
  "middle_corridor_deal_risk_contract",
  "deal_risk_gate",
  "sanctions_policy_signal_screen",
  "source_coverage",
  "evidence_audit",
  "memo_validation",
  "signal_monitoring",
  "strategic_risk_triage"
];
const REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md";
const DOCS_URL = `${REPOSITORY_URL}/blob/main/MCP.md`;
const MIDDLE_CORRIDOR_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/kazakhstan-middle-corridor.md`;
const MIDDLE_CORRIDOR_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/middle-corridor-deal-risk-request.schema.json`;
const MIDDLE_CORRIDOR_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/middle-corridor-deal-risk-response.schema.json`;
const MIDDLE_CORRIDOR_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/middle-corridor-deal-risk.json`;
const CIS_SECONDARY_SANCTIONS_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/cis-secondary-sanctions.md`;
const CIS_SECONDARY_SANCTIONS_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/cis-secondary-sanctions-request.schema.json`;
const CIS_SECONDARY_SANCTIONS_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/cis-secondary-sanctions-response.schema.json`;
const CIS_SECONDARY_SANCTIONS_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/cis-secondary-sanctions.json`;
const CIS_SECONDARY_SANCTIONS_ADR_URL = `${REPOSITORY_URL}/blob/main/docs/adr/0014-per-profile-live-retrieval.md`;
const AGENTIC_INTERACTION_TRUST_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/agentic-interaction-trust.md`;
const AGENTIC_INTERACTION_TRUST_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agentic-interaction-trust-request.schema.json`;
const AGENTIC_INTERACTION_TRUST_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agentic-interaction-trust-response.schema.json`;
const AGENTIC_INTERACTION_TRUST_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/agentic-interaction-trust.json`;
const GULF_MARITIME_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/gulf-maritime-exposure.md`;
const GULF_MARITIME_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/gulf-maritime-exposure-request.schema.json`;
const GULF_MARITIME_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/gulf-maritime-exposure-response.schema.json`;
const GULF_MARITIME_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/gulf-maritime-exposure.json`;
const A2A_EXAMPLES_URL = `${REPOSITORY_URL}/tree/main/examples/a2a`;
const PACKAGE_URL = "https://pypi.org/project/agenda-intelligence-md/";

const CA_CASPIAN_TERMS = [
  "central asia",
  "caspian",
  "kazakhstan",
  "uzbekistan",
  "turkmenistan",
  "kyrgyzstan",
  "tajikistan",
  "azerbaijan",
  "georgia",
  "almaty",
  "tashkent",
  "baku",
  "middle corridor",
  "tcita",
  "tcitr",
  "trans-caspian",
  "khorgos",
  "aktau",
  "kuryk",
  "astana",
  "kazakh",
  "kazakhstani",
  "russia transit",
  "china-kazakhstan",
  "belt and road"
];

const GULF_ME_TERMS = [
  "iran",
  "uae",
  "united arab emirates",
  "saudi arabia",
  "ksa",
  "qatar",
  "bahrain",
  "kuwait",
  "oman",
  "yemen",
  "iraq",
  "red sea",
  "hormuz",
  "bab-el-mandeb",
  "bab el mandeb",
  "persian gulf",
  "arabian gulf",
  "strait of hormuz",
  "gulf",
  "gcc",
  "middle east",
  "levant"
];

const EU_TERMS = [
  "eu",
  "europe",
  "european union",
  "european commission",
  "european parliament",
  "european council",
  "ecb",
  "european central bank",
  "cjeu",
  "eu ai act",
  "eu regulation",
  "eu enforcement",
  "gdpr",
  "cbam",
  "nis2",
  "brussels",
  "schrems"
];

const SANCTIONS_TERMS = [
  "sanctions",
  "ofac",
  "secondary sanctions",
  "export control",
  "export controls",
  "entity list"
];

const MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO = [
  "counterparty_registry_extract",
  "beneficial_ownership_source",
  "sanctions_list_extract",
  "customs_or_regulatory_source",
  "insurance_clause_or_underwriter_note",
  "vessel_or_carrier_history"
];

const MIDDLE_CORRIDOR_HELPFUL_CONTEXT = ["port_operator_notice", "carrier_note"];

// Sanctions-relevant / high-risk jurisdictions for presence-flagging per ADR 0015.
// Escalation flag routed to human review, NOT a determination. Comprehensively or
// sectorally sanctioned jurisdictions. Lowercased; substring match on jurisdiction.
const HIGH_RISK_JURISDICTIONS = {
  russia: "Russia",
  "russian federation": "Russia",
  belarus: "Belarus",
  iran: "Iran",
  "north korea": "North Korea",
  dprk: "North Korea",
  syria: "Syria",
  crimea: "Crimea",
  donetsk: "Donetsk (non-government-controlled)",
  luhansk: "Luhansk (non-government-controlled)"
};

// Re-export / circumvention-watch jurisdictions (ADR 0015 follow-up). NOT
// comprehensively sanctioned; presence is a re-export / diversion watch item,
// a deliberately softer flag than HIGH_RISK_JURISDICTIONS. Lowercased substring match.
const CIRCUMVENTION_WATCH_JURISDICTIONS = {
  armenia: "Armenia",
  georgia: "Georgia",
  kyrgyzstan: "Kyrgyzstan",
  uzbekistan: "Uzbekistan",
  turkey: "Turkey",
  turkiye: "Turkey",
  "united arab emirates": "United Arab Emirates",
  uae: "United Arab Emirates"
};

// OFAC FAQ 1148 / 1151 named sectors of the Russian Federation economy. A counterparty
// operating in any of these (other than "other") is an FFI sanctions-exposure point
// under EO 14024 as amended by EO 14114. Presence-flagging only; not a determination.
const NAMED_SECTORS = {
  technology: "technology",
  defense_and_related_materiel: "defense and related materiel",
  construction: "construction",
  aerospace: "aerospace",
  manufacturing: "manufacturing"
};

// Cutoff date for the OFAC FFI advisory "newly formed" red flag. Russia's further
// invasion of Ukraine on 2022-02-24 marked the start of the transshipment-hub pattern
// ("EXAMPLE OF HIGHER RISK CUSTOMER: A microelectronics exporter formed in March 2022
// located in a high-risk jurisdiction"). Presence-flagging only; not a determination.
const NEWLY_FORMED_COUNTERPARTY_CUTOFF = "2022-02-24";

// Additional transshipment-hub jurisdictions for the OFAC FFI advisory newly-formed
// red flag, drawn from U.S. Treasury / BIS designations of third-country transshipment
// hubs. Deliberately disjoint from HIGH_RISK and CIRCUMVENTION_WATCH above so the
// existing presence / diversion flags are unaffected; used only by newlyFormedCounterparties.
// Lowercased; substring match.
const TRANSSHIPMENT_HUB_JURISDICTIONS = {
  kazakhstan: "Kazakhstan",
  china: "China",
  "hong kong": "Hong Kong",
  cyprus: "Cyprus"
};

// Deceptive-shipping-practice (DSP) verification checklist drawn from OFAC maritime
// guidance, surfaced when vessel / carrier history is not yet supplied. Evidence-gap
// checklist routed to human review — not vessel adjudication, AIS analysis, live
// retrieval, or insurance advice (ADR 0015 boundary).
const VESSEL_DUE_DILIGENCE_INDICATORS = [
  "AIS continuity: check for extended transmission gaps or disablement over the voyage.",
  "Vessel identity consistency: check for MMSI / name / IMO manipulation or misclassification.",
  "Certificate-of-origin integrity: confirm shipping documents match declared cargo origin and destination.",
  "Ship-to-ship transfer history: check for undisclosed STS transfers along the route.",
  "Flag history: check for recent flag changes or registration with a high-risk registry."
];

const REEXPORT_CONTROL_INDICATORS = [
  "End-user statement: obtain a signed end-user / end-use statement naming the ultimate consignee.",
  "No-re-export clause: confirm the counterparty accepts a no-re-export / no-diversion contract clause.",
  "End-use consistency: check the stated end-use is consistent with the cargo type and the ordering party.",
  "Onward destination: confirm disclosure of any onward destination beyond the first delivery point.",
  "Order-vs-destination match: flag a stated end-user in a different country from the order origin."
];

const SOURCE_OF_FUNDS_INDICATORS = [
  "Source of funds: obtain evidence of the funds used for this deal (bank statement, loan or sale proceeds).",
  "Source of wealth: obtain evidence of the counterparty's overall wealth origin (business, prior trade).",
  "Consistency: check the declared source of funds fits the counterparty profile and the deal size.",
  "Payer match: confirm the paying entity and account match the contracting counterparty.",
  "Funds-jurisdiction flag: flag funds routed through a high-risk or sanctions-relevant jurisdiction."
];

const PEP_SCREENING_INDICATORS = [
  "PEP screening: screen each counterparty and its beneficial owners against PEP lists.",
  "Family and close associates: extend screening to immediate family and known close associates.",
  "Senior-management approval: confirm sign-off where a PEP relationship is identified.",
  "Source of funds/wealth: apply enhanced SOF/SOW checks for any identified PEP.",
  "Ongoing monitoring: apply enhanced monitoring for the duration of any PEP relationship."
];

const FRONT_COMPANY_INDICATORS = [
  "Business substance: confirm the counterparty is a real operating business, not a recently formed shell.",
  "Web and registry footprint: check for a verifiable web presence and a registry record that predates the deal.",
  "Address integrity: flag an address shared with multiple unrelated companies or with a sanctioned entity.",
  "Line-of-business fit: confirm the goods or service fit the counterparty's stated line of business.",
  "Representation: flag contact only via an intermediary with broad power of attorney, principals unavailable."
];

// Middle Corridor connections that carry elevated sanctions-program exposure
// (OFAC Iran and Russia programs; sanctioned Caspian ports, operators, or
// vessels). Surfaced as a standing route-screening checklist. Presence-flagging
// routed to human review — NOT a sanctions determination, live screening, or
// legal advice (ADR 0015 boundary).
const MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_CONNECTIONS = [
  "Iran transit legs (Rasht-Astara rail, Bandar Abbas / Chabahar sea): screen for OFAC Iran-program exposure.",
  "Russia Northern Corridor overlaps (Russian rail or territory as a leg or fallback): screen for diversion.",
  "Sanctioned Caspian ports, operators, or flagged vessels: screen operator and vessel against designations.",
  "Onward connection into a sanctions-relevant jurisdiction: confirm ultimate consignee and destination first."
];

// Substring triggers that presence-flag a sanctions-exposed segment named in the
// free-text route. Match on the declared route string only — presence-flagging,
// not adjudication or live screening (ADR 0015 boundary).
const MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_ROUTE_TERMS = [
  ["rasht", "Rasht-Astara (Iran) leg"],
  ["astara", "Rasht-Astara (Iran) leg"],
  ["bandar abbas", "Bandar Abbas (Iran) leg"],
  ["chabahar", "Chabahar (Iran) leg"],
  ["iran", "Iran transit leg"],
  ["northern corridor", "Russia Northern Corridor overlap"],
  ["russia", "Russia Northern Corridor overlap"],
  ["russian", "Russia Northern Corridor overlap"]
];

// Customs-regime review items for the Middle Corridor: harmonized digital-customs
// transit (eTIR; adopted by Organization of Turkic States members) versus
// unharmonized national permitting, which remains a recurring barrier to
// private-sector corridor use. Surfaced as evidence-gap review prompts — NOT
// customs, legal, or compliance advice (ADR 0015 boundary).
const MIDDLE_CORRIDOR_CUSTOMS_HARMONIZATION_INDICATORS = [
  "Permitting clarity: confirm licenses and permits needed at each crossing; flag any unharmonized leg.",
  "Harmonized transit: check which crossings run under eTIR or another harmonized digital-customs regime.",
  "Document acceptance: confirm transit documents are accepted at all crossings without re-declaration.",
  "Tariff consistency: confirm cargo tariff classification and duties are consistent across corridor states.",
  "Customs-rule change watch: flag recent customs-rule or enforcement changes at any crossing on the route."
];

function matchedSanctionsExposedSegments(routeText) {
  const text = (routeText || "").toLowerCase();
  const matched = [];
  for (const [term, label] of MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_ROUTE_TERMS) {
    if (text.includes(term) && !matched.includes(label)) matched.push(label);
  }
  return matched;
}

const CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW = [
  "ofac_sdn_extract",
  "eu_consolidated_extract",
  "ownership_chain_evidence",
  "bank_correspondent_evidence",
  "transit_or_invoice_evidence"
];

const CIS_SECONDARY_SANCTIONS_HELPFUL_CONTEXT = [
  "uk_ofsi_extract",
  "dual_use_export_evidence",
  "adverse_media_evidence",
  "typology_reference",
  "customs_data_evidence"
];

const AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION = [
  "agent_identity_claim",
  "operator_or_principal_authorization",
  "agent_card_or_manifest",
  "tool_scope_or_permission_evidence",
  "session_authentication_evidence",
  "action_intent_evidence",
  "transaction_or_target_action_evidence"
];

const AGENTIC_INTERACTION_TRUST_HELPFUL_CONTEXT = [
  "mcp_or_a2a_endpoint_metadata",
  "rate_limit_or_abuse_signal",
  "fraud_or_account_takeover_signal",
  "device_or_infrastructure_evidence",
  "provider_policy_or_allowlist",
  "prior_interaction_history",
  "incident_report_or_threat_intel",
  "human_review_note"
];

const GULF_MARITIME_REQUIRED_BEFORE_REVIEW = [
  "vessel_registry_extract",
  "pi_insurance_certificate",
  "ownership_or_control_evidence",
  "sanctions_list_extract",
  "ais_track_record"
];

const GULF_MARITIME_HELPFUL_CONTEXT = [
  "flag_registry_record",
  "sts_transfer_evidence",
  "classification_society_record",
  "port_state_control_record",
  "cargo_or_bl_evidence",
  "adverse_media_evidence"
];

// Per-profile live retrieval CAPABILITY declarations. Actual runtime
// activation is env-derived via isLiveRetrievalActive(profile, env). Per the
// 2026-05-27 update to ADR 0014, multiple upstreams can be configured per
// profile and the dispatcher picks the first active one (free options before
// paid). For `cis_secondary_sanctions` the order is:
//   1. Watchman self-host (Apache-2.0, $0 if hosted on a free-tier container)
//      — active when WATCHMAN_URL is set
//   2. OpenSanctions hosted API (paid €0.10/call) — active when
//      OPENSANCTIONS_API_KEY is set
// If neither is configured, the profile degrades to user-supplied evidence
// only and emits `live_retrieval_status: disabled` with a deferral_note.
const PROFILE_LIVE_RETRIEVAL = {
  agenda: { capability_declared: false, upstream_options: [] },
  kazakhstan: { capability_declared: false, upstream_options: [] },
  agentic_interaction_trust: { capability_declared: false, upstream_options: [] },
  gulf_maritime_exposure: { capability_declared: false, upstream_options: [] },
  cis_secondary_sanctions: {
    capability_declared: true,
    upstream_options: [
      {
        name: "Watchman",
        license: WATCHMAN_LICENSE,
        homepage: WATCHMAN_PROJECT_URL,
        activation_env_var: "WATCHMAN_URL",
        disable_env_var: "WATCHMAN_DISABLED",
        cost_model: "self-hosted (Apache-2.0); $0/month on free-tier container"
      },
      {
        name: "OpenSanctions",
        license: OPENSANCTIONS_LICENSE,
        homepage: OPENSANCTIONS_HOMEPAGE,
        activation_env_var: "OPENSANCTIONS_API_KEY",
        disable_env_var: "OPENSANCTIONS_DISABLED",
        cost_model: "paid €0.10/call (30-day business-email trial)"
      }
    ]
  }
};

function isUpstreamOptionActive(option, env = {}) {
  if (!option) return false;
  const activation = ((env[option.activation_env_var] || "") + "").trim();
  if (!activation) return false;
  const disabled = ((env[option.disable_env_var] || "") + "").trim().toLowerCase();
  if (disabled === "1" || disabled === "true" || disabled === "yes") return false;
  return true;
}

function activeUpstreamOption(profile, env = {}) {
  const meta = PROFILE_LIVE_RETRIEVAL[profile];
  if (!meta || !meta.capability_declared) return null;
  for (const option of meta.upstream_options) {
    if (isUpstreamOptionActive(option, env)) return option;
  }
  return null;
}

function isLiveRetrievalActive(profile, env = {}) {
  return activeUpstreamOption(profile, env) !== null;
}

const NOT_ADVICE_NOTICE =
  "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.";

const AGENTIC_TRUST_NOT_ADVICE_NOTICE =
  "Agentic interaction evidence triage only. Not cybersecurity monitoring, fraud adjudication, identity verification, transaction authorization, legal advice, compliance advice, or financial advice.";

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-client-id, authorization",
      ...extraHeaders
    }
  });
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*"
    }
  });
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*"
    }
  });
}

function acceptsHtml(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function originFromRequest(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function agentProfile(request, env = {}) {
  const host = new URL(request.url).host.toLowerCase();
  if (
    env.AGENT_PROFILE === "cis_secondary_sanctions" ||
    host.includes("cis-secondary-sanctions-a2a")
  ) {
    return "cis_secondary_sanctions";
  }
  if (
    env.AGENT_PROFILE === "agentic_interaction_trust" ||
    host.includes("agentic-interaction-trust-a2a") ||
    host.includes("agentic-trust-gate-a2a")
  ) {
    return "agentic_interaction_trust";
  }
  if (
    env.AGENT_PROFILE === "gulf_maritime_exposure" ||
    host.includes("gulf-maritime-exposure-a2a")
  ) {
    return "gulf_maritime_exposure";
  }
  if (
    env.AGENT_PROFILE === "market_entry_readiness" ||
    host.includes("kazakhstan-market-entry-readiness-a2a")
  ) {
    return "market_entry_readiness";
  }
  if (
    env.AGENT_PROFILE === "kazakhstan" ||
    host.includes("middle-corridor-deal-risk-gate-a2a")
  ) {
    return "kazakhstan";
  }
  return "agenda";
}

// JSON-RPC methods that hit the production triage route (as opposed to the
// public agent/card discovery method, which always stays open).
const MESSAGE_SEND_METHODS = new Set(["message/send", "tasks/send", "SendMessage"]);

// Per-profile production access key. Profiles that graduate to an explicit
// Bearer model read a per-profile secret; when the secret is unset the route is
// an open free demo and no key is required — the agent card reflects that state
// truthfully (no security requirement is advertised). Flip enforcement on the
// day a real counterparty needs gating:
//   wrangler secret put MIDDLE_CORRIDOR_API_KEY --env middle-corridor-deal-risk-gate
//   wrangler secret put AGENTIC_INTERACTION_TRUST_API_KEY --env agentic-interaction-trust
function productionAuthKey(profile, env = {}) {
  if (profile === "kazakhstan") return env.MIDDLE_CORRIDOR_API_KEY || "";
  if (profile === "agentic_interaction_trust")
    return env.AGENTIC_INTERACTION_TRUST_API_KEY || "";
  return "";
}

function bearerTokenFromRequest(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : "";
}

// Returns true when the production route may proceed: either no key is
// configured (open demo) or the request carries the matching Bearer token.
// Constant-time-ish comparison is unnecessary here — the key is an opaque
// shared secret, not a password hash, and Workers offers no timing-safe
// primitive in this runtime path.
function isProductionAuthorized(request, env, profile) {
  const key = productionAuthKey(profile, env);
  if (!key) return true;
  return bearerTokenFromRequest(request) === key;
}

function agentCard(request, env = {}) {
  const origin = originFromRequest(request);
  const productionKey = productionAuthKey(agentProfile(request, env), env);
  const card = {
    protocolVersion: "1.0",
    name: "Agenda Intelligence MD",
    description:
      "Live A2A wrapper for Agenda Intelligence MD, an evidence-discipline MCP layer for strategic-risk agents. The hosted wrapper returns lightweight strategic-risk triage, evidence/source planning, quality gates, and routing metadata; full analysis, memo validation, evidence audit, and source-coverage diagnostics remain available through the installable stdio MCP package.",
    url: origin,
    provider: {
      organization: "Vassiliy Lakhonin",
      url: "https://vassiliylakhonin.github.io/",
      legalEntity: {
        type: "individual",
        name: "Vassiliy Lakhonin",
        url: "https://vassiliylakhonin.github.io/verification.json",
        sameAs: [
          "https://github.com/vassiliylakhonin",
          "https://pypi.org/project/agenda-intelligence-md/",
          "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md",
          "https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev"
        ]
      }
    },
    version: VERSION,
    documentationUrl: DOCS_URL,
    supportedInterfaces: [
      {
        url: `${origin}/message/send`,
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0"
      }
    ],
    protocolVersions: ["1.0"],
    securitySchemes: {
      optionalClientId: {
        apiKeySecurityScheme: {
          location: "header",
          name: "X-Client-Id",
          description:
            "Optional caller identifier for observability and abuse triage. Not an access credential."
        }
      },
      productionBearer: {
        httpAuthSecurityScheme: {
          scheme: "bearer",
          bearerFormat: "opaque",
          description:
            "Bearer access key for the production message/send route. Enforced only when the operator configures an access key on this deployment; while unset the route is an open free demo and no key is required."
        }
      }
    },
    securityRequirements: productionKey ? [{ schemes: ["productionBearer"] }] : [],
    security: productionKey ? [{ productionBearer: [] }] : [],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extendedAgentCard: false
    },
    defaultInputModes: ["application/json", "text/plain", "text/markdown"],
    defaultOutputModes: ["application/json", "text/markdown"],
    skills: [
      {
        id: "agenda-signal-screen",
        name: "Sanctions and policy risk signal screen",
        description:
          "Returns a free live A2A signal screen for sanctions, policy, corridor, and regulatory-risk questions: risk signal, affected regions, required source categories, evidence gaps, watch-next indicators, and recommended MCP tool.",
        tags: [
          "sanctions",
          "policy-risk",
          "regulatory-risk",
          "geopolitical-signals",
          "source-coverage",
          "watch-next",
          "free"
        ],
        examples: [
          "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure.",
          "Find evidence gaps and watch-next indicators for EU sanctions around a Central Asia corridor."
        ],
        inputModes: ["application/json", "text/plain"],
        outputModes: ["application/json", "text/markdown"]
      },
      {
        id: "agenda-analyze",
        name: "Strategic-risk signal triage",
        description:
          "Returns lightweight A2A triage for geopolitical, policy, sanctions, trade, regulation, and market-risk questions: relevant modules, decision framing, unknowns, watch-next signals, and the MCP analyze path for full memo assembly.",
        tags: [
          "strategic-risk",
          "geopolitical-risk",
          "policy-analysis",
          "signal-triage",
          "decision-intelligence",
          "memo",
          "mcp"
        ],
        examples: [
          "Analyze how Red Sea shipping disruption changes risk for a Central Asia logistics corridor.",
          "Prepare a structured sanctions-risk memo with uncertainties and watch-next signals."
        ],
        inputModes: ["application/json", "text/plain"],
        outputModes: ["application/json", "text/markdown"]
      },
      {
        id: "agenda-validate-memo",
        name: "Strategic-risk memo validation",
        description:
          "Routes callers to the packaged validate_memo MCP tool, which validates strategic-risk memos against the agenda-memo JSON schema and returns contract errors before analyst or agent handoff.",
        tags: [
          "schema-validation",
          "memo-validation",
          "quality-gate",
          "strategic-risk"
        ],
        examples: [
          "Validate this strategic-risk memo before it is sent to an analyst workflow."
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "agenda-audit-claims",
        name: "Policy evidence quality gate",
        description:
          "Routes callers to the packaged audit_claims MCP tool for claim-level evidence structure, support-level distribution, orphan evidence references, unsupported claims, and provenance discipline.",
        tags: [
          "evidence-audit",
          "claim-support",
          "provenance",
          "quality-gate",
          "strategic-risk"
        ],
        examples: [
          "Audit whether each claim in this memo is linked to evidence ids and labelled by support level."
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "agenda-source-coverage",
        name: "Sanctions and regulatory source coverage",
        description:
          "Returns source-planning guidance and routes callers to the packaged source_coverage MCP tool for sanctions, trade, regulation, energy, conflict, cyber, ESG, and technology-AI evidence packs.",
        tags: [
          "source-planning",
          "evidence-coverage",
          "sanctions",
          "trade",
          "regulation"
        ],
        examples: [
          "Check whether this sanctions evidence pack covers the required source categories."
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "agenda-quote-verification",
        name: "Quote and excerpt presence check",
        description:
          "Routes callers to the packaged verify_quotes MCP tool, which checks whether cited quote fragments appear in caller-supplied source text without claiming live source discovery or factual-truth verification.",
        tags: [
          "quote-checking",
          "evidence-discipline",
          "local-verification",
          "provenance"
        ],
        examples: [
          "Confirm that each quoted excerpt appears in the provided source text."
        ],
        inputModes: ["application/json", "text/plain"],
        outputModes: ["application/json"]
      },
      {
        id: "agenda-signals",
        name: "Geopolitical signal archive lookup",
        description:
          "Routes callers to the packaged list_signals and get_signal MCP tools for strategic-risk signal archive entries, watch-next monitoring, and policy-analysis context vendored from the Global Think Tank Analyst method snapshot.",
        tags: [
          "signals",
          "geopolitical-signals",
          "strategic-intelligence",
          "archive",
          "watch-next",
          "policy-analysis"
        ],
        examples: [
          "List available signal records relevant to a regional-risk workflow."
        ],
        inputModes: ["application/json", "text/plain"],
        outputModes: ["application/json", "text/markdown"]
      }
    ],
    support: {
      email: SUPPORT_CONTACT_EMAIL,
      documentationUrl: DOCS_URL,
      hours_local: SUPPORT_HOURS_LOCAL,
      timezone: SUPPORT_TIMEZONE,
      response_sla:
        "Best-effort response within 2 business days. Solo maintainer (not a company); not a paid support channel."
    },
    x_agenda_intelligence: {
      hosted_wrapper: true,
      wrapper_scope: "A2A/JSON-RPC discovery, lightweight triage, and routing response only",
      jsonrpc_endpoint: `${origin}/message/send`,
      repository: REPOSITORY_URL,
      package: PACKAGE_URL,
      mcp: {
        transport: "stdio",
        server_command: "agenda-intelligence-mcp",
        install: "pip install agenda-intelligence-md"
      },
      boundaries: [
        "No payments or wallet rails.",
        "No autonomous live source retrieval.",
        "No factual-truth verification.",
        "No legal, financial, compliance, investment, or trading advice."
      ]
    }
  };
  return applyAgentProfile(card, request, env);
}

function applyAgentProfile(card, request, env = {}) {
  const profile = agentProfile(request, env);
  if (profile === "cis_secondary_sanctions") return applyCisSecondarySanctionsProfile(card, request, env);
  if (profile === "agentic_interaction_trust") return applyAgenticInteractionTrustProfile(card, request);
  if (profile === "gulf_maritime_exposure") return applyGulfMaritimeProfile(card, request);
  if (profile === "market_entry_readiness") return applyMarketEntryReadinessProfile(card, request);
  if (profile !== "kazakhstan") return card;

  const origin = originFromRequest(request);
  card.name = "Kazakhstan / Middle Corridor Deal Risk Gate";
  card.documentationUrl = MIDDLE_CORRIDOR_DOCS_URL;
  card.description =
    "A2A-compatible evidence-readiness gate for Kazakhstan-Caspian / Middle Corridor logistics, trade-finance, procurement, and insurance-adjacent workflows. Bring route, cargo, counterparties, and dated sources; get structured deal-risk triage, missing source categories, evidence gaps, watch-next indicators, decision-readiness score, risk signal, human-review routing, sanctions-relevant / re-export jurisdiction flags, a domestic-legal vs foreign-sanctions exposure decomposition, and a vessel deceptive-shipping-practice checklist. Presence-flagging and evidence triage only, not a sanctions determination.";
  card.provider.legalEntity.sameAs = [
    "https://github.com/vassiliylakhonin",
    "https://pypi.org/project/agenda-intelligence-md/",
    "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md",
    "https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev"
  ];
  card.skills = [
    {
      id: "middle-corridor-deal-desk-triage",
      name: "Kazakhstan / Middle Corridor deal-risk gate",
      description:
        "Turns a route, cargo, counterparty, and dated-source bundle into a structured deal-risk recommendation with risk signal, decision-readiness score, evidence gaps, and minimum source categories required before signature, shipment, insurer handoff, or committee review.",
      tags: [
        "deal-desk",
        "kazakhstan",
        "middle-corridor",
        "trade-risk",
        "logistics-risk",
        "human-review",
        "free"
      ],
      examples: [
        "Should this Altynkol-Aktau-Baku-Poti shipment be escalated before contract signature?",
        "Generate deal-risk triage for Kazakhstan-Caspian transit with cargo, counterparties, and dated sources."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    },
    {
      id: "middle-corridor-source-coverage-auditor",
      name: "Middle Corridor source coverage auditor",
      description:
        "Checks whether a Middle Corridor evidence pack has enough dated source coverage for a risk decision: sanctions lists, port/operator notices, customs or regulatory sources, counterparty registry extracts, and insurance or carrier notes.",
      tags: [
        "source-coverage",
        "evidence-pack",
        "middle-corridor",
        "trans-caspian",
        "official-sources",
        "decision-readiness"
      ],
      examples: [
        "Audit whether this Kazakhstan corridor evidence pack is sufficient before management review.",
        "List missing required source types for a Middle Corridor sanctions and logistics-risk memo."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    },
    {
      id: "sanctions-adjacency-evidence-gate",
      name: "Sanctions adjacency evidence gate",
      description:
        "Provides a pre-compliance evidence gate for sanctions-adjacent Kazakhstan and Central Asia corridor exposure: source-backed claims, unsupported assertions, missing ownership/counterparty/vessel evidence, and human-review triggers. Not legal or compliance advice.",
      tags: [
        "sanctions-adjacency",
        "pre-compliance",
        "counterparty-risk",
        "beneficial-ownership",
        "trade-finance",
        "kazakhstan"
      ],
      examples: [
        "Gate this Kazakhstan transit transaction for sanctions-adjacent evidence gaps before compliance review.",
        "Identify unsupported sanctions claims in a route-risk note with supplied source extracts."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    },
    {
      id: "risk-memo-quality-gate",
      name: "Risk memo quality gate",
      description:
        "Scores a corridor-risk memo for structure, evidence discipline, source coverage, decision-readiness, watch-next indicators, uncertainty handling, and required fixes before analyst or management handoff.",
      tags: [
        "memo-validation",
        "evidence-audit",
        "quality-gate",
        "decision-readiness",
        "watch-next",
        "strategic-risk"
      ],
      examples: [
        "Quality-gate this Kazakhstan corridor-risk memo before it goes to a client or committee.",
        "Return pass/fail reasons and required fixes for a Middle Corridor risk memo."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    },
    {
      id: "a2a-evidence-pack-linter",
      name: "A2A evidence pack linter",
      description:
        "Lints caller-supplied evidence packs before they enter an agent workflow: missing dates, unknown evidence ids, orphan references, unsupported claims, quote-fragment presence, and source-category gaps.",
      tags: [
        "evidence-linting",
        "quote-checking",
        "provenance",
        "agent-workflows",
        "schema-validation",
        "source-coverage"
      ],
      examples: [
        "Lint this evidence pack before running a Middle Corridor deal-risk memo.",
        "Find orphan evidence references and missing dates in this sanctions evidence bundle."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = "middle_corridor_deal_risk";
  card.x_agenda_intelligence.canonical_product_name = "Kazakhstan / Middle Corridor Deal Risk Gate";
  card.x_agenda_intelligence.wrapper_scope =
    "A2A/JSON-RPC discovery, Kazakhstan and Middle Corridor deal-risk triage, evidence gating, source coverage, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = MIDDLE_CORRIDOR_DOCS_URL;
  card.x_agenda_intelligence.product_contract = {
    request_schema: MIDDLE_CORRIDOR_REQUEST_SCHEMA_URL,
    response_schema: MIDDLE_CORRIDOR_RESPONSE_SCHEMA_URL,
    source_taxonomy: MIDDLE_CORRIDOR_SOURCE_TAXONOMY_URL,
    runnable_examples: A2A_EXAMPLES_URL,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    demo_input_modes: ["structured_json", "text_prompt"]
  };
  card.x_agenda_intelligence.required_before_go = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO;
  card.x_agenda_intelligence.helpful_context_sources = MIDDLE_CORRIDOR_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.supported_contracts = [
    "middle_corridor_deal_risk_contract",
    "lightweight_text_triage"
  ];
  card.x_agenda_intelligence.buyer_use_cases = [
    "pre-signature logistics deal review",
    "pre-shipment evidence completeness check",
    "trade-finance or compliance-adjacent file readiness",
    "insurance-adjacent source-pack handoff",
    "management or client risk-memo quality gate",
    "counterparty dossier-completeness check before presenting evidence to a bank, insurer, or counterparty"
  ];
  card.x_agenda_intelligence.commercial_positioning =
    "Pre-screening evidence triage: identifies which due-diligence documents are still missing before a deal's counterparties are committed to a sanctions-screening or network-intelligence tool. It complements those tools rather than replacing them, and performs no screening, name-matching, or data retrieval itself. Route + cargo + counterparties + dated sources -> auditable corridor-risk triage, evidence gaps, source coverage, watch-next indicators, and human-review escalation. The same evidence-gap picture is also returned outward as counterparty_readiness: a dossier-completeness view (status + supplied-vs-required counts + outstanding documents) for the party that must present enhanced-due-diligence evidence to a bank, insurer, or counterparty. Completeness only, not clearance or a sanctions determination.";
  card.x_agenda_intelligence.focus = [
    "Kazakhstan and Middle Corridor deal-risk triage",
    "sanctions-adjacent evidence gates",
    "source coverage for dated evidence packs",
    "risk memo quality gates",
    "human-review escalation before signature, committee review, insurer handoff, or client delivery"
  ];
  card.x_agenda_intelligence.not_advice_notice = NOT_ADVICE_NOTICE;
  card.x_agenda_intelligence.boundaries = [
    "Pre-compliance evidence triage only.",
    "No autonomous live source retrieval.",
    "No factual-truth verification.",
    "No legal, compliance, sanctions, financial, investment, insurance, or trading advice.",
    "No approval, clearance, authorization, or final decision.",
    "Human review is required for high-stakes decisions."
  ];
  // Top-level x_* extension (does not collide with standard A2A fields) so catalogs
  // and agents get a fast signal: send a structured data part, not a bare prompt.
  // A text prompt falls through to lightweight_text_triage and leaves the deal-risk
  // contract empty; only a structured request reaches the full contract.
  card.x_agent_contract = {
    contract_version: MIDDLE_CORRIDOR_AGENT_CONTRACT_VERSION,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    primary_intent: "middle_corridor_deal_risk_contract",
    supported_intents: MIDDLE_CORRIDOR_SUPPORTED_INTENTS,
    structured_json_required_for_full_contract: true,
    text_prompt_behavior: "lightweight_text_triage",
    high_stakes_human_review_required: true,
    not_advice: true
  };
  return card;
}

function applyAgenticInteractionTrustProfile(card, request) {
  const origin = originFromRequest(request);
  card.name = "Agentic Interaction Trust Gate";
  card.documentationUrl = AGENTIC_INTERACTION_TRUST_DOCS_URL;
  card.description =
    "A2A-compatible evidence-readiness gate for agent-mediated actions across checkout, account, API, MCP tool, and A2A endpoint surfaces. Bring actor identity claims, target surface, requested action, and dated evidence; get trust-routing triage, missing source categories, evidence gaps, watch-next indicators, decision-readiness score, trust signal, and human-review routing.";
  card.provider.legalEntity.sameAs = [
    "https://github.com/vassiliylakhonin",
    "https://pypi.org/project/agenda-intelligence-md/",
    "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md"
  ];
  card.skills = [
    {
      id: "agentic-interaction-trust-gate",
      name: "Agentic interaction trust gate",
      description:
        "Turns an agent-mediated action, target surface, actor claim, and dated evidence into a structured trust-routing recommendation with decision-readiness score, evidence gaps, and mandatory human-review routing.",
      tags: [
        "agentic-ai",
        "trust-and-safety",
        "fraud-risk",
        "mcp",
        "a2a",
        "evidence-readiness",
        "human-review",
        "free"
      ],
      examples: [
        "Should this AI shopping agent checkout be allowed, stepped up, or escalated to human review?",
        "Triage an unknown A2A caller requesting a sanctions-adjacent capability."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = "agentic_interaction_trust";
  card.x_agenda_intelligence.canonical_product_name = "Agentic Interaction Trust Gate";
  card.x_agenda_intelligence.wrapper_scope =
    "A2A/JSON-RPC discovery, agentic interaction trust triage, evidence gating, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = AGENTIC_INTERACTION_TRUST_DOCS_URL;
  card.x_agenda_intelligence.product_contract = {
    request_schema: AGENTIC_INTERACTION_TRUST_REQUEST_SCHEMA_URL,
    response_schema: AGENTIC_INTERACTION_TRUST_RESPONSE_SCHEMA_URL,
    source_taxonomy: AGENTIC_INTERACTION_TRUST_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/agentic-interaction-trust`,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    demo_input_modes: ["structured_json"]
  };
  card.x_agenda_intelligence.required_before_action = AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION;
  card.x_agenda_intelligence.helpful_context_sources = AGENTIC_INTERACTION_TRUST_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.supported_contracts = ["agentic_interaction_trust_contract"];
  card.x_agenda_intelligence.buyer_use_cases = [
    "AI shopping-agent checkout step-up review",
    "unknown A2A caller capability invocation review",
    "MCP tool-scope and permission evidence triage",
    "API partner delegated-action evidence readiness",
    "trust-and-safety human-review queue preparation"
  ];
  card.x_agenda_intelligence.commercial_positioning =
    "Actor + target surface + requested action + dated evidence -> auditable trust-routing triage with evidence gaps, decision-readiness score, watch-next indicators, and human-review escalation.";
  card.x_agenda_intelligence.focus = [
    "agent-mediated checkout and account action triage",
    "A2A and MCP endpoint invocation evidence gates",
    "delegated-action authority and permission evidence",
    "trust-and-safety review readiness",
    "human-review escalation for consequential agentic actions"
  ];
  card.x_agenda_intelligence.not_advice_notice = AGENTIC_TRUST_NOT_ADVICE_NOTICE;
  card.x_agenda_intelligence.boundaries = [
    "Agentic interaction evidence triage only.",
    "No autonomous live source retrieval.",
    "No factual-truth verification.",
    "No cybersecurity monitoring, fraud adjudication, identity verification, or transaction authorization.",
    "No legal, compliance, financial, investment, insurance, or trading advice.",
    "No approval, clearance, authorization, denial, blocking, or final decision.",
    "Human review is required for consequential decisions."
  ];
  return card;
}

function applyGulfMaritimeProfile(card, request) {
  const origin = originFromRequest(request);
  card.name = "Gulf Maritime Exposure Gate";
  card.documentationUrl = GULF_MARITIME_DOCS_URL;
  card.description =
    "A2A-compatible evidence-readiness gate for maritime sanctions and chokepoint-disruption exposure on a vessel " +
    "or voyage transiting the Strait of Hormuz, Persian/Arabian Gulf, Gulf of Oman, Bab-el-Mandeb, or Red Sea. Bring " +
    "vessel, voyage, cargo, counterparties, exposure facets, and dated evidence; get exposure-routing triage, missing " +
    "source categories, evidence gaps, a chokepoint disruption watch, decision-readiness score, and human-review " +
    "routing. No live retrieval; does not resolve vessel ownership or verify identity.";
  card.provider.legalEntity.sameAs = [
    "https://github.com/vassiliylakhonin",
    "https://pypi.org/project/agenda-intelligence-md/",
    "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md"
  ];
  card.skills = [
    {
      id: "gulf-maritime-exposure",
      name: "Gulf maritime exposure triage",
      description:
        "Turns a vessel/voyage, counterparties, exposure facets, and dated evidence into a structured maritime " +
        "sanctions and chokepoint-disruption triage with decision-readiness score, evidence gaps, a chokepoint " +
        "disruption watch, and mandatory human-review routing.",
      tags: ["maritime", "sanctions", "hormuz", "red-sea", "dark-fleet", "evidence-readiness", "human-review", "free"],
      examples: [
        "Should this Hormuz tanker transit be escalated before fixture?",
        "Triage a dark-fleet-indicator voyage with no confirmed P&I cover."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = "gulf_maritime_exposure";
  card.x_agenda_intelligence.canonical_product_name = "Gulf Maritime Exposure Gate";
  card.x_agenda_intelligence.wrapper_scope =
    "A2A/JSON-RPC discovery, maritime sanctions and chokepoint-disruption triage, evidence gating, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = GULF_MARITIME_DOCS_URL;
  card.x_agenda_intelligence.product_contract = {
    request_schema: GULF_MARITIME_REQUEST_SCHEMA_URL,
    response_schema: GULF_MARITIME_RESPONSE_SCHEMA_URL,
    source_taxonomy: GULF_MARITIME_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/gulf-maritime-exposure`,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    demo_input_modes: ["structured_json"]
  };
  card.x_agenda_intelligence.required_before_review = GULF_MARITIME_REQUIRED_BEFORE_REVIEW;
  card.x_agenda_intelligence.helpful_context_sources = GULF_MARITIME_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.supported_contracts = ["gulf_maritime_exposure_contract"];
  card.x_agenda_intelligence.buyer_use_cases = [
    "marine and war-risk underwriting before binding cover",
    "tanker chartering fixture clearance through the Gulf or Red Sea",
    "shipowner/operator sanctions clearance before fixture",
    "bunkering and ship-agency dark-fleet exposure triage"
  ];
  card.x_agenda_intelligence.commercial_positioning =
    "Vessel + voyage + counterparties + exposure facets + dated evidence -> auditable exposure triage with evidence " +
    "gaps, decision-readiness score, chokepoint disruption watch, and human-review escalation. Sits beside a " +
    "vessel-screening or ownership-resolution tool, not instead of one.";
  card.x_agenda_intelligence.boundaries = [
    "No live source retrieval; caller-supplied evidence only.",
    "No vessel-ownership resolution, vessel-identity verification, or name screening.",
    "No factual-truth verification.",
    "No legal, sanctions, compliance, financial, investment, insurance, or trading advice.",
    "Human review is required before any commercial action."
  ];
  return card;
}

function applyCisSecondarySanctionsProfile(card, request, env = {}) {
  const origin = originFromRequest(request);
  const activeOption = activeUpstreamOption("cis_secondary_sanctions", env);
  card.name = "CIS Secondary-Sanctions Exposure";
  card.documentationUrl = CIS_SECONDARY_SANCTIONS_DOCS_URL;
  card.description =
    "A2A-compatible secondary-sanctions exposure evidence triage for CIS, Caucasus, and Central Asia counterparties (Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova). Bring counterparty, exposure facets, and dated source extracts; get " +
    (activeOption ? `auto-fetched ${activeOption.name} name matches, ` : "") +
    "structured triage, evidence gaps, decision-readiness score, exposure dimensions, and mandatory human-review routing. " +
    (activeOption
      ? ""
      : "Sanctions-list name-match (OpenSanctions / Watchman, CC-BY 4.0 / Apache-2.0) is wired but disabled in this public deployment, which runs on user-supplied evidence only. ") +
    "Targets enhanced due diligence in EU / UK / UAE / Singapore institutions screening counterparties against OFAC EO 14114, EU 14th sanctions package, UK OFSI, and FATF / EAG typologies.";
  card.provider.legalEntity.sameAs = [
    "https://github.com/vassiliylakhonin",
    "https://pypi.org/project/agenda-intelligence-md/",
    "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md"
  ];
  card.skills = [
    {
      id: "cis-secondary-sanctions-exposure",
      name: "CIS secondary-sanctions exposure triage",
      description:
        "Turns a CIS / Caucasus / Central Asia counterparty + exposure facets + dated source extracts into a structured secondary-sanctions exposure triage with optional sanctions-list name matches (OpenSanctions / Watchman, when a list upstream is configured), evidence gaps, decision-readiness score, exposure dimensions, and mandatory human-review escalation. It is an evidence-discipline and documented-determination layer beside a screening or ownership-resolution tool, not a replacement; it does not traverse multi-layer beneficial-ownership graphs.",
      tags: [
        "cis",
        "kazakhstan",
        "uzbekistan",
        "georgia",
        "secondary-sanctions",
        "ofac",
        "eu-14th-package",
        "uk-ofsi",
        "evidence-readiness",
        "live-retrieval"
      ],
      examples: [
        "Does the disclosed ownership chain create indirect exposure under OFAC EO 14114?",
        "Triage a Kazakhstani trading-house counterparty against the EU 14th sanctions package."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = "cis_secondary_sanctions";
  card.x_agenda_intelligence.canonical_product_name = "CIS Secondary-Sanctions Exposure";
  card.x_agenda_intelligence.wrapper_scope =
    "A2A/JSON-RPC discovery, CIS secondary-sanctions exposure triage, optional OpenSanctions / Watchman live retrieval when configured, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = CIS_SECONDARY_SANCTIONS_DOCS_URL;
  card.x_agenda_intelligence.product_contract = {
    request_schema: CIS_SECONDARY_SANCTIONS_REQUEST_SCHEMA_URL,
    response_schema: CIS_SECONDARY_SANCTIONS_RESPONSE_SCHEMA_URL,
    source_taxonomy: CIS_SECONDARY_SANCTIONS_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/cis-secondary-sanctions`,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    demo_input_modes: ["structured_json"]
  };
  card.x_agenda_intelligence.required_before_review = CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW;
  card.x_agenda_intelligence.helpful_context_sources = CIS_SECONDARY_SANCTIONS_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.live_retrieval = {
    capability_declared: true,
    active: activeOption !== null,
    active_upstream: activeOption ? activeOption.name : null,
    upstream_options: [
      {
        name: "Watchman",
        homepage: WATCHMAN_PROJECT_URL,
        license: WATCHMAN_LICENSE,
        attribution_notice: WATCHMAN_ATTRIBUTION,
        activation_env_var: "WATCHMAN_URL",
        disable_env_var: "WATCHMAN_DISABLED",
        cost_model: "self-hosted (Apache-2.0); $0/month on free-tier container"
      },
      {
        name: "OpenSanctions",
        homepage: OPENSANCTIONS_HOMEPAGE,
        license: OPENSANCTIONS_LICENSE,
        attribution_notice: OPENSANCTIONS_ATTRIBUTION,
        activation_env_var: "OPENSANCTIONS_API_KEY",
        disable_env_var: "OPENSANCTIONS_DISABLED",
        cost_model: "paid €0.10/call (30-day business-email trial)"
      }
    ],
    adr: CIS_SECONDARY_SANCTIONS_ADR_URL,
    graceful_degrade: true,
    deferral_note: activeOption
      ? undefined
      : "Per the 2026-05-27 update to ADR 0014, live retrieval upstreams are declared but not activated. Set WATCHMAN_URL (free self-host) or OPENSANCTIONS_API_KEY (paid) to activate. Profile currently operates on user-supplied evidence only."
  };
  card.x_agenda_intelligence.supported_contracts = ["cis_secondary_sanctions_exposure_contract"];
  card.x_agenda_intelligence.buyer_use_cases = [
    "EU / UK / UAE / Singapore enhanced due diligence on CIS counterparties",
    "OFAC EO 14114 secondary-sanctions exposure screening",
    "EU 14th sanctions package transit / re-export risk triage",
    "UK OFSI alignment for CIS-facing trade-finance files",
    "FATF / EAG typology mapping for CIS-domiciled entities"
  ];
  card.x_agenda_intelligence.commercial_positioning =
    "CIS / Caucasus / Central Asia counterparty + exposure facets + dated source extracts -> auditable secondary-sanctions exposure triage with optional sanctions-list name matches (when a list upstream is configured), evidence gaps, decision-readiness score, and mandatory human-review escalation.";
  card.x_agenda_intelligence.focus = [
    "CIS counterparty secondary-sanctions exposure triage",
    "OpenSanctions consolidated dataset name matching",
    "ownership / transit / correspondent-banking exposure dimensions",
    "FATF / EAG typology references",
    "graceful degrade to user-supplied evidence on upstream failure"
  ];
  card.x_agenda_intelligence.not_advice_notice = NOT_ADVICE_NOTICE;
  card.x_agenda_intelligence.boundaries = [
    "Pre-compliance evidence triage only.",
    activeOption
      ? `Live retrieval is active for this profile against ${activeOption.name} (CC-BY 4.0 / Apache-2.0).`
      : "Live retrieval (OpenSanctions / Watchman) is available for this profile but is not active in this deployment; triage runs on user-supplied evidence only.",
    "No factual-truth verification. A name match against a sanctions list is not legal-entity identity verification.",
    "No legal, compliance, sanctions, financial, investment, insurance, or trading advice.",
    "No approval, clearance, authorization, or final decision.",
    "Human review is required for high-stakes decisions."
  ];
  card.x_agenda_intelligence.boundaries.push(
    "On any upstream failure or missing OPENSANCTIONS_API_KEY, the response degrades to user-supplied evidence only with live_retrieval_status: degraded / disabled."
  );
  return card;
}

function extractText(params) {
  if (!params || typeof params !== "object") return "";
  if (typeof params.text === "string") return params.text;
  if (typeof params.prompt === "string") return params.prompt;
  if (typeof params.message === "string") return params.message;

  const message = params.message;
  if (message && typeof message === "object") {
    if (typeof message.text === "string") return message.text;
    if (Array.isArray(message.parts)) {
      return message.parts
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
  }

  return "";
}

function tryParseJsonObject(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Enum validation — parity with the schemas/v1 request contracts. The worker
// previously accepted off-enum values (e.g. an unknown counterparty sector) the
// canonical Python service / JSON Schema rejects, then triaged as if valid.
// These mirror the schema enums; a string value outside the set (the "other"
// escape hatch is always included) is reported and the request rejected, like
// the Python _validate_json path. Update alongside schemas/v1/*-request.schema.json.
// ---------------------------------------------------------------------------
const REQUESTED_OUTPUTS = ["structured_json", "markdown_summary", "both"];

const MC_DECISION_STAGES = ["pre_signature", "pre_shipment", "in_transit", "post_incident", "committee_review", "other"];
const MC_CURRENCIES = ["USD", "EUR", "GBP", "KZT", "CNY", "TRY", "AED", "other"];
const MC_COUNTERPARTY_ROLES = [
  "shipper", "forwarder", "carrier", "port_agent", "consignee", "bank", "insurer", "broker", "customs_broker", "unknown", "other"
];
const MC_SOURCE_TYPES = [
  "port_operator_notice", "sanctions_list_extract", "carrier_note", "counterparty_registry_extract",
  "beneficial_ownership_source", "customs_or_regulatory_source", "insurance_clause_or_underwriter_note",
  "vessel_or_carrier_history", "rail_capacity_or_border_wait_source", "contract_or_invoice_extract",
  "end_user_or_reexport_evidence", "source_of_funds_or_wealth_evidence", "pep_screening_evidence",
  "business_substance_evidence", "user_provided_note", "other"
];

const CIS_SECTORS = [
  "trading_house", "logistics_forwarder", "bank", "fintech", "broker_dealer", "manufacturer", "ict_or_electronics",
  "metals_or_mining", "energy_or_petrochem", "agribusiness_or_grain", "construction", "professional_services",
  "holding_or_spv", "unknown", "other"
];
const CIS_REVIEW_SCOPES = ["ofac", "eu", "uk_ofsi", "un", "fatf", "eag", "national_regulator", "other"];
const CIS_DECISION_STAGES = ["onboarding", "periodic_review", "pre_transaction", "post_alert", "committee_review", "other"];
const CIS_EXPOSURE_FACETS = [
  "ownership_or_control", "financial_flows", "ict_or_dual_use_goods", "metals_or_mining", "energy_or_petrochem",
  "agribusiness_or_grain", "transit_or_re_export", "correspondent_banking", "professional_enablers",
  "shell_or_layered_structure", "other"
];
const CIS_ID_SCHEMES = ["lei", "national_bin", "national_tin", "isin", "other"];
const CIS_SOURCE_TYPES = [
  "ofac_sdn_extract", "eu_consolidated_extract", "uk_ofsi_extract", "un_security_council_extract",
  "ownership_chain_evidence", "beneficial_ownership_source", "bank_correspondent_evidence",
  "transit_or_invoice_evidence", "dual_use_export_evidence", "customs_data_evidence", "adverse_media_evidence",
  "typology_reference", "national_regulator_filing", "user_provided_note", "other"
];

const AIT_DECISION_STAGES = ["pre_execution", "in_session", "post_alert", "policy_review", "committee_review", "other"];
const AIT_DECLARED_TYPES = [
  "ai_agent", "automation_script", "api_client", "browser_bot", "human_delegated_agent", "unknown", "other"
];
const AIT_AUTH_CONTEXTS = [
  "anonymous", "session_cookie", "api_key", "oauth", "mTLS", "signed_agent_manifest", "unknown", "other"
];
const AIT_TARGET_SURFACES = [
  "checkout", "account", "api", "mcp_tool", "a2a_endpoint", "content_or_catalog", "auth_flow", "support_or_messaging", "other"
];
const AIT_SOURCE_TYPES = [
  "agent_identity_claim", "operator_or_principal_authorization", "agent_card_or_manifest",
  "mcp_or_a2a_endpoint_metadata", "tool_scope_or_permission_evidence", "session_authentication_evidence",
  "action_intent_evidence", "transaction_or_target_action_evidence", "rate_limit_or_abuse_signal",
  "fraud_or_account_takeover_signal", "device_or_infrastructure_evidence", "provider_policy_or_allowlist",
  "prior_interaction_history", "incident_report_or_threat_intel", "human_review_note", "user_provided_note", "other"
];

function offEnum(label, value, allowed, errors) {
  if (value === undefined || value === null) return;
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (typeof v === "string" && !allowed.includes(v)) {
      errors.push(`${label}: '${v}' is not a permitted value`);
    }
  }
}

function middleCorridorEnumErrors(r) {
  const errors = [];
  offEnum("decision_stage", r.decision_stage, MC_DECISION_STAGES, errors);
  offEnum("requested_output", r.requested_output, REQUESTED_OUTPUTS, errors);
  if (r.shipment_value && typeof r.shipment_value === "object") {
    offEnum("shipment_value.currency", r.shipment_value.currency, MC_CURRENCIES, errors);
  }
  for (const cp of Array.isArray(r.counterparties) ? r.counterparties : []) {
    if (cp && typeof cp === "object") offEnum("counterparties[].role", cp.role, MC_COUNTERPARTY_ROLES, errors);
  }
  for (const s of Array.isArray(r.dated_sources) ? r.dated_sources : []) {
    if (s && typeof s === "object") offEnum("dated_sources[].source_type", s.source_type, MC_SOURCE_TYPES, errors);
  }
  return errors;
}

function cisEnumErrors(r) {
  const errors = [];
  const cp = r.counterparty && typeof r.counterparty === "object" ? r.counterparty : {};
  offEnum("counterparty.sector", cp.sector, CIS_SECTORS, errors);
  for (const id of Array.isArray(cp.registered_identifiers) ? cp.registered_identifiers : []) {
    if (id && typeof id === "object") offEnum("registered_identifiers[].scheme", id.scheme, CIS_ID_SCHEMES, errors);
  }
  offEnum("exposure_facets", r.exposure_facets, CIS_EXPOSURE_FACETS, errors);
  offEnum("jurisdiction_review_scope", r.jurisdiction_review_scope, CIS_REVIEW_SCOPES, errors);
  offEnum("decision_stage", r.decision_stage, CIS_DECISION_STAGES, errors);
  offEnum("requested_output", r.requested_output, REQUESTED_OUTPUTS, errors);
  for (const s of Array.isArray(r.dated_sources) ? r.dated_sources : []) {
    if (s && typeof s === "object") offEnum("dated_sources[].source_type", s.source_type, CIS_SOURCE_TYPES, errors);
  }
  return errors;
}

function agenticEnumErrors(r) {
  const errors = [];
  const actor = r.actor && typeof r.actor === "object" ? r.actor : {};
  offEnum("actor.declared_type", actor.declared_type, AIT_DECLARED_TYPES, errors);
  offEnum("actor.authentication_context", actor.authentication_context, AIT_AUTH_CONTEXTS, errors);
  offEnum("target_surface", r.target_surface, AIT_TARGET_SURFACES, errors);
  offEnum("decision_stage", r.decision_stage, AIT_DECISION_STAGES, errors);
  offEnum("requested_output", r.requested_output, REQUESTED_OUTPUTS, errors);
  for (const s of Array.isArray(r.dated_sources) ? r.dated_sources : []) {
    if (s && typeof s === "object") offEnum("dated_sources[].source_type", s.source_type, AIT_SOURCE_TYPES, errors);
  }
  return errors;
}

function invalidRequestResult(profile, endpoint, schema, errors) {
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() },
    artifacts: [],
    metadata: { product_profile: profile, canonical_http_endpoint: endpoint, schema, valid: false, errors }
  };
}

function isCisSecondarySanctionsRequest(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.counterparty &&
    typeof value.counterparty === "object" &&
    typeof value.counterparty.name === "string" &&
    typeof value.counterparty.jurisdiction === "string" &&
    Array.isArray(value.exposure_facets) &&
    Array.isArray(value.dated_sources) &&
    typeof value.risk_question === "string" &&
    typeof value.decision_stage === "string"
  );
}

function structuredCisSecondarySanctionsRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [
    params.request,
    params.cis_secondary_sanctions_request,
    params.cis_secondary_sanctions_exposure_request,
    params.input,
    params
  ];
  const message = params.message;
  if (message && typeof message === "object") {
    if (message.data && typeof message.data === "object") candidates.push(message.data);
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (!part || typeof part !== "object") continue;
        candidates.push(part.data, part.json, part.content);
        const parsed = tryParseJsonObject(part.text);
        if (parsed) candidates.push(parsed);
      }
    }
  }
  for (const candidate of candidates) {
    if (isCisSecondarySanctionsRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isCisSecondarySanctionsRequest(parsed)) return parsed;
  }
  return null;
}

function cisEvidenceGapForSource(sourceType) {
  const gaps = {
    ofac_sdn_extract: "No OFAC SDN list extract supplied.",
    eu_consolidated_extract: "No EU consolidated sanctions list extract supplied.",
    uk_ofsi_extract: "No UK OFSI sanctions list extract supplied.",
    un_security_council_extract: "No UN Security Council sanctions extract supplied.",
    ownership_chain_evidence: "No ownership chain evidence supplied.",
    bank_correspondent_evidence: "No bank correspondent evidence supplied.",
    transit_or_invoice_evidence: "No transit or invoice evidence supplied.",
    dual_use_export_evidence: "No dual-use export evidence supplied.",
    customs_data_evidence: "No customs data evidence supplied.",
    adverse_media_evidence: "No adverse media evidence supplied.",
    typology_reference: "No typology reference supplied."
  };
  return gaps[sourceType] || `No ${sourceType} supplied.`;
}

function cisTriageRecommendation(request, missing, exposureSignal) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0) {
    return "insufficient_information";
  }
  if (missing.length === 0 && exposureSignal === "low") return "ready_for_human_review";
  if (request.decision_stage === "onboarding") return "escalate_before_onboarding";
  if (request.decision_stage === "pre_transaction") return "escalate_before_transaction";
  return "not_decision_ready";
}

function cisExposureSignal(request, missing, openSanctionsMatchCount) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0) return "unknown";
  if (openSanctionsMatchCount >= 1) return "high";
  if (missing.length >= 4) return "medium_high";
  if (missing.length > 0) return "medium";
  return "low";
}

function cisDecisionReadiness(request, supplied) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0 || supplied.length === 0) {
    return [0, "insufficient_information"];
  }
  const requiredPresent = CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW.filter((s) => supplied.includes(s)).length;
  const contextPresent = CIS_SECONDARY_SANCTIONS_HELPFUL_CONTEXT.filter((s) => supplied.includes(s)).length;
  const score = Math.min(
    100,
    Math.round(
      10 +
        (requiredPresent / CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW.length) * 70 +
        (contextPresent / CIS_SECONDARY_SANCTIONS_HELPFUL_CONTEXT.length) * 20
    )
  );
  if (score >= 85) return [score, "review_ready"];
  if (score >= 50) return [score, "partial"];
  return [score, "not_decision_ready"];
}

// Mirrors services._UNDISCLOSED_UBO_TOKENS / _cis_has_undisclosed_ubo so the
// A2A worker flags an undisclosed/unverified ultimate beneficial owner exactly
// like the canonical Python service. Flags an evidence gap from the declared
// ownership chain; does not analyze or attribute ownership.
const UNDISCLOSED_UBO_TOKENS = [
  "undisclosed",
  "unknown",
  "not disclosed",
  "undetermined",
  "unverified",
  "unidentified",
  "tbd",
  "to be determined",
  "nominee"
];

function cisHasUndisclosedUbo(request) {
  const counterparty = (request && request.counterparty) || {};
  const layers = counterparty.ownership_layers;
  if (!Array.isArray(layers)) return false;
  return layers.some(
    (layer) =>
      typeof layer === "string" && UNDISCLOSED_UBO_TOKENS.some((token) => layer.toLowerCase().includes(token))
  );
}

function cisTopExposureDimensions(facets, missing, openSanctionsMatchCount, undisclosedUbo = false) {
  const dims = [];
  if (openSanctionsMatchCount > 0) {
    dims.push("direct or near-direct match in OpenSanctions consolidated dataset");
  }
  if (undisclosedUbo) dims.push("undisclosed or unverified ultimate beneficial owner");
  if (facets.includes("ownership_or_control")) dims.push("indirect ownership or control exposure");
  if (facets.includes("transit_or_re_export")) {
    dims.push("transit or re-export exposure under EU 14th package / OFAC EO 14114");
  }
  if (facets.includes("ict_or_dual_use_goods")) dims.push("ICT or dual-use goods diversion exposure");
  if (facets.includes("correspondent_banking")) dims.push("correspondent banking exposure");
  if (facets.includes("shell_or_layered_structure")) dims.push("shell or layered structure exposure");
  if (facets.includes("professional_enablers")) dims.push("professional-enabler exposure");
  if (missing.includes("ownership_chain_evidence")) dims.push("ownership chain not yet documented");
  return Array.from(new Set(dims));
}

function suppliedSourceTypes(request) {
  const types = [];
  for (const source of request.dated_sources || []) {
    if (!source || typeof source !== "object") continue;
    if (typeof source.source_type === "string") types.push(source.source_type);
  }
  return Array.from(new Set(types));
}

function isAgenticInteractionTrustRequest(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.actor &&
    typeof value.actor === "object" &&
    typeof value.actor.declared_type === "string" &&
    typeof value.actor.declared_name === "string" &&
    typeof value.target_surface === "string" &&
    typeof value.requested_action === "string" &&
    Array.isArray(value.dated_sources) &&
    typeof value.risk_question === "string" &&
    typeof value.decision_stage === "string"
  );
}

function structuredAgenticInteractionTrustRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [
    params.request,
    params.agentic_interaction_trust_request,
    params.agentic_trust_request,
    params.input,
    params
  ];
  const message = params.message;
  if (message && typeof message === "object") {
    if (message.data && typeof message.data === "object") candidates.push(message.data);
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (!part || typeof part !== "object") continue;
        candidates.push(part.data, part.json, part.content);
        const parsed = tryParseJsonObject(part.text);
        if (parsed) candidates.push(parsed);
      }
    }
  }
  for (const candidate of candidates) {
    if (isAgenticInteractionTrustRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isAgenticInteractionTrustRequest(parsed)) return parsed;
  }
  return null;
}

function agenticEvidenceGapForSource(sourceType) {
  const gaps = {
    agent_identity_claim: "No agent identity claim supplied.",
    operator_or_principal_authorization: "No operator or principal authorization supplied.",
    agent_card_or_manifest: "No agent card or signed manifest supplied.",
    tool_scope_or_permission_evidence: "No tool-scope or permission evidence supplied.",
    session_authentication_evidence: "No session authentication evidence supplied.",
    action_intent_evidence: "No action-intent evidence supplied.",
    transaction_or_target_action_evidence: "No transaction or target-action evidence supplied.",
    provider_policy_or_allowlist: "No provider policy or allowlist record supplied."
  };
  return gaps[sourceType] || `No ${sourceType} supplied.`;
}

function agenticDecisionReadiness(request, supplied) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0 || supplied.length === 0) {
    return [0, "insufficient_information"];
  }
  const requiredPresent = AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION.filter((s) => supplied.includes(s)).length;
  const contextPresent = AGENTIC_INTERACTION_TRUST_HELPFUL_CONTEXT.filter((s) => supplied.includes(s)).length;
  const score = Math.min(
    100,
    Math.round(
      10 +
        (requiredPresent / AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION.length) * 70 +
        (contextPresent / AGENTIC_INTERACTION_TRUST_HELPFUL_CONTEXT.length) * 20
    )
  );
  if (score >= 85) return [score, "review_ready"];
  if (score >= 50) return [score, "partial"];
  return [score, "not_decision_ready"];
}

function agenticTrustSignal(request, supplied, missing) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0) return "unknown";
  if (supplied.includes("fraud_or_account_takeover_signal")) return "low";
  if (supplied.includes("rate_limit_or_abuse_signal") && missing.length >= 4) return "unknown";
  if (missing.length >= 5) return "unknown";
  if (missing.length >= 3) return "medium";
  if (missing.length > 0) return "medium_high";
  return "high";
}

function agenticTriageRecommendation(request, supplied, missing) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0) return "insufficient_information";
  if (supplied.includes("fraud_or_account_takeover_signal")) return "block_until_verified";
  if (missing.length === 0) return "allow_low_risk";
  if (["checkout", "auth_flow", "account"].includes(request.target_surface) && missing.length <= 4) {
    return "require_step_up";
  }
  if (
    ["a2a_endpoint", "mcp_tool"].includes(request.target_surface) ||
    supplied.includes("rate_limit_or_abuse_signal")
  ) {
    return "escalate_to_human_review";
  }
  if (["policy_review", "committee_review"].includes(request.decision_stage)) return "not_decision_ready";
  return "escalate_to_human_review";
}

function agenticTopRiskDimensions(request, supplied, missing) {
  const dims = [];
  if (missing.includes("operator_or_principal_authorization")) {
    dims.push("delegated action authority is not evidenced");
  }
  if (missing.includes("agent_card_or_manifest")) dims.push("agent identity is declared but not independently anchored");
  if (missing.includes("tool_scope_or_permission_evidence")) dims.push("requested tool or action scope is not evidenced");
  if (missing.includes("action_intent_evidence")) dims.push("action intent is not evidenced");
  if (request.target_surface === "checkout") dims.push("checkout action may need step-up before completion");
  if (["a2a_endpoint", "mcp_tool"].includes(request.target_surface)) {
    dims.push("agent endpoint invocation requires capability-scope review");
  }
  if (supplied.includes("rate_limit_or_abuse_signal")) {
    dims.push("abuse or burst pattern requires review before continued access");
  }
  if (supplied.includes("fraud_or_account_takeover_signal")) {
    dims.push("fraud or account-takeover signal requires verification before action");
  }
  return Array.from(new Set(dims));
}

function agenticInteractionTrustResult(request) {
  const supplied = suppliedSourceTypes(request);
  const missing = AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION.filter((s) => !supplied.includes(s));
  const [score, label] = agenticDecisionReadiness(request, supplied);
  const response = {
    triage_recommendation: agenticTriageRecommendation(request, supplied, missing),
    trust_signal: agenticTrustSignal(request, supplied, missing),
    decision_readiness_score: score,
    decision_readiness_label: label,
    actor: request.actor,
    target_surface: request.target_surface,
    requested_action: request.requested_action,
    supplied_sources: supplied,
    minimum_sources_before_action: missing,
    evidence_gaps: missing.map(agenticEvidenceGapForSource),
    top_risk_dimensions: agenticTopRiskDimensions(request, supplied, missing),
    watch_next: [
      "agent identity spoofing pattern",
      "unexpected tool-scope expansion",
      "checkout or transaction anomaly",
      "account takeover signal",
      "rate-limit or scraping burst",
      "provider allowlist or policy change",
      "mcp or a2a endpoint metadata change",
      "credential leakage or secret exposure report"
    ],
    human_review_required: true,
    not_advice_notice: AGENTIC_TRUST_NOT_ADVICE_NOTICE,
    limitations: [
      "This response does not verify the identity of the actor, operator, or principal.",
      "This response does not authorize, approve, deny, or block the requested action."
    ]
  };
  if (request.asset_or_resource) response.asset_or_resource = request.asset_or_resource;
  return { response };
}

function agenticArtifactText(response) {
  const missing = response.minimum_sources_before_action || [];
  const missingText = missing.length ? missing.map((s) => `- ${s}`).join("\n") : "- none";
  const dims = response.top_risk_dimensions || [];
  const dimsText = dims.length ? dims.map((s) => `- ${s}`).join("\n") : "- none";
  return [
    "Agentic interaction trust gate response",
    "",
    `Recommendation: ${response.triage_recommendation}`,
    `Trust signal: ${response.trust_signal}`,
    `Decision readiness: ${response.decision_readiness_score}/100 (${response.decision_readiness_label})`,
    `Target surface: ${response.target_surface}`,
    `Human review required: ${String(response.human_review_required)}`,
    "",
    "Top risk dimensions:",
    dimsText,
    "",
    "Minimum sources before action:",
    missingText,
    "",
    response.not_advice_notice
  ].join("\n");
}

function a2aResultForAgenticInteractionTrust(params) {
  const structured = structuredAgenticInteractionTrustRequestFromParams(params);
  if (!structured) {
    return {
      id: crypto.randomUUID(),
      status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() },
      artifacts: [],
      metadata: {
        product_profile: "agentic_interaction_trust",
        canonical_http_endpoint: "/v1/agentic-interaction/trust",
        schema: "schemas/v1/agentic-interaction-trust-request.schema.json",
        valid: false,
        errors: ["Missing structured agentic interaction trust request"]
      }
    };
  }
  const enumErrors = agenticEnumErrors(structured);
  if (enumErrors.length) {
    return invalidRequestResult(
      "agentic_interaction_trust",
      "/v1/agentic-interaction/trust",
      "schemas/v1/agentic-interaction-trust-request.schema.json",
      enumErrors
    );
  }
  const result = agenticInteractionTrustResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "agentic-interaction-trust-response",
        name: "Agentic interaction trust response",
        parts: [
          {
            text: agenticArtifactText(result.response),
            mediaType: "text/markdown"
          },
          {
            data: result.response,
            mediaType: "application/json"
          }
        ]
      }
    ],
    metadata: {
      product_profile: "agentic_interaction_trust",
      canonical_http_endpoint: "/v1/agentic-interaction/trust",
      schema: "schemas/v1/agentic-interaction-trust-request.schema.json",
      human_review_required: result.response.human_review_required,
      not_advice_notice: result.response.not_advice_notice,
      response: result.response
    }
  };
}

const GULF_NOT_ADVICE_NOTICE =
  "Maritime sanctions and chokepoint-disruption evidence triage only. Not legal, sanctions, compliance, " +
  "financial, investment, insurance, or trading advice. Does not resolve vessel ownership or verify identity.";

const GULF_CHOKEPOINTS = [
  "strait_of_hormuz", "persian_gulf", "gulf_of_oman", "bab_el_mandeb", "red_sea", "suez_canal", "other"
];
const GULF_DECISION_STAGES = [
  "pre_fixture", "pre_voyage", "pre_port_call", "post_alert", "committee_review", "other"
];
const GULF_EXPOSURE_FACETS = [
  "iran_oil_exposure", "russia_oil_price_cap", "dark_fleet_indicators", "sts_transfer", "flag_hopping",
  "insurance_or_pi_gap", "ais_manipulation", "ownership_or_control", "dual_use_cargo", "chokepoint_disruption"
];
const GULF_SOURCE_TYPES = [
  "vessel_registry_extract", "flag_registry_record", "pi_insurance_certificate", "ais_track_record",
  "sts_transfer_evidence", "ownership_or_control_evidence", "sanctions_list_extract", "cargo_or_bl_evidence",
  "classification_society_record", "port_state_control_record", "charterer_kyc_evidence",
  "adverse_media_evidence", "prior_incident_or_detention", "price_cap_attestation_or_recordkeeping",
  "human_review_note", "user_provided_note", "other"
];

const GULF_CHOKEPOINT_WATCH = {
  strait_of_hormuz: [
    "Strait of Hormuz transit advisory or security incident",
    "Iran IRGC interdiction or detention report"
  ],
  persian_gulf: ["Persian/Arabian Gulf security incident or escalation notice"],
  gulf_of_oman: ["Gulf of Oman ship-to-ship-area attack or seizure report"],
  bab_el_mandeb: ["Bab-el-Mandeb attack or transit-advisory notice"],
  red_sea: ["Red Sea attack, rerouting notice, or Cape-of-Good-Hope diversion update"],
  suez_canal: ["Suez Canal transit disruption or rerouting notice"]
};

function gulfEnumErrors(r) {
  const errors = [];
  const voyage = r.voyage && typeof r.voyage === "object" ? r.voyage : {};
  offEnum("voyage.chokepoint", voyage.chokepoint, GULF_CHOKEPOINTS, errors);
  offEnum("exposure_facets", r.exposure_facets, GULF_EXPOSURE_FACETS, errors);
  offEnum("decision_stage", r.decision_stage, GULF_DECISION_STAGES, errors);
  offEnum("requested_output", r.requested_output, REQUESTED_OUTPUTS, errors);
  for (const s of Array.isArray(r.dated_sources) ? r.dated_sources : []) {
    if (s && typeof s === "object") offEnum("dated_sources[].source_type", s.source_type, GULF_SOURCE_TYPES, errors);
  }
  return errors;
}

function isGulfMaritimeRequest(value) {
  return (
    value &&
    typeof value === "object" &&
    value.voyage &&
    typeof value.voyage === "object" &&
    Array.isArray(value.exposure_facets) &&
    Array.isArray(value.dated_sources) &&
    typeof value.risk_question === "string" &&
    typeof value.decision_stage === "string"
  );
}

function structuredGulfMaritimeRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [
    params.request,
    params.gulf_maritime_request,
    params.gulf_maritime_exposure_request,
    params.input,
    params
  ];
  const message = params.message;
  if (message && typeof message === "object") {
    if (message.data && typeof message.data === "object") candidates.push(message.data);
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (!part || typeof part !== "object") continue;
        candidates.push(part.data, part.json, part.content);
        const parsed = tryParseJsonObject(part.text);
        if (parsed) candidates.push(parsed);
      }
    }
  }
  for (const candidate of candidates) {
    if (isGulfMaritimeRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isGulfMaritimeRequest(parsed)) return parsed;
  }
  return null;
}

function gulfEvidenceGapForSource(sourceType) {
  const gaps = {
    vessel_registry_extract: "No vessel registry extract supplied.",
    flag_registry_record: "No flag registry record supplied.",
    pi_insurance_certificate: "No P&I insurance certificate supplied.",
    ais_track_record: "No AIS track record supplied.",
    sts_transfer_evidence: "No ship-to-ship transfer evidence supplied.",
    ownership_or_control_evidence: "No ownership or control evidence supplied.",
    sanctions_list_extract: "No sanctions list extract supplied.",
    cargo_or_bl_evidence: "No cargo or bill-of-lading evidence supplied.",
    classification_society_record: "No classification society record supplied.",
    port_state_control_record: "No port state control record supplied.",
    charterer_kyc_evidence: "No charterer KYC evidence supplied.",
    adverse_media_evidence: "No adverse media evidence supplied.",
    prior_incident_or_detention: "No prior incident or detention record supplied.",
    price_cap_attestation_or_recordkeeping:
      "No price-cap attestation or itemized ancillary-cost recordkeeping supplied."
  };
  return gaps[sourceType] || `No ${sourceType} supplied.`;
}

function gulfDecisionReadiness(request, supplied) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0 || supplied.length === 0) {
    return [0, "insufficient_information"];
  }
  const requiredPresent = GULF_MARITIME_REQUIRED_BEFORE_REVIEW.filter((s) => supplied.includes(s)).length;
  const contextPresent = GULF_MARITIME_HELPFUL_CONTEXT.filter((s) => supplied.includes(s)).length;
  const score = Math.min(
    100,
    Math.round(
      10 +
        (requiredPresent / GULF_MARITIME_REQUIRED_BEFORE_REVIEW.length) * 70 +
        (contextPresent / GULF_MARITIME_HELPFUL_CONTEXT.length) * 20
    )
  );
  if (score >= 85) return [score, "review_ready"];
  if (score >= 50) return [score, "partial"];
  return [score, "not_decision_ready"];
}

function gulfExposureSignal(request, missing) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0) return "unknown";
  const facets = Array.isArray(request.exposure_facets) ? request.exposure_facets : [];
  const highRisk = ["iran_oil_exposure", "russia_oil_price_cap", "dark_fleet_indicators", "ais_manipulation"];
  if (missing.includes("sanctions_list_extract") && facets.some((f) => highRisk.includes(f))) return "high";
  if (missing.length >= 4) return "medium_high";
  if (missing.length > 0) return "medium";
  return "low";
}

function gulfTriageRecommendation(request, missing, exposureSignal) {
  if (!Array.isArray(request.dated_sources) || request.dated_sources.length === 0) return "insufficient_information";
  if (missing.length === 0 && exposureSignal === "low") return "ready_for_human_review";
  if (request.decision_stage === "pre_fixture") return "escalate_before_fixture";
  if (["pre_voyage", "pre_port_call"].includes(request.decision_stage)) return "escalate_before_voyage";
  return "not_decision_ready";
}

function gulfTopExposureDimensions(facets, missing, supplied) {
  const map = {
    iran_oil_exposure: "Iran-origin oil sanctions exposure (OFAC / EU)",
    russia_oil_price_cap: "Russia oil price-cap / attestation exposure",
    dark_fleet_indicators: "dark-fleet indicators (aged tanker, opaque ownership, no mainstream P&I)",
    sts_transfer: "ship-to-ship transfer concealment exposure",
    flag_hopping: "flag-hopping or convenience-flag exposure",
    insurance_or_pi_gap: "insurance or P&I cover gap",
    ais_manipulation: "AIS gap, spoofing, or manipulation exposure",
    ownership_or_control: "indirect ownership or control exposure",
    dual_use_cargo: "dual-use cargo diversion exposure",
    chokepoint_disruption: "chokepoint security or disruption exposure"
  };
  const dims = [];
  for (const f of facets) if (map[f]) dims.push(map[f]);
  if (missing.includes("ownership_or_control_evidence")) dims.push("vessel ownership or control not yet documented");
  if (missing.includes("pi_insurance_certificate")) dims.push("P&I cover not yet confirmed");
  if (facets.includes("russia_oil_price_cap") && !(supplied || []).includes("price_cap_attestation_or_recordkeeping")) {
    dims.push(
      "per-loading price-cap attestation and itemized ancillary-cost recordkeeping " +
        "not yet evidenced (OFAC tiered safe-harbor)"
    );
  }
  return Array.from(new Set(dims));
}

function gulfChokepointDisruptionWatch(request) {
  const voyage = request.voyage && typeof request.voyage === "object" ? request.voyage : {};
  const watch = (GULF_CHOKEPOINT_WATCH[voyage.chokepoint] || []).slice();
  watch.push("war-risk premium or underwriter advisory change for the transit area");
  return watch;
}

function gulfMaritimeExposureResult(request) {
  const supplied = suppliedSourceTypes(request);
  const missing = GULF_MARITIME_REQUIRED_BEFORE_REVIEW.filter((s) => !supplied.includes(s));
  const [score, label] = gulfDecisionReadiness(request, supplied);
  const exposureSignal = gulfExposureSignal(request, missing);
  const facets = Array.isArray(request.exposure_facets) ? request.exposure_facets : [];
  const watchNext = [
    "new OFAC vessel or entity designation",
    "new EU or UK OFSI shipping-related listing",
    "P&I club cover withdrawal or confirmation change",
    "flag-registry deregistration or flag-hopping report",
    "AIS gap, spoofing, or dark-activity report on the vessel"
  ];
  if (facets.includes("russia_oil_price_cap")) {
    watchNext.push("price-cap attestation refusal, withdrawal, or itemized ancillary-cost gap");
  }
  const response = {
    triage_recommendation: gulfTriageRecommendation(request, missing, exposureSignal),
    exposure_signal: exposureSignal,
    decision_readiness_score: score,
    decision_readiness_label: label,
    voyage: request.voyage,
    exposure_facets: facets,
    supplied_sources: supplied,
    minimum_sources_before_review: missing,
    evidence_gaps: missing.map(gulfEvidenceGapForSource),
    top_exposure_dimensions: gulfTopExposureDimensions(facets, missing, supplied),
    chokepoint_disruption_watch: gulfChokepointDisruptionWatch(request),
    watch_next: watchNext,
    human_review_required: true,
    not_advice_notice: GULF_NOT_ADVICE_NOTICE,
    limitations: [
      "Triage is based on caller-supplied evidence only; this service does not retrieve sources, " +
        "resolve vessel ownership, or verify vessel identity.",
      "A name match against a sanctions list is not legal-entity or vessel-identity verification. " +
        "Human review is required."
    ]
  };
  if (request.vessel) response.vessel = request.vessel;
  if (request.cargo) response.cargo = request.cargo;
  return { response };
}

function gulfArtifactText(response) {
  const missing = response.minimum_sources_before_review || [];
  const missingText = missing.length ? missing.map((s) => `- ${s}`).join("\n") : "- none";
  const dims = response.top_exposure_dimensions || [];
  const dimsText = dims.length ? dims.map((s) => `- ${s}`).join("\n") : "- none";
  const watch = response.chokepoint_disruption_watch || [];
  const watchText = watch.length ? watch.map((s) => `- ${s}`).join("\n") : "- none";
  return [
    "Gulf maritime exposure response",
    "",
    `Recommendation: ${response.triage_recommendation}`,
    `Exposure signal: ${response.exposure_signal}`,
    `Decision readiness: ${response.decision_readiness_score}/100 (${response.decision_readiness_label})`,
    `Human review required: ${String(response.human_review_required)}`,
    "",
    "Top exposure dimensions:",
    dimsText,
    "",
    "Minimum sources before review:",
    missingText,
    "",
    "Chokepoint disruption watch:",
    watchText,
    "",
    response.not_advice_notice
  ].join("\n");
}

function a2aResultForGulfMaritimeExposure(params) {
  const structured = structuredGulfMaritimeRequestFromParams(params);
  if (!structured) {
    return invalidRequestResult(
      "gulf_maritime_exposure",
      "/v1/gulf-maritime/exposure",
      "schemas/v1/gulf-maritime-exposure-request.schema.json",
      ["Missing structured Gulf maritime exposure request"]
    );
  }
  const enumErrors = gulfEnumErrors(structured);
  if (enumErrors.length) {
    return invalidRequestResult(
      "gulf_maritime_exposure",
      "/v1/gulf-maritime/exposure",
      "schemas/v1/gulf-maritime-exposure-request.schema.json",
      enumErrors
    );
  }
  const result = gulfMaritimeExposureResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "gulf-maritime-exposure-response",
        name: "Gulf maritime exposure response",
        parts: [
          { text: gulfArtifactText(result.response), mediaType: "text/markdown" },
          { data: result.response, mediaType: "application/json" }
        ]
      }
    ],
    metadata: {
      product_profile: "gulf_maritime_exposure",
      canonical_http_endpoint: "/v1/gulf-maritime/exposure",
      schema: "schemas/v1/gulf-maritime-exposure-request.schema.json",
      human_review_required: result.response.human_review_required,
      not_advice_notice: result.response.not_advice_notice,
      response: result.response
    }
  };
}

// ---------------------------------------------------------------------------
// Kazakhstan market-entry readiness gate (fifth vertical worker)
// JS parity of services.kazakhstan_market_entry_readiness. No live retrieval.
// run_provenance is intentionally omitted here (deferred, like the other
// workers' worker-side provenance); the response schema makes it optional.
// ---------------------------------------------------------------------------

const MARKET_ENTRY_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/kazakhstan-market-entry-readiness.md`;
const MARKET_ENTRY_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/market-entry-readiness-request.schema.json`;
const MARKET_ENTRY_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/market-entry-readiness-response.schema.json`;
const MARKET_ENTRY_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/kazakhstan-market-entry-readiness.json`;

const MARKET_ENTRY_BOUNDARY_NOTICE =
  "Internal evidence triage only. Not legal, compliance, customs, tax, financial, investment, " +
  "insurance, sanctions, or launch-authorization advice.";

const MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION = [
  "partner_company_profile",
  "product_or_project_description",
  "commercial_objective",
  "kazakhstan_use_case",
  "initial_source_links_or_documents"
];
const MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE = [
  "law_firm_opinion",
  "counterparty_registry_extract",
  "beneficial_ownership_source",
  "counterparty_integrity_due_diligence",
  "bank_account_and_kyc_onboarding",
  "business_substance_evidence",
  "authority_to_sign_evidence",
  "contract_or_term_sheet_draft",
  "tax_accounting_note",
  "permanent_establishment_or_tax_residency_assessment",
  "currency_control_and_repatriation_note",
  "work_permit_and_local_employment_quota_note"
];
const MARKET_ENTRY_REQUIRED_BEFORE_IMPORT = [
  "customs_broker_memo",
  "hs_code_classification",
  "certification_pathway",
  "packing_list_and_incoterms",
  "battery_safety_documents",
  "freight_forwarder_quote",
  "insurance_or_cargo_handling_note",
  "landed_cost_model",
  "supplier_moq_payment_terms"
];
const MARKET_ENTRY_REQUIRED_BEFORE_SHOWROOM = [
  "showroom_lease_offer",
  "showroom_opex_model",
  "outdoor_advertising_quote",
  "localized_customer_materials",
  "warranty_policy",
  "service_partner_confirmation",
  "spare_parts_price_list",
  "demo_unit_plan",
  "test_ride_or_pilot_safety_process",
  "trademark_or_brand_protection_filing",
  "data_localization_and_privacy_note"
];
const MARKET_ENTRY_REQUIRED_BEFORE_DEALER = [
  "dealer_interview_notes",
  "fleet_customer_validation",
  "dealer_margin_model",
  "fleet_tco_model",
  "financing_or_leasing_partner_note",
  "service_sla_draft",
  "regional_expansion_assumption_register"
];
const MARKET_ENTRY_WATCH_INDICATORS = [
  "customs rule change",
  "certification requirement change",
  "tax or VAT treatment change",
  "permanent-establishment or tax-residency rule change",
  "currency-control or profit-repatriation rule change",
  "foreign-worker quota or local-employment ratio change",
  "local-content or procurement-localization rule change",
  "third-party trademark filing or brand-squatting signal",
  "personal-data localization or privacy rule change",
  "anti-corruption enforcement or third-party due-diligence expectation change",
  "bank KYC or account-opening tightening for foreign-owned entities",
  "lease availability or rent change",
  "freight rate change",
  "battery handling or insurance constraint",
  "supplier price or MOQ change",
  "partner commitment change",
  "dealer or fleet demand signal",
  "service capacity bottleneck",
  "public announcement risk",
  "government or regulator signal"
];

const MARKET_ENTRY_COMMITMENT_STAGES = [
  "pre_entity_setup",
  "pre_signature",
  "pre_import",
  "pre_certification",
  "pre_showroom_lease",
  "pre_first_batch_order",
  "pre_ad_spend",
  "pre_dealer_contract",
  "committee_review"
];

const MARKET_ENTRY_SECTORS = [
  "mobility",
  "renewable_energy",
  "epc",
  "infrastructure",
  "data_center",
  "technology_transfer",
  "distribution",
  "real_estate_or_land",
  "other"
];
const MARKET_ENTRY_DECISION_STAGES = [
  "concept_review",
  "pre_entity_setup",
  "pre_signature",
  "pre_import",
  "pre_certification",
  "pre_showroom_lease",
  "pre_first_batch_order",
  "pre_ad_spend",
  "pre_dealer_contract",
  "committee_review",
  "other"
];
const MARKET_ENTRY_COUNTERPARTY_ROLES = [
  "supplier",
  "distributor",
  "dealer",
  "customer",
  "bank",
  "law_firm",
  "customs_broker",
  "freight_forwarder",
  "certification_advisor",
  "realtor",
  "advertising_agency",
  "service_partner",
  "government_stakeholder",
  "investor",
  "other"
];
const MARKET_ENTRY_SOURCE_TYPES = [
  ...MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION,
  ...MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE,
  ...MARKET_ENTRY_REQUIRED_BEFORE_IMPORT,
  ...MARKET_ENTRY_REQUIRED_BEFORE_SHOWROOM,
  ...MARKET_ENTRY_REQUIRED_BEFORE_DEALER,
  "market_size_source",
  "competitor_scan",
  "pricing_benchmark",
  "customer_interview_notes",
  "government_or_akimat_note",
  "local_content_or_procurement_localization_note",
  "special_economic_zone_eligibility_note",
  "bankability_note",
  "sdg_or_sustainability_mapping",
  "project_timeline",
  "risk_register",
  "decision_log",
  "grid_connection_and_offtake_evidence",
  "land_or_site_control_evidence",
  "ip_ownership_and_licensing_evidence",
  "export_control_classification_note",
  "user_provided_note",
  "other"
];

const MARKET_ENTRY_STAGE_TIER = {
  concept_review: MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION,
  pre_entity_setup: MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE,
  pre_signature: MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE,
  committee_review: MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE,
  pre_import: MARKET_ENTRY_REQUIRED_BEFORE_IMPORT,
  pre_certification: MARKET_ENTRY_REQUIRED_BEFORE_IMPORT,
  pre_first_batch_order: MARKET_ENTRY_REQUIRED_BEFORE_IMPORT,
  pre_showroom_lease: MARKET_ENTRY_REQUIRED_BEFORE_SHOWROOM,
  pre_ad_spend: MARKET_ENTRY_REQUIRED_BEFORE_SHOWROOM,
  pre_dealer_contract: MARKET_ENTRY_REQUIRED_BEFORE_DEALER,
  other: MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE
};

// JS parity of taxonomy.tier_watch_indicators / sector_* maps. Keyed by the same
// taxonomy tier-key strings as the Python service so watch_next output matches.
const MARKET_ENTRY_TIER_BY_KEY = {
  required_before_validation: MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION,
  required_before_signature: MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE,
  required_before_import_or_first_batch: MARKET_ENTRY_REQUIRED_BEFORE_IMPORT,
  required_before_showroom_or_public_launch: MARKET_ENTRY_REQUIRED_BEFORE_SHOWROOM,
  required_before_dealer_or_fleet_expansion: MARKET_ENTRY_REQUIRED_BEFORE_DEALER
};
const MARKET_ENTRY_STAGE_TIER_KEY = {
  concept_review: "required_before_validation",
  pre_entity_setup: "required_before_signature",
  pre_signature: "required_before_signature",
  committee_review: "required_before_signature",
  pre_import: "required_before_import_or_first_batch",
  pre_certification: "required_before_import_or_first_batch",
  pre_first_batch_order: "required_before_import_or_first_batch",
  pre_showroom_lease: "required_before_showroom_or_public_launch",
  pre_ad_spend: "required_before_showroom_or_public_launch",
  pre_dealer_contract: "required_before_dealer_or_fleet_expansion",
  other: "required_before_signature"
};

// Sector-specific required evidence beyond the universal validation/signature
// tiers. Folded into the launch-commitment ceiling and the gap list so the
// advertised sector breadth is real, not cosmetic.
const MARKET_ENTRY_SECTOR_REQUIREMENTS = {
  mobility: ["certification_pathway", "service_partner_confirmation", "spare_parts_price_list"],
  renewable_energy: [
    "grid_connection_and_offtake_evidence",
    "land_or_site_control_evidence",
    "bankability_note",
    "local_content_or_procurement_localization_note"
  ],
  epc: [
    "land_or_site_control_evidence",
    "local_content_or_procurement_localization_note",
    "project_timeline",
    "risk_register"
  ],
  infrastructure: [
    "land_or_site_control_evidence",
    "local_content_or_procurement_localization_note",
    "government_or_akimat_note",
    "project_timeline"
  ],
  data_center: [
    "grid_connection_and_offtake_evidence",
    "land_or_site_control_evidence",
    "data_localization_and_privacy_note",
    "special_economic_zone_eligibility_note"
  ],
  technology_transfer: [
    "ip_ownership_and_licensing_evidence",
    "export_control_classification_note",
    "trademark_or_brand_protection_filing"
  ],
  distribution: ["customs_broker_memo", "certification_pathway", "landed_cost_model"],
  real_estate_or_land: ["land_or_site_control_evidence", "government_or_akimat_note"],
  other: []
};
const MARKET_ENTRY_SECTOR_WATCH = {
  mobility: ["certification requirement change", "battery handling or insurance constraint", "service capacity bottleneck"],
  renewable_energy: [
    "auction or PPA tariff change",
    "grid-connection queue or curtailment change",
    "bankability or lender-appetite change"
  ],
  epc: [
    "public-procurement or tender-term change",
    "cost-escalation or FX exposure change",
    "local-content or procurement-localization rule change"
  ],
  infrastructure: ["concession or PPP framework change", "local-content or procurement-localization rule change"],
  data_center: [
    "power availability or tariff change",
    "personal-data localization or privacy rule change",
    "special-economic-zone eligibility change"
  ],
  technology_transfer: [
    "export-control or dual-use classification change",
    "IP registration or enforcement change",
    "third-party trademark filing or brand-squatting signal"
  ],
  distribution: ["customs rule change", "certification requirement change", "supplier price or MOQ change"],
  real_estate_or_land: ["land-use or zoning rule change", "lease availability or rent change"],
  other: []
};
const MARKET_ENTRY_TIER_WATCH = {
  required_before_validation: ["partner commitment change"],
  required_before_signature: [
    "bank KYC or account-opening tightening for foreign-owned entities",
    "tax or VAT treatment change",
    "currency-control or profit-repatriation rule change",
    "anti-corruption enforcement or third-party due-diligence expectation change"
  ],
  required_before_import_or_first_batch: ["customs rule change", "freight rate change", "supplier price or MOQ change"],
  required_before_showroom_or_public_launch: ["lease availability or rent change", "service capacity bottleneck"],
  required_before_dealer_or_fleet_expansion: ["dealer or fleet demand signal"]
};

const MARKET_ENTRY_EVIDENCE_GAP_DETAILS = {
  law_firm_opinion: {
    evidence_needed:
      "Written recommendation on branch, representative office, LLP, distributor, importer, or dealer structure.",
    why_it_matters: "The legal form affects sales, import, service, tax, contracting, and liability.",
    owner: "Kazakhstan legal counsel",
    next_action: "Request a short legal-structure memo.",
    decision_blocked: "Signature or entity setup."
  },
  counterparty_registry_extract: {
    evidence_needed: "Current registry extract for the partner and any local counterparty (status, directors, address).",
    why_it_matters: "A live registry extract confirms the counterparty exists and who can bind it before any contract.",
    owner: "Legal counsel",
    next_action: "Pull a fresh registry extract for each named counterparty.",
    decision_blocked: "Partner appointment and signature."
  },
  beneficial_ownership_source: {
    evidence_needed: "Beneficial-ownership record showing who ultimately owns and controls the counterparty.",
    why_it_matters: "Ownership drives integrity, sanctions, and conflict exposure; an unknown UBO is an unmanaged risk.",
    owner: "Compliance / legal counsel",
    next_action: "Obtain a UBO declaration or registry source for each counterparty.",
    decision_blocked: "Partner appointment and signature."
  },
  counterparty_integrity_due_diligence: {
    evidence_needed:
      "Integrity / anti-corruption due diligence on the distributor, agents, and any government-facing " +
      "intermediaries (ownership, embedded officials, adverse media, sanctions and PEP screening).",
    why_it_matters:
      "Under FCPA / UK Bribery Act the foreign parent can be liable for an intermediary's conduct; engaging " +
      "a partner who touches customs, certification, or akimat without integrity DD is an unmanaged exposure.",
    owner: "Compliance / legal counsel",
    next_action: "Run integrity DD before appointing or contracting any local partner or agent.",
    decision_blocked: "Partner appointment and signature."
  },
  bank_account_and_kyc_onboarding: {
    evidence_needed:
      "Bank-account opening readiness: full UBO pack (apostilled), source-of-funds and expected-turnover " +
      "statement, and the presence / timeline the chosen bank requires.",
    why_it_matters:
      "Account opening for a foreign-owned entity is document-heavy and slow; until it clears, the entity " +
      "cannot pay suppliers or receive revenue.",
    owner: "Finance lead",
    next_action: "Confirm the bank's KYC checklist and start onboarding in parallel with entity setup.",
    decision_blocked: "Supplier payment and revenue collection."
  },
  business_substance_evidence: {
    evidence_needed:
      "Evidence the entry vehicle has real substance (office, staff, local decision-making) appropriate to " +
      "the chosen model.",
    why_it_matters: "Thin substance undermines tax treatment, banking onboarding, and counterparty trust.",
    owner: "Operations lead",
    next_action: "Document the planned substance for the chosen entry model.",
    decision_blocked: "Entity model choice and signature."
  },
  authority_to_sign_evidence: {
    evidence_needed: "Evidence that the individual signing for each counterparty has authority to bind it.",
    why_it_matters: "A contract signed without authority is unenforceable and a fraud vector.",
    owner: "Legal counsel",
    next_action: "Collect powers of attorney or board authorizations for the signatories.",
    decision_blocked: "Signature."
  },
  contract_or_term_sheet_draft: {
    evidence_needed: "Draft contract or term sheet covering scope, pricing, territory, exclusivity, term, and exit.",
    why_it_matters: "Commercial terms must be on paper before signature so they can be reviewed and negotiated.",
    owner: "Commercial lead / legal counsel",
    next_action: "Produce a term sheet or draft contract for review.",
    decision_blocked: "Signature."
  },
  tax_accounting_note: {
    evidence_needed: "Note on VAT, corporate tax, withholding, and accounting treatment for the chosen entry model.",
    why_it_matters: "Tax and accounting treatment change the real cost and reporting load of the entry model.",
    owner: "Tax advisor",
    next_action: "Request a tax and accounting memo for each candidate entry model.",
    decision_blocked: "Entity model choice and signature."
  },
  permanent_establishment_or_tax_residency_assessment: {
    evidence_needed:
      "Assessment of whether the chosen entry model (branch, representative office, LLP, or direct " +
      "contracting) creates a taxable permanent establishment or resident status.",
    why_it_matters:
      "Permanent-establishment and residency treatment drive tax registration, reporting load, and the " +
      "real cost of the entry model.",
    owner: "Tax advisor",
    next_action: "Request a permanent-establishment and tax-residency memo for each candidate entry model.",
    decision_blocked: "Entity model choice and signature."
  },
  currency_control_and_repatriation_note: {
    evidence_needed:
      "Note on currency-contract registration thresholds, repatriation reporting, and how supplier payments " +
      "and profit repatriation will clear local banks.",
    why_it_matters:
      "Currency-control registration and repatriation reporting affect how, and how quickly, money can move " +
      "in and out after commitment.",
    owner: "Treasury / banking advisor",
    next_action: "Confirm currency-contract registration and repatriation steps with the servicing bank.",
    decision_blocked: "Cross-border payment and profit-repatriation planning."
  },
  work_permit_and_local_employment_quota_note: {
    evidence_needed:
      "Note on work-permit requirements and local-employment ratio / quota obligations for the planned " +
      "expatriate and local headcount.",
    why_it_matters: "Foreign-worker quotas and local-employment ratios constrain who can be deployed and when.",
    owner: "HR / legal counsel",
    next_action: "Confirm work-permit and local-employment quota requirements for the staffing plan.",
    decision_blocked: "Staffing and entity operation."
  },
  grid_connection_and_offtake_evidence: {
    evidence_needed:
      "Grid-connection study or technical conditions plus the offtake or power-purchase basis (PPA term " +
      "sheet, settlement route, or anchor-customer load commitment).",
    why_it_matters:
      "Without a connection path and a buyer for the output, the project's revenue and bankability are " +
      "unproven and any commitment is premature.",
    owner: "Project / technical lead",
    next_action: "Obtain the grid-connection conditions and the offtake or PPA basis before any binding step.",
    decision_blocked: "Investment commitment and signature."
  },
  land_or_site_control_evidence: {
    evidence_needed:
      "Evidence of site control: land lease, allocation decision, or ownership for the project footprint, " +
      "with zoning / land-use suitability.",
    why_it_matters: "A project without secured, correctly-zoned land cannot be built, financed, or committed to.",
    owner: "Project lead / legal counsel",
    next_action: "Secure and document land or site control with a zoning suitability check.",
    decision_blocked: "Investment commitment and signature."
  },
  ip_ownership_and_licensing_evidence: {
    evidence_needed:
      "Evidence of who owns the transferred technology and on what licensing terms, with freedom-to-operate " +
      "and any third-party or background-IP constraints.",
    why_it_matters:
      "Transferring or licensing technology without clear ownership and freedom to operate exposes both " +
      "sides to infringement and enforceability disputes.",
    owner: "IP counsel",
    next_action: "Confirm IP ownership, licensing scope, and freedom to operate before the transfer agreement.",
    decision_blocked: "Technology-transfer signature."
  },
  export_control_classification_note: {
    evidence_needed:
      "Classification of the technology against applicable export-control / dual-use regimes and whether a " +
      "license or authorization is required to transfer it to Kazakhstan.",
    why_it_matters:
      "Transferring controlled or dual-use technology without classification can breach export-control law " +
      "in the origin jurisdiction regardless of Kazakhstan-side approvals.",
    owner: "Export-control / trade counsel",
    next_action: "Classify the technology and confirm whether an export license is required before transfer.",
    decision_blocked: "Technology-transfer signature."
  }
};

const MARKET_ENTRY_SUMMARY = {
  insufficient_information:
    "Not enough has been supplied to assess Kazakhstan market-entry readiness; the gate cannot return a " +
    "meaningful decision yet.",
  concept_ready:
    "The concept is taking shape, but the validation-tier evidence is incomplete, so the file is not yet " +
    "ready for controlled validation.",
  validation_ready:
    "The concept is coherent enough for controlled validation, but it is not signature-, import-, lease-, " +
    "or launch-ready until the flagged legal, tax, banking, customs, certification, and operational gaps " +
    "are closed.",
  committee_review_ready:
    "Validation and signature-tier evidence are largely in place; the remaining operational gaps for this " +
    "stage should go to committee review before the binding commitment.",
  launch_commitment_ready:
    "The evidence pack covers the validation, signature, and stage-relevant operational tiers; route to " +
    "committee for the binding launch-commitment decision with human sign-off."
};

function marketEntrySuppliedTypes(request) {
  const types = [];
  for (const source of Array.isArray(request.supplied_sources) ? request.supplied_sources : []) {
    if (source && typeof source === "object" && typeof source.source_type === "string") {
      types.push(source.source_type);
    }
  }
  return Array.from(new Set(types));
}

function marketEntrySatisfied(request, supplied) {
  const satisfied = new Set(supplied);
  if (request.commercial_objective) satisfied.add("commercial_objective");
  if (request.market && request.decision_question) satisfied.add("kazakhstan_use_case");
  if (supplied.length) satisfied.add("initial_source_links_or_documents");
  return satisfied;
}

function marketEntryReadiness(satisfied, stageTier, sectorMissing) {
  const coreValidation = [
    "partner_company_profile",
    "product_or_project_description",
    "initial_source_links_or_documents",
    "commercial_objective"
  ];
  const corePresent = coreValidation.filter((s) => satisfied.has(s)).length;
  const validationMissing = MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION.filter((s) => !satisfied.has(s));
  const signatureMissing = MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE.filter((s) => !satisfied.has(s));
  const operationalMissing = stageTier.filter((s) => !satisfied.has(s));
  if (corePresent === 0) return "insufficient_information";
  if (validationMissing.length) return "concept_ready";
  if (signatureMissing.length) return "validation_ready";
  if (operationalMissing.length || (sectorMissing && sectorMissing.length)) return "committee_review_ready";
  return "launch_commitment_ready";
}

// JS parity of services._market_entry_watch_next: sector indicators + the
// indicators for tiers that still have gaps + one always-on regulator signal,
// de-duplicated in insertion order. Replaces the prior static 20-item dump.
function marketEntryWatchNext(sector, stageTierKey, satisfied) {
  const out = [];
  const add = (item) => {
    if (item && !out.includes(item)) out.push(item);
  };
  for (const item of MARKET_ENTRY_SECTOR_WATCH[sector] || []) add(item);
  const openTierKeys = [];
  for (const tierKey of ["required_before_validation", "required_before_signature", stageTierKey]) {
    if (openTierKeys.includes(tierKey)) continue;
    const tier = MARKET_ENTRY_TIER_BY_KEY[tierKey] || [];
    if (tier.some((s) => !satisfied.has(s))) openTierKeys.push(tierKey);
  }
  for (const tierKey of openTierKeys) {
    for (const item of MARKET_ENTRY_TIER_WATCH[tierKey] || []) add(item);
  }
  add("government or regulator signal");
  return out;
}

function marketEntryGateDecision(readiness, stage) {
  if (readiness === "insufficient_information") {
    return MARKET_ENTRY_COMMITMENT_STAGES.includes(stage) ? "stop" : "not_decision_ready";
  }
  if (readiness === "concept_ready") return "pause_for_evidence";
  if (readiness === "validation_ready") return "proceed_to_validation";
  return "escalate_before_signature";
}

function marketEntryEvidenceGap(sourceType) {
  const detail = MARKET_ENTRY_EVIDENCE_GAP_DETAILS[sourceType];
  const label = sourceType.replace(/_/g, " ");
  if (!detail) {
    return {
      source_type: sourceType,
      evidence_needed: `Supply the ${label} for this market-entry file.`,
      why_it_matters: `The ${label} is a required gate input that is not yet in the evidence pack.`,
      owner: "Project lead",
      next_action: `Request or produce the ${label}.`,
      decision_blocked: "Progression to the next market-entry commitment."
    };
  }
  return { source_type: sourceType, ...detail };
}

function marketEntryReadinessResult(request) {
  const stage = request.decision_stage;
  const sector = request.sector;
  const stageTier = MARKET_ENTRY_STAGE_TIER[stage] || MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE;
  const stageTierKey = MARKET_ENTRY_STAGE_TIER_KEY[stage] || "required_before_signature";
  const supplied = marketEntrySuppliedTypes(request);
  const satisfied = marketEntrySatisfied(request, supplied);
  const sectorRequired = MARKET_ENTRY_SECTOR_REQUIREMENTS[sector] || [];
  const sectorMissing = sectorRequired.filter((s) => !satisfied.has(s));
  const readinessLabel = marketEntryReadiness(satisfied, stageTier, sectorMissing);
  const gateDecision = marketEntryGateDecision(readinessLabel, stage);

  const gapSourceTypes = [];
  for (const tier of [MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION, MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE, stageTier]) {
    for (const sourceType of tier) {
      if (!satisfied.has(sourceType) && !gapSourceTypes.includes(sourceType)) gapSourceTypes.push(sourceType);
    }
  }
  for (const sourceType of sectorMissing) {
    if (!gapSourceTypes.includes(sourceType)) gapSourceTypes.push(sourceType);
  }
  const evidenceGaps = gapSourceTypes.map(marketEntryEvidenceGap);

  const confirmedFacts = [];
  if (satisfied.has("partner_company_profile")) confirmedFacts.push("A partner or company profile was supplied.");
  if (satisfied.has("product_or_project_description")) {
    confirmedFacts.push("A product or project description was supplied.");
  }
  confirmedFacts.push(`The decision is at ${stage.replace(/_/g, " ")} stage.`);
  if (Array.isArray(request.known_blockers) && request.known_blockers.length) {
    confirmedFacts.push("The caller has already named open blockers on the file.");
  }

  let assumptions = Array.isArray(request.known_assumptions) ? request.known_assumptions.slice() : [];
  if (!assumptions.length) {
    assumptions = [
      "Public cost benchmarks are not signed quotes.",
      "Supplier prices are not Kazakhstan landed costs.",
      "The final commercial structure depends on local legal, tax, customs, and operational review."
    ];
  }

  const readyToValidate = ["validation_ready", "committee_review_ready", "launch_commitment_ready"].includes(
    readinessLabel
  );
  const readyToCommit = readinessLabel === "launch_commitment_ready";
  const claimAudit = [
    {
      claim: "The project can move into controlled validation.",
      status: readyToValidate ? "supported" : "needs_professional_confirmation",
      how_to_use_now: readyToValidate
        ? "Use for advisor requests, quotes, and structured partner or customer interviews."
        : "Do not rely on this yet; close the validation-tier evidence first."
    },
    {
      claim: "The project is ready for launch commitment.",
      status: readyToCommit ? "supported" : "unsupported",
      how_to_use_now: readyToCommit
        ? "Route to committee for the binding decision with human sign-off."
        : "Do not use. Replace with the current readiness label until the evidence gaps are closed."
    }
  ];
  const blockers = Array.isArray(request.known_blockers) ? request.known_blockers : [];
  if (blockers.length) {
    claimAudit.push({
      claim: "The blockers the caller named on this file are resolved.",
      status: "unsupported",
      how_to_use_now:
        `Do not treat as resolved: the caller listed ${blockers.length} open blocker(s) ` +
        `(e.g. "${blockers[0]}"). Close each one and re-run the gate.`
    });
  }
  if (Array.isArray(request.known_assumptions) && request.known_assumptions.length) {
    claimAudit.push({
      claim: "The caller-supplied cost, price, and structure assumptions are decision-grade.",
      status: "assumption_only",
      how_to_use_now:
        "Treat the caller's assumptions as planning inputs only; confirm with signed quotes, " +
        "landed-cost models, and local legal / tax review before any commitment."
    });
  }

  const ownerActions = [
    {
      timeframe: "48_hours",
      owner: "Project lead",
      action: "Send the missing-evidence request to the partner and named advisors.",
      output: "Evidence-request pack and missing-document checklist."
    },
    {
      timeframe: "7_days",
      owner: "Project lead",
      action: "Collect the legal, tax, banking, customs, certification, and operational inputs the gate flagged.",
      output: "Gate evidence pack."
    },
    {
      timeframe: "30_days",
      owner: "Project lead",
      action: "Convert the validation evidence into a committee-ready entry decision memo.",
      output: "Committee-ready gate memo."
    }
  ];

  const response = {
    gate_decision: gateDecision,
    readiness_label: readinessLabel,
    human_review_required: true,
    summary: MARKET_ENTRY_SUMMARY[readinessLabel],
    confirmed_facts: confirmedFacts,
    assumptions,
    evidence_gaps: evidenceGaps,
    claim_audit: claimAudit,
    owner_actions: ownerActions,
    watch_next: marketEntryWatchNext(sector, stageTierKey, satisfied),
    boundary_notice: MARKET_ENTRY_BOUNDARY_NOTICE
  };
  if (readinessLabel !== "insufficient_information") {
    response.strongest_reason_to_proceed =
      "The Kazakhstan use case and commercial objective are specific enough to start advisor requests, " +
      "quote collection, and partner validation.";
  }
  if (evidenceGaps.length) {
    response.strongest_reason_to_pause =
      "The current evidence pack is not sufficient for signature, import, lease, first-batch order, " +
      "advertising spend, or partner appointment.";
    response.management_note =
      "The opportunity can move at the level of its readiness label, but should not move to launch " +
      "commitment until the flagged legal, customs, certification, landed-cost, service, lease, and " +
      "partner evidence gaps are closed.";
  }
  return { response };
}

function marketEntryArtifactText(response) {
  const gaps = response.evidence_gaps || [];
  const gapsText = gaps.length ? gaps.map((g) => `- ${g.source_type}: ${g.next_action}`).join("\n") : "- none";
  return [
    "Kazakhstan market-entry readiness gate response",
    "",
    `Gate decision: ${response.gate_decision}`,
    `Readiness label: ${response.readiness_label}`,
    `Human review required: ${String(response.human_review_required)}`,
    "",
    response.summary,
    "",
    "Evidence gaps:",
    gapsText,
    "",
    response.boundary_notice
  ].join("\n");
}

function marketEntryEnumErrors(r) {
  const errors = [];
  offEnum("sector", r.sector, MARKET_ENTRY_SECTORS, errors);
  offEnum("decision_stage", r.decision_stage, MARKET_ENTRY_DECISION_STAGES, errors);
  offEnum("requested_output", r.requested_output, REQUESTED_OUTPUTS, errors);
  for (const cp of Array.isArray(r.counterparties) ? r.counterparties : []) {
    if (cp && typeof cp === "object") offEnum("counterparties[].role", cp.role, MARKET_ENTRY_COUNTERPARTY_ROLES, errors);
  }
  for (const s of Array.isArray(r.supplied_sources) ? r.supplied_sources : []) {
    if (s && typeof s === "object") offEnum("supplied_sources[].source_type", s.source_type, MARKET_ENTRY_SOURCE_TYPES, errors);
  }
  return errors;
}

function isMarketEntryReadinessRequest(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.project_name === "string" &&
    typeof value.partner_or_company === "string" &&
    typeof value.market === "string" &&
    typeof value.decision_question === "string" &&
    typeof value.decision_stage === "string" &&
    Array.isArray(value.supplied_sources)
  );
}

function structuredMarketEntryReadinessRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [
    params.request,
    params.market_entry_request,
    params.market_entry_readiness_request,
    params.input,
    params
  ];
  const message = params.message;
  if (message && typeof message === "object") {
    if (message.data && typeof message.data === "object") candidates.push(message.data);
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (!part || typeof part !== "object") continue;
        candidates.push(part.data, part.json, part.content);
        const parsed = tryParseJsonObject(part.text);
        if (parsed) candidates.push(parsed);
      }
    }
  }
  for (const candidate of candidates) {
    if (isMarketEntryReadinessRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isMarketEntryReadinessRequest(parsed)) return parsed;
  }
  return null;
}

function a2aResultForMarketEntryReadiness(params) {
  const structured = structuredMarketEntryReadinessRequestFromParams(params);
  if (!structured) {
    return invalidRequestResult(
      "kazakhstan_market_entry_readiness",
      "/v1/market-entry/readiness",
      "schemas/v1/market-entry-readiness-request.schema.json",
      ["Missing structured Kazakhstan market-entry readiness request"]
    );
  }
  const enumErrors = marketEntryEnumErrors(structured);
  if (enumErrors.length) {
    return invalidRequestResult(
      "kazakhstan_market_entry_readiness",
      "/v1/market-entry/readiness",
      "schemas/v1/market-entry-readiness-request.schema.json",
      enumErrors
    );
  }
  const result = marketEntryReadinessResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "market-entry-readiness-response",
        name: "Kazakhstan market-entry readiness response",
        parts: [
          { text: marketEntryArtifactText(result.response), mediaType: "text/markdown" },
          { data: result.response, mediaType: "application/json" }
        ]
      }
    ],
    metadata: {
      product_profile: "kazakhstan_market_entry_readiness",
      canonical_http_endpoint: "/v1/market-entry/readiness",
      schema: "schemas/v1/market-entry-readiness-request.schema.json",
      human_review_required: result.response.human_review_required,
      not_advice_notice: result.response.boundary_notice,
      response: result.response
    }
  };
}

function applyMarketEntryReadinessProfile(card, request) {
  const origin = originFromRequest(request);
  card.name = "Kazakhstan Market-Entry Readiness Gate";
  card.documentationUrl = MARKET_ENTRY_DOCS_URL;
  card.description =
    "A2A-compatible evidence-readiness gate for a Kazakhstan market-entry file (distribution, import, service, " +
    "showroom, EPC, renewable-energy, infrastructure, technology-transfer, or partner-entry). Bring company, " +
    "project, Kazakhstan objective, counterparties, and supplied sources; get a gate decision, readiness label, " +
    "evidence gaps, claim audit, owner actions, watch-next indicators, and mandatory human-review routing. No live " +
    "retrieval; not legal, compliance, customs, tax, sanctions, or launch-authorization advice.";
  card.provider.legalEntity.sameAs = [
    "https://github.com/vassiliylakhonin",
    "https://pypi.org/project/agenda-intelligence-md/",
    "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md"
  ];
  card.skills = [
    {
      id: "kazakhstan-market-entry-readiness",
      name: "Kazakhstan market-entry readiness gate",
      description:
        "Turns a company, project, Kazakhstan objective, counterparties, and supplied sources into a structured " +
        "market-entry readiness triage with a gate decision, readiness label, evidence gaps, claim audit, owner " +
        "actions, watch-next indicators, and mandatory human-review routing.",
      tags: ["kazakhstan", "market-entry", "go-to-market", "due-diligence", "evidence-readiness", "human-review", "free"],
      examples: [
        "Can this Kazakhstan distribution file move from concept to controlled validation?",
        "What must be closed before we sign the dealer contract in Kazakhstan?"
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = "kazakhstan_market_entry_readiness";
  card.x_agenda_intelligence.canonical_product_name = "Kazakhstan Market-Entry Readiness Gate";
  card.x_agenda_intelligence.wrapper_scope =
    "A2A/JSON-RPC discovery, market-entry evidence triage, gate decision, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = MARKET_ENTRY_DOCS_URL;
  card.x_agenda_intelligence.product_contract = {
    request_schema: MARKET_ENTRY_REQUEST_SCHEMA_URL,
    response_schema: MARKET_ENTRY_RESPONSE_SCHEMA_URL,
    source_taxonomy: MARKET_ENTRY_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/kazakhstan-market-entry-readiness`,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    demo_input_modes: ["structured_json"]
  };
  card.x_agenda_intelligence.required_before_validation = MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION;
  card.x_agenda_intelligence.required_before_signature = MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE;
  card.x_agenda_intelligence.supported_contracts = ["kazakhstan_market_entry_readiness_contract"];
  card.x_agenda_intelligence.buyer_use_cases = [
    "foreign company assessing a Kazakhstan distribution / import entry before signature",
    "EPC, renewable-energy, or infrastructure entrant gating committee review",
    "advisor or consultant triaging a client's Kazakhstan market-entry file",
    "partner-entry / technology-transfer readiness before commitment"
  ];
  card.x_agenda_intelligence.commercial_positioning =
    "Company + project + Kazakhstan objective + counterparties + supplied sources -> auditable market-entry triage " +
    "with a gate decision, readiness label, evidence gaps, owner actions, and human-review escalation. Sits beside " +
    "legal, tax, and customs advisors, not instead of them.";
  card.x_agenda_intelligence.boundaries = [
    "No live source retrieval; caller-supplied evidence only.",
    "No factual-truth verification.",
    "No legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice.",
    "Human review is required before any commercial action."
  ];
  return card;
}

async function matchAgainstActiveUpstream(env, counterparty) {
  const active = activeUpstreamOption("cis_secondary_sanctions", env);
  if (!active) {
    // No upstream configured. Return a degraded shape with OpenSanctions
    // attribution as the canonical fallback (matches the prior behavior so
    // existing callers / tests see a consistent shape).
    return {
      upstream_name: null,
      result: await matchCounterpartyAgainstOpenSanctions(env, {
        name: counterparty.name,
        jurisdiction: counterparty.jurisdiction
      })
    };
  }
  if (active.name === "Watchman") {
    return {
      upstream_name: "Watchman",
      result: await matchCounterpartyAgainstWatchman(env, {
        name: counterparty.name,
        jurisdiction: counterparty.jurisdiction
      })
    };
  }
  return {
    upstream_name: "OpenSanctions",
    result: await matchCounterpartyAgainstOpenSanctions(env, {
      name: counterparty.name,
      jurisdiction: counterparty.jurisdiction
    })
  };
}

async function cisSecondarySanctionsResult(request, env) {
  const supplied = suppliedSourceTypes(request);
  const counterparty = request.counterparty || {};
  const { upstream_name, result: upstreamResult } = await matchAgainstActiveUpstream(env, counterparty);
  const autoFetched = [];
  for (const match of upstreamResult.matches || []) {
    const sourceType = match.source_type || "user_provided_note";
    if (!supplied.includes(sourceType)) supplied.push(sourceType);
    autoFetched.push({
      source_type: sourceType,
      title: match.name || `${upstream_name || "upstream"} match`,
      datasets: match.datasets || [],
      opensanctions_id: match.opensanctions_id,
      watchman_source_id: match.watchman_source_id || null,
      score: match.score,
      topics: match.topics || [],
      jurisdictions: match.jurisdictions || [],
      notes: upstream_name
        ? `Auto-fetched from ${upstream_name}; attribution required (see upstream license).`
        : "Auto-fetched (upstream attribution required)."
    });
  }

  const missing = CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW.filter((s) => !supplied.includes(s));
  const [score, label] = cisDecisionReadiness(request, supplied);
  const exposureSignal = cisExposureSignal(request, missing, autoFetched.length);
  const triage = cisTriageRecommendation(request, missing, exposureSignal);
  const facets = Array.isArray(request.exposure_facets) ? request.exposure_facets : [];
  const undisclosedUbo = cisHasUndisclosedUbo(request);

  const limitations = [];
  // Attribution only when upstream data was actually merged (Python parity): on the
  // disabled / degraded / zero-match paths nothing was fetched, so the notice would
  // imply a sanctions-list match via the upstream that never happened.
  if (upstreamResult.attribution && autoFetched.length) limitations.push(upstreamResult.attribution.notice);
  // User-facing degrade note derived from status only — never echo internal
  // env-var names or upstream stack details (parity with the Python service;
  // degrade_reason is kept on live_retrieval_status for operators).
  if (upstreamResult.status === "disabled") {
    limitations.push(
      "Live sanctions-list retrieval is not currently enabled; triage is based on user-supplied evidence only."
    );
  } else if (upstreamResult.status === "degraded") {
    limitations.push(
      "Live sanctions-list retrieval was unavailable; triage is based on user-supplied evidence only."
    );
  }
  if (undisclosedUbo) {
    limitations.push(
      "Ultimate beneficial owner is undisclosed or unverified in the supplied ownership chain; " +
        "the counterparty cannot be fully screened until the UBO is resolved."
    );
  }
  limitations.push(
    "Name match against a sanctions list is not legal-entity identity verification. Human review is required."
  );

  const response = {
    triage_recommendation: triage,
    secondary_exposure_signal: exposureSignal,
    decision_readiness_score: score,
    decision_readiness_label: label,
    counterparty: request.counterparty,
    exposure_facets: facets,
    supplied_sources: supplied,
    minimum_sources_before_review: missing,
    evidence_gaps: missing.map(cisEvidenceGapForSource),
    top_exposure_dimensions: cisTopExposureDimensions(facets, missing, autoFetched.length, undisclosedUbo),
    watch_next: [
      "new OFAC SDN designations",
      "new EU sanctions package",
      "new UK OFSI listing",
      "new EAG typology report",
      "FATF grey-list or black-list update",
      "national regulator enforcement update"
    ],
    human_review_required: true,
    not_advice_notice: NOT_ADVICE_NOTICE,
    limitations
  };

  return {
    response,
    live_retrieval_status: upstreamResult.status,
    live_retrieval_upstream: upstream_name,
    auto_fetched_sources: autoFetched,
    upstream_attribution: upstreamResult.attribution
  };
}

function cisArtifactText(response, liveRetrievalStatus) {
  const missing = response.minimum_sources_before_review || [];
  const missingText = missing.length ? missing.map((s) => `- ${s}`).join("\n") : "- none";
  const dims = response.top_exposure_dimensions || [];
  const dimsText = dims.length ? dims.map((s) => `- ${s}`).join("\n") : "- none";
  return [
    "CIS secondary-sanctions exposure response",
    "",
    `Recommendation: ${response.triage_recommendation}`,
    `Exposure signal: ${response.secondary_exposure_signal}`,
    `Decision readiness: ${response.decision_readiness_score}/100 (${response.decision_readiness_label})`,
    `Live retrieval status: ${liveRetrievalStatus}`,
    `Human review required: ${String(response.human_review_required)}`,
    "",
    "Top exposure dimensions:",
    dimsText,
    "",
    "Minimum sources before review:",
    missingText,
    "",
    response.not_advice_notice
  ].join("\n");
}

async function a2aResultForCisSecondarySanctions(params, request, env) {
  const structured = structuredCisSecondarySanctionsRequestFromParams(params);
  if (!structured) {
    return {
      id: crypto.randomUUID(),
      status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() },
      artifacts: [],
      metadata: {
        product_profile: "cis_secondary_sanctions",
        canonical_http_endpoint: "/v1/cis-secondary-sanctions/exposure",
        schema: "schemas/v1/cis-secondary-sanctions-request.schema.json",
        valid: false,
        errors: ["Missing structured CIS secondary-sanctions exposure request"]
      }
    };
  }
  const enumErrors = cisEnumErrors(structured);
  if (enumErrors.length) {
    return invalidRequestResult(
      "cis_secondary_sanctions",
      "/v1/cis-secondary-sanctions/exposure",
      "schemas/v1/cis-secondary-sanctions-request.schema.json",
      enumErrors
    );
  }
  const result = await cisSecondarySanctionsResult(structured, env);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "cis-secondary-sanctions-exposure-response",
        name: "CIS secondary-sanctions exposure response",
        parts: [
          {
            text: cisArtifactText(result.response, result.live_retrieval_status),
            mediaType: "text/markdown"
          },
          {
            data: result.response,
            mediaType: "application/json"
          }
        ]
      }
    ],
    metadata: {
      product_profile: "cis_secondary_sanctions",
      canonical_http_endpoint: "/v1/cis-secondary-sanctions/exposure",
      schema: "schemas/v1/cis-secondary-sanctions-request.schema.json",
      live_retrieval_status: result.live_retrieval_status,
      live_retrieval_upstream: result.live_retrieval_upstream,
      auto_fetched_sources: result.auto_fetched_sources,
      upstream_attribution: result.upstream_attribution,
      human_review_required: result.response.human_review_required,
      not_advice_notice: result.response.not_advice_notice,
      response: result.response
    }
  };
}

function isMiddleCorridorDealRiskRequest(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.route === "string" &&
    typeof value.cargo === "string" &&
    typeof value.risk_question === "string" &&
    typeof value.decision_stage === "string" &&
    Array.isArray(value.counterparties) &&
    Array.isArray(value.dated_sources)
  );
}

function structuredDealRiskRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;

  const candidates = [params.request, params.middle_corridor_deal_risk_request, params.input, params];
  const message = params.message;
  if (message && typeof message === "object" && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (!part || typeof part !== "object") continue;
      candidates.push(part.data, part.json, part.content);
      const parsedText = tryParseJsonObject(part.text);
      if (parsedText) candidates.push(parsedText);
    }
  }

  for (const candidate of candidates) {
    if (isMiddleCorridorDealRiskRequest(candidate)) return candidate;
  }
  return null;
}

function textFromStructuredDealRiskRequest(request) {
  const counterparties = request.counterparties
    .map((party) => [party.role, party.name, party.jurisdiction].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("; ");
  const sources = request.dated_sources
    .map((source) => [source.source_type, source.title, source.date].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("; ");

  return [
    "Kazakhstan Middle Corridor deal risk gate structured request.",
    `Route: ${request.route}.`,
    `Cargo: ${request.cargo}.`,
    `Decision stage: ${request.decision_stage}.`,
    `Question: ${request.risk_question}.`,
    counterparties ? `Counterparties: ${counterparties}.` : "",
    sources ? `Dated sources: ${sources}.` : "",
    "sanctions corridor risk source coverage evidence gate"
  ]
    .filter(Boolean)
    .join(" ");
}

function hasAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function routeModules(text) {
  const modules = [{ module: "global-think-tank-analyst", role: "reasoning_method" }];
  if (hasAny(text, CA_CASPIAN_TERMS)) {
    modules.push({ module: "central-asia-caspian", role: "regional_specialist" });
  }
  if (hasAny(text, GULF_ME_TERMS)) {
    modules.push({ module: "gulf-middle-east", role: "regional_specialist" });
  }
  if (hasAny(text, EU_TERMS)) {
    modules.push({ module: "eu", role: "regional_specialist" });
  }
  if (hasAny(text, SANCTIONS_TERMS)) {
    modules.push({ module: "sanctions-sector", role: "sector_specialist" });
  }
  return modules;
}

function routeModulesForProfile(text, profile) {
  if (profile !== "kazakhstan") return routeModules(text);
  const modules = routeModules(`${text}\nKazakhstan Central Asia Caspian Middle Corridor sanctions corridor risk`);
  return modules;
}

function classifyIntentForProfile(text, profile) {
  const lower = text.toLowerCase();
  if (
    profile === "kazakhstan" &&
    hasAny(lower, [
      "deal risk",
      "deal-risk",
      "deal desk",
      "contract signature",
      "before signature",
      "escalated before contract",
      "escalate before",
      "go/no-go",
      "proceed",
      "pause",
      "reject-for-now"
    ])
  ) {
    return "deal_risk_gate";
  }
  return classifyIntent(text);
}

function classifyIntent(text) {
  const lower = text.toLowerCase();
  if (!lower.trim()) return "health_probe";
  if (hasAny(lower, ["validate", "schema", "json schema", "memo validation"])) {
    return "memo_validation";
  }
  if (hasAny(lower, ["source", "coverage", "required source", "source plan"])) {
    return "source_coverage";
  }
  if (
    hasAny(lower, ["screen", "risk signal", "signal screen", "policy risk", "sanctions risk", "corridor risk"]) ||
    (hasAny(lower, SANCTIONS_TERMS) && hasAny(lower, ["policy", "risk", "corridor", "regulation", "shipping"]))
  ) {
    return "sanctions_policy_signal_screen";
  }
  if (hasAny(lower, ["audit", "evidence", "claim", "provenance", "unsupported"])) {
    return "evidence_audit";
  }
  if (hasAny(lower, ["signal", "watch", "monitor", "early warning", "indicator"])) {
    return "signal_monitoring";
  }
  return "strategic_risk_triage";
}

function extractAfterLabel(text, labels) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(
    `(?:${escaped})\\s*:\\s*(.*?)(?=(?:\\.\\s+[A-Z][A-Za-z /-]{1,40}:)|(?:\\n[A-Z][A-Za-z /-]{1,40}:)|$)`,
    "is"
  );
  const match = text.match(pattern);
  return match ? match[1].trim().replace(/\.$/, "") : null;
}

function cleanExtractedDealField(value) {
  return value
    ? value
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[.;,\s]+$/, "")
    : null;
}

function extractDealRoute(text) {
  const labelled = extractAfterLabel(text, ["Route"]);
  if (labelled) return labelled;

  const match = text.match(
    /\broute\s+(.+?)(?=(?:\.\s+(?:Counterparties|Sources|Dated sources|Should|Question)\b)|(?:\s+with\s+(?:cargo|counterparties)\b)|$)/is
  );
  return match ? cleanExtractedDealField(match[1]) : null;
}

function extractDealCargo(text) {
  const labelled = extractAfterLabel(text, ["Cargo"]);
  if (labelled) return labelled;

  const shipmentMatch = text.match(/\bshipment of\s+(.+?)(?=(?:\s+on\s+route\b)|(?:\s+via\b)|[.;]|$)/is);
  if (shipmentMatch) return cleanExtractedDealField(shipmentMatch[1]);

  const cargoMatch = text.match(/\bcargo\s+(?:is|of|:)?\s*(.+?)(?=(?:\s+on\s+route\b)|[.;]|$)/is);
  return cargoMatch ? cleanExtractedDealField(cargoMatch[1]) : null;
}

function extractDealValue(text) {
  const labelled = extractAfterLabel(text, ["Value"]);
  if (labelled) return labelled;

  const match = text.match(/\b(?:USD|EUR|GBP|KZT|CNY)\s*[\d,.]+(?:\s?(?:m|mn|million|bn|billion))?\b/i);
  return match ? cleanExtractedDealField(match[0]) : null;
}

function detectSuppliedSources(text) {
  const lower = text.toLowerCase();
  const sources = [];
  const checks = [
    ["port_operator_notice", ["port operator notice", "port notice"]],
    ["sanctions_list_extract", ["sanctions list extract", "sanctions extract"]],
    ["carrier_note", ["carrier note", "carrier routing note"]],
    ["counterparty_registry_extract", ["counterparty registry", "registry extract"]],
    ["beneficial_ownership_source", ["beneficial ownership", "ubo"]],
    ["insurance_clause_or_underwriter_note", ["insurance clause", "underwriter note", "insurance terms"]],
    ["customs_or_regulatory_source", ["customs source", "regulatory source", "customs document"]],
    ["vessel_or_carrier_history", ["vessel history", "ais", "carrier history"]]
  ];
  for (const [name, terms] of checks) {
    if (terms.some((term) => lower.includes(term))) sources.push(name);
  }
  return [...new Set(sources)];
}

function detectExplicitlyMissingSources(text) {
  const lower = text.toLowerCase();
  const missing = [];
  if (/(no|missing|without)\s+beneficial ownership/.test(lower)) missing.push("beneficial_ownership_source");
  if (/(no|missing|without)\s+(counterparty registry|registry extract)/.test(lower)) missing.push("counterparty_registry_extract");
  if (/(no|missing|without)\s+(insurance clause|underwriter note|insurance terms)/.test(lower)) missing.push("insurance_clause_or_underwriter_note");
  if (/(no|missing|without)\s+(customs source|customs document|regulatory source)/.test(lower)) missing.push("customs_or_regulatory_source");
  if (/(no|missing|without)\s+(vessel history|ais|carrier history|vessel or carrier history)/.test(lower)) {
    missing.push("vessel_or_carrier_history");
  }
  return [...new Set(missing)];
}

function dealRiskGateForText(text) {
  const explicitlyMissing = detectExplicitlyMissingSources(text);
  const suppliedSources = detectSuppliedSources(text).filter((source) => !explicitlyMissing.includes(source));
  const requiredSources = [
    "sanctions_list_extract",
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "port_operator_notice",
    "customs_or_regulatory_source",
    "insurance_clause_or_underwriter_note",
    "vessel_or_carrier_history"
  ];
  const missingSources = requiredSources.filter(
    (source) => !suppliedSources.includes(source) || explicitlyMissing.includes(source)
  );
  const route = extractDealRoute(text) || "not supplied";
  const cargo = extractDealCargo(text) || "not supplied";
  const value = extractDealValue(text);
  const counterparties = extractAfterLabel(text, ["Counterparties", "Parties"]) || "not supplied";
  const triageRecommendation = missingSources.length > 0 ? "escalate_before_signature" : "proceed_with_human_review";
  const riskSignal =
    missingSources.length >= 4
      ? "medium-high"
      : missingSources.length > 0
        ? "medium"
        : "triage_only_review_required";

  return {
    triage_recommendation: triageRecommendation,
    risk_signal: riskSignal,
    route,
    cargo,
    value,
    counterparties,
    supplied_sources: suppliedSources,
    missing_sources: missingSources,
    minimum_sources_before_go: missingSources,
    reason:
      missingSources.length > 0
        ? "Evidence pack is not decision-ready for contract signature because required sanctions, counterparty, ownership, insurance, customs, or vessel/carrier evidence is missing."
        : "Required source categories are present at the routing layer, but human review is still required before commercial reliance.",
    commercial_impact: [
      "Possible shipment delay or rerouting cost.",
      "Potential insurer exclusion or documentation dispute.",
      "Counterparty or ownership review may be required before signature.",
      "Committee/client memo may need explicit unsupported-claim labels."
    ],
    watch_next: [
      "new OFAC/EU/UK/UN designations, FAQs, licences, guidance, or enforcement notices",
      "port/operator delay notices for Aktau, Kuryk, Baku, Poti, or linked rail corridors",
      "customs rule or enforcement changes affecting transit documentation",
      "carrier/vessel history updates or insurance terms that change the risk view"
    ],
    human_review_required: true,
    not_legal_or_compliance_advice: true
  };
}

function suppliedSourcesFromStructuredRequest(request) {
  return [
    ...new Set(
      request.dated_sources
        .map((source) => source?.source_type)
        .filter((sourceType) => typeof sourceType === "string" && sourceType.trim())
    )
  ];
}

function evidenceGapForSource(sourceType) {
  const gaps = {
    counterparty_registry_extract: "No counterparty registry extract supplied.",
    beneficial_ownership_source: "No beneficial ownership source supplied.",
    sanctions_list_extract: "No sanctions list extract supplied.",
    customs_or_regulatory_source: "No customs or regulatory source supplied.",
    insurance_clause_or_underwriter_note: "No insurance clause or underwriter note supplied.",
    vessel_or_carrier_history: "No vessel or carrier history supplied."
  };
  return gaps[sourceType] || `No ${sourceType} supplied.`;
}

function triageRecommendationForStructuredRequest(request, missingSources) {
  if (request.dated_sources.length === 0) return "insufficient_information";
  if (missingSources.length === 0) return "ready_for_human_review";
  if (request.decision_stage === "pre_signature") return "escalate_before_signature";
  if (request.decision_stage === "pre_shipment") return "escalate_before_shipment";
  return "not_decision_ready";
}

function riskSignalForStructuredRequest(request, missingSources) {
  if (request.dated_sources.length === 0) return "unknown";
  if (missingSources.length >= 4) return "medium_high";
  if (missingSources.length > 0) return "medium";
  return "low";
}

function flaggedJurisdictionCounterparties(request, table) {
  const flagged = [];
  for (const cp of request.counterparties || []) {
    if (!cp || typeof cp.jurisdiction !== "string") continue;
    const lowered = cp.jurisdiction.toLowerCase();
    for (const [token, label] of Object.entries(table)) {
      if (lowered.includes(token)) {
        flagged.push({ name: cp.name || "unnamed counterparty", role: cp.role || "unknown", jurisdiction: cp.jurisdiction, matched: label });
        break;
      }
    }
  }
  return flagged;
}

function highRiskJurisdictionCounterparties(request) {
  return flaggedJurisdictionCounterparties(request, HIGH_RISK_JURISDICTIONS);
}

function circumventionWatchCounterparties(request) {
  const highRiskTokens = Object.keys(HIGH_RISK_JURISDICTIONS);
  const flagged = [];
  for (const cp of request.counterparties || []) {
    if (!cp || typeof cp.jurisdiction !== "string") continue;
    const lowered = cp.jurisdiction.toLowerCase();
    // A high-risk jurisdiction takes precedence over the softer watch flag.
    if (highRiskTokens.some((token) => lowered.includes(token))) continue;
    for (const [token, label] of Object.entries(CIRCUMVENTION_WATCH_JURISDICTIONS)) {
      if (lowered.includes(token)) {
        flagged.push({ name: cp.name || "unnamed counterparty", role: cp.role || "unknown", jurisdiction: cp.jurisdiction, matched: label });
        break;
      }
    }
  }
  return flagged;
}

// Flag counterparties operating in an OFAC-named sector (FAQ 1148 / 1151). FFIs are
// exposed under EO 14024 as amended by EO 14114 for facilitating transactions involving
// persons in the technology, defense and related materiel, construction, aerospace, or
// manufacturing sectors of the Russian Federation economy. Presence-flagging based on
// the counterparty's declared sector(s); does not adjudicate whether a sanction applies.
function namedSectorCounterparties(request) {
  const flagged = [];
  for (const cp of request.counterparties || []) {
    if (!cp || !Array.isArray(cp.specified_sectors)) continue;
    const named = cp.specified_sectors
      .filter((s) => typeof s === "string" && s in NAMED_SECTORS)
      .map((s) => NAMED_SECTORS[s]);
    if (named.length === 0) continue;
    flagged.push({ name: cp.name || "unnamed counterparty", role: cp.role || "unknown", sectors: named });
  }
  return flagged;
}

// Flag counterparties newly formed on or after 2022-02-24 in a high-risk,
// circumvention-watch, or transshipment-hub jurisdiction. Mirrors the OFAC FFI
// advisory red flag: "EXAMPLE OF HIGHER RISK CUSTOMER: A microelectronics exporter
// formed in March 2022 located in a high-risk jurisdiction". Presence-flagging only.
function newlyFormedCounterparties(request) {
  const flagged = [];
  const sources = [HIGH_RISK_JURISDICTIONS, CIRCUMVENTION_WATCH_JURISDICTIONS, TRANSSHIPMENT_HUB_JURISDICTIONS];
  for (const cp of request.counterparties || []) {
    if (!cp) continue;
    const dateOfFormation = cp.date_of_formation;
    if (typeof dateOfFormation !== "string" || dateOfFormation < NEWLY_FORMED_COUNTERPARTY_CUTOFF) continue;
    if (typeof cp.jurisdiction !== "string") continue;
    const lowered = cp.jurisdiction.toLowerCase();
    let matchedLabel = null;
    for (const source of sources) {
      for (const [token, label] of Object.entries(source)) {
        if (lowered.includes(token)) {
          matchedLabel = label;
          break;
        }
      }
      if (matchedLabel !== null) break;
    }
    if (matchedLabel === null) continue;
    flagged.push({
      name: cp.name || "unnamed counterparty",
      role: cp.role || "unknown",
      jurisdiction: cp.jurisdiction,
      date_of_formation: dateOfFormation,
      matched: matchedLabel
    });
  }
  return flagged;
}

function topRisksForStructuredRequest(
  missingSources,
  highRisk = false,
  circumventionWatch = false,
  namedSectorPresent = false,
  newlyFormedPresent = false
) {
  const risks = ["sanctions adjacency", "Caspian crossing capacity and draft exposure"];
  if (highRisk) risks.unshift("counterparty in a sanctions-relevant / high-risk jurisdiction");
  if (circumventionWatch) risks.push("counterparty in a re-export / circumvention-watch jurisdiction");
  if (namedSectorPresent) risks.push("counterparty operates in an OFAC-named sector under EO 14024");
  if (newlyFormedPresent) risks.push("counterparty newly formed in a transshipment-risk jurisdiction");
  if (missingSources.includes("customs_or_regulatory_source")) risks.push("customs/documentation uncertainty");
  if (missingSources.includes("insurance_clause_or_underwriter_note")) risks.push("insurance exclusions");
  if (
    missingSources.includes("counterparty_registry_extract") ||
    missingSources.includes("beneficial_ownership_source")
  ) {
    risks.push("counterparty and ownership uncertainty");
  }
  if (missingSources.includes("vessel_or_carrier_history")) risks.push("carrier or vessel history gap");
  return [...new Set(risks)];
}

function exposureLayersForStructuredRequest(
  missingSources,
  highRisk = false,
  circumventionWatch = false,
  namedSectorPresent = false,
  newlyFormedPresent = false
) {
  const domesticLegalLayer = [
    "Home-jurisdiction legal and licensing posture not assessed here (this product does not verify export-control licensing or documentation); confirm with qualified review."
  ];
  if (missingSources.includes("customs_or_regulatory_source")) {
    domesticLegalLayer.push("No customs or regulatory source supplied to review documentation posture.");
  }
  const foreignSanctionsExposureLayer = ["Secondary / extraterritorial sanctions adjacency present; exposure not adjudicated."];
  if (highRisk) {
    foreignSanctionsExposureLayer.push("Counterparty in a sanctions-relevant / high-risk jurisdiction — escalation flag, not a determination.");
  }
  if (circumventionWatch) {
    foreignSanctionsExposureLayer.push("Counterparty in a re-export / circumvention-watch jurisdiction — verify end-use and onward destination.");
  }
  if (namedSectorPresent) {
    foreignSanctionsExposureLayer.push(
      "Counterparty operates in an OFAC-named sector (FAQ 1148 / 1151) — FFI sanctions-exposure flag under EO 14024 / EO 14114, not a determination."
    );
  }
  if (newlyFormedPresent) {
    foreignSanctionsExposureLayer.push(
      "Counterparty newly formed in a transshipment-risk jurisdiction (OFAC FFI advisory red flag) — escalation flag for human review, not a determination."
    );
  }
  if (missingSources.includes("sanctions_list_extract")) {
    foreignSanctionsExposureLayer.push("No sanctions list extract supplied to review listed-party exposure.");
  }
  if (missingSources.includes("beneficial_ownership_source")) {
    foreignSanctionsExposureLayer.push("No beneficial ownership source — indirect / ownership-based exposure cannot be reviewed.");
  }
  return { domestic_legal_layer: domesticLegalLayer, foreign_sanctions_exposure_layer: foreignSanctionsExposureLayer };
}

function decisionReadinessForStructuredRequest(request, suppliedSources) {
  if (request.dated_sources.length === 0 || suppliedSources.length === 0) {
    return {
      score: 0,
      label: "insufficient_information"
    };
  }

  const requiredPresent = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.filter((sourceType) =>
    suppliedSources.includes(sourceType)
  ).length;
  const helpfulPresent = MIDDLE_CORRIDOR_HELPFUL_CONTEXT.filter((sourceType) =>
    suppliedSources.includes(sourceType)
  ).length;
  const score = Math.min(
    100,
    Math.round(
      10 +
        (requiredPresent / MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.length) * 70 +
        (helpfulPresent / MIDDLE_CORRIDOR_HELPFUL_CONTEXT.length) * 20
    )
  );

  return {
    score,
    label: score >= 85 ? "review_ready" : score >= 50 ? "partial" : "not_decision_ready"
  };
}

function counterpartyReadinessForStructuredRequest(request, suppliedSources, minimumSourcesBeforeGo) {
  const requiredTotal = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.length;
  const outstanding = minimumSourcesBeforeGo.filter((sourceType) =>
    MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.includes(sourceType)
  );
  const missingCount = outstanding.length;
  const suppliedCount = requiredTotal - missingCount;
  let status;
  if (request.dated_sources.length === 0 || suppliedSources.length === 0) {
    status = "insufficient_information";
  } else if (missingCount === 0) {
    status = "complete_for_review";
  } else if (suppliedCount > 0) {
    status = "partial";
  } else {
    status = "incomplete";
  }
  // Per-document ledger mirroring the EDD "date requested, date received" / chain-of-custody
  // practice. date_received is the earliest supplied dated source of that type, when present.
  const receivedDates = {};
  for (const source of request.dated_sources || []) {
    const sourceType = source.source_type;
    const date = source.date;
    if (sourceType && date && (!(sourceType in receivedDates) || date < receivedDates[sourceType])) {
      receivedDates[sourceType] = date;
    }
  }
  const documentLedger = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.map((sourceType) => {
    const entry = {
      source_type: sourceType,
      status: suppliedSources.includes(sourceType) ? "received" : "missing"
    };
    if (sourceType in receivedDates) entry.date_received = receivedDates[sourceType];
    return entry;
  });
  return {
    status,
    required_total: requiredTotal,
    supplied_count: suppliedCount,
    missing_count: missingCount,
    outstanding_documents: outstanding,
    document_ledger: documentLedger,
    presentable_note:
      "Dossier-completeness view for presenting enhanced-due-diligence evidence to a bank, " +
      "insurer, or counterparty. Tracks completeness of the required-before-go evidence set only; " +
      "it is not clearance, approval, a sanctions determination, or compliance advice. Human review " +
      "is required before any commercial action."
  };
}

function operationalDecisionForStructuredRequest(request, triageRecommendation, riskSignal, score) {
  const gate =
    {
      pre_signature: "quote / sign the booking",
      pre_shipment: "accept the booking and release for loading",
      in_transit: "let the shipment continue",
      post_incident: "clear the shipment post-incident",
      committee_review: "take the committee decision"
    }[request.decision_stage] || "take the next commercial step";
  if (String(triageRecommendation).includes("escalate") || String(riskSignal).includes("high")) {
    return { decision: "escalate", applies_to: gate, rationale: `Route to compliance or legal before you ${gate}.` };
  }
  if (score < 40) {
    return { decision: "hold", applies_to: gate, rationale: `Do not ${gate} yet; request the missing evidence first.` };
  }
  if (score < 70) {
    return {
      decision: "proceed_with_conditions",
      applies_to: gate,
      rationale: `Only ${gate} after the evidence gaps are closed and assigned an owner.`
    };
  }
  return {
    decision: "proceed",
    applies_to: gate,
    rationale: `Evidence set looks complete; you may ${gate}, subject to human sign-off.`
  };
}

function dealRiskContractResponseForRequest(request) {
  const suppliedSources = suppliedSourcesFromStructuredRequest(request);
  const minimumSourcesBeforeGo = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.filter(
    (sourceType) => !suppliedSources.includes(sourceType)
  );
  const decisionReadiness = decisionReadinessForStructuredRequest(request, suppliedSources);
  const flaggedHighRisk = highRiskJurisdictionCounterparties(request);
  const flaggedCircumvention = circumventionWatchCounterparties(request);
  const flaggedNamedSectors = namedSectorCounterparties(request);
  const flaggedNewlyFormed = newlyFormedCounterparties(request);
  const matchedSanctionsSegments = matchedSanctionsExposedSegments(request.route);
  const triageRecommendation = triageRecommendationForStructuredRequest(request, minimumSourcesBeforeGo);
  const riskSignal = riskSignalForStructuredRequest(request, minimumSourcesBeforeGo);
  const response = {
    triage_recommendation: triageRecommendation,
    risk_signal: riskSignal,
    decision_readiness_score: decisionReadiness.score,
    decision_readiness_label: decisionReadiness.label,
    operational_decision: operationalDecisionForStructuredRequest(
      request,
      triageRecommendation,
      riskSignal,
      decisionReadiness.score
    ),
    route: request.route,
    cargo: request.cargo,
    counterparties: request.counterparties,
    supplied_sources: suppliedSources,
    minimum_sources_before_go: minimumSourcesBeforeGo,
    evidence_gaps: minimumSourcesBeforeGo.map(evidenceGapForSource),
    top_risks: topRisksForStructuredRequest(
      minimumSourcesBeforeGo,
      flaggedHighRisk.length > 0,
      flaggedCircumvention.length > 0,
      flaggedNamedSectors.length > 0,
      flaggedNewlyFormed.length > 0
    ),
    exposure_layers: exposureLayersForStructuredRequest(
      minimumSourcesBeforeGo,
      flaggedHighRisk.length > 0,
      flaggedCircumvention.length > 0,
      flaggedNamedSectors.length > 0,
      flaggedNewlyFormed.length > 0
    ),
    watch_next: [
      "new sanctions designations",
      "Caspian ferry-slot, tonnage, or draft notice",
      "port delays or operator notices",
      "rail capacity constraints",
      "customs enforcement changes",
      "carrier or vessel history updates",
      "insurance or underwriter terms changes"
    ],
    human_review_required: true,
    not_advice_notice: NOT_ADVICE_NOTICE,
    counterparty_readiness: counterpartyReadinessForStructuredRequest(request, suppliedSources, minimumSourcesBeforeGo),
    route_sanctions_exposure_indicators: [...MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_CONNECTIONS],
    customs_harmonization_indicators: [...MIDDLE_CORRIDOR_CUSTOMS_HARMONIZATION_INDICATORS]
  };
  const limitations = [];
  if (flaggedHighRisk.length > 0) {
    const named = flaggedHighRisk.map((c) => `${c.name} (${c.role}, ${c.jurisdiction})`).join(", ");
    limitations.push(
      `One or more counterparties are domiciled in a sanctions-relevant / high-risk jurisdiction (${named}); this is an escalation flag for human review, not a sanctions determination. Confirm end-use, ownership, and applicable restrictions before any commercial action.`
    );
  }
  if (flaggedCircumvention.length > 0) {
    const namedCw = flaggedCircumvention.map((c) => `${c.name} (${c.role}, ${c.jurisdiction})`).join(", ");
    limitations.push(
      `One or more counterparties are domiciled in a re-export / circumvention-watch jurisdiction (${namedCw}); this is a diversion watch item for human review, not a sanctions determination. Verify end-use and onward destination before any commercial action.`
    );
  }
  if (flaggedNamedSectors.length > 0) {
    const namedNs = flaggedNamedSectors
      .map((c) => `${c.name} (${c.role}, sectors: ${c.sectors.join("/")})`)
      .join(", ");
    limitations.push(
      `One or more counterparties operate in an OFAC-named sector of the Russian Federation economy (${namedNs}); this is an FFI sanctions-exposure escalation flag under EO 14024 as amended by EO 14114, not a sanctions determination. Confirm end-use and applicable restrictions before any commercial action.`
    );
  }
  if (flaggedNewlyFormed.length > 0) {
    const namedNf = flaggedNewlyFormed
      .map((c) => `${c.name} (${c.role}, ${c.jurisdiction}, formed ${c.date_of_formation})`)
      .join(", ");
    limitations.push(
      `One or more counterparties were newly formed in a transshipment-risk jurisdiction (${namedNf}); this matches an OFAC FFI advisory red-flag pattern and is an escalation flag for human review, not a sanctions determination.`
    );
  }
  if (matchedSanctionsSegments.length > 0) {
    const namedSeg = matchedSanctionsSegments.join(", ");
    limitations.push(
      `The declared route references one or more connections flagged as sanctions-exposed (${namedSeg}); this is a route-screening escalation flag for human review, not a sanctions determination. Screen the specific connection, its operators, and any onward destination before any commercial action.`
    );
  }
  if (limitations.length > 0) response.limitations = limitations;
  if (matchedSanctionsSegments.length > 0) {
    response.route_sanctions_matched_segments = [...matchedSanctionsSegments];
  }
  if (minimumSourcesBeforeGo.includes("vessel_or_carrier_history")) {
    response.vessel_due_diligence_indicators = [...VESSEL_DUE_DILIGENCE_INDICATORS];
  }
  if (!suppliedSources.includes("end_user_or_reexport_evidence")) {
    response.reexport_control_indicators = [...REEXPORT_CONTROL_INDICATORS];
  }
  if (!suppliedSources.includes("source_of_funds_or_wealth_evidence")) {
    response.source_of_funds_indicators = [...SOURCE_OF_FUNDS_INDICATORS];
  }
  if (!suppliedSources.includes("pep_screening_evidence")) {
    response.pep_screening_indicators = [...PEP_SCREENING_INDICATORS];
  }
  if (!suppliedSources.includes("business_substance_evidence")) {
    response.front_company_indicators = [...FRONT_COMPANY_INDICATORS];
  }
  if (request.shipment_value) response.shipment_value = request.shipment_value;
  return response;
}

function sourcePlanForModules(modules) {
  const moduleNames = new Set(modules.map((item) => item.module));
  const categories = [
    "primary official source for the triggering event or rule",
    "independent secondary context that does not replace the primary source",
    "dated retrieval notes so stale-risk can be reviewed later"
  ];

  if (moduleNames.has("sanctions-sector")) {
    categories.push(
      "sanctions authority pages and list entries, such as OFAC, EU, UK OFSI, UN, or relevant national regulators",
      "trade, shipping, ownership, banking, insurance, or export-control evidence for operational exposure"
    );
  }
  if (moduleNames.has("central-asia-caspian")) {
    categories.push(
      "Central Asia/Caspian government, customs, transport, corridor, and state-company sources",
      "IFI, logistics, energy, or regional-market sources that expose corridor and counterparty constraints"
    );
  }
  if (moduleNames.has("gulf-middle-east")) {
    categories.push(
      "Gulf/Middle East official statements, maritime-security, energy, shipping, and insurance sources",
      "regional conflict, chokepoint, and trade-finance indicators for escalation monitoring"
    );
  }
  if (moduleNames.has("eu")) {
    categories.push(
      "EU institution, regulator, Official Journal, national authority, and court sources",
      "implementation guidance and enforcement signals that separate legal text from policy rhetoric"
    );
  }

  return [...new Set(categories)];
}

function affectedRegionsForModules(modules) {
  const moduleNames = new Set(modules.map((item) => item.module));
  const regions = [];
  if (moduleNames.has("central-asia-caspian")) regions.push("Central Asia/Caspian");
  if (moduleNames.has("gulf-middle-east")) regions.push("Gulf/Middle East");
  if (moduleNames.has("eu")) regions.push("European Union");
  if (regions.length === 0) regions.push("Global/cross-border");
  return regions;
}

function sourceCategoriesForModules(modules) {
  const moduleNames = new Set(modules.map((item) => item.module));
  const categories = ["primary official source", "independent context source", "dated retrieval note"];
  if (moduleNames.has("sanctions-sector")) {
    categories.push("sanctions authority", "trade finance", "ownership/counterparty", "shipping or logistics");
  }
  if (moduleNames.has("central-asia-caspian")) {
    categories.push("corridor operator", "customs/transport authority", "state-company or IFI source");
  }
  if (moduleNames.has("gulf-middle-east")) {
    categories.push("maritime security", "energy/shipping market", "regional official statement");
  }
  if (moduleNames.has("eu")) {
    categories.push("EU institution", "national regulator", "Official Journal or court source");
  }
  return [...new Set(categories)];
}

function hasSuppliedSourceForCategory(category, suppliedSources, text) {
  const supplied = new Set(suppliedSources);
  if (category === "primary official source") {
    return [
      "sanctions_list_extract",
      "port_operator_notice",
      "counterparty_registry_extract",
      "customs_or_regulatory_source"
    ].some((source) => supplied.has(source));
  }
  if (category === "dated retrieval note") {
    return /\b(?:dated|checked at|retrieved)\s+\d{4}-\d{2}-\d{2}/i.test(text);
  }
  if (category === "sanctions authority") return supplied.has("sanctions_list_extract");
  if (category === "ownership/counterparty") {
    return supplied.has("counterparty_registry_extract") || supplied.has("beneficial_ownership_source");
  }
  if (category === "shipping or logistics") {
    return supplied.has("carrier_note") || supplied.has("vessel_or_carrier_history");
  }
  if (category === "corridor operator") return supplied.has("port_operator_notice");
  if (category === "customs/transport authority") {
    return supplied.has("customs_or_regulatory_source") || supplied.has("port_operator_notice");
  }
  if (category === "trade finance") {
    return supplied.has("insurance_clause_or_underwriter_note") || supplied.has("sanctions_list_extract");
  }
  return false;
}

function watchNextForModules(modules) {
  const moduleNames = new Set(modules.map((item) => item.module));
  const items = [
    "new primary-source update that changes the triggering fact",
    "contradictory official statement or implementation guidance"
  ];
  if (moduleNames.has("sanctions-sector")) {
    items.push("new OFAC/EU/UK/UN designation, licence, FAQ, guidance, or enforcement notice");
    items.push("banking, insurance, ownership, or export-control exposure change");
  }
  if (moduleNames.has("central-asia-caspian")) {
    items.push("corridor disruption notice, customs rule change, tariff update, or state-company statement");
  }
  if (moduleNames.has("gulf-middle-east")) {
    items.push("maritime incident, insurance premium movement, port restriction, or chokepoint security update");
  }
  if (moduleNames.has("eu")) {
    items.push("EU Council/Commission update, Official Journal publication, regulator guidance, or court decision");
  }
  return [...new Set(items)];
}

function signalScreenForText(text, modules, intent) {
  const moduleNames = new Set(modules.map((item) => item.module));
  const lower = text.toLowerCase();
  const isSanctions = moduleNames.has("sanctions-sector");
  const isCorridor = moduleNames.has("central-asia-caspian") || hasAny(lower, ["corridor", "transit", "kazakhstan"]);
  const isMaritime = moduleNames.has("gulf-middle-east") || hasAny(lower, ["red sea", "shipping", "hormuz", "maritime"]);

  let riskSignal = "Strategic-risk question requires source-backed triage before raising confidence.";
  if (isSanctions && isCorridor && isMaritime) {
    riskSignal =
      "Sanctions or maritime disruption may increase transit, insurance, counterparty, and trade-finance risk for corridor-linked flows.";
  } else if (isSanctions && isCorridor) {
    riskSignal =
      "Sanctions exposure may affect corridor-linked counterparties, logistics providers, banks, or state-connected entities.";
  } else if (isSanctions) {
    riskSignal =
      "Sanctions-policy movement may create counterparty, ownership, banking, export-control, or compliance-screening exposure.";
  } else if (isMaritime) {
    riskSignal =
      "Maritime disruption may shift routing, insurance, logistics cost, and escalation assumptions for exposed trade flows.";
  }

  const sourceCategories = sourceCategoriesForModules(modules);
  const explicitlyMissingSources = detectExplicitlyMissingSources(text);
  const suppliedSources = detectSuppliedSources(text).filter((source) => !explicitlyMissingSources.includes(source));
  const missingSourceCategories = sourceCategories.filter(
    (category) => !hasSuppliedSourceForCategory(category, suppliedSources, text)
  );
  return {
    intent,
    risk_signal: riskSignal,
    affected_regions: affectedRegionsForModules(modules),
    source_categories_required: sourceCategories,
    evidence_gaps: missingSourceCategories
      .slice(0, 5)
      .map((category) => `No caller-supplied ${category} evidence in this live A2A request.`),
    watch_next: watchNextForModules(modules),
    recommended_mcp_tool:
      intent === "source_coverage"
        ? "source_coverage"
        : intent === "evidence_audit"
          ? "audit_claims"
          : "analyze",
    confidence: "triage_only_no_live_retrieval"
  };
}

function qualityGatesForIntent(intent) {
  const gates = [
    "Separate facts, assessments, assumptions, and unknowns.",
    "Attach evidence ids to load-bearing claims.",
    "Mark unsupported claims instead of smoothing them away.",
    "State what would change the judgment."
  ];

  if (intent === "memo_validation") {
    gates.unshift("Validate the memo against agenda-memo.schema.json before using it downstream.");
  }
  if (intent === "deal_risk_gate" || intent === "middle_corridor_deal_risk_contract") {
    gates.unshift("Treat proceed/pause/escalate as routing guidance for human review, not approval advice.");
    gates.unshift("Escalate before signature when required source categories are missing.");
  }
  if (intent === "sanctions_policy_signal_screen") {
    gates.unshift("Treat the signal screen as a lead, not a verified finding.");
  }
  if (intent === "evidence_audit" || intent === "source_coverage") {
    gates.unshift("Check source-category coverage before treating the evidence pack as complete.");
  }
  if (intent === "signal_monitoring") {
    gates.push("Convert durable signals into watch-next indicators with review dates.");
  }

  return gates;
}

function nextActionsForIntent(intent) {
  if (intent === "memo_validation") {
    return [
      "Install the MCP package and run validate_memo against the candidate memo JSON.",
      "Fix schema errors before asking an agent to expand or summarize the memo."
    ];
  }
  if (intent === "deal_risk_gate" || intent === "middle_corridor_deal_risk_contract") {
    return [
      "Fill the minimum_sources_before_go list before contract signature or committee review.",
      "Run source_coverage and audit_claims in the MCP server with the dated evidence pack.",
      "Escalate unsupported sanctions, ownership, insurance, customs, or vessel-history claims to human review."
    ];
  }
  if (intent === "evidence_audit") {
    return [
      "Run audit_claims with the memo and evidence pack.",
      "Review unsupported_claims and orphan evidence references before publishing the analysis."
    ];
  }
  if (intent === "source_coverage") {
    return [
      "Run source_coverage with the topic categories that match the risk question.",
      "Fill required_but_missing_sources before raising confidence."
    ];
  }
  if (intent === "sanctions_policy_signal_screen") {
    return [
      "Use the signal_screen object as the first-pass risk lead.",
      "Attach primary sources, then run analyze or source_coverage in the MCP server for a full memo."
    ];
  }
  if (intent === "signal_monitoring") {
    return [
      "Use list_signals/get_signal for existing signal examples.",
      "Open a signal tracker only if the event needs monitoring across sessions."
    ];
  }
  return [
    "Use the suggested modules as the analysis load-list.",
    "Run the MCP analyze tool for the full memo contract and validation path."
  ];
}

function triageForText(text, modules, profile = "agenda", structuredRequest = null) {
  const intent =
    profile === "kazakhstan" && structuredRequest
      ? "middle_corridor_deal_risk_contract"
      : classifyIntentForProfile(text, profile);
  return {
    intent,
    modules,
    signal_screen: signalScreenForText(text, modules, intent),
    deal_risk_gate: intent === "deal_risk_gate" ? dealRiskGateForText(text) : null,
    deal_risk_contract:
      intent === "middle_corridor_deal_risk_contract" ? dealRiskContractResponseForRequest(structuredRequest) : null,
    source_plan: sourcePlanForModules(modules),
    quality_gates: qualityGatesForIntent(intent),
    next_actions: nextActionsForIntent(intent),
    install: {
      package: PACKAGE_URL,
      command: "pip install agenda-intelligence-md",
      mcp_server_command: "agenda-intelligence-mcp"
    }
  };
}

function headerHost(request, headerName) {
  const value = request.headers.get(headerName);
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch (_error) {
    return null;
  }
}

// message/send payloads below this many prompt characters are treated as
// health probes. Real triage requests carry hundreds of characters; the
// known monitors (Agenstry, uptime pingers) send near-empty payloads. This
// catches small-payload probes that do not announce themselves as "agenstry"
// in the user-agent (e.g. untagged uptime checks from monitor colos).

function classifyClient(request) {
  const clientId = request.headers.get("x-client-id");
  if (clientId) return safeClientId(clientId);
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  if (userAgent.includes("agenstry")) return "agenstry";
  if (userAgent.includes("curl")) return "curl";
  if (userAgent.includes("wrangler")) return "wrangler";
  if (userAgent.includes("bot") || userAgent.includes("crawler") || userAgent.includes("spider")) return "automation";
  if (userAgent.includes("mozilla")) return "browser";
  return "unknown";
}

function safeClientId(value) {
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9._:-]/g, "-");
  return normalized.slice(0, 64) || "unknown";
}

// Billable upstreams (per ADR 0014). OpenSanctions hosted API is the only
// paid live-retrieval upstream (€0.10/call); Watchman self-host and the
// deterministic triage path cost €0. Used for per-task cost accounting in
// usageStats — no LLM is called on the Worker path, so upstream calls are
// the only real per-request spend.
const BILLABLE_UPSTREAM_EUR = { OpenSanctions: 0.1 };

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Extract per-request billable cost from a result's live-retrieval metadata.
// A call is billed only when a paid upstream actually returned data
// (status "success"). "disabled" = no call made; "degraded" = the call
// failed, treated as non-billable (providers typically do not bill failed
// lookups) — conservative on the side of not over-reporting spend.
function billableUpstreamCost(result) {
  const status = result?.metadata?.live_retrieval_status ?? null;
  const upstream = result?.metadata?.live_retrieval_upstream ?? null;
  const unit = upstream ? BILLABLE_UPSTREAM_EUR[upstream] : undefined;
  if (status !== "success" || !unit) {
    return { status, upstream, billable: false, cost_eur: 0 };
  }
  return { status, upstream, billable: true, cost_eur: unit };
}

function buildUsageEvent(request, details = {}) {
  const url = new URL(request.url);
  const cf = request.cf || {};
  const promptChars = Number.isFinite(details.prompt_chars) ? details.prompt_chars : 0;

  return {
    event: "agenda_intelligence_a2a_usage",
    event_version: 1,
    timestamp: new Date().toISOString(),
    source: "cloudflare_worker",
    method: request.method,
    path: url.pathname,
    host: url.hostname,
    jsonrpc_method: details.jsonrpc_method || null,
    jsonrpc_id_present: Boolean(details.jsonrpc_id_present),
    agent_profile: details.agent_profile || agentProfile(request),
    prompt_chars: promptChars,
    modules_used: Array.isArray(details.modules_used) ? details.modules_used.map((item) => item.module) : [],
    live_retrieval: details.live_retrieval || { status: null, upstream: null, billable: false, cost_eur: 0 },
    client: classifyClient(request),
    referrer_host: headerHost(request, "referer"),
    cf: {
      colo: cf.colo || null,
      country: cf.country || null
    },
    likely_probe: Boolean(details.likely_probe)
  };
}

function logUsageEvent(request, details) {
  const event = buildUsageEvent(request, details);
  console.log(event);
  return event;
}

function dateKeyFromTimestamp(timestamp) {
  if (typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
    return new Date().toISOString().slice(0, 10);
  }
  return timestamp.slice(0, 10);
}

function dateKeyFromRequest(request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function statsTokenFromRequest(request) {
  const url = new URL(request.url);
  return request.headers.get("x-stats-token") || url.searchParams.get("token") || "";
}

function isStatsAuthorized(request, env) {
  if (!env?.STATS_TOKEN) return false;
  return statsTokenFromRequest(request) === env.STATS_TOKEN;
}

async function recordUsageStats(env, event) {
  const kv = env?.AGENDA_USAGE;
  if (!kv || !event || event.event !== "agenda_intelligence_a2a_usage") return;

  const day = dateKeyFromTimestamp(event.timestamp);
  const key = `usage-event:${day}:${event.timestamp}:${crypto.randomUUID()}`;
  await kv.put(
    key,
    JSON.stringify({
      timestamp: event.timestamp,
      agent_profile: event.agent_profile || "unknown",
      host: event.host || "unknown",
      jsonrpc_method: event.jsonrpc_method || "unknown",
      prompt_chars: event.prompt_chars || 0,
      likely_probe: Boolean(event.likely_probe),
      client: event.client || "unknown",
      country: event.cf?.country || "unknown",
      modules_used: Array.isArray(event.modules_used) ? event.modules_used : [],
      live_retrieval: event.live_retrieval || { status: null, upstream: null, billable: false, cost_eur: 0 }
    })
  );
}

function incrementMap(map, key) {
  const safeKey = key || "unknown";
  map.set(safeKey, (map.get(safeKey) || 0) + 1);
}

function sortedMap(map) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function listOrNone(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none detected";
}

async function listUsageEvents(kv, date) {
  const events = [];
  let cursor;

  do {
    const result = await kv.list({ prefix: `usage-event:${date}:`, cursor });
    const rows = await Promise.all(
      result.keys.map(async (item) => {
        const raw = await kv.get(item.name);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (_error) {
          return null;
        }
      })
    );
    events.push(...rows.filter(Boolean));
    cursor = result.cursor;
    if (result.list_complete !== false) break;
  } while (cursor);

  return events;
}

async function usageStats(env, date) {
  const kv = env?.AGENDA_USAGE;
  if (!kv) {
    return {
      configured: false,
      error: "AGENDA_USAGE KV binding is not configured"
    };
  }

  const events = await listUsageEvents(kv, date);
  const clients = new Map();
  const countries = new Map();
  const methods = new Map();
  const modules = new Map();
  const agentProfiles = new Map();
  const hosts = new Map();
  const upstreams = new Map();
  let likelyProbe = 0;
  let promptChars = 0;
  let billableCalls = 0;
  let estimatedCostEur = 0;

  for (const event of events) {
    if (event.likely_probe) likelyProbe += 1;
    promptChars += Number.isFinite(event.prompt_chars) ? event.prompt_chars : 0;
    const lr = event.live_retrieval;
    if (lr && lr.billable) {
      billableCalls += 1;
      estimatedCostEur += Number.isFinite(lr.cost_eur) ? lr.cost_eur : 0;
      incrementMap(upstreams, lr.upstream || "unknown");
    }
    incrementMap(agentProfiles, event.agent_profile);
    incrementMap(hosts, event.host);
    incrementMap(clients, event.client);
    incrementMap(countries, event.country);
    incrementMap(methods, event.jsonrpc_method);
    for (const moduleName of Array.isArray(event.modules_used) ? event.modules_used : []) {
      incrementMap(modules, moduleName);
    }
  }

  const total = events.length;
  const nonProbe = total - likelyProbe;

  return {
    configured: true,
    date,
    generated_at: new Date().toISOString(),
    approximate: true,
    counters: {
      total,
      non_probe: nonProbe,
      likely_probe: likelyProbe,
      prompt_chars_total: promptChars,
      prompt_chars_avg: total > 0 ? Math.round(promptChars / total) : 0,
      billable_calls: billableCalls
    },
    cost: {
      estimated_cost_eur: round2(estimatedCostEur),
      billable_upstreams: sortedMap(upstreams),
      budget: budgetStatus(env, estimatedCostEur)
    },
    clients: sortedMap(clients),
    agent_profiles: sortedMap(agentProfiles),
    hosts: sortedMap(hosts),
    countries: sortedMap(countries),
    methods: sortedMap(methods),
    modules: sortedMap(modules)
  };
}

// Daily spend vs an optional configurable cap (USAGE_BUDGET_EUR_PER_DAY).
// Emits a 50/75/90 alert level so the /stats surface and operators can see
// budget pressure. When no cap is configured, reports configured:false and
// no alert — the Worker never blocks on budget, it only reports.
function budgetStatus(env, estimatedCostEur) {
  const cap = Number(env?.USAGE_BUDGET_EUR_PER_DAY);
  if (!Number.isFinite(cap) || cap <= 0) {
    return { configured: false, alert_level: "none" };
  }
  const pct = Math.round((estimatedCostEur / cap) * 100);
  let alert_level = "none";
  if (pct >= 90) alert_level = "90";
  else if (pct >= 75) alert_level = "75";
  else if (pct >= 50) alert_level = "50";
  return {
    configured: true,
    cap_eur_per_day: cap,
    spent_eur: round2(estimatedCostEur),
    pct_of_budget: pct,
    alert_level
  };
}

function routingMarkdown(text, modules, profile = "agenda", triageOverride = null) {
  const triageText =
    profile === "kazakhstan"
      ? `${text}\nKazakhstan Central Asia Caspian Middle Corridor sanctions corridor risk`
      : text;
  const triage = triageOverride || triageForText(triageText, modules, profile);
  const moduleList = modules.map((item) => `- ${item.module}: ${item.role}`).join("\n");
  const screen = triage.signal_screen;
  const sourceList = triage.source_plan.map((item) => `- ${item}`).join("\n");
  const qualityList = triage.quality_gates.map((item) => `- ${item}`).join("\n");
  const actionList = triage.next_actions.map((item) => `- ${item}`).join("\n");
  const regionList = screen.affected_regions.map((item) => `- ${item}`).join("\n");
  const requiredSourceList = screen.source_categories_required.map((item) => `- ${item}`).join("\n");
  const gapList = screen.evidence_gaps.map((item) => `- ${item}`).join("\n");
  const watchList = screen.watch_next.map((item) => `- ${item}`).join("\n");
  const dealGateBlock =
    triage.deal_risk_gate && profile === "kazakhstan"
      ? [
          "Deal risk gate:",
          `Recommendation: ${triage.deal_risk_gate.triage_recommendation}`,
          `Risk signal: ${triage.deal_risk_gate.risk_signal}`,
          `Route: ${triage.deal_risk_gate.route}`,
          `Cargo: ${triage.deal_risk_gate.cargo}`,
          triage.deal_risk_gate.value ? `Value: ${triage.deal_risk_gate.value}` : null,
          `Counterparties: ${triage.deal_risk_gate.counterparties}`,
          "",
          "Supplied source types detected:",
          listOrNone(triage.deal_risk_gate.supplied_sources),
          "",
          "Minimum sources before go:",
          listOrNone(triage.deal_risk_gate.minimum_sources_before_go),
          "",
          `Reason: ${triage.deal_risk_gate.reason}`,
          "",
          "Commercial impact:",
          triage.deal_risk_gate.commercial_impact.map((item) => `- ${item}`).join("\n"),
          "",
          "Human review required: true",
          "Not legal/compliance advice: true",
          ""
        ]
          .filter((item) => item !== null)
          .join("\n")
      : "";
  const dealContractBlock =
    triage.deal_risk_contract && profile === "kazakhstan"
      ? [
          "Middle Corridor deal-risk contract response:",
          `Recommendation: ${triage.deal_risk_contract.triage_recommendation}`,
          `Risk signal: ${triage.deal_risk_contract.risk_signal}`,
          `Decision readiness: ${triage.deal_risk_contract.decision_readiness_score}/100 (${triage.deal_risk_contract.decision_readiness_label})`,
          `Operational decision: ${triage.deal_risk_contract.operational_decision.decision} (${triage.deal_risk_contract.operational_decision.applies_to})`,
          `Route: ${triage.deal_risk_contract.route}`,
          `Cargo: ${triage.deal_risk_contract.cargo}`,
          "",
          "Supplied source types:",
          listOrNone(triage.deal_risk_contract.supplied_sources),
          "",
          "Minimum sources before go:",
          listOrNone(triage.deal_risk_contract.minimum_sources_before_go),
          "",
          "Evidence gaps:",
          listOrNone(triage.deal_risk_contract.evidence_gaps),
          "",
          "Structured JSON:",
          "```json",
          JSON.stringify(triage.deal_risk_contract, null, 2),
          "```",
          ""
        ].join("\n")
      : "";
  const promptLine = text ? `\n\nReceived prompt excerpt:\n\n> ${text.slice(0, 500)}` : "";
  const title =
    profile === "kazakhstan"
      ? "Kazakhstan / Middle Corridor Deal Risk Gate live wrapper is responding."
      : "Agenda Intelligence MD live wrapper is responding.";
  const scope =
    profile === "kazakhstan"
      ? "This endpoint is a free, no-payment A2A/JSON-RPC wrapper for Kazakhstan and Middle Corridor deal-risk triage, sanctions-adjacent evidence gating, source coverage, memo quality gates, and routing. Full product behavior is in the installable MCP server:"
      : "This endpoint is a free, no-payment A2A/JSON-RPC wrapper for discovery, uptime, lightweight strategic-risk triage, and routing. Full product behavior is in the installable MCP server:";
  return [
    title,
    "",
    scope,
    "",
    "```bash",
    "pip install agenda-intelligence-md",
    "agenda-intelligence-mcp",
    "```",
    "",
    `Detected intent: ${triage.intent}`,
    "",
    dealGateBlock,
    dealContractBlock,
    "Signal screen:",
    `Risk signal: ${screen.risk_signal}`,
    "",
    "Affected regions:",
    regionList,
    "",
    "Required source categories:",
    requiredSourceList,
    "",
    "Evidence gaps:",
    gapList,
    "",
    "Watch next:",
    watchList,
    "",
    `Recommended MCP tool: ${screen.recommended_mcp_tool}`,
    "",
    "Suggested modules:",
    moduleList,
    "",
    "Evidence/source plan:",
    sourceList,
    "",
    "Quality gates:",
    qualityList,
    "",
    "Next actions:",
    actionList,
    "",
    "Boundaries: no live retrieval, no factual-truth verification, no legal/financial/compliance advice.",
    promptLine
  ].join("\n");
}

function a2aResult(params, request, env = {}) {
  const structuredRequest = structuredDealRiskRequestFromParams(params);
  if (structuredRequest) {
    const enumErrors = middleCorridorEnumErrors(structuredRequest);
    if (enumErrors.length) {
      return invalidRequestResult(
        "kazakhstan",
        "/v1/middle-corridor/deal-risk",
        "schemas/v1/middle-corridor-deal-risk-request.schema.json",
        enumErrors
      );
    }
  }
  const text = structuredRequest ? textFromStructuredDealRiskRequest(structuredRequest) : extractText(params);
  const profile = agentProfile(request, env);
  const triageText =
    profile === "kazakhstan"
      ? `${text}\nKazakhstan Central Asia Caspian Middle Corridor sanctions corridor risk`
      : text;
  const modules = routeModulesForProfile(text, profile);
  const triage = triageForText(triageText, modules, profile, structuredRequest);
  return {
    id: crypto.randomUUID(),
    status: {
      state: "TASK_STATE_COMPLETED",
      timestamp: new Date().toISOString()
    },
    artifacts: [
      {
        artifactId: "agenda-intelligence-routing-note",
        name: "Agenda Intelligence routing note",
        parts: [
          {
            text: routingMarkdown(text, modules, profile, triage),
            mediaType: "text/markdown"
          },
          {
            // Expose the product-level structured response as the primary
            // machine-readable payload when present (deal-risk contract for a
            // structured request, deal-risk gate for freeform text); fall back
            // to the full routing triage for the general agenda profile.
            data: triage.deal_risk_contract || triage.deal_risk_gate || triage,
            mediaType: "application/json"
          }
        ]
      }
    ],
    metadata: {
      agent_card: `${originFromRequest(request)}/.well-known/agent-card.json`,
      repository: REPOSITORY_URL,
      package: PACKAGE_URL,
      mcp_transport: "stdio",
      mcp_server_command: "agenda-intelligence-mcp",
      modules_used: modules,
      triage,
      signal_screen: triage.signal_screen,
      wrapper_scope:
        profile === "kazakhstan"
          ? "Kazakhstan and Middle Corridor deal-risk triage, evidence gating, and routing response only"
          : "discovery, lightweight triage, and routing response only",
      product_profile: profile
    }
  };
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

async function handleJsonRpc(payload, request, env = {}, ctx = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonRpcError(null, -32600, "Invalid Request");
  }

  const id = payload.id ?? null;
  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(id, -32600, "Invalid Request");
  }

  if (payload.method === "message/send" || payload.method === "tasks/send" || payload.method === "SendMessage") {
    const params = payload.params ?? {};
    const profile = agentProfile(request, env);
    let result;
    let promptChars;
    let modulesUsed;
    if (profile === "cis_secondary_sanctions") {
      result = await a2aResultForCisSecondarySanctions(params, request, env);
      const structured = structuredCisSecondarySanctionsRequestFromParams(params);
      promptChars = structured && structured.risk_question ? structured.risk_question.length : 0;
      modulesUsed = ["cis_secondary_sanctions"];
    } else if (profile === "agentic_interaction_trust") {
      result = a2aResultForAgenticInteractionTrust(params);
      const structured = structuredAgenticInteractionTrustRequestFromParams(params);
      promptChars = structured && structured.risk_question ? structured.risk_question.length : 0;
      modulesUsed = ["agentic_interaction_trust"];
    } else if (profile === "gulf_maritime_exposure") {
      result = a2aResultForGulfMaritimeExposure(params);
      const structured = structuredGulfMaritimeRequestFromParams(params);
      promptChars = structured && structured.risk_question ? structured.risk_question.length : 0;
      modulesUsed = ["gulf_maritime_exposure"];
    } else if (profile === "market_entry_readiness") {
      result = a2aResultForMarketEntryReadiness(params);
      const structured = structuredMarketEntryReadinessRequestFromParams(params);
      promptChars = structured && structured.decision_question ? structured.decision_question.length : 0;
      modulesUsed = ["market_entry_readiness"];
    } else {
      result = a2aResult(params, request, env);
      const structuredRequest = structuredDealRiskRequestFromParams(params);
      const text = structuredRequest ? textFromStructuredDealRiskRequest(structuredRequest) : extractText(params);
      promptChars = text.length;
      modulesUsed = result.metadata.modules_used;
    }
    const likelyProbe =
      classifyClient(request) === "agenstry" || promptChars < PROBE_PROMPT_CHAR_THRESHOLD;
    const event = logUsageEvent(request, {
      jsonrpc_method: payload.method,
      jsonrpc_id_present: payload.id !== undefined,
      agent_profile: result.metadata.product_profile,
      prompt_chars: promptChars,
      modules_used: modulesUsed,
      live_retrieval: billableUpstreamCost(result),
      likely_probe: likelyProbe
    });
    const statsPromise = recordUsageStats(env, event).catch((error) => {
      console.warn("usage stats write failed", error);
    });
    if (typeof ctx.waitUntil === "function") {
      ctx.waitUntil(statsPromise);
    }

    return {
      jsonrpc: "2.0",
      id,
      result
    };
  }

  if (payload.method === "agent/card" || payload.method === "agentCard" || payload.method === "GetExtendedAgentCard") {
    return {
      jsonrpc: "2.0",
      id,
      result: agentCard(request, env)
    };
  }

  return jsonRpcError(id, -32601, "Method not found", {
    supported_methods: ["message/send", "tasks/send", "agent/card"]
  });
}

async function handlePost(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse(jsonRpcError(null, -32700, "Parse error"), 200);
  }
  const method = payload && typeof payload === "object" ? payload.method : null;
  if (MESSAGE_SEND_METHODS.has(method)) {
    const profile = agentProfile(request, env);
    if (!isProductionAuthorized(request, env, profile)) {
      return jsonResponse(
        jsonRpcError(
          payload.id ?? null,
          -32001,
          "Unauthorized: the production route requires a valid Bearer access key",
          { security_scheme: "productionBearer", profile }
        ),
        401,
        { "www-authenticate": "Bearer", "cache-control": "no-store" }
      );
    }
  }
  return jsonResponse(await handleJsonRpc(payload, request, env, ctx));
}

async function handleStats(request, env) {
  if (!isStatsAuthorized(request, env)) {
    return jsonResponse(
      {
        error: "Unauthorized"
      },
      401,
      {
        "cache-control": "no-store"
      }
    );
  }

  const date = dateKeyFromRequest(request);
  if (!date) {
    return jsonResponse(
      {
        error: "Invalid date. Use YYYY-MM-DD."
      },
      400
    );
  }

  const stats = await usageStats(env, date);
  return jsonResponse(stats, stats.configured ? 200 : 503);
}

function healthInfo(request, env) {
  const card = agentCard(request, env);
  const origin = originFromRequest(request);
  return {
    ok: true,
    name: card.name,
    version: VERSION,
    profile: agentProfile(request, env),
    agent_card: `${origin}/.well-known/agent-card.json`,
    message_send: `${origin}/message/send`,
    status: `${origin}/status`,
    stats: `${origin}/stats`,
    stats_auth: "x-stats-token header or token query parameter",
    repository: REPOSITORY_URL,
    payments: false
  };
}

function statusInfo(request, env) {
  const origin = originFromRequest(request);
  const profile = agentProfile(request, env);
  const card = agentCard(request, env);
  const liveRetrievalMeta = PROFILE_LIVE_RETRIEVAL[profile] || PROFILE_LIVE_RETRIEVAL.agenda;
  const liveRetrievalActive = isLiveRetrievalActive(profile, env);
  const status = {
    status: "ok",
    name: card.name,
    version: VERSION,
    profile,
    a2a_protocol_version: card.protocolVersion,
    agent_card_url: `${origin}/.well-known/agent-card.json`,
    message_send_url: `${origin}/message/send`,
    repository: REPOSITORY_URL,
    package: PACKAGE_URL,
    boundaries: {
      not_advice: true,
      live_retrieval: liveRetrievalActive,
      factual_verification: false,
      human_review_required:
        profile === "kazakhstan" ||
        profile === "cis_secondary_sanctions" ||
        profile === "agentic_interaction_trust"
    }
  };
  if (liveRetrievalMeta.capability_declared) {
    const active = activeUpstreamOption(profile, env);
    status.live_retrieval = {
      capability_declared: true,
      active: liveRetrievalActive,
      active_upstream: active ? active.name : null,
      upstream_options: liveRetrievalMeta.upstream_options.map((option) => ({
        name: option.name,
        license: option.license,
        homepage: option.homepage,
        activation_env_var: option.activation_env_var,
        disable_env_var: option.disable_env_var,
        cost_model: option.cost_model,
        active: isUpstreamOptionActive(option, env)
      })),
      adr: CIS_SECONDARY_SANCTIONS_ADR_URL
    };
    if (!liveRetrievalActive) {
      status.live_retrieval.deferral_note =
        "Per the 2026-05-27 update to ADR 0014, live retrieval upstreams are declared but not activated. Set WATCHMAN_URL (free self-host of moov-io/watchman) or OPENSANCTIONS_API_KEY (paid €0.10/call) to activate. Profile currently operates on user-supplied evidence only.";
    }
  }
  return status;
}

function landingHtml(request, env) {
  const origin = originFromRequest(request);
  const profile = agentProfile(request, env);
  const card = agentCard(request, env);
  const isKazakhstan = profile === "kazakhstan";
  const isAgentic = profile === "agentic_interaction_trust";

  const title = escapeHtml(card.name);
  const tagline = isKazakhstan
    ? "Pre-compliance evidence triage for Kazakhstan / Middle Corridor deal flow — route, cargo, counterparties, dated sources → auditable risk gate."
    : isAgentic
      ? "Evidence-readiness gate for agent-mediated actions — actor, target surface, requested action, dated evidence → auditable trust-routing triage."
      : "Evidence-discipline layer for strategic intelligence agents — geography-routed structured risk triage with explicit source provenance.";

  const tryItCurl = isKazakhstan
    ? `curl -X POST ${origin}/message/send \\
  -H 'content-type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [
          { "text": "Screen Kazakhstan Middle Corridor sanctions exposure for a logistics route.", "mediaType": "text/plain" }
        ]
      }
    }
  }'`
    : isAgentic
      ? `curl -X POST ${origin}/message/send \\
  -H 'content-type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "agentic-demo-1",
    "method": "message/send",
    "params": {
      "request": {
        "actor": {"declared_type": "ai_agent", "declared_name": "Example Shopping Agent", "operator": "Example Consumer", "authentication_context": "session_cookie"},
        "target_surface": "checkout",
        "requested_action": "complete purchase of two restricted-delivery items",
        "asset_or_resource": "order-123",
        "decision_stage": "pre_execution",
        "dated_sources": [
          {"id": "ait-1", "source_type": "agent_identity_claim", "title": "Declared agent identity header", "date": "2026-05-28"},
          {"id": "ait-2", "source_type": "session_authentication_evidence", "title": "Authenticated checkout session", "date": "2026-05-28"},
          {"id": "ait-3", "source_type": "transaction_or_target_action_evidence", "title": "Order summary", "date": "2026-05-28"}
        ],
        "risk_question": "Is this agent-mediated checkout ready to allow, step up, or route to human review?"
      }
    }
  }'`
    : `curl -X POST ${origin}/message/send \\
  -H 'content-type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "parts": [
          { "text": "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure.", "mediaType": "text/plain" }
        ]
      }
    }
  }'`;

  const flagshipBlock = isKazakhstan
    ? `<p>This worker is the live Kazakhstan / Middle Corridor Deal Risk Gate — the flagship commercial use case of the Agenda Intelligence runtime. It accepts route + cargo + counterparties + dated sources and returns an auditable triage with evidence gaps, missing source categories, decision-readiness score, and a three-value recommendation (insufficient_information, pre_signature_escalate, ready_for_human_review). Human review is required before any commercial action.</p>`
    : isAgentic
      ? `<p>This worker is the live Agentic Interaction Trust Gate. It accepts actor + target surface + requested action + dated evidence and returns an auditable trust-routing triage with evidence gaps, missing source categories, decision-readiness score, trust signal, and mandatory human-review routing. It is not a detection engine and does not authorize, deny, or block actions.</p>`
    : `<p>This worker is the general Agenda Intelligence A2A wrapper — discovery, uptime checks, lightweight strategic-risk triage, and JSON-RPC routing across geography-aware modules. For deeper Kazakhstan / Middle Corridor deal-risk screening, use the dedicated <a href="https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/">deal-risk-gate worker</a>.</p>`;

  const agenstryListing = isKazakhstan
    ? "https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev"
    : "https://agenstry.com/agents/agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${escapeHtml(tagline)}">
<style>
  :root {
    --fg: #1a1a1a; --muted: #4a4a4a; --line: #d8d8d8;
    --bg: #fafafa; --card: #ffffff; --accent: #1e5b8c;
    --good: #1f7a3a; --warn: #8c5a1e;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body { font-family: var(--sans); color: var(--fg); background: var(--bg); margin: 0; line-height: 1.55; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 24px 96px; }
  h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.01em; }
  h2 { font-size: 16px; margin: 32px 0 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  p { margin: 0 0 12px; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(30,91,140,0.3); }
  a:hover { border-bottom-color: var(--accent); }
  .tagline { color: var(--muted); font-size: 17px; margin: 0 0 24px; }
  .status-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 0 0 8px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-family: var(--mono); border: 1px solid var(--line); background: var(--card); }
  .badge-live { color: var(--good); }
  .badge-live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--good); display: inline-block; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px 20px; margin: 0 0 16px; }
  pre { background: #1a1a1a; color: #f0f0f0; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: var(--mono); font-size: 13px; line-height: 1.5; margin: 0; }
  code { font-family: var(--mono); font-size: 13px; background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 3px; }
  ul { margin: 0; padding-left: 20px; }
  li { margin: 4px 0; }
  .endpoints { font-family: var(--mono); font-size: 13px; }
  .endpoints li { margin: 6px 0; }
  .endpoints .label { color: var(--muted); display: inline-block; min-width: 130px; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
  footer p { margin: 0 0 6px; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p class="tagline">${escapeHtml(tagline)}</p>

  <div class="status-row">
    <span class="badge badge-live">Live</span>
    <span class="badge">v${escapeHtml(VERSION)}</span>
    <span class="badge">A2A ${escapeHtml(card.protocolVersion)}</span>
    <span class="badge">Profile: ${escapeHtml(profile)}</span>
  </div>

  <h2>What this is</h2>
  ${flagshipBlock}
  <p><strong>Not</strong> legal, compliance, sanctions, financial, investment, or insurance advice. <strong>Not</strong> a factuality verifier — schemas enforce structure, not truth. <strong>No</strong> autonomous live source retrieval.</p>

  <h2>Try it (curl)</h2>
  <pre>${escapeHtml(tryItCurl)}</pre>

  <h2>Endpoints</h2>
  <ul class="endpoints">
    <li><span class="label">Agent card:</span> <a href="${origin}/.well-known/agent-card.json">/.well-known/agent-card.json</a></li>
    <li><span class="label">JSON-RPC:</span> <code>POST ${origin}/message/send</code></li>
    <li><span class="label">Status:</span> <a href="${origin}/status">/status</a></li>
    <li><span class="label">Health (JSON):</span> <a href="${origin}/health">/health</a></li>
  </ul>

  <h2>Where the code lives</h2>
  <ul>
    <li>Source: <a href="${REPOSITORY_URL}">${REPOSITORY_URL.replace("https://", "")}</a></li>
    <li>Install: <a href="${PACKAGE_URL}">PyPI — agenda-intelligence-md</a></li>
    <li>Agenstry listing: <a href="${agenstryListing}">${agenstryListing.replace("https://", "")}</a></li>
    <li>${isKazakhstan ? `Use case: <a href="${MIDDLE_CORRIDOR_DOCS_URL}">Kazakhstan / Middle Corridor</a>` : `Docs: <a href="${DOCS_URL}">MCP integration</a>`}</li>
  </ul>

  <footer>
    <p>Hosted on Cloudflare Workers. No payments, no wallets, no autonomous live retrieval, no factual-truth verification. Human review required before any commercial action.</p>
    <p>This live wrapper is intentionally limited. Full product behavior remains in the installable stdio MCP server (<code>pip install agenda-intelligence-md</code>).</p>
  </footer>
</main>
</body>
</html>`;
}

export async function handleRequest(request, env = {}, ctx = {}) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-client-id"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
    const card = agentCard(request, env);
    const signed = await maybeSignCard(card, env);
    return jsonResponse(signed);
  }

  if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
    return jsonResponse(buildJwks(env.AGENT_CARD_SIGNING_KEY || env.AGENT_CARD_PRIVATE_JWK), 200, {
      "cache-control": "public, max-age=3600"
    });
  }

  if (request.method === "GET" && url.pathname === "/") {
    if (acceptsHtml(request)) {
      return htmlResponse(landingHtml(request, env));
    }
    return jsonResponse(healthInfo(request, env));
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse(healthInfo(request, env));
  }

  if (request.method === "GET" && url.pathname === "/status") {
    return jsonResponse(statusInfo(request, env));
  }

  if (request.method === "GET" && url.pathname === "/stats") {
    return handleStats(request, env);
  }

  if (request.method === "POST" && (url.pathname === "/message/send" || url.pathname === "/")) {
    return handlePost(request, env, ctx);
  }

  return textResponse("Not found", 404);
}

export default {
  fetch: handleRequest
};

export {
  agentCard,
  buildUsageEvent,
  dealRiskContractResponseForRequest,
  handleJsonRpc,
  healthInfo,
  isProductionAuthorized,
  isStatsAuthorized,
  productionAuthKey,
  landingHtml,
  recordUsageStats,
  routeModules,
  signalScreenForText,
  statusInfo,
  triageForText,
  usageStats
};
