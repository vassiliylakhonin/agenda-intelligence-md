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

import {
  SNAPSHOT_ATTRIBUTION,
  SNAPSHOT_LICENSE,
  SNAPSHOT_PROJECT_URL,
  matchCounterparty as matchCounterpartyAgainstSnapshot
} from "./upstream_snapshot.js";

import {
  fetchOwnership as fetchOwnershipFromGleif,
  isEnabled as gleifEnabled
} from "./upstream_gleif.js";

import { CARD_EXTENSION_URI } from "./card-extension.js";
import { buildJwks, maybeSignCard } from "./jws.js";
import {
  DECISION_NOT_AUTHORIZATION_NOTICE,
  decisionPolicyCatalog,
  signDecisionReceipt,
  verifyDecisionReceipt
} from "./decision-receipt.js";
import { OKF_CONTENT, OKF_PATHS, PROFILE_CONTENT, PROFILE_PATHS } from "./okf_content.js";
import {
  CANONICAL_INPUT_MODE,
  CIS_SECONDARY_SANCTIONS_ADR_URL,
  DISCOVERY_UPDATED_AT,
  DOCS_URL,
  MIDDLE_CORRIDOR_AGENT_CONTRACT_VERSION,
  MIDDLE_CORRIDOR_DOCS_URL,
  MIDDLE_CORRIDOR_SUPPORTED_INTENTS,
  OKF_BUNDLE_REPO_URL,
  PACKAGE_URL,
  PROFILE_LIVE_RETRIEVAL,
  REPOSITORY_URL,
  SCHEMAS_URL,
  SOURCE_POLICY_URL,
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_HOURS_LOCAL,
  SUPPORT_TIMEZONE,
  VERSION,
  profileDiscovery
} from "./profiles.js";
import {
  MCP_ENDPOINT_PATH,
  MCP_META_PROTOCOL_VERSION,
  MCP_META_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  MCP_TOOL_LIST_CACHE_SCOPE,
  MCP_TOOL_LIST_TTL_MS,
  MCP_UNSUPPORTED_PROTOCOL_VERSION,
  mcpArgumentsToParams,
  mcpToolSpecForProfile,
  mcpToolsForProfile,
  mcpUsesLegacyRequestWrapper
} from "./mcp.js";
import { PROBE_PROMPT_CHAR_THRESHOLD } from "./usage_constants.js";

const AGENSTRY_VERIFICATION_PATH = "/.well-known/agenstry-verify";
const CIS_REVIEW_INTAKE_PATH = "/intake/cis-review";
const CIS_REVIEW_INTAKE_ORIGIN = "https://vassiliylakhonin.github.io";
// The agent card already carries the contact under `support`, so machines could
// always find a person. The HTML landing page could not: measured 2026-08-14,
// none of the eight profiles offered a human any way to make contact, which made
// every human visit a dead end.
const PROVIDER_SITE_URL = "https://github.com/vassiliylakhonin";
const CIS_REVIEW_INTAKE_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const CIS_REVIEW_INTAKE_MAX_BYTES = 16 * 1024;

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

// Jurisdictions where the EU has ACTUALLY activated its country-level anti-circumvention
// tool (vs the broader watch set above). Kyrgyzstan is the first activation, in the 20th
// package (2026-04): specific item categories restricted to the country to prevent onward
// re-export, plus regional FI transaction bans. Presence-flagging only; not a determination.
const COUNTRY_LEVEL_ANTI_CIRCUMVENTION = {
  kyrgyzstan: "Kyrgyzstan"
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

// Substring triggers that presence-flag a potential dual-use / export-controlled
// item named in the free-text cargo. Terms follow the BIS/EU Common High Priority
// List (CHPL) pattern of goods most diverted to sanctioned end-users. Match on the
// declared cargo string only — presence-flagging routed to human review, NOT an
// export-control classification, licensing determination, or live screening. This
// is the cargo-string dual-use flag deferred in ADR 0015, on the allowed side of
// its boundary.
const MIDDLE_CORRIDOR_DUAL_USE_CARGO_TERMS = [
  ["microcontroller", "microcontrollers"],
  ["microprocessor", "microprocessors"],
  ["integrated circuit", "integrated circuits"],
  ["semiconductor", "semiconductors"],
  ["microelectronic", "microelectronics"],
  ["fpga", "FPGAs / programmable logic"],
  ["transceiver", "RF transceivers"],
  ["rf module", "RF modules"],
  ["rf amplifier", "RF amplifiers"],
  ["oscillator", "oscillators"],
  ["gnss", "GNSS / navigation modules"],
  ["gps module", "GPS / navigation modules"],
  ["gyroscope", "gyroscopes / inertial sensors"],
  ["accelerometer", "accelerometers / inertial sensors"],
  ["inertial measurement", "inertial measurement units"],
  ["cnc", "CNC / machine tools"],
  ["machine tool", "machine tools"],
  ["ball bearing", "precision bearings"],
  ["uav", "UAV / drone components"],
  ["drone", "UAV / drone components"],
  ["thermal imaging", "thermal-imaging / night-vision optics"],
  ["night vision", "thermal-imaging / night-vision optics"],
  ["carbon fiber", "carbon-fibre materials"],
  ["carbon fibre", "carbon-fibre materials"]
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
  "Customs-rule change watch: flag recent customs-rule or enforcement changes at any crossing on the route.",
  "Rail gauge-change points: confirm transloading and gauge-change handling and capacity at Khorgos / Altynkol and at the Caspian rail-ferry interchange (the corridor is rail-dominant, not maritime).",
  "Caspian dwell exposure: flag demurrage, wagon-detention, and ferry-slot risk at Aktau / Kuryk and onward Black Sea ports."
];

function matchedSanctionsExposedSegments(routeText) {
  const text = (routeText || "").toLowerCase();
  const matched = [];
  for (const [term, label] of MIDDLE_CORRIDOR_SANCTIONS_EXPOSED_ROUTE_TERMS) {
    if (text.includes(term) && !matched.includes(label)) matched.push(label);
  }
  return matched;
}

// Presence-flag potential dual-use / export-controlled items named in the cargo
// text. Case-insensitive substring match on the declared cargo string only. Per
// ADR 0015 (cargo-string dual-use detection) this is presence-flagging routed to
// human review, NOT an export-control classification, licensing determination, or
// live screening.
function matchedDualUseCargoTerms(cargoText) {
  const text = (cargoText || "").toLowerCase();
  const matched = [];
  for (const [term, label] of MIDDLE_CORRIDOR_DUAL_USE_CARGO_TERMS) {
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
      "access-control-allow-headers": "content-type, x-client-id, authorization, mcp-method, mcp-name",
      ...extraHeaders
    }
  });
}

function intakeCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowed =
    origin === CIS_REVIEW_INTAKE_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "access-control-allow-origin": allowed ? origin : CIS_REVIEW_INTAKE_ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-stats-token",
    "cache-control": "no-store",
    vary: "Origin"
  };
}

function isAllowedIntakeOrigin(request) {
  const origin = request.headers.get("origin") || "";
  return (
    origin === CIS_REVIEW_INTAKE_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

function textResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders
    }
  });
}

function agenstryVerificationToken(env = {}) {
  const token = typeof env.AGENSTRY_VERIFY_TOKEN === "string" ? env.AGENSTRY_VERIFY_TOKEN.trim() : "";
  return /^af-verify-[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

function htmlResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
      ...extraHeaders
    }
  });
}

function markdownResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
      ...extraHeaders
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

function didIdentifierFromOrigin(origin) {
  return `did:web:${new URL(origin).host}`;
}

function okfUrl(origin, path = "/okf/index.md") {
  return `${origin}${path}`;
}

function confidentialProjectRoomUrl(origin, path = "/profiles/confidential-project-room") {
  return `${origin}${path}`;
}

function aiCatalogHeaders(request) {
  const origin = originFromRequest(request);
  return {
    Link: [
      `<${origin}/.well-known/ai-catalog.json>; rel="ai-catalog"`,
      `<${origin}/.well-known/api-catalog>; rel="api-catalog"`,
      `<${origin}/api/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"`,
      `<${origin}/.well-known/mcp/server-card.json>; rel="mcp-server-card"`,
      `<${origin}/.well-known/did.json>; rel="identity"`
    ].join(", ")
  };
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
    env.AGENT_PROFILE === "agent_output_verification" ||
    host.includes("agent-output-verification-a2a")
  ) {
    return "agent_output_verification";
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
    env.AGENT_PROFILE === "critical_minerals_due_diligence" ||
    env.AGENT_PROFILE === "critical_minerals" ||
    host.includes("critical-minerals-due-diligence-a2a")
  ) {
    return "critical_minerals_due_diligence";
  }
  if (
    env.AGENT_PROFILE === "dual_use_technology_export" ||
    host.includes("dual-use-technology-export-a2a")
  ) {
    return "dual_use_technology_export";
  }
  if (
    env.AGENT_PROFILE === "corridor_sanctions_assistant" ||
    host.includes("corridor-sanctions-assistant-a2a")
  ) {
    return "corridor_sanctions_assistant";
  }
  if (
    env.AGENT_PROFILE === "kazakhstan" ||
    host.includes("middle-corridor-deal-risk-gate-a2a")
  ) {
    return "kazakhstan";
  }
  if (
    env.AGENT_PROFILE === "dual_use_technology_export" ||
    host.includes("dual-use-technology-export-a2a")
  ) {
    return "dual_use_technology_export";
  }

  return "agenda";
}

const A2A_PROTOCOL_VERSION = "1.0";
const A2A_LEGACY_PROTOCOL_VERSION = "0.3";
const MAX_JSON_RPC_BODY_BYTES = 1024 * 1024;

// SendMessage is the A2A 1.0 JSON-RPC method. The slash-style methods remain
// accepted as unadvertised compatibility aliases for existing 0.x clients.
const V1_MESSAGE_SEND_METHODS = new Set(["SendMessage"]);
const LEGACY_MESSAGE_SEND_METHODS = new Set(["message/send", "tasks/send"]);
const MESSAGE_SEND_METHODS = new Set([
  ...V1_MESSAGE_SEND_METHODS,
  ...LEGACY_MESSAGE_SEND_METHODS
]);

// Both spellings of the two Message roles. See v1MessageViolations below for
// why the JSON-RPC spelling has to be here.
const V1_MESSAGE_ROLES = new Set(["ROLE_USER", "ROLE_AGENT", "user", "agent"]);

function normalizedA2aVersion(value) {
  if (typeof value !== "string") return "";
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(value.trim());
  return match ? `${match[1]}.${match[2]}` : "";
}

function requestedA2aVersion(request, payload) {
  const header = request.headers.get("a2a-version");
  const parameter = payload?.params?.["A2A-Version"] || payload?.params?.a2aVersion;
  const raw = header || parameter;
  if (raw !== null && raw !== undefined && String(raw).trim()) {
    return normalizedA2aVersion(String(raw)) || null;
  }
  return V1_MESSAGE_SEND_METHODS.has(payload?.method)
    ? A2A_PROTOCOL_VERSION
    : A2A_LEGACY_PROTOCOL_VERSION;
}

function v1MessageViolations(params) {
  const violations = [];
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return [{ field: "params", description: "SendMessage params must be an object" }];
  }
  const message = params.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return [{ field: "message", description: "A Message object is required" }];
  }
  if (typeof message.messageId !== "string" || !message.messageId.trim()) {
    violations.push({ field: "message.messageId", description: "A non-empty messageId is required" });
  }
  // A2A spells this role two ways: ROLE_USER in the protobuf definition and
  // "user" in the JSON-RPC representation. Both are the same value, and the
  // spec allows either. Accepting only the protobuf spelling would refuse any
  // client that speaks the JSON-RPC form, for a field that is never read after
  // this check.
  //
  // No caller in the 2026-08-18..26 logs is known to have been rejected this
  // way; the change is conformance, not a repair. An earlier version of this
  // comment blamed AgenstryBot's daily failures on the spelling. That was
  // wrong, and the correction is worth keeping: those failures are the five
  // gates refusing a four-character plain-text probe because they need a
  // structured payload, which they answer with a request-guidance artifact.
  // Both spellings behave identically on that path, before and after.
  if (!V1_MESSAGE_ROLES.has(message.role)) {
    violations.push({
      field: "message.role",
      description: "role must be ROLE_USER or ROLE_AGENT (\"user\" and \"agent\" are accepted as the JSON-RPC spelling)"
    });
  }
  if (!Array.isArray(message.parts) || message.parts.length === 0) {
    violations.push({ field: "message.parts", description: "At least one part is required" });
  } else {
    message.parts.forEach((part, index) => {
      if (!part || typeof part !== "object" || Array.isArray(part)) {
        violations.push({
          field: `message.parts[${index}]`,
          description: "Part must be an object"
        });
        return;
      }
      const contentFields = ["text", "raw", "url", "data"].filter((field) =>
        Object.prototype.hasOwnProperty.call(part, field)
      );
      if (contentFields.length !== 1) {
        violations.push({
          field: `message.parts[${index}]`,
          description: "Part must contain exactly one of text, raw, url, or data"
        });
      }
    });
  }
  return violations;
}

// Per-profile production access key. Profiles that graduate to an explicit
// Bearer model read a per-profile secret; when the secret is unset the route is
// an open free demo and no key is required — the agent card reflects that state
// truthfully (no security requirement is advertised). Flip enforcement on the
// day a real counterparty needs gating:
//   wrangler secret put MIDDLE_CORRIDOR_API_KEY --env middle-corridor-deal-risk-gate
//   wrangler secret put AGENTIC_INTERACTION_TRUST_API_KEY --env agentic-interaction-trust
//   wrangler secret put CIS_SECONDARY_SANCTIONS_API_KEY --env cis-secondary-sanctions
function productionAuthKey(profile, env = {}) {
  if (profile === "kazakhstan") return env.MIDDLE_CORRIDOR_API_KEY || "";
  if (profile === "agentic_interaction_trust")
    return env.AGENTIC_INTERACTION_TRUST_API_KEY || "";
  if (profile === "cis_secondary_sanctions")
    return env.CIS_SECONDARY_SANCTIONS_API_KEY || "";
  return "";
}

// Best-effort soft rate limit on the A2A request route. Off by default: when
// RATE_LIMIT_PER_HOUR is unset or <= 0 the route is unthrottled (current state).
// Set it per-env to cap free programmatic use while keeping the browser demo
// usable — a human clicking the demo issues only a handful of calls/hour. KV is
// eventually consistent, so this deters bulk scripting; it is NOT a hard
// security control and it fails open on any storage error. Activation is the
// go-live step, e.g. a [vars] entry or:
//   wrangler secret put RATE_LIMIT_PER_HOUR --env cis-secondary-sanctions   # e.g. 60
// Deactivate by removing it (or setting 0).
function rateLimitPerHour(env = {}) {
  const raw = Number.parseInt(env.RATE_LIMIT_PER_HOUR, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function clientIpFromRequest(request) {
  const raw =
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  return raw.split(",")[0].trim() || "unknown";
}

// Returns { limited, limit, count }. Fails open: a KV hiccup never blocks a
// legitimate call. Buckets per profile + client IP + UTC hour.
async function checkRateLimit(request, env, profile) {
  const limit = rateLimitPerHour(env);
  const kv = env?.AGENDA_USAGE;
  if (!limit || !kv) return { limited: false, limit, count: 0 };
  const ip = clientIpFromRequest(request);
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `rate:${profile || "unknown"}:${ip}:${hour}`;
  try {
    const current = Number.parseInt((await kv.get(key)) || "0", 10) || 0;
    if (current >= limit) return { limited: true, limit, count: current };
    await kv.put(key, String(current + 1), { expirationTtl: 7200 });
    return { limited: false, limit, count: current + 1 };
  } catch (_error) {
    return { limited: false, limit, count: 0 };
  }
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
    name: "Agenda Intelligence MD",
    description:
      "Live A2A wrapper for Agenda Intelligence MD, an evidence-discipline MCP layer for strategic-risk agents. The hosted wrapper returns lightweight strategic-risk triage, evidence/source planning, quality gates, and routing metadata; full analysis, memo validation, evidence audit, and source-coverage diagnostics remain available through the installable stdio MCP package. Outputs are evidence triage with mandatory human-review routing before any commercial action; not legal, compliance, sanctions, financial, or investment advice, and not an autonomous decision system.",
    provider: {
      organization: "Vassiliy Lakhonin",
      url: PROVIDER_SITE_URL,
      legalEntity: {
        type: "individual",
        name: "Vassiliy Lakhonin",
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
    ...(productionKey
      ? {
          securitySchemes: {
            productionBearer: {
              httpAuthSecurityScheme: {
                scheme: "bearer",
                bearerFormat: "opaque",
                description: "Bearer access key required by this deployment's SendMessage route."
              }
            }
          },
          // SecurityRequirement.schemes is a map of scheme name to a StringList
          // of scopes, not a list of names. A bare array validates as long as
          // nobody configures a key — which nobody has, so this shipped unseen.
          // Checked 2026-08-26 against the vendored A2A v1.0.1 schema: the array
          // form fails with "schemes: must be object", the map form passes. The
          // first deployment to set a production key would have started serving
          // an invalid card.
          securityRequirements: [{ schemes: { productionBearer: { list: [] } } }]
        }
        : { securityRequirements: [] }),
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false
    },
    defaultInputModes: ["application/json", "text/plain", "text/markdown"],
    defaultOutputModes: ["application/json", "text/markdown"],
    skills: [
      {
        id: "agenda-signal-screen",
        name: "Sanctions and policy risk signal triage",
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
      protocol_version: "1.0",
      public_endpoint: !productionKey,
      optional_client_identifier_header: "X-Client-Id",
      ai_catalog: `${origin}/.well-known/ai-catalog.json`,
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
    },
    // An empty securityRequirements is the honest declaration for an open
    // deployment, and it stays empty: declaring a scheme this Worker does not
    // enforce would be a false claim in a card it signs. But empty is also
    // silent. A directory scoring this card on 2026-08-26 read it as "declares
    // no security information" and could not tell a deliberate open endpoint
    // from an oversight — the same reading an agent deciding whether to call
    // would make. The remedy is to say so, not to invent an auth model.
    //
    // The site card at vassiliylakhonin.github.io has carried exactly this
    // block since before the fleet did; this brings the eight Workers in line
    // with it rather than inventing a second vocabulary. Everything here is
    // checkable against the deployment: required_authentication follows the
    // configured key, and the usage log records prompt_chars, never the prompt.
    x_security_posture: {
      transport: "https",
      public_endpoint: !productionKey,
      required_authentication: Boolean(productionKey),
      optional_client_identifier_header: "X-Client-Id",
      data_handling: [
        "No payment credentials accepted.",
        "No wallet rails.",
        "No caller prompt text stored in aggregate stats.",
        "Usage analytics are aggregate operational counters."
      ],
      abuse_contact: `mailto:${SUPPORT_CONTACT_EMAIL}`
    }
  };
  return applyAgentProfile(card, request, env);
}

function agentCardProtocolVersion(card) {
  return card?.supportedInterfaces?.[0]?.protocolVersion || null;
}

// The A2A v1 AgentCard schema (specification/a2a.proto, message AgentCard)
// defines exactly the fields below, and AgentProvider exactly two. An
// independent conformance scan on 2026-08-23 rejected every card this Worker
// serves, because the card carried `support`, `x_agenda_intelligence`,
// `x_agent_contract` and a top-level `signature` at the root, plus
// `provider.legalEntity`. Verified against the proto: none of those are card
// fields, and the one extension mechanism the spec defines is
// `capabilities.extensions[]`, whose `params` is an arbitrary JSON Struct.
//
// This normalises at the wire boundary rather than in `agentCard()`, so
// `profiles.js`, the Python adapter, the contract tests and every internal
// reader keep reading `card.x_agenda_intelligence` unchanged; only the served
// JSON moves. The field list is an allow-list, not a list of known offenders,
// so a profile that adds a new key stays conformant without touching this.
const A2A_CARD_FIELDS = new Set([
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
  "iconUrl"
]);
const A2A_PROVIDER_FIELDS = new Set(["organization", "url"]);
const CARD_EXTENSION_DESCRIPTION =
  "Wrapper scope, product contract, boundaries, support channel and provider identity for this agent. " +
  "Descriptive only: reading it is never required to call the agent.";

function toSpecWireCard(card) {
  const wire = {};
  const params = {};
  for (const [key, value] of Object.entries(card)) {
    if (A2A_CARD_FIELDS.has(key)) wire[key] = value;
    else params[key] = value;
  }
  if (wire.provider && typeof wire.provider === "object") {
    const provider = {};
    const providerExtras = {};
    for (const [key, value] of Object.entries(wire.provider)) {
      if (A2A_PROVIDER_FIELDS.has(key)) provider[key] = value;
      else providerExtras[key] = value;
    }
    wire.provider = provider;
    if (Object.keys(providerExtras).length > 0) params.provider = providerExtras;
  }
  if (Object.keys(params).length === 0) return wire;
  const capabilities = { ...(wire.capabilities || {}) };
  capabilities.extensions = [
    ...(capabilities.extensions || []),
    {
      uri: CARD_EXTENSION_URI,
      description: CARD_EXTENSION_DESCRIPTION,
      required: false,
      params
    }
  ];
  wire.capabilities = capabilities;
  return wire;
}

function aiCatalog(request, env = {}) {
  const origin = originFromRequest(request);
  const host = new URL(origin).host;
  const card = agentCard(request, env);
  return {
    specVersion: "1.0",
    host: {
      displayName: card.name,
      identifier: didIdentifierFromOrigin(origin),
      documentationUrl: DOCS_URL
    },
    displayName: `${card.name} AI resource catalog`,
    description:
      "Discovery catalog for Agenda Intelligence MD resources: A2A wrapper, MCP server card, OKF knowledge bundle, confidential project-room profile contract, schemas, and source-policy artifacts. Visibility in this catalog is not buyer traction or product-market-fit evidence.",
    url: `${origin}/.well-known/ai-catalog.json`,
    version: VERSION,
    updatedAt: DISCOVERY_UPDATED_AT,
    entries: [
      {
        identifier: `urn:ai:${host}:agent:agenda-intelligence-md-a2a`,
        displayName: card.name,
        type: "application/a2a-agent-card+json",
        url: `${origin}/.well-known/agent-card.json`,
        description: card.description,
        capabilities: ["message/send", "strategic-risk-triage", "source-planning", "evidence-gap-routing"],
        tags: ["a2a", "json-rpc", "evidence-readiness", "strategic-risk", "human-review"],
        representativeQueries: [
          "screen sanctions and policy risk with explicit evidence gaps",
          "route a strategic-risk question to the right evidence-readiness workflow",
          "find the A2A agent card for Agenda Intelligence MD"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:server:agenda-intelligence-md-mcp`,
        displayName: "Agenda Intelligence MD MCP server",
        type: "application/mcp-server-card+json",
        url: `${origin}/.well-known/mcp/server-card.json`,
        description:
          "Installable stdio MCP server exposing schema validation, evidence audit, source coverage, quote checks, and analysis prompt assembly.",
        capabilities: ["validate_memo", "audit_claims", "source_coverage", "verify_quotes", "analyze"],
        tags: ["mcp", "stdio", "claim-audit", "source-coverage", "schema-validation"],
        representativeQueries: [
          "install an MCP server for claim evidence audit",
          "validate an agenda memo against a JSON schema",
          "check source coverage for a sanctions evidence pack"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:endpoint:message-send`,
        displayName: "Agenda Intelligence MD message/send endpoint",
        type: "application/jsonrpc+json",
        url: `${origin}/message/send`,
        description: "JSON-RPC endpoint for lightweight hosted A2A triage and routing responses.",
        capabilities: ["message/send", "risk-triage", "evidence-gaps", "watch-next-indicators"],
        tags: ["json-rpc", "a2a-endpoint", "hosted-worker"],
        representativeQueries: [
          "send a strategic risk triage request to Agenda Intelligence MD",
          "get evidence gaps and source planning for a policy-risk question"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:api:worker-openapi`,
        displayName: "Agenda Intelligence MD Worker OpenAPI",
        type: "application/vnd.oai.openapi+json",
        url: `${origin}/api/openapi.json`,
        description:
          "OpenAPI 3.0 contract for the public Agenda Intelligence MD worker discovery, health, status, OKF, entity map, and JSON-RPC message/send surfaces.",
        capabilities: ["openapi", "http-contract", "json-rpc", "discovery"],
        tags: ["openapi", "http-api", "service-description", "worker"],
        representativeQueries: [
          "find the OpenAPI contract for Agenda Intelligence MD",
          "what HTTP endpoints does the Agenda Intelligence worker expose",
          "discover the JSON-RPC message/send contract for Agenda Intelligence MD"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:knowledge:okf-bundle`,
        displayName: "Agenda Intelligence MD OKF-style knowledge bundle",
        type: "text/markdown",
        url: okfUrl(origin),
        description:
          "Compact Markdown/YAML concept bundle for retrieval agents: evidence-readiness, human-review packets, evidence packs, claim audits, source policy, market gate, and repo stack.",
        capabilities: ["concept-retrieval", "evidence-readiness-definitions", "human-review-packet"],
        tags: ["okf", "markdown", "knowledge-bundle", "evidence-readiness"],
        representativeQueries: [
          "what is Agenda Intelligence MD evidence-readiness",
          "explain human-review packet and claim audit concepts",
          "understand the Agenda Intelligence repository stack"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:entitymap:agenda-intelligence-md`,
        displayName: "Agenda Intelligence MD entity map",
        type: "application/entitymap+json",
        url: `${origin}/entitymap.json`,
        description:
          "Machine-readable map of Agenda Intelligence MD entities, boundaries, relationships, and canonical retrieval paths.",
        capabilities: ["entity-discovery", "concept-navigation", "domain-boundary-routing"],
        tags: ["entitymap", "knowledge-graph", "retrieval", "domain-map"],
        representativeQueries: [
          "what are the core entities in Agenda Intelligence MD",
          "map Agenda Intelligence MD evidence-readiness concepts",
          "find the relationship between evidence pack, claim audit, and human-review packet"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:artifact:confidential-project-room-profile`,
        displayName: "Confidential Project-Room Evidence-Readiness Profile",
        type: "text/markdown",
        url: confidentialProjectRoomUrl(origin),
        description:
          "Alias-first public contract and synthetic redacted example for confidential project-room evidence-readiness reviews. Not a secure data room, approval system, or customer-traction claim.",
        capabilities: ["confidential-project-room", "redacted-profile", "alias-first-review", "owner-action-routing"],
        tags: ["confidential-workflow", "redacted-example", "project-room", "evidence-readiness", "build-to-learn"],
        representativeQueries: [
          "confidential project-room evidence-readiness profile",
          "how to review a private project packet without exposing client names",
          "redacted source pack owner actions and human-review routing"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:schema:agenda-intelligence-v1`,
        displayName: "Agenda Intelligence MD JSON schemas",
        type: "application/schema+json",
        url: SCHEMAS_URL,
        description:
          "Schema contracts for agenda requests, memos, briefs, evidence packs, evidence audits, and vertical worker requests/responses.",
        capabilities: ["json-schema", "contract-validation", "memo-validation", "evidence-pack-validation"],
        tags: ["json-schema", "quality-gate", "contracts"],
        representativeQueries: [
          "find the evidence pack schema for Agenda Intelligence MD",
          "find the evidence audit JSON schema",
          "validate a strategic-risk memo contract"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      },
      {
        identifier: `urn:ai:${host}:policy:source-policy`,
        displayName: "Agenda Intelligence MD source policy",
        type: "text/markdown",
        url: SOURCE_POLICY_URL,
        description:
          "Source planning, coverage, quote-presence checks, provenance tags, and non-verification boundaries.",
        capabilities: ["source-planning", "source-coverage", "quote-presence", "provenance-discipline"],
        tags: ["source-policy", "provenance", "non-verification-boundaries"],
        representativeQueries: [
          "how does Agenda Intelligence MD handle source coverage",
          "does Agenda Intelligence MD verify factual truth",
          "what source categories are required for evidence readiness"
        ],
        version: VERSION,
        updatedAt: DISCOVERY_UPDATED_AT
      }
    ],
    boundaries: [
      "This catalog advertises resources, not customer traction.",
      "Agenda Intelligence MD routes evidence gaps to humans; it does not approve vendors or make autonomous decisions.",
      "Hosted workers are portfolio/demo surfaces unless buyer behavior proves demand."
    ]
  };
}

function mcpTool(name, description) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      additionalProperties: true
    }
  };
}

function mcpServerCard(request, env = {}) {
  const origin = originFromRequest(request);
  const card = agentCard(request, env);
  return {
    serverInfo: {
      name: "Agenda Intelligence MD MCP Server",
      version: VERSION
    },
    description:
      "Installable stdio MCP server for evidence-readiness workflows: schema validation, claim audit, source coverage, quote-presence checks, and analysis prompt assembly. It routes evidence to human review; it does not provide legal, compliance, sanctions, financial, procurement, or factual-truth determinations.",
    // `transport` stays the stdio singular for clients that read the old shape.
    // `transports` is the current list: since 2026-07-28 dropped sessions, this
    // worker can serve MCP over plain Streamable HTTP alongside the local server.
    transport: {
      type: "stdio",
      command: "agenda-intelligence-mcp",
      install: "pip install agenda-intelligence-md"
    },
    protocolVersion: MCP_PROTOCOL_VERSION,
    protocolVersions: [...MCP_SUPPORTED_PROTOCOL_VERSIONS],
    transports: [
      {
        type: "stdio",
        command: "agenda-intelligence-mcp",
        install: "pip install agenda-intelligence-md",
        tools_note: "Full local catalog: schema validation, claim audit, coverage, quote checks, prompt assembly."
      },
      {
        type: "streamable-http",
        url: `${origin}${MCP_ENDPOINT_PATH}`,
        stateless: true,
        tools: mcpToolsForProfile(agentProfile(request, env)).map((tool) => tool.name),
        tools_note: "Hosted endpoint exposes this deployment's triage contract only, not the local catalog."
      }
    ],
    documentationUrl: DOCS_URL,
    package: PACKAGE_URL,
    repository: REPOSITORY_URL,
    related: {
      ai_catalog: `${origin}/.well-known/ai-catalog.json`,
      api_catalog: `${origin}/.well-known/api-catalog`,
      openapi: `${origin}/api/openapi.json`,
      agent_card: `${origin}/.well-known/agent-card.json`,
      did: `${origin}/.well-known/did.json`,
      entitymap: `${origin}/entitymap.json`,
      source_policy: SOURCE_POLICY_URL,
      okf_bundle: okfUrl(origin),
      okf_repository_copy: OKF_BUNDLE_REPO_URL,
      confidential_project_room_profile: confidentialProjectRoomUrl(origin),
      confidential_project_room_example: confidentialProjectRoomUrl(
        origin,
        "/profiles/confidential-project-room/redacted-example.json"
      )
    },
    capabilities: {
      tools: true,
      resources: false,
      prompts: false
    },
    tools: [
      mcpTool("validate_memo", "Validate a strategic-risk memo against the agenda memo schema."),
      mcpTool("audit_claims", "Audit claim-level evidence links, support levels, and unsupported claims."),
      mcpTool("source_coverage", "Check whether an evidence pack covers required source categories."),
      mcpTool("verify_quotes", "Check whether quoted fragments appear in caller-supplied source text."),
      mcpTool("analyze", "Assemble an evidence-disciplined analysis prompt for human review."),
      mcpTool("validate_evidence", "Validate an evidence pack contract before handoff."),
      mcpTool("score_output", "Score output readiness against evidence and policy quality gates."),
      mcpTool("list_source_categories", "List source categories used for coverage planning.")
    ],
    boundaries: card.x_agenda_intelligence?.boundaries || [
      "No factual-truth verification.",
      "Human review required before commercial action."
    ]
  };
}

function didDocument(request) {
  const origin = originFromRequest(request);
  const id = didIdentifierFromOrigin(origin);
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id,
    service: [
      {
        id: `${id}#ai-catalog`,
        type: "AICatalog",
        serviceEndpoint: `${origin}/.well-known/ai-catalog.json`
      },
      {
        id: `${id}#a2a`,
        type: "A2AAgentCard",
        serviceEndpoint: `${origin}/.well-known/agent-card.json`
      },
      {
        id: `${id}#mcp`,
        type: "MCPServer",
        serviceEndpoint: `${origin}/.well-known/mcp/server-card.json`
      },
      {
        id: `${id}#api-catalog`,
        type: "APICatalog",
        serviceEndpoint: `${origin}/.well-known/api-catalog`
      },
      {
        id: `${id}#openapi`,
        type: "OpenAPI",
        serviceEndpoint: `${origin}/api/openapi.json`
      },
      {
        id: `${id}#confidential-project-room-profile`,
        type: "EvidenceReadinessProfile",
        serviceEndpoint: confidentialProjectRoomUrl(origin)
      }
    ]
  };
}

function apiCatalog(request) {
  const origin = originFromRequest(request);
  return {
    linkset: [
      {
        anchor: `${origin}/`,
        "service-desc": [
          {
            href: `${origin}/api/openapi.json`,
            type: "application/vnd.oai.openapi+json;version=3.0",
            title: "Agenda Intelligence MD Worker API (OpenAPI 3.0)"
          }
        ]
      }
    ]
  };
}

function openApiDocument(request) {
  const origin = originFromRequest(request);
  return {
    openapi: "3.0.3",
    info: {
      title: "Agenda Intelligence MD Worker API",
      version: VERSION,
      description:
        "Public HTTP contract for the Agenda Intelligence MD worker: discovery documents, status endpoints, live OKF/entity-map artifacts, and JSON-RPC message/send. This API routes evidence-readiness and strategic-risk triage to human review; it is not legal, compliance, sanctions, financial, procurement, or factual-truth verification advice."
    },
    servers: [{ url: origin }],
    tags: [
      { name: "discovery", description: "Machine-readable discovery documents." },
      { name: "status", description: "Health and status endpoints." },
      { name: "knowledge", description: "OKF and entity-map artifacts for retrieval agents." },
      { name: "jsonrpc", description: "A2A-compatible JSON-RPC endpoint." }
    ],
    paths: {
      "/": {
        get: {
          tags: ["status"],
          summary: "Landing page or health JSON",
          description:
            "Returns an HTML landing page when the request accepts text/html; otherwise returns the same JSON shape as /health.",
          responses: {
            200: {
              description: "HTML landing page or JSON health object.",
              content: {
                "text/html": { schema: { type: "string" } },
                "application/json": { schema: { $ref: "#/components/schemas/HealthInfo" } }
              }
            }
          }
        },
        post: {
          tags: ["jsonrpc"],
          summary: "JSON-RPC message/send alias",
          description: "Alias for POST /message/send.",
          requestBody: { $ref: "#/components/requestBodies/JsonRpcRequest" },
          responses: {
            200: {
              description: "JSON-RPC result or JSON-RPC error envelope.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/health": {
        get: {
          tags: ["status"],
          summary: "Health check",
          responses: {
            200: {
              description: "Health information.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/HealthInfo" } } }
            }
          }
        }
      },
      "/status": {
        get: {
          tags: ["status"],
          summary: "Worker status and boundaries",
          responses: {
            200: {
              description: "Version, profile, boundary flags, and discovery links.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/robots.txt": {
        get: {
          tags: ["discovery"],
          summary: "Robots and Agentmap policy",
          responses: {
            200: {
              description: "Robots.txt including Agentmap and AI content signal policy.",
              content: { "text/plain": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/.well-known/agent-card.json": {
        get: {
          tags: ["discovery"],
          summary: "A2A agent card",
          responses: {
            200: {
              description: "A2A agent card for the worker.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/.well-known/agenstry-verify": {
        get: {
          tags: ["discovery"],
          summary: "Agenstry domain ownership proof",
          description: "Returns the configured Agenstry verification token as plain text. Returns 404 when unset.",
          responses: {
            200: {
              description: "Single-line Agenstry verification token.",
              content: {
                "text/plain": { schema: { type: "string", pattern: "^af-verify-[A-Za-z0-9_-]+$" } }
              }
            },
            404: { description: "No valid verification token is configured." }
          }
        }
      },
      "/.well-known/ai-catalog.json": {
        get: {
          tags: ["discovery"],
          summary: "AI resource catalog",
          responses: {
            200: {
              description: "Agentic resource discovery catalog.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/.well-known/api-catalog": {
        get: {
          tags: ["discovery"],
          summary: "API catalog",
          responses: {
            200: {
              description: "Linkset that points to the worker OpenAPI document.",
              content: { "application/linkset+json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/api/openapi.json": {
        get: {
          tags: ["discovery"],
          summary: "OpenAPI document",
          responses: {
            200: {
              description: "OpenAPI 3.0 document for the worker.",
              content: { "application/vnd.oai.openapi+json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/.well-known/mcp/server-card.json": {
        get: {
          tags: ["discovery"],
          summary: "MCP server card",
          responses: {
            200: {
              description: "MCP server card for the installable stdio package.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/.well-known/mcp-server.json": {
        get: {
          tags: ["discovery"],
          summary: "Legacy MCP server card alias",
          responses: {
            200: {
              description: "Legacy alias for /.well-known/mcp/server-card.json.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/.well-known/did.json": {
        get: {
          tags: ["discovery"],
          summary: "DID document",
          responses: {
            200: {
              description: "DID document linking AI catalog, A2A card, and MCP card.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/entitymap.json": {
        get: {
          tags: ["knowledge"],
          summary: "Entity map",
          responses: {
            200: {
              description: "Machine-readable entity map for Agenda Intelligence MD concepts and boundaries.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/okf/index.md": {
        get: {
          tags: ["knowledge"],
          summary: "OKF bundle index",
          responses: {
            200: {
              description: "OKF-style Markdown knowledge bundle index.",
              content: { "text/markdown": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/okf/{file}": {
        get: {
          tags: ["knowledge"],
          summary: "OKF bundle document",
          parameters: [
            {
              name: "file",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: OKF_PATHS.map((path) => path.replace("/okf/", "")).filter((file) => file !== "index.md")
              }
            }
          ],
          responses: {
            200: {
              description: "OKF-style Markdown concept document.",
              content: { "text/markdown": { schema: { type: "string" } } }
            },
            404: {
              description: "Unknown OKF document."
            }
          }
        }
      },
      "/profiles/confidential-project-room": {
        get: {
          tags: ["knowledge"],
          summary: "Confidential project-room profile contract",
          description:
            "Alias-first evidence-readiness profile contract for private project-room reviews. Public artifact only; it does not accept or store confidential data.",
          responses: {
            200: {
              description: "Markdown profile contract for redacted confidential project-room reviews.",
              content: { "text/markdown": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/profiles/confidential-project-room/index.md": {
        get: {
          tags: ["knowledge"],
          summary: "Confidential project-room profile contract Markdown alias",
          responses: {
            200: {
              description: "Markdown profile contract for redacted confidential project-room reviews.",
              content: { "text/markdown": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/profiles/confidential-project-room/redacted-example.json": {
        get: {
          tags: ["knowledge"],
          summary: "Synthetic redacted confidential project-room example",
          responses: {
            200: {
              description: "Synthetic alias-only JSON profile example. No buyer traction or client data is claimed.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            }
          }
        }
      },
      "/message/send": {
        post: {
          tags: ["jsonrpc"],
          summary: "A2A 1.0 JSON-RPC SendMessage",
          description:
            "Accepts A2A 1.0 JSON-RPC SendMessage requests for lightweight hosted triage and routing. The unadvertised message/send and tasks/send aliases remain available only for A2A 0.3 compatibility. Full analysis remains in the installable stdio MCP package.",
          parameters: [
            {
              name: "A2A-Version",
              in: "header",
              required: false,
              description: "A2A protocol version. Defaults to 1.0 for SendMessage.",
              schema: { type: "string", enum: ["1.0"], default: "1.0" }
            }
          ],
          requestBody: { $ref: "#/components/requestBodies/JsonRpcRequest" },
          responses: {
            200: {
              description: "JSON-RPC result or JSON-RPC error envelope.",
              content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
            },
            401: {
              description:
                "Only returned when a per-profile production bearer key is configured and the request lacks a matching token."
            },
            413: {
              description: "The JSON request body exceeds 1 MiB."
            },
            415: {
              description: "The request Content-Type is not application/json."
            }
          }
        }
      }
    },
    components: {
      requestBodies: {
        JsonRpcRequest: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["jsonrpc", "id", "method", "params"],
                properties: {
                  jsonrpc: { type: "string", enum: ["2.0"] },
                  id: { oneOf: [{ type: "string" }, { type: "number" }] },
                  method: { type: "string", enum: ["SendMessage"] },
                  params: {
                    type: "object",
                    required: ["message"],
                    properties: {
                      message: {
                        type: "object",
                        required: ["messageId", "role", "parts"],
                        properties: {
                          messageId: { type: "string", minLength: 1 },
                          role: { type: "string", enum: ["ROLE_USER", "ROLE_AGENT"] },
                          parts: {
                            type: "array",
                            minItems: 1,
                            items: { type: "object", additionalProperties: true }
                          }
                        }
                      }
                    }
                  }
                },
                additionalProperties: true
              },
              example: {
                jsonrpc: "2.0",
                id: "request-1",
                method: "SendMessage",
                params: {
                  message: {
                    messageId: "message-1",
                    role: "ROLE_USER",
                    parts: [{ text: "Route this question and identify evidence gaps." }]
                  }
                }
              }
            }
          }
        }
      },
      schemas: {
        HealthInfo: {
          type: "object",
          required: ["ok", "name", "version", "profile", "ai_catalog", "agent_card", "message_send"],
          properties: {
            ok: { type: "boolean" },
            name: { type: "string" },
            version: { type: "string" },
            profile: { type: "string" },
            ai_catalog: { type: "string", format: "uri" },
            agent_card: { type: "string", format: "uri" },
            mcp_server_card: { type: "string", format: "uri" },
            did: { type: "string", format: "uri" },
            entitymap: { type: "string", format: "uri" },
            okf_bundle: { type: "string", format: "uri" },
            confidential_project_room_profile: { type: "string", format: "uri" },
            message_send: { type: "string", format: "uri" },
            status: { type: "string", format: "uri" },
            repository: { type: "string", format: "uri" },
            payments: { type: "boolean" }
          },
          additionalProperties: true
        }
      }
    },
    "x-agenda-intelligence": {
      boundaries: [
        "No legal, compliance, sanctions, financial, procurement, investment, insurance, or trading advice.",
        "No factual-truth verification.",
        "No autonomous live source retrieval on the default hosted worker.",
        "Human review required before commercial action.",
        "OpenAPI discovery is not buyer traction or product-market-fit evidence."
      ],
      repository: REPOSITORY_URL,
      package: PACKAGE_URL
    }
  };
}

function entityMap(request) {
  const origin = originFromRequest(request);
  const entityUrl = (slug) => `${origin}/entitymap.json#${slug}`;
  const confidentialProjectRoomDiscovery = profileDiscovery("confidential_project_room");
  return {
    version: "1.0",
    schema: "https://entitymap.org/spec/v1.0",
    publisher: {
      name: "Vassiliy Lakhonin",
      url: PROVIDER_SITE_URL
    },
    updatedAt: DISCOVERY_UPDATED_AT,
    url: `${origin}/entitymap.json`,
    description:
      "Machine-readable entity map for Agenda Intelligence MD. It is a navigation aid for retrieval agents and technical evaluators, not a formal ontology, ranking asset, compliance claim, or market-validation claim.",
    related: {
      ai_catalog: `${origin}/.well-known/ai-catalog.json`,
      did: `${origin}/.well-known/did.json`,
      okf_bundle: okfUrl(origin),
      confidential_project_room_profile: confidentialProjectRoomUrl(origin),
      repository: REPOSITORY_URL,
      source_policy: SOURCE_POLICY_URL
    },
    boundaries: [
      "Not legal advice.",
      "Not compliance advice.",
      "Not sanctions screening.",
      "Not factual-truth verification.",
      "Not autonomous decision-making.",
      "Not proof of buyer demand or product-market fit."
    ],
    entities: [
      {
        id: entityUrl("agenda-intelligence-md"),
        slug: "agenda-intelligence-md",
        name: "Agenda Intelligence MD",
        type: "software_project",
        url: origin,
        canonicalUrl: REPOSITORY_URL,
        description:
          "Evidence-readiness and trust-routing runtime for high-stakes AI-assisted or strategic-risk decisions. It routes claims, evidence gaps, owner actions, and human-review readiness rather than approving decisions.",
        sameAs: [
          REPOSITORY_URL,
          PACKAGE_URL,
          "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md"
        ],
        relatedEntities: [
          "human-review-packet",
          "evidence-pack",
          "claim-audit",
          "confidential-project-room",
          "source-policy",
          "market-gate"
        ],
        evidence: [
          `${origin}/.well-known/ai-catalog.json`,
          `${origin}/.well-known/agent-card.json`,
          okfUrl(origin)
        ]
      },
      {
        id: entityUrl("confidential-project-room"),
        slug: "confidential-project-room",
        name: "Confidential Project-Room Workflow",
        type: "private_review_workflow",
        url: confidentialProjectRoomUrl(origin),
        canonicalUrl: confidentialProjectRoomDiscovery.documentation_url,
        description:
          "Alias-first evidence-readiness workflow for private project, procurement, financing, vendor, or committee files. Public artifacts show the review contract and synthetic redacted example, not client data.",
        relatedEntities: ["human-review-packet", "evidence-pack", "claim-audit", "source-policy", "market-gate"],
        evidence: [
          confidentialProjectRoomUrl(origin),
          confidentialProjectRoomUrl(origin, "/profiles/confidential-project-room/redacted-example.json"),
          confidentialProjectRoomDiscovery.profile_schema
        ],
        boundaries: [
          "Not a secure data room.",
          "Not a legal, compliance, procurement, security, tax, financial, insurance, export-control, or investment decision.",
          "No client names or private source text in public examples."
        ],
        successSignals: [
          "redacted file offered",
          "second private-room profile requested",
          "paid concierge review interest",
          "process-owner introduction",
          "concrete workflow correction"
        ],
        nonSignals: ["public catalog visibility", "technical completion", "generic praise"]
      },
      {
        id: entityUrl("machine-enforcement-audit"),
        slug: "machine-enforcement-audit",
        name: "Machine Enforcement Audit",
        type: "output_shape",
        url: okfUrl(origin, "/okf/human-review-packet.md"),
        description:
          "Reviewer-facing packet showing supported claims, weak claims, missing evidence, likely owner action, and readiness route.",
        relatedEntities: ["evidence-pack", "claim-audit", "source-policy"]
      },
      {
        id: entityUrl("evidence-pack"),
        slug: "evidence-pack",
        name: "Evidence Pack",
        type: "input_shape",
        url: okfUrl(origin, "/okf/evidence-pack.md"),
        canonicalUrl: `${REPOSITORY_URL}/blob/main/schemas/v1/evidence-pack.schema.json`,
        description:
          "Source set used to assess whether claims are ready for human review. External content is treated as data, not instructions.",
        relatedEntities: ["source-policy", "claim-audit", "human-review-packet"]
      },
      {
        id: entityUrl("machine-enforcement-audit"),
        slug: "machine-enforcement-audit",
        name: "Machine Enforcement Audit",
        type: "evidence_discipline",
        url: okfUrl(origin, "/okf/claim-audit.md"),
        canonicalUrl: `${REPOSITORY_URL}/blob/main/schemas/v1/evidence-audit.schema.json`,
        description:
          "Claim-level mapping of support, weakness, missing proof, source IDs, and readiness. It checks evidence sufficiency, not world-truth.",
        relatedEntities: ["evidence-pack", "human-review-packet", "source-policy"]
      },
      {
        id: entityUrl("source-policy"),
        slug: "source-policy",
        name: "Source Policy",
        type: "boundary_discipline",
        url: okfUrl(origin, "/okf/source-policy.md"),
        canonicalUrl: SOURCE_POLICY_URL,
        description:
          "Rules for source planning, coverage, quote-presence checks, provenance tags, and non-verification boundaries.",
        relatedEntities: ["evidence-pack", "claim-audit"]
      },
      {
        id: entityUrl("market-gate"),
        slug: "market-gate",
        name: "Market Gate",
        type: "market_discipline",
        url: okfUrl(origin, "/okf/market-gate.md"),
        description:
          "Discipline that prevents technical artifacts, public listings, and deployed workers from being treated as buyer demand.",
        relatedEntities: ["confidential-project-room"]
      },
      {
        id: entityUrl("repo-stack"),
        slug: "repo-stack",
        name: "Agenda Intelligence Repository Stack",
        type: "repository_map",
        url: okfUrl(origin, "/okf/repo-stack.md"),
        description:
          "Map of the product/runtime repository, reasoning method repository, and regional specialist skill repositories.",
        relatedEntities: ["agenda-intelligence-md"]
      }
    ]
  };
}

function okfMarkdown(pathname) {
  if (pathname === "/okf" || pathname === "/okf/") return OKF_CONTENT["/okf/index.md"];
  return OKF_CONTENT[pathname] || null;
}

function profileContent(pathname) {
  if (pathname === "/profiles/confidential-project-room" || pathname === "/profiles/confidential-project-room/") {
    return PROFILE_CONTENT["/profiles/confidential-project-room/index.md"];
  }
  return PROFILE_CONTENT[pathname] || null;
}

function profileContentType(pathname) {
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/markdown; charset=utf-8";
}

function applyAgentProfile(card, request, env = {}) {
  const profile = agentProfile(request, env);
  if (profile === "cis_secondary_sanctions") return applyCisSecondarySanctionsProfile(card, request, env);
  if (profile === "agentic_interaction_trust") return applyAgenticInteractionTrustProfile(card, request);
  if (profile === "agent_output_verification") return applyAgentOutputVerificationProfile(card, request);
  if (profile === "gulf_maritime_exposure") return applyGulfMaritimeProfile(card, request);
  if (profile === "market_entry_readiness") return applyMarketEntryReadinessProfile(card, request);
  if (profile === "critical_minerals_due_diligence") return applyCriticalMineralsProfile(card, request);
  if (profile === "dual_use_technology_export") return applyDualUseTechnologyExportProfile(card, request);
  if (profile === "corridor_sanctions_assistant") return applyCorridorSanctionsAssistantProfile(card, request);
  if (profile !== "kazakhstan") return card;

  const origin = originFromRequest(request);
  const discovery = profileDiscovery("kazakhstan");
  card.name = "Kazakhstan / Middle Corridor Deal Risk Gate";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "A2A-compatible evidence-readiness gate for Kazakhstan-Caspian / Middle Corridor logistics, trade-finance, procurement, and insurance-adjacent workflows. Bring route, cargo, counterparties, and dated sources; get structured deal-risk triage, missing source categories, evidence gaps, watch-next indicators, decision-readiness score, risk signal, human-review routing, and named sanctions-exposure flags: OFAC named-sector (EO 14024/14114) and newly-formed-counterparty red flags, EU re-export / circumvention-watch jurisdictions (incl. the 20th-package measures on Kyrgyzstan), dual-use cargo screened against the EU/US Common High Priority List, a domestic-legal vs foreign-sanctions exposure decomposition, and a vessel deceptive-shipping-practice checklist. Deterministic rule-based logic, no model in the decision path. Presence-flagging and evidence triage only, not a sanctions determination." +
    PROVIDER_FRONT_DOOR_POINTER;
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
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
        "Provides a pre-compliance evidence gate for sanctions-adjacent Kazakhstan and Central Asia corridor exposure: OFAC named-sector (EO 14024/14114) and newly-formed-counterparty flags, EU re-export / circumvention-watch jurisdictions, dual-use cargo against the EU/US Common High Priority List, missing ownership/counterparty/vessel evidence, and human-review triggers. Deterministic rule-based presence-flagging; not legal or compliance advice, not a sanctions determination.",
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
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.required_before_go = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO;
  card.x_agenda_intelligence.helpful_context_sources = MIDDLE_CORRIDOR_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.focus = discovery.focus;
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
  const discovery = profileDiscovery("agentic_interaction_trust");
  card.name = "Agentic Interaction Trust Gate";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "Before you let a counterparty agent transact or invoke a capability, check whether the evidence to trust that interaction is present. An A2A-compatible evidence-readiness gate for agent-to-agent and agent-mediated actions across A2A endpoint, MCP tool, checkout, account, and API surfaces. Bring the actor's identity claim, target surface, requested action, and dated evidence; get trust-routing triage, the missing source categories, evidence gaps, watch-next indicators, a decision-readiness score, a trust signal, and human-review routing. Evidence-readiness only — not identity verification, authentication, or transaction authorization.";
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
  card.skills = [
    {
      id: "agentic-interaction-trust-gate",
      name: "Counterparty-agent trust gate",
      description:
        "Turns an unknown counterparty agent's requested action, target surface, identity claim, and dated evidence into a structured trust-routing recommendation — allow, step up, escalate to human review, or block until verified — with the evidence that is still missing, a decision-readiness score, and mandatory human-review routing. Evidence-readiness triage, not identity verification.",
      tags: [
        "agentic-ai",
        "a2a",
        "agent-to-agent",
        "counterparty-agent",
        "mcp",
        "trust-and-safety",
        "evidence-readiness",
        "human-review",
        "free"
      ],
      examples: [
        "An unknown A2A agent wants to invoke a capability or settle a payment — is there enough evidence to allow it, step it up, or escalate?",
        "Triage an agent-to-agent transaction before it executes: what authorization and tool-scope evidence is missing?",
        "Should this AI shopping-agent checkout be allowed, stepped up, or escalated to human review?"
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.required_before_action = AGENTIC_INTERACTION_TRUST_REQUIRED_BEFORE_ACTION;
  card.x_agenda_intelligence.helpful_context_sources = AGENTIC_INTERACTION_TRUST_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.focus = discovery.focus;
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

function applyAgentOutputVerificationProfile(card, request) {
  const origin = originFromRequest(request);
  const discovery = profileDiscovery("agent_output_verification");
  card.name = "Agent Output Verification";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "Before you relay or act on a claim-backed answer from another agent, check whether every claim is grounded. An A2A-compatible relay-readiness gate for agent-to-agent output hand-off: bring the claim set and its evidence; get a machine-actionable verdict — allow_relay, verify_before_relay, or block_unsafe_claims — with the unsafe and weak claims, evidence gaps, and owner actions. Schema-level and structural only — not factual-truth verification, source retrieval, or an approval.";
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
  card.skills = [
    {
      id: "agent-output-verification",
      name: "Agent output relay-readiness gate",
      description:
        "Turns another agent's claim set and evidence into a machine-actionable relay verdict — allow_relay, verify_before_relay, or block_unsafe_claims — with the ungrounded and weak claims, evidence gaps, and the owner actions needed before the output is safe to relay. Structural claim-support triage, not factual-truth verification.",
      tags: [
        "agentic-ai",
        "a2a",
        "agent-to-agent",
        "claims",
        "evidence-readiness",
        "trust-and-safety",
        "human-review",
        "free"
      ],
      examples: [
        "Another agent handed me an analysis with cited claims — is it safe to relay, or does it contain unsupported claims?",
        "Verify this agent-drafted memo's claim set before publication.",
        "Gate an orchestrated multi-agent output: which claims are ungrounded?"
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    },
    {
      id: "pre-action-check",
      name: "Pre-action evidence gate",
      description:
        "Routes a caller-controlled action to continue, request_evidence, require_approval, or stop using " +
        "supplied claim evidence, risk tier, policy checks, and external approval status. It reports readiness " +
        "only and does not authenticate, authorize, enforce, or perform the action.",
      tags: ["agentic-ai", "a2a", "guardrails", "evidence-readiness", "human-approval"],
      examples: [
        "Check whether this low-risk agent action has enough claim evidence to continue.",
        "Pause this high-risk tool action until a human approval reference is supplied.",
        "Stop this action because its supporting claims or policy checks failed."
      ],
      inputModes: ["application/json"],
      outputModes: ["application/json", "text/markdown"]
    },
    {
      id: "evidence-gap-analysis",
      name: "Evidence gap and orphan-reference analysis",
      description:
        "Finds missing evidence ids, quote-to-reference mismatches, unsupported statements, and weak claims in " +
        "a caller-supplied claim set. Returns the evidence gaps and owner actions already produced by the relay-readiness " +
        "contract. Structural only: it does not retrieve sources or verify factual truth.",
      tags: ["agentic-ai", "a2a", "evidence-gaps", "orphan-references", "claim-support", "human-review"],
      examples: [
        "Which claims cite evidence ids that were not supplied?",
        "Find quote references that do not match the claim's declared evidence.",
        "List the evidence gaps and owner actions before another agent relays this output."
      ],
      inputModes: ["application/json"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.pre_action_check_contract = discovery.pre_action_check_contract;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.focus = discovery.focus;
  card.x_agenda_intelligence.not_advice_notice = AGENT_OUTPUT_VERIFICATION_NOT_ADVICE_NOTICE;
  card.x_agenda_intelligence.boundaries = [
    "Claim-level relay-readiness evidence triage only.",
    "Schema-level and structural: it does not verify that any claim or quote is factually true.",
    "No live source retrieval; it does not fetch or validate cited sources.",
    "No legal, compliance, financial, investment, insurance, or trading advice.",
    "No approval, clearance, authorization, or final decision.",
    "Human review is required for any verdict other than allow_relay."
  ];
  return card;
}

// Corridor & Sanctions Risk Assistant — lightweight discovery FRONT (Zee-pattern).
// It orients a human, routes to the structured gates, and hands off to
// person-led work after fit, scope, fee, and timing are confirmed. It performs
// no triage, scoring, screening, or retrieval of its own; those live in the
// named gates below.

// Appended to each structured gate's card description so a human landing on any
// one gate is routed to the same front door and commercial process rather than
// navigating nine cards blind. One factual navigation line, no traction claim.
const PROVIDER_FRONT_DOOR_POINTER =
  " New to these gates? Start with the Corridor & Sanctions Risk Assistant " +
  "(https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev) for plain-language orientation. " +
  "Describe the route or counterparty and the next decision or review; fit, scope, fee, and timing are confirmed " +
  "before work starts.";

const CIS_FILE_PREPARATION_POINTER =
  " For person-led preparation of a company-owned trade file, request the redacted intake by email at " +
  `${SUPPORT_CONTACT_EMAIL}. One fixed fee per file is agreed before ` +
  "work starts; scope, fee and timing are confirmed within one business day.";

const CORRIDOR_ASSISTANT_NOT_ADVICE_NOTICE =
  "Orientation and routing only. Not legal, compliance, sanctions, financial, investment, or insurance advice, " +
  "and not an autonomous decision system. The structured gates perform the triage; human review is required before " +
  "any commercial action.";

const CORRIDOR_ASSISTANT_GATES = Object.freeze([
  {
    name: "Kazakhstan / Middle Corridor Deal Risk Gate",
    use_when:
      "a route/cargo/counterparties deal along the Middle Corridor needs a pre-signature evidence-completeness read",
    a2a: "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev",
    profile: "middle_corridor_deal_risk"
  },
  {
    name: "CIS Secondary-Sanctions Exposure",
    use_when:
      "a CIS / Caucasus / Central Asia counterparty needs secondary-sanctions exposure triage for EU / UK / UAE / Singapore due diligence",
    a2a: "https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev",
    profile: "cis_secondary_sanctions"
  },
  {
    name: "Gulf Maritime Exposure Gate",
    use_when:
      "a vessel/voyage through the Gulf, Strait of Hormuz, Bab-el-Mandeb, or Red Sea needs sanctions/chokepoint exposure triage",
    a2a: "https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev",
    profile: "gulf_maritime_exposure"
  },
  {
    name: "Kazakhstan Market-Entry Readiness Gate",
    use_when:
      "a Kazakhstan market-entry file (distribution, import, EPC, energy, infrastructure, partner) needs a readiness gate",
    a2a: "https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev",
    profile: "kazakhstan_market_entry_readiness"
  }
]);

function corridorAssistantMessageText() {
  return [
    "# Corridor & Sanctions Risk Assistant",
    "",
    "Front door to the corridor and sanctions evidence-readiness gates. I orient and route. I do not screen, score, or retrieve.",
    "",
    "## Which gate fits",
    ...CORRIDOR_ASSISTANT_GATES.map((gate) => `- **${gate.name}**: use when ${gate.use_when}. A2A: ${gate.a2a}`),
    "",
    "## If you need person-led work",
    `Email a one-line description of the route or counterparty and the next decision or review to ${SUPPORT_CONTACT_EMAIL} (${SUPPORT_HOURS_LOCAL}).`,
    "I confirm fit, scope, fee, and timing before work starts.",
    "",
    "_Orientation and routing only. Not legal, compliance, sanctions, financial, investment, or insurance advice. " +
      "Human review is required before any commercial action._"
  ].join("\n");
}

function a2aResultForCorridorSanctionsAssistant(params) {
  const text = extractText(params);
  const response = {
    kind: "orientation_and_routing",
    message:
      "Corridor & sanctions orientation: routing to the structured gates and person-led work. " +
      "No triage or screening performed here.",
    caller_text: text ? text.slice(0, 500) : "",
    gates: CORRIDOR_ASSISTANT_GATES.map((gate) => ({ ...gate })),
    engagement: {
      offer: "Person-led review of a current deal or counterparty, scoped and quoted before work starts.",
      contact_email: SUPPORT_CONTACT_EMAIL,
      support_hours: SUPPORT_HOURS_LOCAL,
      next_step:
        "Email a one-line description (route or counterparty + the next decision or review). Fit, scope, fee, and timing are confirmed before work starts."
    },
    human_review_required: true,
    not_advice_notice: CORRIDOR_ASSISTANT_NOT_ADVICE_NOTICE
  };
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "corridor-sanctions-assistant-orientation",
        name: "Corridor & sanctions orientation",
        parts: [
          { text: corridorAssistantMessageText(), mediaType: "text/markdown" },
          { data: response, mediaType: "application/json" }
        ]
      }
    ],
    metadata: {
      product_profile: "corridor_sanctions_assistant",
      human_review_required: true,
      not_advice_notice: CORRIDOR_ASSISTANT_NOT_ADVICE_NOTICE,
      response
    }
  };
}

function applyCorridorSanctionsAssistantProfile(card, request) {
  const origin = originFromRequest(request);
  const discovery = profileDiscovery("corridor_sanctions_assistant");
  card.name = "Corridor & Sanctions Risk Assistant";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "Front door to the corridor and sanctions evidence-readiness gates. Ask about a specific Kazakhstan / Middle " +
    "Corridor deal or a CIS / Caucasus / Central Asia counterparty; get a plain-language read on what due-diligence " +
    "evidence a bank, insurer, or compliance desk will still ask for, and a pointer to the structured gate that fits. " +
    "For person-led work, email a one-line description of the route or counterparty and the next decision or review. " +
    "Fit, scope, fee, and timing are confirmed before work starts. Orientation and routing only. The structured " +
    "triage, scoring, and any screening happen in the named gates, and human review is required before any commercial action.";
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
  card.skills = [
    {
      id: "corridor-sanctions-orientation",
      name: "Corridor & sanctions deal orientation",
      description:
        "Bring a one-line deal or counterparty (route, cargo, or entity + the decision pending). Get a plain-language " +
        "read on the evidence gaps a bank/insurer/compliance desk will flag, which structured gate to run, and what " +
        "to send for person-led work. Fit, scope, fee, and timing are confirmed before work starts.",
      tags: ["corridor", "sanctions", "kazakhstan", "cis", "deal-risk", "evidence-readiness", "human-review", "free"],
      examples: [
        "I'm shipping steel Kazakhstan->EU via the Middle Corridor next month — what will the bank ask for?",
        "Counterparty is a trading house in Georgia — where do I check secondary-sanctions exposure?",
        "I have a live deal. What do you need to scope the review and quote it?"
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.focus = discovery.focus;
  card.x_agenda_intelligence.routes_to = discovery.routes_to;
  card.x_agenda_intelligence.engagement = discovery.engagement;
  card.x_agenda_intelligence.not_advice_notice = CORRIDOR_ASSISTANT_NOT_ADVICE_NOTICE;
  card.x_agenda_intelligence.boundaries = [
    "Orientation and routing only; no triage, scoring, screening, or retrieval of its own.",
    "No legal, compliance, sanctions, financial, investment, or insurance advice.",
    "No approval, clearance, authorization, denial, or final decision.",
    "Human review is required before any commercial action."
  ];
  return card;
}

function applyGulfMaritimeProfile(card, request) {
  const origin = originFromRequest(request);
  const discovery = profileDiscovery("gulf_maritime_exposure");
  card.name = "Gulf Maritime Exposure Gate";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "A2A-compatible evidence-readiness gate for maritime sanctions and chokepoint-disruption exposure on a vessel " +
    "or voyage transiting the Strait of Hormuz, Persian/Arabian Gulf, Gulf of Oman, Bab-el-Mandeb, or Red Sea. Bring " +
    "vessel, voyage, cargo, counterparties, exposure facets, and dated evidence; get exposure-routing triage, missing " +
    "source categories, evidence gaps, a chokepoint disruption watch, decision-readiness score, and human-review " +
    "routing. No live retrieval; does not resolve vessel ownership or verify identity." +
    PROVIDER_FRONT_DOOR_POINTER;
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
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
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.required_before_review = GULF_MARITIME_REQUIRED_BEFORE_REVIEW;
  card.x_agenda_intelligence.helpful_context_sources = GULF_MARITIME_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
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
  const discovery = profileDiscovery("cis_secondary_sanctions");
  card.name = "CIS Secondary-Sanctions Exposure";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "A2A-compatible secondary-sanctions exposure evidence triage for CIS, Caucasus, and Central Asia counterparties (Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova). Bring counterparty, exposure facets, and dated source extracts; get " +
    (activeOption ? `auto-fetched ${activeOption.name} name matches, ` : "") +
    (gleifEnabled(env)
      ? "auto-fetched disclosed LEI ownership (direct / ultimate parent, via GLEIF), "
      : "") +
    "structured evidence gaps, exposure dimensions, and mandatory human-review routing. " +
    (activeOption
      ? ""
      : "Sanctions-list name-match (Snapshot public-list snapshot, or Watchman / OpenSanctions) is wired but disabled in this deployment, which runs on user-supplied evidence only. ") +
    "Person-led file preparation is for the exporter, importer, trader, freight forwarder, or finance lead who owns the file. It accepts redacted context and is not a compliance determination." +
    CIS_FILE_PREPARATION_POINTER;
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
  card.skills = [
    {
      id: "cis-secondary-sanctions-exposure",
      name: "CIS secondary-sanctions exposure triage",
      description:
        "Turns a CIS / Caucasus / Central Asia counterparty, exposure facets, and dated source extracts into structured evidence gaps, exposure dimensions, and mandatory human-review routing, with server-side name matches against a public-list snapshot (Snapshot upstream, with Watchman / OpenSanctions as alternates). When ownership enrichment is enabled, it also fetches disclosed LEI ownership (direct / ultimate parent, via GLEIF) as ownership evidence. Name matches are possible string matches, not identity verification or a determination. The API sits beside a screening or ownership-resolution tool and does not traverse multi-layer beneficial-ownership graphs.",
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
        "Triage a Kazakhstani trading-house counterparty against the EU sanctions package."
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.required_before_review = CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW;
  card.x_agenda_intelligence.helpful_context_sources = CIS_SECONDARY_SANCTIONS_HELPFUL_CONTEXT;
  card.x_agenda_intelligence.live_retrieval = {
    capability_declared: true,
    active: activeOption !== null,
    active_upstream: activeOption ? activeOption.name : null,
    upstream_options: [
      {
        name: "Snapshot",
        homepage: SNAPSHOT_PROJECT_URL,
        license: SNAPSHOT_LICENSE,
        attribution_notice: SNAPSHOT_ATTRIBUTION,
        activation_env_var: "SNAPSHOT_INDEX_URL",
        disable_env_var: "SNAPSHOT_DISABLED",
        cost_model: "static public-list snapshot fetched by the worker; $0, no external host"
      },
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
      : "Per the 2026-05-27 update to ADR 0014, live retrieval upstreams are declared but not activated. Set SNAPSHOT_INDEX_URL ($0 static snapshot, no host), WATCHMAN_URL (free self-host), or OPENSANCTIONS_API_KEY (paid) to activate. Profile currently operates on user-supplied evidence only."
  };
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.focus = discovery.focus;
  card.x_agenda_intelligence.not_advice_notice = NOT_ADVICE_NOTICE;
  card.x_agenda_intelligence.boundaries = [
    "Pre-compliance evidence triage only.",
    activeOption
      ? `Live retrieval is active for this profile against ${activeOption.name}; name matches are possible string matches only, not identity verification or a determination.`
      : "Live retrieval (Snapshot / Watchman / OpenSanctions) is available for this profile but is not active in this deployment; triage runs on user-supplied evidence only.",
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

// A caller who pokes a structured gate with a plain-language question — a
// directory crawler, another agent, or a human with curl — used to get
// TASK_STATE_FAILED with an empty artifacts[] and a schema filename. Measured
// 2026-08-18 against the live workers: five of the eight gates answered that
// way to every probe, and the reply named no required field, carried no
// example, and pointed at no human. The gate still refuses the request; it now
// says what it needs, shows one request that works, and names the front door.
const GATE_REQUEST_GUIDES = Object.freeze({
  cis_secondary_sanctions: {
    title: "CIS Secondary-Sanctions Exposure Gate",
    required: [
      "counterparty — object with name and jurisdiction",
      "exposure_facets — array, e.g. ownership_or_control, transit_or_re_export",
      "dated_sources — array of { id, source_type, title, date }",
      "risk_question — one sentence naming the decision",
      "decision_stage — onboarding, periodic_review, pre_transaction, post_alert, committee_review, other"
    ],
    example: {
      counterparty: { name: "Example Trading LLP", jurisdiction: "KZ", sector: "trading_house" },
      exposure_facets: ["ownership_or_control", "transit_or_re_export"],
      dated_sources: [
        { id: "cis-1", source_type: "ofac_sdn_extract", title: "OFAC SDN extract", date: "2026-08-01" },
        { id: "cis-2", source_type: "ownership_chain_evidence", title: "Ownership chain memo", date: "2026-08-04" }
      ],
      risk_question: "Is this counterparty ready for onboarding review under secondary-sanctions exposure?",
      decision_stage: "onboarding"
    }
  },
  agentic_interaction_trust: {
    title: "Agentic Interaction Trust Gate",
    required: [
      "actor — object with declared_type and declared_name",
      "target_surface — checkout, account, api, mcp_tool, a2a_endpoint, content_or_catalog, auth_flow, support_or_messaging, other",
      "requested_action — what the actor is asking to do",
      "dated_sources — array of { id, source_type, title, date }",
      "risk_question — one sentence naming the decision",
      "decision_stage — pre_execution, in_session, post_alert, policy_review, committee_review, other"
    ],
    example: {
      actor: {
        declared_type: "ai_agent",
        declared_name: "Example Shopping Agent",
        operator: "Example Consumer",
        authentication_context: "session_cookie"
      },
      target_surface: "checkout",
      requested_action: "complete purchase of two restricted-delivery items",
      dated_sources: [
        { id: "ait-1", source_type: "agent_identity_claim", title: "Declared agent identity header", date: "2026-08-01" },
        { id: "ait-2", source_type: "session_authentication_evidence", title: "Authenticated checkout session", date: "2026-08-01" }
      ],
      risk_question: "Is this agent-mediated checkout ready to allow, step up, or route to human review?",
      decision_stage: "pre_execution"
    }
  },
  agent_output_verification: {
    title: "Agent Output Verification Gate",
    required: [
      "claims — non-empty array of { claim_id, claim, support_level, evidence_ids }",
      "support_level — direct, partial, weak, unsupported",
      "evidence — array of { evidence_id, title, date }"
    ],
    example: {
      claims: [
        {
          claim_id: "c1",
          claim: "The counterparty is not on the OFAC SDN list as of 2026-08-01.",
          support_level: "direct",
          evidence_ids: ["e1"]
        }
      ],
      evidence: [{ evidence_id: "e1", title: "OFAC SDN extract", date: "2026-08-01" }]
    }
  },
  gulf_maritime_exposure: {
    title: "Gulf Maritime Exposure Gate",
    required: [
      "voyage — object, chokepoint one of strait_of_hormuz, persian_gulf, gulf_of_oman, bab_el_mandeb, red_sea, suez_canal, other",
      "exposure_facets — array, e.g. dark_fleet_indicators, insurance_or_pi_gap",
      "dated_sources — array of { id, source_type, title, date }",
      "risk_question — one sentence naming the decision",
      "decision_stage — pre_fixture, pre_voyage, pre_port_call, post_alert, committee_review, other"
    ],
    example: {
      voyage: { vessel: "Example Carrier", chokepoint: "strait_of_hormuz", cargo: "crude oil" },
      exposure_facets: ["dark_fleet_indicators", "insurance_or_pi_gap"],
      dated_sources: [
        { id: "gme-1", source_type: "vessel_registry_extract", title: "Vessel registry extract", date: "2026-08-01" },
        { id: "gme-2", source_type: "pi_insurance_certificate", title: "P&I certificate", date: "2026-07-28" }
      ],
      risk_question: "Is this voyage ready for pre-fixture human review?",
      decision_stage: "pre_fixture"
    }
  },
  kazakhstan_market_entry_readiness: {
    title: "Kazakhstan Market-Entry Readiness Gate",
    required: [
      "project_name — the entry project",
      "partner_or_company — the entering company or partner",
      "market — target market",
      "decision_question — one sentence naming the decision",
      "decision_stage — concept_review, pre_entity_setup, pre_signature, pre_import, pre_certification, pre_showroom_lease, other",
      "supplied_sources — array of { id, source_type, title, date }"
    ],
    example: {
      project_name: "Example EV distribution entry",
      partner_or_company: "Example Motors Ltd",
      market: "Kazakhstan",
      decision_question: "Is this entry ready for a pre-signature human review?",
      decision_stage: "pre_signature",
      supplied_sources: [
        { id: "me-1", source_type: "user_provided_note", title: "Partner background note", date: "2026-08-01" }
      ]
    }
  },
  kazakhstan: {
    title: "Kazakhstan / Middle Corridor Deal Risk Gate",
    required: [
      "route — the corridor leg",
      "cargo — what moves",
      "counterparties — array of { role, name, jurisdiction }",
      "dated_sources — array of { id, source_type, title, date }",
      "risk_question — one sentence naming the decision",
      "decision_stage — pre_signature, pre_shipment, in_transit, post_incident, committee_review, other"
    ],
    example: {
      route: "Aktau — Baku — Poti",
      cargo: "industrial equipment",
      counterparties: [{ role: "forwarder", name: "Example Forwarding", jurisdiction: "KZ" }],
      dated_sources: [
        { id: "mc-1", source_type: "port_operator_notice", title: "Aktau port notice", date: "2026-08-01" },
        { id: "mc-2", source_type: "sanctions_list_extract", title: "EU consolidated extract", date: "2026-08-02" }
      ],
      risk_question: "Is this shipment ready for a pre-signature human review?",
      decision_stage: "pre_signature"
    }
  },
  critical_minerals_due_diligence: {
    title: "Critical Minerals & Strategic Raw Materials Due Diligence Gate",
    required: [
      "project_name — the offtake, investment or shipment file",
      "commodity — one of lithium, rare_earth_elements, nickel, cobalt, copper, graphite, manganese, tungsten, gallium_germanium, other_critical_mineral",
      "origin_jurisdiction — where the material is mined",
      "decision_question — one sentence naming the decision",
      "decision_stage — pre_exploration, pre_offtake_agreement, pre_processing_contract, pre_export_shipment, pre_investment_decision",
      "supplied_sources — array of { id, source_type, title, date }"
    ],
    example: {
      project_name: "Example spodumene offtake",
      commodity: "lithium",
      origin_jurisdiction: "KZ",
      processing_jurisdiction: "CN",
      target_market: "eu",
      decision_question: "Is this offtake ready for a pre-signature human review?",
      decision_stage: "pre_offtake_agreement",
      supplied_sources: [
        { id: "cm-1", source_type: "mining_concession_or_license_extract", title: "Concession extract", date: "2026-08-01" },
        { id: "cm-2", source_type: "certified_ore_assay_report", title: "Certified assay", date: "2026-08-02" }
      ]
    }
  },
  dual_use_technology_export: {
    title: "Dual-Use Technology & Export Controls Gate",
    required: [
      "shipment — object with hs_code, description, origin, and destination",
      "dated_sources — array of { id, source_type, title, date }",
      "risk_question — one sentence naming the decision",
      "shipment.eccn — optional classification supplied by the caller",
      "shipment.end_user_sector — optional sector: military, civilian, aerospace, semiconductor, or unknown"
    ],
    example: {
      shipment: {
        hs_code: "854231",
        eccn: "3A001",
        description: "Example integrated circuits",
        origin: "DE",
        destination: "KZ",
        transit_countries: ["TR"],
        end_user_sector: "civilian"
      },
      dated_sources: [
        { id: "du-1", source_type: "classification_note", title: "Exporter classification note", date: "2026-08-01" },
        { id: "du-2", source_type: "end_user_statement", title: "Signed end-user statement", date: "2026-08-02" }
      ],
      risk_question: "Is this file complete enough for export-control human review?"
    }
  }
});

function invalidRequestArtifact(profile, endpoint, schema, errors) {
  const guide = GATE_REQUEST_GUIDES[profile];
  if (!guide) return null;
  const text = [
    `# ${guide.title} — request not accepted`,
    "",
    "Nothing was screened. This gate reads a structured request, not a plain-language question.",
    "",
    "## Why it stopped",
    ...errors.map((error) => `- ${error}`),
    "",
    "## What it needs",
    ...guide.required.map((field) => `- ${field}`),
    "",
    "## A request that works",
    "```json",
    JSON.stringify(guide.example, null, 2),
    "```",
    "",
    `Send it as \`params.message.parts[0].data\` to \`message/send\`, or POST it to \`${endpoint}\`.`,
    `Full field list: \`${schema}\`.`,
    "",
    "## If you would rather talk to a person",
    "Start with the Corridor & Sanctions Risk Assistant",
    "(https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev) for plain-language orientation,",
    `or email ${SUPPORT_CONTACT_EMAIL} with a one-line route or counterparty and the next decision or review.`,
    "Fit, scope, fee, and timing are confirmed before work starts.",
    "",
    "The gate triages evidence readiness. It does not verify facts, retrieve live sources, or replace human review."
  ].join("\n");
  return {
    artifactId: `${profile.replace(/_/g, "-")}-request-guidance`,
    name: `${guide.title} — how to send a request this gate accepts`,
    parts: [
      { text, mediaType: "text/markdown" },
      {
        data: {
          valid: false,
          errors,
          required_fields: guide.required,
          example_request: guide.example,
          canonical_http_endpoint: endpoint,
          schema,
          front_door: "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev",
          support_contact: SUPPORT_CONTACT_EMAIL
        },
        mediaType: "application/json"
      }
    ]
  };
}

function invalidRequestResult(profile, endpoint, schema, errors) {
  const artifact = invalidRequestArtifact(profile, endpoint, schema, errors);
  const guide = GATE_REQUEST_GUIDES[profile];
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() },
    artifacts: artifact ? [artifact] : [],
    metadata: {
      product_profile: profile,
      canonical_http_endpoint: endpoint,
      schema,
      valid: false,
      errors,
      ...(guide
        ? {
            required_fields: guide.required,
            example_request: guide.example,
            front_door: "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev",
            support_contact: SUPPORT_CONTACT_EMAIL
          }
        : {})
    }
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

// FollowTheMoney schema -> the vocabulary the compact index publishes, for
// upstreams that return a schema but no entity type of their own.
function schemaToEntityType(schema) {
  switch (schema) {
    case "Person":
      return "individual";
    case "Company":
    case "Organization":
    case "LegalEntity":
      return "entity";
    case "Vessel":
      return "vessel";
    case "Airplane":
      return "aircraft";
    default:
      return "unknown";
  }
}

const NON_COUNTERPARTY_TYPES = ["vessel", "aircraft"];

// Name the lists that actually answered. The dimension used to say
// "OpenSanctions consolidated dataset" whichever upstream produced the match,
// which misstated provenance whenever the Snapshot or Watchman upstream was the
// active one.
function matchUpstreamLabel(matches) {
  const datasets = [];
  for (const match of matches || []) {
    for (const dataset of (match && match.datasets) || []) {
      const value = String(dataset).trim();
      if (value && !datasets.includes(value)) datasets.push(value);
    }
  }
  if (datasets.length === 0) return "the active sanctions-list upstream";
  if (datasets.length <= 3) return datasets.join(", ");
  return `${datasets.slice(0, 3).join(", ")} and ${datasets.length - 3} more`;
}

// A match is reported as a match on the counterparty only when the listed thing
// could be the counterparty. A ship or an aircraft named after a person is not
// that person, and saying "direct match" about one states something the record
// does not support. Such a listing is still surfaced — it can matter to a file —
// but it is named for what it is.
function cisTopExposureDimensions(facets, missing, matches, undisclosedUbo = false) {
  const dims = [];
  const list = Array.isArray(matches) ? matches : [];
  const craft = list.filter((m) => NON_COUNTERPARTY_TYPES.includes(m && m.entity_type));
  const direct = list.filter((m) => !NON_COUNTERPARTY_TYPES.includes(m && m.entity_type));
  if (direct.length > 0) {
    dims.push(`direct or near-direct match in ${matchUpstreamLabel(list)}`);
  }
  if (craft.length > 0) {
    dims.push(
      `listed vessel or aircraft carrying a matching name in ${matchUpstreamLabel(craft)} — not a match on the counterparty itself`
    );
  }
  if (undisclosedUbo) dims.push("undisclosed or unverified ultimate beneficial owner");
  if (facets.includes("ownership_or_control")) dims.push("indirect ownership or control exposure");
  if (facets.includes("transit_or_re_export")) {
    dims.push("transit or re-export exposure under EU sanctions package / OFAC EO 14114");
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

function profileReadinessContract(response, {
  profile,
  statusField,
  scoreField = "decision_readiness_score",
  routingField = "triage_recommendation",
  signalField = null,
  boundaryField = "not_advice_notice"
}) {
  const namedValue = (field) => {
    if (!field || !(field in response) || response[field] === null || response[field] === undefined) return null;
    return { field, value: String(response[field]) };
  };
  const score = scoreField && Number.isInteger(response[scoreField]) ? response[scoreField] : null;
  return {
    profile,
    status: String(response[statusField] || ""),
    score,
    routing: namedValue(routingField),
    signal: namedValue(signalField),
    blocking_gaps: Array.isArray(response.evidence_gaps) ? response.evidence_gaps.slice() : [],
    non_blocking_gaps: [],
    claim_audit: Array.isArray(response.claim_audit) ? response.claim_audit.slice() : [],
    owner_actions: Array.isArray(response.owner_actions) ? response.owner_actions.slice() : [],
    watch_next: Array.isArray(response.watch_next) ? response.watch_next.slice() : [],
    human_review_required: Boolean(response.human_review_required ?? true),
    boundary_notice: String(response[boundaryField] || response.not_advice_notice || "")
  };
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
  response.readiness_contract = profileReadinessContract(response, {
    profile: "agentic_interaction_trust",
    statusField: "decision_readiness_label",
    signalField: "trust_signal"
  });
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
    return invalidRequestResult(
      "agentic_interaction_trust",
      "/v1/agentic-interaction/trust",
      "schemas/v1/agentic-interaction-trust-request.schema.json",
      ["Missing structured agentic interaction trust request"]
    );
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

const AGENT_OUTPUT_VERIFICATION_NOT_ADVICE_NOTICE =
  "Agent-output relay-readiness triage only. Schema-level and structural: it does not verify that any " +
  "claim or quote is factually true, does not fetch or validate cited sources, and does not authorize " +
  "an action or provide legal, compliance, sanctions, financial, or investment advice. Human review is " +
  "required before a consuming agent acts on any verdict other than allow_relay.";

const AGENT_OUTPUT_VERIFICATION_SUPPORT_LEVELS = ["direct", "partial", "weak", "unsupported"];

function isAgentOutputVerificationRequest(value) {
  return (
    value &&
    typeof value === "object" &&
    Array.isArray(value.claims) &&
    value.claims.length > 0 &&
    Array.isArray(value.evidence)
  );
}

function structuredAgentOutputVerificationRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [params.request, params.audit_json, params.input, params];
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
    if (isAgentOutputVerificationRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isAgentOutputVerificationRequest(parsed)) return parsed;
  }
  return null;
}

function agentOutputVerificationEnumErrors(request) {
  const errors = [];
  const claims = Array.isArray(request.claims) ? request.claims : [];
  claims.forEach((claim, index) => {
    if (!claim || typeof claim !== "object") {
      errors.push(`claims[${index}] must be an object`);
      return;
    }
    if (!claim.claim_id) errors.push(`claims[${index}].claim_id is required`);
    if (!claim.claim) errors.push(`claims[${index}].claim is required`);
    if (!AGENT_OUTPUT_VERIFICATION_SUPPORT_LEVELS.includes(claim.support_level)) {
      errors.push(`claims[${index}].support_level must be one of ${AGENT_OUTPUT_VERIFICATION_SUPPORT_LEVELS.join(", ")}`);
    }
  });
  return errors;
}

function agentOutputAuditSummary(request) {
  const claims = Array.isArray(request.claims) ? request.claims : [];
  const evidence = Array.isArray(request.evidence) ? request.evidence : [];
  const evidenceIds = new Set(evidence.map((item) => item && item.evidence_id));
  const supportLevels = {};
  const orphans = [];
  const spanOrphans = [];
  let grounded = 0;
  for (const claim of claims) {
    supportLevels[claim.support_level] = (supportLevels[claim.support_level] || 0) + 1;
    const declared = Array.isArray(claim.evidence_ids) ? claim.evidence_ids : [];
    const missing = declared.filter((eid) => !evidenceIds.has(eid));
    if (missing.length) orphans.push({ claim_id: claim.claim_id, missing_evidence_ids: missing });
    const quotes = Array.isArray(claim.supporting_quotes) ? claim.supporting_quotes : [];
    if (quotes.length) grounded += 1;
    const declaredSet = new Set(declared);
    for (const sq of quotes) {
      const eid = sq && sq.evidence_id;
      if (!declaredSet.has(eid)) {
        const reason = evidenceIds.has(eid) ? "evidence_id not in claim.evidence_ids" : "evidence_id not in evidence";
        spanOrphans.push({ claim_id: claim.claim_id, evidence_id: eid, reason });
      }
    }
  }
  return { supportLevels, orphans, spanOrphans, grounded, claimCount: claims.length };
}

function agentOutputVerificationResult(request) {
  const claims = Array.isArray(request.claims) ? request.claims : [];
  const summary = agentOutputAuditSummary(request);
  const unsupportedStatements = (Array.isArray(request.unsupported_claims) ? request.unsupported_claims : []).map(
    (item) => String(item)
  );
  const claimCount = summary.claimCount;
  const grounded = summary.grounded;

  const unsafeClaims = [];
  const weakClaims = [];
  const seenUnsafe = new Set();
  for (const claim of claims) {
    if (claim.support_level === "unsupported") {
      unsafeClaims.push({
        claim_id: claim.claim_id,
        claim: claim.claim,
        reason: "claim declared with support_level unsupported"
      });
      seenUnsafe.add(claim.claim_id);
    } else if (claim.support_level === "weak") {
      weakClaims.push({ claim_id: claim.claim_id, claim: claim.claim });
    }
  }
  for (const entry of summary.orphans) {
    if (seenUnsafe.has(entry.claim_id)) continue;
    const claimText = (claims.find((c) => c.claim_id === entry.claim_id) || {}).claim || "";
    unsafeClaims.push({
      claim_id: entry.claim_id,
      claim: claimText,
      reason: `cites evidence_id(s) not present: ${entry.missing_evidence_ids.join(", ")}`
    });
    seenUnsafe.add(entry.claim_id);
  }

  const evidenceGaps = [];
  for (const entry of summary.orphans) {
    evidenceGaps.push(`Claim ${entry.claim_id} cites evidence not supplied: ${entry.missing_evidence_ids.join(", ")}.`);
  }
  for (const entry of summary.spanOrphans) {
    evidenceGaps.push(`Claim ${entry.claim_id} quote attributed to evidence ${entry.evidence_id} (${entry.reason}).`);
  }

  const direct = summary.supportLevels.direct || 0;
  const partial = summary.supportLevels.partial || 0;
  const weak = summary.supportLevels.weak || 0;
  const rawScore = claimCount ? Math.round(((direct * 1.0 + partial * 0.6 + weak * 0.2) / claimCount) * 100) : 0;
  let readinessScore = Math.max(0, rawScore - 10 * unsafeClaims.length - 5 * unsupportedStatements.length);

  let verdict;
  if (unsafeClaims.length || unsupportedStatements.length) {
    verdict = "block_unsafe_claims";
    readinessScore = Math.min(readinessScore, 49);
  } else if (!claimCount) {
    verdict = "insufficient_information";
  } else if (weakClaims.length || summary.spanOrphans.length) {
    verdict = "verify_before_relay";
  } else if (grounded === claimCount) {
    verdict = "allow_relay";
  } else {
    verdict = "verify_before_relay";
  }

  let readinessLabel;
  if (!claimCount) {
    readinessLabel = "insufficient_information";
  } else if (verdict === "block_unsafe_claims") {
    readinessLabel = "not_decision_ready";
  } else if (readinessScore >= 85) {
    readinessLabel = "review_ready";
  } else if (readinessScore >= 50) {
    readinessLabel = "partial";
  } else {
    readinessLabel = "not_decision_ready";
  }

  let trustSignal;
  if (verdict === "block_unsafe_claims") {
    trustSignal = "low";
  } else if (verdict === "insufficient_information" || verdict === "not_decision_ready") {
    trustSignal = "unknown";
  } else if (verdict === "verify_before_relay") {
    trustSignal = "medium";
  } else if (grounded === claimCount) {
    trustSignal = "high";
  } else {
    trustSignal = "medium_high";
  }

  const ownerActions = [];
  for (const item of unsafeClaims) ownerActions.push(`Ground or remove claim ${item.claim_id}: ${item.reason}.`);
  for (const statement of unsupportedStatements) {
    ownerActions.push(`Supply source-backed evidence for the unsupported statement: ${statement}`);
  }
  for (const item of weakClaims) {
    ownerActions.push(`Strengthen weak claim ${item.claim_id} with direct supporting evidence.`);
  }

  const response = {
    verdict,
    trust_signal: trustSignal,
    readiness_score: readinessScore,
    readiness_label: readinessLabel,
    claim_count: claimCount,
    grounded_claim_count: grounded,
    unsafe_claims: unsafeClaims,
    weak_claims: weakClaims,
    unsupported_statements: unsupportedStatements,
    evidence_gaps: evidenceGaps,
    owner_actions: ownerActions,
    watch_next: [
      "producing agent revises claims after this verdict",
      "new evidence supplied for previously unsupported or orphaned claims",
      "cited source freshness or provenance change"
    ],
    human_review_required: verdict !== "allow_relay",
    not_advice_notice: AGENT_OUTPUT_VERIFICATION_NOT_ADVICE_NOTICE,
    limitations: [
      "Schema-level and structural only. Does not verify that any claim or quote is factually true.",
      "Does not fetch or validate cited sources; it checks declared support structure only."
    ]
  };
  return { response };
}

const PRE_ACTION_POLICY_VERSION = "pre-action-check.v1";
const PRE_ACTION_RISK_TIERS = ["low", "medium", "high", "critical"];
const PRE_ACTION_APPROVAL_STATUSES = ["not_requested", "approved", "rejected"];
const PRE_ACTION_POLICY_PROFILES = ["default", "agentic_interaction_trust"];
const PRE_ACTION_POLICY_CHECK_STATUSES = ["passed", "needs_evidence", "failed"];
const PRE_ACTION_NOT_AUTHORIZATION_NOTICE =
  "Pre-action evidence-readiness routing only. The caller remains responsible for authenticating the actor, " +
  "enforcing the returned decision, storing and validating any approval record, and authorizing or performing " +
  "the action. A continue decision is not approval, clearance, authorization, or factual verification.";

function isPreActionCheckRequest(request) {
  return Boolean(
    request &&
      typeof request === "object" &&
      typeof request.run_id === "string" &&
      request.actor &&
      typeof request.actor === "object" &&
      typeof request.requested_action === "string" &&
      request.target &&
      typeof request.target === "object" &&
      typeof request.risk_tier === "string" &&
      Array.isArray(request.claims) &&
      Array.isArray(request.evidence)
  );
}

function preActionCheckErrors(request) {
  const errors = agentOutputVerificationEnumErrors(request);
  if (!request.run_id) errors.push("run_id is required");
  if (!request.actor || typeof request.actor !== "object") errors.push("actor must be an object");
  if (!request.requested_action) errors.push("requested_action is required");
  if (!request.target || typeof request.target !== "object") errors.push("target must be an object");
  if (!PRE_ACTION_RISK_TIERS.includes(request.risk_tier)) {
    errors.push(`risk_tier must be one of ${PRE_ACTION_RISK_TIERS.join(", ")}`);
  }
  const policyContext = request.policy_context;
  if (policyContext && !PRE_ACTION_POLICY_PROFILES.includes(policyContext.profile || "default")) {
    errors.push(`policy_context.profile must be one of ${PRE_ACTION_POLICY_PROFILES.join(", ")}`);
  }
  const checks = policyContext && Array.isArray(policyContext.checks) ? policyContext.checks : [];
  checks.forEach((check, index) => {
    if (!check || typeof check !== "object") {
      errors.push(`policy_context.checks[${index}] must be an object`);
      return;
    }
    if (!check.check_id) errors.push(`policy_context.checks[${index}].check_id is required`);
    if (!PRE_ACTION_POLICY_CHECK_STATUSES.includes(check.status)) {
      errors.push(
        `policy_context.checks[${index}].status must be one of ${PRE_ACTION_POLICY_CHECK_STATUSES.join(", ")}`
      );
    }
  });
  const approval = request.approval;
  if (approval && !PRE_ACTION_APPROVAL_STATUSES.includes(approval.status)) {
    errors.push(`approval.status must be one of ${PRE_ACTION_APPROVAL_STATUSES.join(", ")}`);
  }
  return errors;
}

function deduplicatedStrings(items) {
  const result = [];
  const seen = new Set();
  for (const item of items) {
    const text = String(item || "").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      result.push(text);
    }
  }
  return result;
}

function preActionCheckResult(request) {
  const verification = agentOutputVerificationResult(request).response;
  const policyContext = request.policy_context || {};
  const policyProfile = policyContext.profile || "default";
  const policyChecks = Array.isArray(policyContext.checks) ? policyContext.checks : [];
  const failedChecks = policyChecks.filter((item) => item.status === "failed");
  const evidenceChecks = policyChecks.filter((item) => item.status === "needs_evidence");
  const approvalStatus = (request.approval && request.approval.status) || "not_requested";

  const verificationGaps = verification.evidence_gaps || [];
  const unsafeGaps = (verification.unsafe_claims || []).map(
    (item) => `Claim ${item.claim_id}: ${item.reason}`
  );
  const unsupportedGaps = (verification.unsupported_statements || []).map(
    (item) => `Unsupported statement: ${item}`
  );
  const failedPolicyGaps = failedChecks.map(
    (item) => item.evidence_gap || `Policy check ${item.check_id} failed.`
  );
  const policyEvidenceGaps = evidenceChecks.map(
    (item) => item.evidence_gap || `Policy check ${item.check_id} needs evidence.`
  );
  const blockingGaps = deduplicatedStrings([
    ...verificationGaps,
    ...unsafeGaps,
    ...unsupportedGaps,
    ...failedPolicyGaps
  ]);
  const evidenceRequests = deduplicatedStrings([...(verification.owner_actions || []), ...policyEvidenceGaps]);

  let decision;
  let reasonCode;
  if (approvalStatus === "rejected") {
    decision = "stop";
    reasonCode = "approval_rejected";
  } else if (failedChecks.length) {
    decision = "stop";
    reasonCode = "policy_check_failed";
  } else if (verification.verdict === "block_unsafe_claims") {
    decision = "stop";
    reasonCode = "unsafe_claims";
  } else if (evidenceChecks.length || verification.verdict !== "allow_relay") {
    decision = "request_evidence";
    reasonCode = "evidence_gaps";
  } else {
    const approvalRiskTiers = new Set(["high", "critical"]);
    if (policyProfile === "agentic_interaction_trust") approvalRiskTiers.add("medium");
    if (approvalRiskTiers.has(request.risk_tier) && approvalStatus !== "approved") {
      decision = "require_approval";
      reasonCode = "approval_required_for_risk";
    } else {
      decision = "continue";
      reasonCode = "evidence_ready";
    }
  }

  return {
    response: {
      decision_id: crypto.randomUUID(),
      run_id: request.run_id,
      policy_version: PRE_ACTION_POLICY_VERSION,
      decision,
      reason_code: reasonCode,
      blocking_gaps: blockingGaps,
      evidence_requests: evidenceRequests,
      approval_required: decision === "require_approval",
      human_review_required: decision === "require_approval",
      verification,
      policy_checks: policyChecks,
      not_authorization_notice: PRE_ACTION_NOT_AUTHORIZATION_NOTICE,
      limitations: [
        "Uses caller-supplied claims, evidence, policy-check results, risk tier, and approval reference.",
        "Does not authenticate the actor, inspect the target system, store state, or perform the action.",
        "Does not sign the decision receipt; decision_id is a correlation identifier only."
      ]
    }
  };
}

function decisionGateTask(capability, response, { error = false } = {}) {
  const outcome = response.decision || response.reason_code || "complete";
  const result = {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: `${capability.replace(/_/gu, "-")}-response`,
        name: `${capability.replace(/_/gu, " ")} response`,
        parts: [
          {
            text: [
              "Agenda Decision Gate response",
              "",
              `Capability: ${capability}`,
              `Outcome: ${outcome}`,
              `Gate passed: ${String(response.gate_passed === true)}`,
              "",
              DECISION_NOT_AUTHORIZATION_NOTICE
            ].join("\n"),
            mediaType: "text/markdown"
          },
          { data: response, mediaType: "application/json" }
        ]
      }
    ],
    metadata: {
      product_profile: "agent_output_verification",
      capability,
      human_review_required:
        typeof response.human_review_required === "boolean"
          ? response.human_review_required
          : response.gate_passed !== true,
      not_authorization_notice: DECISION_NOT_AUTHORIZATION_NOTICE,
      response
    }
  };
  if (error) result.error = true;
  return result;
}

function a2aResultForDecisionPoliciesList(params) {
  if (params.request && Object.keys(params.request).length > 0) {
    return invalidRequestResult(
      "agent_output_verification",
      "/mcp#decision_policies_list",
      "schemas/v1/decision-policies-list-request.schema.json",
      ["The decision policy list request does not accept arguments"]
    );
  }
  return decisionGateTask("decision_policies_list", decisionPolicyCatalog());
}

async function a2aResultForDecisionCheck(params, request, env = {}) {
  const structured = structuredAgentOutputVerificationRequestFromParams(params);
  if (!structured || !isPreActionCheckRequest(structured)) {
    return invalidRequestResult(
      "agent_output_verification",
      "/mcp#decision_check",
      "schemas/v1/pre-action-check-request.schema.json",
      ["Missing structured pre-action check request"]
    );
  }
  const errors = preActionCheckErrors(structured);
  if (errors.length) {
    return invalidRequestResult(
      "agent_output_verification",
      "/mcp#decision_check",
      "schemas/v1/pre-action-check-request.schema.json",
      errors
    );
  }

  const baseResponse = preActionCheckResult(structured).response;
  const signingKey = env.AGENT_CARD_SIGNING_KEY || env.AGENT_CARD_PRIVATE_JWK;
  if (!signingKey) {
    return decisionGateTask(
      "decision_check",
      {
        ...baseResponse,
        receipt_status: "unavailable",
        receipt: null,
        limitations: [
          ...baseResponse.limitations,
          "Receipt signing is unavailable; do not treat this diagnostic decision as a signed Gate pass."
        ]
      },
      { error: true }
    );
  }

  try {
    const receipt = await signDecisionReceipt({
      request: structured,
      decision: baseResponse,
      privateJwk: signingKey,
      kid: env.AGENT_CARD_SIGNING_KID || null,
      issuer: originFromRequest(request)
    });
    const limitations = baseResponse.limitations.filter(
      (item) => !item.startsWith("Does not sign the decision receipt")
    );
    limitations.push(
      "The attached receipt proves this Worker's readiness result and request binding only; it is not authorization."
    );
    return decisionGateTask("decision_check", {
      ...baseResponse,
      receipt_status: "signed",
      receipt,
      limitations
    });
  } catch (_error) {
    return decisionGateTask(
      "decision_check",
      {
        ...baseResponse,
        receipt_status: "unavailable",
        receipt: null,
        limitations: [
          ...baseResponse.limitations,
          "Receipt signing failed; do not treat this diagnostic decision as a signed Gate pass."
        ]
      },
      { error: true }
    );
  }
}

function decisionVerifyErrors(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["decision_verify arguments must be an object"];
  }
  const allowed = new Set(["receipt", "expected_request_hash", "expected_action_hash"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`Unexpected field: ${key}`);
  }
  if (typeof value.receipt !== "string" || value.receipt.split(".").length !== 3) {
    errors.push("receipt must be a compact JWS string");
  }
  const hashPattern = /^sha256:[a-f0-9]{64}$/u;
  if (!hashPattern.test(value.expected_request_hash || "")) {
    errors.push("expected_request_hash must be a sha256-prefixed lowercase hex digest");
  }
  if (!hashPattern.test(value.expected_action_hash || "")) {
    errors.push("expected_action_hash must be a sha256-prefixed lowercase hex digest");
  }
  return errors;
}

async function a2aResultForDecisionVerify(params, request, env = {}) {
  const structured = params && typeof params === "object" ? params.request : null;
  const errors = decisionVerifyErrors(structured);
  if (errors.length) {
    return invalidRequestResult(
      "agent_output_verification",
      "/mcp#decision_verify",
      "schemas/v1/decision-receipt-verify-request.schema.json",
      errors
    );
  }
  const signingKey = env.AGENT_CARD_SIGNING_KEY || env.AGENT_CARD_PRIVATE_JWK;
  const response = await verifyDecisionReceipt({
    token: structured.receipt,
    publicJwk: signingKey,
    expectedRequestHash: structured.expected_request_hash,
    expectedActionHash: structured.expected_action_hash,
    expectedIssuer: originFromRequest(request)
  });
  return decisionGateTask("decision_verify", response, {
    error: response.reason_code === "signing_key_unavailable"
  });
}

function agentOutputVerificationArtifactText(response) {
  const unsafe = response.unsafe_claims || [];
  const unsafeText = unsafe.length ? unsafe.map((item) => `- ${item.claim_id}: ${item.reason}`).join("\n") : "- none";
  const actions = response.owner_actions || [];
  const actionsText = actions.length ? actions.map((item) => `- ${item}`).join("\n") : "- none";
  return [
    "Agent output verification response",
    "",
    `Verdict: ${response.verdict}`,
    `Trust signal: ${response.trust_signal}`,
    `Readiness: ${response.readiness_score}/100 (${response.readiness_label})`,
    `Claims: ${response.grounded_claim_count}/${response.claim_count} grounded`,
    `Human review required: ${String(response.human_review_required)}`,
    "",
    "Unsafe claims:",
    unsafeText,
    "",
    "Owner actions:",
    actionsText,
    "",
    response.not_advice_notice
  ].join("\n");
}

function a2aResultForAgentOutputVerification(params) {
  const structured = structuredAgentOutputVerificationRequestFromParams(params);
  if (!structured) {
    return invalidRequestResult(
      "agent_output_verification",
      "/v1/agent-output/verification",
      "schemas/v1/evidence-audit.schema.json",
      ["Missing structured agent-output verification request"]
    );
  }
  if (isPreActionCheckRequest(structured)) {
    const actionErrors = preActionCheckErrors(structured);
    if (actionErrors.length) {
      return invalidRequestResult(
        "agent_output_verification",
        "/v1/agent-output/pre-action-check",
        "schemas/v1/pre-action-check-request.schema.json",
        actionErrors
      );
    }
    const result = preActionCheckResult(structured);
    return {
      id: crypto.randomUUID(),
      status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
      artifacts: [
        {
          artifactId: "pre-action-check-response",
          name: "Pre-action check response",
          parts: [
            {
              text: [
                "Pre-action check response",
                "",
                `Decision: ${result.response.decision}`,
                `Reason: ${result.response.reason_code}`,
                `Run: ${result.response.run_id}`,
                `Human review required: ${String(result.response.human_review_required)}`,
                "",
                result.response.not_authorization_notice
              ].join("\n"),
              mediaType: "text/markdown"
            },
            { data: result.response, mediaType: "application/json" }
          ]
        }
      ],
      metadata: {
        product_profile: "agent_output_verification",
        capability: "pre_action_check",
        canonical_http_endpoint: "/v1/agent-output/pre-action-check",
        schema: "schemas/v1/pre-action-check-request.schema.json",
        human_review_required: result.response.human_review_required,
        not_authorization_notice: result.response.not_authorization_notice,
        response: result.response
      }
    };
  }
  const enumErrors = agentOutputVerificationEnumErrors(structured);
  if (enumErrors.length) {
    return invalidRequestResult(
      "agent_output_verification",
      "/v1/agent-output/verification",
      "schemas/v1/evidence-audit.schema.json",
      enumErrors
    );
  }
  const result = agentOutputVerificationResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "agent-output-verification-response",
        name: "Agent output verification response",
        parts: [
          {
            text: agentOutputVerificationArtifactText(result.response),
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
      product_profile: "agent_output_verification",
      canonical_http_endpoint: "/v1/agent-output/verification",
      schema: "schemas/v1/evidence-audit.schema.json",
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
  response.readiness_contract = profileReadinessContract(response, {
    profile: "gulf_maritime_exposure",
    statusField: "decision_readiness_label",
    signalField: "exposure_signal"
  });
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
      "Note on currency-contract registration (mandatory at the USD 50,000 threshold for legal entities under " +
      "the 2026 currency-control rules), repatriation reporting, and how supplier payments, intercompany flows, " +
      "and profit repatriation will clear local banks.",
    why_it_matters:
      "Under the 2026 currency-control regime local banks can delay or refuse cross-border intercompany transfers " +
      "(capital, shareholder loans, royalties, management fees) that lack demonstrable economic substance, so " +
      "substance evidence affects how, and how quickly, money moves after commitment.",
    owner: "Treasury / banking advisor",
    next_action:
      "Confirm currency-contract registration at the USD 50,000 threshold and prepare economic-substance " +
      "evidence for intercompany flows with the servicing bank.",
    decision_blocked: "Cross-border payment, intercompany-flow, and profit-repatriation planning."
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
  if (readiness === "committee_review_ready") return "route_to_committee";
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
  response.readiness_contract = profileReadinessContract(response, {
    profile: "kazakhstan_market_entry_readiness",
    statusField: "readiness_label",
    scoreField: null,
    routingField: "gate_decision",
    boundaryField: "boundary_notice"
  });
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
  const discovery = profileDiscovery("market_entry_readiness");
  card.name = "Kazakhstan Market-Entry Readiness Gate";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "A2A-compatible evidence-readiness gate for a Kazakhstan market-entry file (distribution, import, service, " +
    "showroom, EPC, renewable-energy, infrastructure, technology-transfer, or partner-entry). Bring company, " +
    "project, Kazakhstan objective, counterparties, and supplied sources; get a gate decision, readiness label, " +
    "evidence gaps, claim audit, owner actions, watch-next indicators, and mandatory human-review routing. No live " +
    "retrieval; not legal, compliance, customs, tax, sanctions, or launch-authorization advice." +
    PROVIDER_FRONT_DOOR_POINTER;
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
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
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.required_before_validation = MARKET_ENTRY_REQUIRED_BEFORE_VALIDATION;
  card.x_agenda_intelligence.required_before_signature = MARKET_ENTRY_REQUIRED_BEFORE_SIGNATURE;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.boundaries = [
    "No live source retrieval; caller-supplied evidence only.",
    "No factual-truth verification.",
    "No legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice.",
    "Human review is required before any commercial action."
  ];
  return card;
}

const CRITICAL_MINERALS_QUOTA_RESTRICTED = new Set([
  "rare_earth_elements",
  "gallium_germanium",
  "graphite",
  "tungsten"
]);

const CRITICAL_MINERALS_HIGH_RISK_PROCESSING_JURISDICTIONS = new Set([
  "Russia",
  "Iran",
  "North Korea",
  "Myanmar",
  "Syria"
]);

const CRITICAL_MINERALS_TAXONOMY = {
  required_before_offtake: [
    "mining_concession_or_license_extract",
    "certified_ore_assay_report",
    "beneficial_ownership_due_diligence",
    "export_quota_and_permit_clearance",
    "csddd_human_rights_and_esg_audit",
    "processing_and_refining_tolling_agreement"
  ],
  required_before_investment: [
    "bankable_feasibility_study",
    "sovereign_royalty_and_tax_stability_memo",
    "tailings_and_environmental_permits",
    "local_content_and_employment_quota_filing"
  ],
  required_before_shipment: [
    "certificate_of_origin",
    "export_customs_declaration",
    "port_of_loading_assay_verification",
    "sanctions_and_export_control_license",
    "marine_and_transit_cargo_insurance"
  ]
};

const CRITICAL_MINERALS_NOT_ADVICE_NOTICE =
  "Pre-compliance evidence triage only on caller-supplied documentation. " +
  "Does not perform live retrieval, factual-truth verification, mineral assay testing, " +
  "or provide legal, sanctions, trade-compliance, ESG certification, or investment advice.";

function isCriticalMineralsRequest(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.project_name === "string" &&
      typeof value.commodity === "string" &&
      typeof value.origin_jurisdiction === "string" &&
      typeof value.decision_question === "string" &&
      typeof value.decision_stage === "string" &&
      Array.isArray(value.supplied_sources)
  );
}

function criticalMineralsErrors(request) {
  const errors = [];
  if (!request || typeof request !== "object") return ["request must be an object"];
  if (!request.project_name) errors.push("project_name is required");
  if (!request.commodity) errors.push("commodity is required");
  if (!request.origin_jurisdiction) errors.push("origin_jurisdiction is required");
  if (!request.decision_question) errors.push("decision_question is required");
  if (!request.decision_stage) errors.push("decision_stage is required");
  if (!Array.isArray(request.supplied_sources)) errors.push("supplied_sources must be an array");
  return errors;
}

function criticalMineralsResult(request) {
  const stage = request.decision_stage || "pre_offtake_agreement";
  const commodity = request.commodity || "";
  const origin = request.origin_jurisdiction || "";
  const processing = request.processing_jurisdiction || "";

  const suppliedSources = [];
  for (const s of request.supplied_sources || []) {
    if (s && s.source_type && !suppliedSources.includes(s.source_type)) {
      suppliedSources.push(s.source_type);
    }
  }

  const stageTierMap = {
    pre_offtake_agreement: "required_before_offtake",
    pre_investment_decision: "required_before_investment",
    pre_export_shipment: "required_before_shipment",
    pre_exploration: "required_before_offtake",
    pre_processing_contract: "required_before_offtake"
  };
  const tierKey = stageTierMap[stage] || "required_before_offtake";
  const required = CRITICAL_MINERALS_TAXONOMY[tierKey] || [];
  const missingSources = required.filter((s) => !suppliedSources.includes(s));

  const hasConcession = suppliedSources.includes("mining_concession_or_license_extract");
  const hasAssay =
    suppliedSources.includes("certified_ore_assay_report") ||
    suppliedSources.includes("port_of_loading_assay_verification");
  const hasCoo = suppliedSources.includes("certificate_of_origin");

  let traceability = "unverified";
  if (hasConcession && hasAssay && (hasCoo || stage !== "pre_export_shipment")) {
    traceability = "verified";
  } else if (hasConcession || hasAssay) {
    traceability = "partial";
  }

  const quotaRestricted = CRITICAL_MINERALS_QUOTA_RESTRICTED.has(commodity);
  const flags = [];
  if (quotaRestricted && !suppliedSources.includes("export_quota_and_permit_clearance")) {
    flags.push(`${commodity} is subject to strategic export quota / licensing restrictions.`);
  }
  if (CRITICAL_MINERALS_HIGH_RISK_PROCESSING_JURISDICTIONS.has(processing)) {
    flags.push(`Processing jurisdiction ${processing} carries elevated sanctions / export-control exposure.`);
  }

  const totalReq = required.length || 1;
  const satisfiedCount = totalReq - missingSources.length;
  let baseScore = Math.round((satisfiedCount / totalReq) * 100);
  if (flags.length) baseScore = Math.max(0, baseScore - 15 * flags.length);

  let score = 0;
  let readinessLabel = "insufficient_information";
  let triage = "insufficient_information";
  let riskSignal = "unknown";
  let decision = "request_evidence";
  let reasonCode = "insufficient_sources";

  if (!suppliedSources.length) {
    score = 0;
    readinessLabel = "insufficient_information";
    triage = "insufficient_information";
    riskSignal = "unknown";
    decision = "request_evidence";
    reasonCode = "insufficient_sources";
  } else if (missingSources.length || flags.length) {
    score = Math.min(baseScore, 65);
    readinessLabel = score < 40 ? "not_decision_ready" : "partial";
    if (stage === "pre_offtake_agreement") triage = "escalate_before_offtake";
    else if (stage === "pre_export_shipment") triage = "escalate_before_shipment";
    else if (stage === "pre_investment_decision") triage = "escalate_before_investment";
    else triage = "not_decision_ready";
    riskSignal = flags.length || score < 40 ? "high" : "medium_high";
    decision = flags.length && score < 40 ? "stop" : "request_evidence";
    reasonCode = "critical_evidence_gaps";
  } else {
    score = Math.max(80, baseScore);
    readinessLabel = "review_ready";
    triage = "ready_for_human_review";
    riskSignal = score >= 90 ? "low" : "medium";
    decision = "continue";
    reasonCode = "evidence_complete";
  }

  const blockingGaps = [...missingSources.map((s) => `Missing required source: ${s.replace(/_/gu, " ")}`), ...flags];
  const opDecision = {
    decision,
    reason_code: reasonCode,
    blocking_gaps: blockingGaps,
    next_permitted_action:
      decision === "continue"
        ? "Human review and committee sign-off"
        : "Obtain missing origin, assay, or export-control permits"
  };

  const exportExposure = {
    quota_restricted: quotaRestricted,
    processing_monopoly_risk: Boolean(processing && (processing === "China" || processing === "Russia")),
    jurisdiction_risk_flags: flags
  };

  const topRisks = [
    {
      category: "Supply Chain & Origin Traceability",
      severity: traceability === "unverified" || traceability === "obfuscated" ? "high" : "low",
      description: `Traceability status is ${traceability} for ${commodity} originating from ${origin}.`
    }
  ];
  if (flags.length) {
    topRisks.push({
      category: "Export Control & Regulatory Quotas",
      severity: "high",
      description: flags.join("; ")
    });
  }

  const exposureLayers = [
    {
      layer: "Origin Concession & Mining Rights",
      level: suppliedSources.includes("mining_concession_or_license_extract") ? "verified" : "gap",
      summary: "Mining concession / license extract status in source ledger."
    },
    {
      layer: "Processing & Beneficiation Route",
      level: suppliedSources.includes("processing_and_refining_tolling_agreement") ? "verified" : "gap",
      summary: "Refining, smelter, and tolling contract agreements."
    },
    {
      layer: "ESG & CSDDD Compliance",
      level: suppliedSources.includes("csddd_human_rights_and_esg_audit") ? "verified" : "gap",
      summary: "Human rights, environmental, and tailings due diligence audit."
    }
  ];

  const watchNext = [
    "EU Critical Raw Materials Act strategic project announcements",
    "Export quota and licensing rule revisions in producing states",
    "OFAC / EU / UK sanctions updates on mining conglomerates",
    "Refinery tolling fee and capacity bottlenecks",
    "CSDDD supply-chain due diligence compliance audits"
  ];

  const response = {
    triage_recommendation: triage,
    risk_signal: riskSignal,
    decision_readiness_score: score,
    decision_readiness_label: readinessLabel,
    operational_decision: opDecision,
    commodity,
    origin_jurisdiction: origin,
    traceability_status: traceability,
    export_control_exposure: exportExposure,
    supplied_sources: suppliedSources,
    minimum_sources_before_go: missingSources,
    evidence_gaps: blockingGaps,
    top_risks: topRisks,
    exposure_layers: exposureLayers,
    watch_next: watchNext,
    human_review_required: true,
    not_advice_notice: CRITICAL_MINERALS_NOT_ADVICE_NOTICE,
    run_provenance: {
      contract_version: VERSION,
      input_digest: "sha256:canonical",
      schema_uri: `${SCHEMAS_URL}/critical-minerals-due-diligence-response.schema.json`
    }
  };
  if (request.processing_jurisdiction) response.processing_jurisdiction = request.processing_jurisdiction;
  if (request.target_market) response.target_market = request.target_market;

  response.readiness_contract = profileReadinessContract(response, {
    profile: "critical_minerals_due_diligence",
    statusField: "decision_readiness_label",
    scoreField: "decision_readiness_score",
    routingField: "triage_recommendation",
    boundaryField: "not_advice_notice"
  });

  return { response };
}

function criticalMineralsArtifactText(response) {
  const missing = response.minimum_sources_before_go || [];
  const missingText = missing.length ? missing.map((item) => `- ${item}`).join("\n") : "- none";
  const risks = response.top_risks || [];
  const risksText = risks.length
    ? risks.map((r) => `- [${(r.severity || "medium").toUpperCase()}] ${r.category}: ${r.description}`).join("\n")
    : "- none";
  return [
    "Critical Minerals & Strategic Raw Materials Due Diligence Gate response",
    "",
    `Recommendation: ${response.triage_recommendation}`,
    `Risk signal: ${response.risk_signal}`,
    `Decision readiness: ${response.decision_readiness_score}/100 (${response.decision_readiness_label})`,
    `Commodity: ${response.commodity}`,
    `Origin jurisdiction: ${response.origin_jurisdiction}`,
    `Traceability status: ${response.traceability_status}`,
    `Human review required: ${String(response.human_review_required)}`,
    "",
    "Top risks:",
    risksText,
    "",
    "Minimum sources before go:",
    missingText,
    "",
    response.not_advice_notice
  ].join("\n");
}

function structuredCriticalMineralsRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [
    params.request,
    params.critical_minerals_request,
    params.critical_minerals_due_diligence_request,
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
    if (isCriticalMineralsRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isCriticalMineralsRequest(parsed)) return parsed;
  }
  return null;
}

function a2aResultForCriticalMinerals(params) {
  const structured = structuredCriticalMineralsRequestFromParams(params);
  if (!structured) {
    return invalidRequestResult(
      "critical_minerals_due_diligence",
      "/v1/critical-minerals/due-diligence",
      "schemas/v1/critical-minerals-due-diligence-request.schema.json",
      ["Missing structured Critical Minerals Due Diligence request"]
    );
  }
  const errors = criticalMineralsErrors(structured);
  if (errors.length) {
    return invalidRequestResult(
      "critical_minerals_due_diligence",
      "/v1/critical-minerals/due-diligence",
      "schemas/v1/critical-minerals-due-diligence-request.schema.json",
      errors
    );
  }
  const result = criticalMineralsResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "critical-minerals-due-diligence-response",
        name: "Critical minerals due diligence response",
        parts: [
          { text: criticalMineralsArtifactText(result.response), mediaType: "text/markdown" },
          { data: result.response, mediaType: "application/json" }
        ]
      }
    ],
    metadata: {
      product_profile: "critical_minerals_due_diligence",
      canonical_http_endpoint: "/v1/critical-minerals/due-diligence",
      schema: "schemas/v1/critical-minerals-due-diligence-request.schema.json",
      human_review_required: result.response.human_review_required,
      not_advice_notice: result.response.not_advice_notice,
      response: result.response
    }
  };
}

function applyCriticalMineralsProfile(card, request) {
  const origin = originFromRequest(request);
  const discovery = profileDiscovery("critical_minerals_due_diligence");
  card.name = "Critical Minerals & Strategic Raw Materials Due Diligence Gate";
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "A2A-compatible evidence-readiness gate for critical raw materials origin tracing and supply-chain due diligence. Bring commodity, extraction jurisdiction, processing route, counterparties, and dated sources; get deterministic due-diligence triage with origin traceability, export quota flags, CSDDD compliance evidence gaps, and human-review routing." +
    PROVIDER_FRONT_DOOR_POINTER;
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
  card.skills = [
    {
      id: "critical-minerals-due-diligence",
      name: "Critical minerals due diligence gate",
      description:
        "Turns commodity, origin jurisdiction, processing route, and supplied sources into structured critical-minerals due diligence triage.",
      tags: ["critical-minerals", "rare-earths", "lithium", "csddd", "export-control", "due-diligence", "free"],
      examples: [
        "Is this rare earth elements offtake dossier complete for committee review?",
        "What export quota permits are missing before we sign the lithium offtake?"
      ],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.boundaries = [
    "No live source retrieval; caller-supplied evidence only.",
    "No factual-truth verification or mineral assay testing.",
    "No legal, compliance, sanctions, ESG certification, or investment advice.",
    "Human review is required before any commercial action."
  ];
  return card;
}

function isDualUseTechnologyExportRequest(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.shipment &&
      typeof value.shipment === "object" &&
      typeof value.shipment.hs_code === "string" &&
      typeof value.shipment.description === "string" &&
      typeof value.shipment.origin === "string" &&
      typeof value.shipment.destination === "string" &&
      Array.isArray(value.dated_sources) &&
      typeof value.risk_question === "string"
  );
}

function dualUseTechnologyExportErrors(request) {
  const errors = [];
  if (!request || typeof request !== "object") return ["request must be an object"];
  if (!request.shipment || typeof request.shipment !== "object") {
    errors.push("shipment must be an object");
  } else {
    for (const field of ["hs_code", "description", "origin", "destination"]) {
      if (typeof request.shipment[field] !== "string" || !request.shipment[field].trim()) {
        errors.push(`shipment.${field} is required`);
      }
    }
  }
  if (!Array.isArray(request.dated_sources)) errors.push("dated_sources must be an array");
  if (typeof request.risk_question !== "string" || !request.risk_question.trim()) {
    errors.push("risk_question is required");
  }
  return errors;
}

function structuredDualUseTechnologyExportRequestFromParams(params) {
  if (!params || typeof params !== "object") return null;
  const candidates = [params.request, params.dual_use_technology_export_request, params.input, params];
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
    if (isDualUseTechnologyExportRequest(candidate)) return candidate;
    const parsed = typeof candidate === "string" ? tryParseJsonObject(candidate) : null;
    if (parsed && isDualUseTechnologyExportRequest(parsed)) return parsed;
  }
  return null;
}

function dualUseTechnologyExportResult(request) {
  const shipment = request.shipment;
  const sources = request.dated_sources;
  const riskVectors = [];
  let score = 40;

  if (typeof shipment.eccn === "string" && shipment.eccn.trim()) score += 20;
  else riskVectors.push("No caller-supplied ECCN classification; obtain a classification note before human review.");

  if (shipment.end_user_sector && shipment.end_user_sector !== "unknown") score += 20;
  else riskVectors.push("End-user sector is missing or unknown; end-use evidence is incomplete.");

  if (sources.length > 0) score += 20;
  else riskVectors.push("No dated supporting sources were supplied.");

  if (shipment.end_user_sector === "military") {
    riskVectors.push("Caller declared a military end-user sector; escalate to export-control counsel or the responsible authority.");
  }
  if (Array.isArray(shipment.transit_countries) && shipment.transit_countries.length > 0) {
    riskVectors.push("Transit countries are present; human review must assess diversion and re-export controls for each leg.");
  }

  const hasMissingEvidence = riskVectors.some(
    (item) => item.startsWith("No ") || item.startsWith("End-user")
  );
  const status =
    shipment.end_user_sector === "military"
      ? "escalate"
      : hasMissingEvidence
        ? "not_decision_ready"
        : "decision_ready";

  return {
    contract_version: VERSION,
    profile: "dual_use_technology_export",
    export_risk_triage: {
      status,
      score,
      primary_risk_vectors: riskVectors,
      evidence_ledger: sources.map(
        (source) =>
          `${String(source?.id || "source")}: ${String(source?.source_type || "unspecified")} — ${String(source?.title || "untitled")} (${String(source?.date || "undated")})`
      )
    }
  };
}

function dualUseTechnologyExportArtifactText(response) {
  const triage = response.export_risk_triage;
  const risks = triage.primary_risk_vectors.length
    ? triage.primary_risk_vectors.map((risk) => `- ${risk}`).join("\n")
    : "- No structural risk vector was triggered by the supplied fields.";
  return [
    "Dual-Use Technology & Export Controls Gate response",
    "",
    `Evidence-readiness status: ${triage.status}`,
    `Structural completeness score: ${triage.score}/100`,
    "",
    "Primary risk vectors:",
    risks,
    "",
    "Caller-supplied evidence triage only. No live list retrieval, ECCN/HS classification, license determination, clearance, or legal advice. Human review is required before export or shipment."
  ].join("\n");
}

function a2aResultForDualUseTechnologyExport(params) {
  const structured = structuredDualUseTechnologyExportRequestFromParams(params);
  if (!structured) {
    return invalidRequestResult(
      "dual_use_technology_export",
      "/message/send",
      "schemas/v1/dual-use-technology-export-request.schema.json",
      ["Missing structured dual-use technology export request"]
    );
  }
  const errors = dualUseTechnologyExportErrors(structured);
  if (errors.length) {
    return invalidRequestResult(
      "dual_use_technology_export",
      "/message/send",
      "schemas/v1/dual-use-technology-export-request.schema.json",
      errors
    );
  }
  const response = dualUseTechnologyExportResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "dual-use-technology-export-response",
        name: "Dual-use technology export controls response",
        parts: [
          { text: dualUseTechnologyExportArtifactText(response), mediaType: "text/markdown" },
          { data: response, mediaType: "application/json" }
        ]
      }
    ],
    metadata: {
      product_profile: "dual_use_technology_export",
      schema: "schemas/v1/dual-use-technology-export-request.schema.json",
      human_review_required: true,
      response
    }
  };
}

function applyDualUseTechnologyExportProfile(card, request) {
  const origin = originFromRequest(request);
  const discovery = profileDiscovery("dual_use_technology_export");
  card.name = discovery.canonical_product_name;
  card.documentationUrl = discovery.documentation_url;
  card.description =
    "A2A-compatible evidence-readiness gate for dual-use technology export files. Bring the HS code, optional caller-supplied ECCN, origin, destination, transit route, end-user sector, and dated sources; get structural completeness triage and human-review routing. It does not classify goods, retrieve control lists, determine licensing, or authorize an export." +
    PROVIDER_FRONT_DOOR_POINTER;
  card.provider.legalEntity.sameAs = discovery.provider_same_as;
  card.skills = [
    {
      id: "dual-use-technology-export-controls",
      name: "Dual-use technology export-controls evidence gate",
      description:
        "Checks whether a caller-supplied technology shipment file contains the classification, route, end-user, and dated-source fields needed for export-control human review.",
      tags: ["dual-use", "export-controls", "eccn", "hs-code", "end-user", "evidence-readiness", "human-review"],
      examples: [
        "Is this semiconductor shipment file complete enough for export-control review?",
        "Which classification or end-user evidence is missing before this hardware export proceeds?"
      ],
      inputModes: ["application/json"],
      outputModes: ["application/json", "text/markdown"]
    }
  ];
  card.x_agenda_intelligence.product_profile = discovery.product_profile;
  card.x_agenda_intelligence.canonical_product_name = discovery.canonical_product_name;
  card.x_agenda_intelligence.wrapper_scope = discovery.wrapper_scope;
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = discovery.documentation_url;
  card.x_agenda_intelligence.product_contract = discovery.product_contract;
  card.x_agenda_intelligence.supported_contracts = discovery.supported_contracts;
  card.x_agenda_intelligence.buyer_use_cases = discovery.buyer_use_cases;
  card.x_agenda_intelligence.commercial_positioning = discovery.commercial_positioning;
  card.x_agenda_intelligence.boundaries = [
    "No live source or control-list retrieval; caller-supplied evidence only.",
    "No ECCN, HS-code, sanctions, license, end-use, or destination determination.",
    "No legal, trade-compliance, customs, sanctions, or investment advice.",
    "Human review is required before any export, shipment, sale, or commercial action."
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
  if (active.name === "Snapshot") {
    return {
      upstream_name: "Snapshot",
      result: await matchCounterpartyAgainstSnapshot(env, {
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
  // Only a real, successful fetch produces auto-fetched sources. A degraded or
  // disabled run may still carry matches (the keyless simulation does), but
  // nothing was retrieved, so there is no attribution obligation and no match
  // to imply to a reviewer. Parity with the Python service.
  for (const match of upstreamResult.status === "success" ? upstreamResult.matches || [] : []) {
    const sourceType = match.source_type || "user_provided_note";
    if (!supplied.includes(sourceType)) supplied.push(sourceType);
    autoFetched.push({
      source_type: sourceType,
      title: match.name || `${upstream_name || "upstream"} match`,
      entity_type: match.entity_type || schemaToEntityType(match.schema),
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

  // Ownership enrichment (GLEIF), off by default, runs ALONGSIDE the sanctions
  // match — never replaces it. Contributes disclosed direct/ultimate parent as
  // ownership evidence per ADR 0022. Graceful degrade: any non-success status
  // simply merges no ownership sources.
  let ownershipResult = null;
  if (gleifEnabled(env)) {
    ownershipResult = await fetchOwnershipFromGleif(env, {
      name: counterparty.name,
      jurisdiction: counterparty.jurisdiction
    });
    for (const match of ownershipResult.matches || []) {
      const sourceType = match.source_type || "ownership_chain_evidence";
      if (!supplied.includes(sourceType)) supplied.push(sourceType);
      autoFetched.push({
        source_type: sourceType,
        title: match.name || "GLEIF ownership record",
        datasets: [],
        lei: match.lei || null,
        relationship_role: match.relationship_role || null,
        score: match.score,
        topics: [],
        jurisdictions: match.jurisdictions || [],
        notes: "Auto-fetched from GLEIF (disclosed LEI ownership); CC0-1.0 attribution appreciated."
      });
    }
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
  const sanctionsMatchCount = (upstreamResult.matches || []).length;
  if (upstreamResult.attribution && sanctionsMatchCount) limitations.push(upstreamResult.attribution.notice);
  // Separate ownership-enrichment attribution (GLEIF), only when it merged records.
  if (ownershipResult && ownershipResult.attribution && (ownershipResult.matches || []).length) {
    limitations.push(ownershipResult.attribution.notice);
  }
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
  const cpJurisdiction = (request.counterparty || {}).jurisdiction;
  if (typeof cpJurisdiction === "string") {
    const lowered = cpJurisdiction.toLowerCase();
    for (const [token, label] of Object.entries(COUNTRY_LEVEL_ANTI_CIRCUMVENTION)) {
      if (lowered.includes(token)) {
        limitations.push(
          `Counterparty domiciled in ${label}, now subject to EU country-level anti-circumvention measures ` +
            "(first activated in the 20th sanctions package): confirm the specific restricted item categories and " +
            "onward destination, and check correspondent-banking exposure to any regional financial institution " +
            "designated in that package. Escalation flag for human review, not a sanctions determination."
        );
        break;
      }
    }
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
    top_exposure_dimensions: cisTopExposureDimensions(facets, missing, autoFetched, undisclosedUbo),
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
  response.readiness_contract = profileReadinessContract(response, {
    profile: "cis_secondary_sanctions",
    statusField: "decision_readiness_label",
    signalField: "secondary_exposure_signal"
  });

  return {
    response,
    live_retrieval_status: upstreamResult.status,
    live_retrieval_upstream: upstream_name,
    // Provenance date of the public-list index the match ran against (Snapshot
    // upstream only; null for Watchman / OpenSanctions, which query live). The
    // snapshot is a static file rebuilt by hand, so a caller cannot otherwise
    // tell whether a "no match" reflects the current lists or a stale index.
    live_retrieval_snapshot_generated_at: upstreamResult.snapshot_generated_at ?? null,
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
    return invalidRequestResult(
      "cis_secondary_sanctions",
      "/v1/cis-secondary-sanctions/exposure",
      "schemas/v1/cis-secondary-sanctions-request.schema.json",
      ["Missing structured CIS secondary-sanctions exposure request"]
    );
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
      live_retrieval_snapshot_generated_at: result.live_retrieval_snapshot_generated_at,
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

// Place names a route is written out of, for the fallback below. Kept apart
// from SUBJECT_JURISDICTIONS because that table answers "which country's
// authorities apply" and collapses Baku into Azerbaijan — correct there, and
// useless for printing a route back.
const ROUTE_PLACES = [
  ["Aktau", ["aktau"]],
  ["Kuryk", ["kuryk"]],
  ["Baku", ["baku"]],
  ["Poti", ["poti"]],
  ["Batumi", ["batumi"]],
  ["Khorgos", ["khorgos"]],
  ["Almaty", ["almaty"]],
  ["Astana", ["astana"]],
  ["Tashkent", ["tashkent"]],
  ["Turkmenbashi", ["turkmenbashi"]],
  ["Jebel Ali", ["jebel ali", "jafza"]],
  ["Dubai", ["dubai"]],
  ["Abu Dhabi", ["abu dhabi"]],
  ["Fujairah", ["fujairah"]],
  ["Sharjah", ["sharjah"]],
  ["Bandar Abbas", ["bandar abbas"]],
  ["Chabahar", ["chabahar"]],
  ["Novorossiysk", ["novorossiysk"]],
  ["Istanbul", ["istanbul"]],
  ["Mersin", ["mersin"]],
  ["Jeddah", ["jeddah"]],
  ["Ras Tanura", ["ras tanura"]],
  ["Sohar", ["sohar"]],
  ["Duqm", ["duqm"]],
  ["Basra", ["basra"]],
  ["Aden", ["aden"]],
  ["Singapore", ["singapore"]],
  ["Urumqi", ["urumqi"]]
];

const COMPILED_ROUTE_PLACES = compileVocabulary(ROUTE_PLACES);

// Place names in the order the caller wrote them.
//
// Deliberately reports the written order and says so, rather than inferring
// direction. "Aktau to Jebel Ali via Baku and Poti" and "Jebel Ali from Aktau"
// both name the same four places; only the first states a sequence, and a
// worker that guesses which is which on a deal file is guessing about the
// thing the caller is paying attention to.
function namedPlacesInOrder(text) {
  const lower = (text || "").toLowerCase();
  const hits = [];
  for (const [label, patterns] of COMPILED_ROUTE_PLACES) {
    let earliest = -1;
    for (const pattern of patterns) {
      const match = pattern.exec(lower);
      if (match && (earliest === -1 || match.index < earliest)) earliest = match.index;
    }
    if (earliest !== -1) hits.push([earliest, label]);
  }
  return hits.sort((left, right) => left[0] - right[0]).map(([, label]) => label);
}

// Route extraction, three passes.
//
// Measured live 2026-08-26 on the Middle Corridor gate: "Aluminium extrusions
// from Aktau to Jebel Ali via Baku and Poti" returned `Route: not supplied`
// while the subject line directly above it named all four places out of the
// same sentence. Two lines apart, the note said it had read the route and
// that no route was supplied. The label pass and the "route <x>" keyword pass
// both need the caller to use the schema's own vocabulary; ordinary English
// does not.
function extractDealRoute(text) {
  const labelled = extractAfterLabel(text, ["Route"]);
  if (labelled) return labelled;

  const match = text.match(
    /\broute\s+(.+?)(?=(?:\.\s+(?:Counterparties|Sources|Dated sources|Should|Question)\b)|(?:\s+with\s+(?:cargo|counterparties)\b)|$)/is
  );
  if (match) return cleanExtractedDealField(match[1]);

  // "from X to Y" runs to the end of the sentence, and a deal file rarely ends
  // the sentence at the destination. On the live example it swallowed "buyer
  // is a UAE company incorporated in 2025, payment through a Georgian bank"
  // into the route field. A capture that reaches a party, a payment or a
  // valuation clause is not a route, so it is dropped in favour of the place
  // names — which for that same sentence give the four ports in written order.
  const fromTo = text.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?=[.;]|$)/is);
  const places = namedPlacesInOrder(text);
  if (fromTo) {
    const candidate = cleanExtractedDealField(`${fromTo[1]} to ${fromTo[2]}`);
    const overreached =
      !candidate ||
      candidate.length > ROUTE_CAPTURE_MAX_CHARS ||
      /\b(?:buyer|seller|payment|counterpart(?:y|ies)|bank|value|incorporated|invoice|insurer)\b/i.test(candidate);
    if (!overreached) return candidate;
  }

  if (places.length >= 2) {
    return `${places.join(", ")} (place names in the order written; send a Route: field for the parsed leg order)`;
  }
  return null;
}

// A route reads "Aktau to Jebel Ali via Baku and Poti" — 44 characters. Past
// this, the capture has run into the next clause.
const ROUTE_CAPTURE_MAX_CHARS = 90;

function extractDealCargo(text) {
  const labelled = extractAfterLabel(text, ["Cargo"]);
  if (labelled) return labelled;

  const shipmentMatch = text.match(/\bshipment of\s+(.+?)(?=(?:\s+on\s+route\b)|(?:\s+via\b)|[.;]|$)/is);
  if (shipmentMatch) return cleanExtractedDealField(shipmentMatch[1]);

  const cargoMatch = text.match(/\bcargo\s+(?:is|of|:)?\s*(.+?)(?=(?:\s+on\s+route\b)|[.;]|$)/is);
  if (cargoMatch) return cleanExtractedDealField(cargoMatch[1]);

  // Same failure as the route: "Aluminium extrusions from Aktau..." names the
  // cargo in the first two words and matched none of the keyword patterns,
  // because the caller never wrote "cargo" or "shipment of". The commodity
  // vocabulary already classified it for the subject line; report the class
  // and say it is a class, so nobody reads it as the caller's own wording.
  const classes = matchVocabulary((text || "").toLowerCase(), COMPILED_SUBJECT_COMMODITIES);
  if (classes.length) {
    return `${classes.join(", ")} (cargo class read from the wording; send a Cargo: field for the exact description)`;
  }
  return null;
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
    sanctions_list_extract: "No sanctions screening result supplied.",
    customs_or_regulatory_source: "No customs or regulatory source supplied.",
    insurance_clause_or_underwriter_note: "No insurance clause or underwriter note supplied.",
    vessel_or_carrier_history: "No carrier, vessel, or rail-operator history supplied."
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
  newlyFormedPresent = false,
  dualUsePresent = false
) {
  const risks = ["sanctions adjacency", "Caspian crossing capacity and draft exposure"];
  if (highRisk) risks.unshift("counterparty in a sanctions-relevant / high-risk jurisdiction");
  if (dualUsePresent) risks.unshift("cargo includes a potential dual-use / export-controlled item");
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
  if (missingSources.includes("vessel_or_carrier_history")) risks.push("carrier / vessel / rail-operator history gap");
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
    foreignSanctionsExposureLayer.push("No sanctions screening result supplied to review listed-party exposure.");
  }
  if (missingSources.includes("beneficial_ownership_source")) {
    foreignSanctionsExposureLayer.push("No beneficial ownership source — indirect / ownership-based exposure cannot be reviewed; the OFAC/EU 50 Percent Rule (aggregate blocked-person ownership) is a human-review step the file is not yet ready for.");
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
  const matchedDualUse = matchedDualUseCargoTerms(request.cargo);
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
      flaggedNewlyFormed.length > 0,
      matchedDualUse.length > 0
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
  if (matchedDualUse.length > 0) {
    const namedDu = matchedDualUse.join(", ");
    limitations.push(
      `The declared cargo references one or more potential dual-use / export-controlled items (${namedDu}); under the BIS/EU Common High Priority List pattern this is an export-control escalation flag for human review, not a classification or licensing determination. Obtain an end-use / end-user statement and confirm export-control classification before any commercial action.`
    );
  }
  if (matchedDualUse.length > 0 && !suppliedSources.includes("end_user_or_reexport_evidence")) {
    limitations.push(
      "The file presents a potential dual-use / export-controlled cargo but no end-user / re-export evidence is on hand; obtain a signed end-user statement before signature. This is an evidence-readiness gap for human review, not a licensing determination."
    );
  }
  if (limitations.length > 0) response.limitations = limitations;
  if (matchedSanctionsSegments.length > 0) {
    response.route_sanctions_matched_segments = [...matchedSanctionsSegments];
  }
  if (minimumSourcesBeforeGo.includes("vessel_or_carrier_history")) {
    response.vessel_due_diligence_indicators = [...VESSEL_DUE_DILIGENCE_INDICATORS];
  }
  if (matchedDualUse.length > 0 || !suppliedSources.includes("end_user_or_reexport_evidence")) {
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
  const linkIntegrityBlock = linkIntegrity(request.dated_sources);
  if (linkIntegrityBlock) response.link_integrity = linkIntegrityBlock;
  response.readiness_contract = profileReadinessContract(response, {
    profile: "middle_corridor_deal_risk",
    statusField: "decision_readiness_label",
    signalField: "risk_signal"
  });
  return response;
}

// Observe-only structural lint of cited source URLs. Mirrors the Python
// services._link_integrity: classifies dated_sources[].url as well_formed,
// illustrative (documented placeholder hosts such as example.com), or
// malformed, and returns a diagnostic block only when at least one URL is
// malformed. It never fetches URLs, never performs live retrieval, and never
// changes a triage recommendation or evidence gap.
const RESERVED_LINK_HOSTS = new Set(["example.com", "example.org", "example.net", "localhost"]);
const RESERVED_LINK_TLDS = [".example", ".test", ".invalid", ".localhost"];
const LINK_PLACEHOLDER_TOKENS = new Set(["tbd", "n/a", "na", "none", "xxx", "todo", "pending", "url"]);

function classifySourceUrl(url) {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw || LINK_PLACEHOLDER_TOKENS.has(raw.toLowerCase())) return "malformed";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return "malformed";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "malformed";
  if (!parsed.hostname) return "malformed";
  const host = parsed.hostname.toLowerCase();
  if (RESERVED_LINK_HOSTS.has(host) || RESERVED_LINK_TLDS.some((tld) => host.endsWith(tld))) {
    return "illustrative";
  }
  return "well_formed";
}

function linkIntegrity(sources) {
  let checked = 0;
  let wellFormed = 0;
  let illustrative = 0;
  const flagged = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || typeof source !== "object") continue;
    const url = source.url;
    if (typeof url !== "string" || !url.trim()) continue;
    checked += 1;
    const verdict = classifySourceUrl(url);
    if (verdict === "well_formed") {
      wellFormed += 1;
    } else if (verdict === "illustrative") {
      illustrative += 1;
    } else {
      const entry = { url, reason: "url is not a well-formed http(s) link" };
      if (typeof source.id === "string") entry.source_id = source.id;
      if (typeof source.source_type === "string") entry.source_type = source.source_type;
      flagged.push(entry);
    }
  }
  if (flagged.length === 0) return null;
  return { checked, well_formed: wellFormed, illustrative, flagged };
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

// What the caller actually named, read back to them.
//
// Measured 2026-08-26 by replaying an external-shaped call against the live
// endpoint: a 472-byte question naming a UAE counterparty, Fujairah, refined
// products and Kazakhstan transit came back in 20,864 bytes that contained
// none of those words. The note opened with "live wrapper is responding" and
// a pip install line, and the only trace of the question was two template
// region names. Over the 30 days to that date ten external calls carried a
// real prompt, from three callers, and none of the three returned after their
// first day. A screen that cannot repeat the subject back cannot show that it
// read the subject.
//
// Detection is vocabulary lookup over the same term lists that route the
// modules, so the subject line can never name a jurisdiction the router did
// not see. Nothing here asserts anything ABOUT the named party: this is a
// receipt of what was read, not a finding.
const SUBJECT_JURISDICTIONS = [
  ["United Arab Emirates", ["uae", "united arab emirates", "dubai", "abu dhabi", "fujairah", "sharjah", "jebel ali"]],
  ["Kazakhstan", ["kazakhstan", "almaty", "astana", "aktau", "kuryk", "khorgos"]],
  ["Iran", ["iran", "bandar abbas", "chabahar", "rasht-astara"]],
  ["Russia", ["russia", "russian federation", "novorossiysk"]],
  ["Kyrgyzstan", ["kyrgyzstan", "bishkek"]],
  ["Uzbekistan", ["uzbekistan", "tashkent"]],
  ["Turkmenistan", ["turkmenistan", "turkmenbashi"]],
  ["Azerbaijan", ["azerbaijan", "baku"]],
  ["Georgia", ["georgia", "poti", "batumi"]],
  ["Türkiye", ["turkey", "türkiye", "turkiye", "istanbul", "mersin"]],
  ["China", ["china", "xinjiang", "urumqi"]],
  ["European Union", ["european union", "eu sanctions", "european commission"]],
  ["United Kingdom", ["united kingdom", "uk sanctions", "ofsi"]],
  ["Singapore", ["singapore"]],
  ["Saudi Arabia", ["saudi arabia", "ksa", "jeddah", "ras tanura"]],
  ["Oman", ["oman", "sohar", "duqm"]],
  ["Qatar", ["qatar", "doha"]],
  ["Iraq", ["iraq", "basra"]],
  ["Yemen", ["yemen", "aden"]]
];

const SUBJECT_CHOKEPOINTS = [
  ["Strait of Hormuz", ["hormuz", "strait of hormuz"]],
  ["Bab-el-Mandeb", ["bab-el-mandeb", "bab el mandeb"]],
  ["Red Sea", ["red sea"]],
  ["Suez Canal", ["suez"]],
  ["Caspian Sea crossing", ["caspian", "trans-caspian", "middle corridor", "tcitr", "tcita"]],
  ["Bosphorus", ["bosphorus", "bosporus", "turkish straits"]]
];

// One decision-relevant fact per named port.
//
// A caller who writes "Fujairah" has told the screen something specific, and
// the first version answered as if they had written "a port": the note named
// the UAE and stopped. Fujairah's whole significance to a sanctions or
// war-risk question is that it sits outside the Strait of Hormuz. Each line
// below is a stable geographic or institutional fact about the place, not a
// claim about the caller's cargo, counterparty, or voyage.
const PORT_NOTES = [
  [
    "Fujairah",
    ["fujairah"],
    "bunkering and storage hub on the Gulf of Oman, outside the Strait of Hormuz — loading here avoids a Hormuz transit, which moves the war-risk question without touching the counterparty question"
  ],
  [
    "Jebel Ali",
    ["jebel ali", "jafza"],
    "free-zone port — the operating entity is licensed by the zone authority, so the registry extract to ask for is the zone's, not the mainland DED's"
  ],
  [
    "Aktau / Kuryk",
    ["aktau", "kuryk"],
    "Caspian ferry ports — vessel and slot availability, not customs, is what usually moves Middle Corridor transit times"
  ],
  [
    "Bandar Abbas / Chabahar",
    ["bandar abbas", "chabahar"],
    "Iranian ports — any leg through them makes this a US-nexus question before it is a routing question"
  ],
  [
    "Novorossiysk",
    ["novorossiysk"],
    "Russian Black Sea port — origin and price-cap attestation questions attach to cargo loaded here"
  ],
  [
    "Khorgos",
    ["khorgos"],
    "China–Kazakhstan land crossing — the gauge change and customs clearance there are documented separately from the sea legs"
  ],
  [
    "Poti / Batumi",
    ["poti", "batumi"],
    "Georgian Black Sea ports — the western handover of the Middle Corridor, where corridor paperwork changes hands"
  ]
];

const SUBJECT_COMMODITIES = [
  ["refined petroleum products", ["refined product", "refined products", "gasoil", "diesel", "jet fuel", "naphtha", "fuel oil"]],
  ["crude oil", ["crude oil", "crude"]],
  ["LNG or gas", ["lng", "natural gas", "gas condensate"]],
  ["grain or agricultural cargo", ["grain", "wheat", "barley", "agricultural cargo"]],
  ["metals or ore", ["copper", "aluminium", "aluminum", "uranium", "ferroalloy", "ore"]],
  ["dual-use or electronics", ["dual-use", "dual use", "semiconductor", "electronics", "machine tool", "cnc"]],
  ["fertiliser or chemicals", ["fertiliser", "fertilizer", "ammonia", "urea", "petrochemical"]]
];

// A caller-facing verb: what the request wants done, in their own words rather
// than the internal intent slug. `Detected intent: sanctions_policy_signal_screen`
// is a machine label that told the reader nothing they had not just typed.
const SUBJECT_ACTIONS = [
  ["screen a counterparty before onboarding", ["onboard", "onboarding", "supplier", "counterparty", "kyc", "due diligence"]],
  ["screen a route or shipment", ["route", "transit", "shipment", "voyage", "vessel", "cargo"]],
  ["check exposure before a signature or payment", ["before signature", "pre-signature", "payment", "trade finance", "letter of credit"]],
  ["build an evidence pack for review", ["evidence pack", "evidence", "audit", "provenance", "memo"]]
];

// Whole-word matching, and the reason is a real miss.
//
// The first version used String.includes and the replayed UAE/Fujairah call
// came back tagged "cargo metals or ore" — because the caller wrote "before
// onboarding", and "before" ends in "ore". A screen that hallucinates a cargo
// class out of a preposition is worse than one that names no cargo at all:
// the whole point of the subject line is that it proves the request was read.
//
// Compiled once at module load, not per request. The tables are fixed and the
// worker's CPU budget is the scarce resource here (p50 3.9 ms measured
// 2026-08-26 across 44k calls); rebuilding ~130 regexes on every invocation
// would spend it on nothing.
function compileVocabulary(table) {
  return table.map(([label, terms]) => [
    label,
    terms.map((term) => new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i"))
  ]);
}

const COMPILED_SUBJECT_JURISDICTIONS = compileVocabulary(SUBJECT_JURISDICTIONS);
const COMPILED_SUBJECT_CHOKEPOINTS = compileVocabulary(SUBJECT_CHOKEPOINTS);
const COMPILED_SUBJECT_COMMODITIES = compileVocabulary(SUBJECT_COMMODITIES);
const COMPILED_SUBJECT_ACTIONS = compileVocabulary(SUBJECT_ACTIONS);
const COMPILED_PORT_NOTES = PORT_NOTES.map(([label, terms, note]) => [
  label,
  compileVocabulary([[label, terms]])[0][1],
  note
]);

function portNotesFor(text) {
  const lower = (text || "").toLowerCase();
  return COMPILED_PORT_NOTES.filter(([, patterns]) => patterns.some((pattern) => pattern.test(lower))).map(
    ([label, , note]) => `${label}: ${note}`
  );
}

function matchVocabulary(lower, compiledTable) {
  const found = [];
  for (const [label, patterns] of compiledTable) {
    if (patterns.some((pattern) => pattern.test(lower))) found.push(label);
  }
  return found;
}

function subjectForText(text) {
  const lower = (text || "").toLowerCase();
  return {
    jurisdictions: matchVocabulary(lower, COMPILED_SUBJECT_JURISDICTIONS),
    chokepoints: matchVocabulary(lower, COMPILED_SUBJECT_CHOKEPOINTS),
    commodities: matchVocabulary(lower, COMPILED_SUBJECT_COMMODITIES),
    actions: matchVocabulary(lower, COMPILED_SUBJECT_ACTIONS)
  };
}

// Named regimes and lists to check, keyed by what the caller named.
//
// This is the half of a screening answer a caller cannot get from a taxonomy:
// not "sanctions authority" as a source category, but which authority, which
// list, and what that list settles. Every row names a public regime or a
// public list. None of them says the named party appears on anything — the
// worker holds no live retrieval on this profile, and a presence claim would
// be a sanctions determination, which this endpoint does not make.
const JURISDICTION_REGIMES = {
  "United Arab Emirates": [
    "OFAC SDN and Non-SDN Menu-Based lists — US designation status of the counterparty and its owners",
    "UAE Executive Office for Control & Non-Proliferation local list and guidance — the UAE's own re-export and diversion controls",
    "UAE trade licence and free-zone registry extract (DED, JAFZA, DMCC or the relevant zone) — legal identity, activity scope, incorporation date"
  ],
  Kazakhstan: [
    "OFAC EO 14024 / EO 14114 named-sector and correspondent-banking exposure — the route's secondary-sanctions surface",
    "EU circumvention-watch measures on Central Asia re-export flows — whether the transit leg is itself the flagged step",
    "KZ State Revenue Committee customs declaration and transit paperwork — that the declared route is the route"
  ],
  Iran: [
    "OFAC Iran programs (including EO 13902 and the petroleum-sector authorities) — any Iran leg is a US-nexus question before it is a routing question"
  ],
  Russia: [
    "OFAC EO 14024 / EO 14114, EU sanctions packages, UK OFSI consolidated list — direct and 50-percent-rule ownership exposure"
  ],
  Kyrgyzstan: [
    "EU circumvention measures covering Kyrgyz entities — the jurisdiction is on the EU's re-export watch, so a Kyrgyz leg needs its own evidence"
  ],
  "European Union": [
    "EU consolidated financial sanctions list and the Official Journal text of the applicable package — the measure as written, not as reported"
  ],
  "United Kingdom": ["UK OFSI consolidated list and the relevant UK statutory instrument"],
  China: ["US Entity List and Unverified List, plus EU/US Common High Priority List for dual-use cargo"],
  "Saudi Arabia": ["OFAC SDN and EU/UK consolidated lists for counterparty and ownership screening"],
  Türkiye: ["OFAC SDN and EU/UK consolidated lists, plus re-export and circumvention guidance for Turkish intermediaries"],
  Singapore: ["OFAC SDN and EU/UK consolidated lists, plus MAS and Singapore Customs guidance on transhipment"],
  Iraq: ["OFAC SDN and EU/UK consolidated lists for counterparty and ownership screening"],
  Yemen: ["UN Security Council consolidated list and OFAC Yemen-related designations"],
  Qatar: ["OFAC SDN and EU/UK consolidated lists for counterparty and ownership screening"],
  Oman: ["OFAC SDN and EU/UK consolidated lists for counterparty and ownership screening"],
  Uzbekistan: ["OFAC SDN and EU/UK consolidated lists, plus EU circumvention-watch guidance on Central Asia re-export"],
  Turkmenistan: ["OFAC SDN and EU/UK consolidated lists for counterparty and ownership screening"],
  Azerbaijan: ["OFAC SDN and EU/UK consolidated lists for counterparty and ownership screening"],
  Georgia: ["OFAC SDN and EU/UK consolidated lists, plus EU circumvention-watch guidance on Caucasus transit"]
};

const CHOKEPOINT_REGIMES = {
  "Strait of Hormuz": [
    "Joint War Committee listed-areas notice and the vessel's war-risk cover — whether the voyage is inside a listed area and who pays the premium",
    "UKMTO and IMO security advisories current at the voyage date"
  ],
  "Bab-el-Mandeb": [
    "Joint War Committee listed areas and current war-risk premium terms",
    "UKMTO advisories and carrier routing notices for the transit window"
  ],
  "Red Sea": [
    "Joint War Committee listed areas and war-risk cover for the transit window",
    "Carrier routing notice — Suez versus Cape of Good Hope, and who bears the diversion cost"
  ],
  "Suez Canal": ["Suez Canal Authority circulars and the carrier's routing notice for the transit window"],
  "Caspian Sea crossing": [
    "Port of Aktau or Kuryk operator notice and the ferry or feeder schedule — the leg where Middle Corridor transit times actually move"
  ],
  Bosphorus: ["Turkish Straits transit rules and any Montreux-related notices current at the voyage date"]
};

const COMMODITY_REGIMES = {
  "refined petroleum products": [
    "G7 oil price-cap attestation chain, if any leg touches Russian-origin product — the attestation, not the assurance that one exists",
    "Product origin documents: refinery certificate, bill of lading, cargo blending history"
  ],
  "crude oil": [
    "G7 oil price-cap attestation chain for Russian-origin crude",
    "Cargo origin and ship-to-ship transfer history — the deceptive-shipping-practice checklist applies here"
  ],
  "LNG or gas": ["Origin and offtake documentation, plus any project-level designation affecting the loading terminal"],
  "dual-use or electronics": [
    "EU/US Common High Priority List classification of the specific goods — the item-level question that decides whether this is an export-control file at all",
    "End-user statement and end-use documentation"
  ],
  "metals or ore": ["Origin certificates and any metals-specific designations or import bans applying at the destination"],
  "grain or agricultural cargo": ["Origin certificates and port-of-loading documentation"],
  "fertiliser or chemicals": ["Origin certificates plus any chemical-specific control listing for the goods"]
};

// What to collect, and what each item settles.
//
// The previous note answered this with five lines of "No caller-supplied
// <category> evidence in this live A2A request" — the same sentence five
// times, phrased as the caller's failure, naming nothing they could go and
// fetch. A caller who has just been told their request was incomplete needs
// the next action, not the complaint.
const EVIDENCE_REQUESTS = {
  "primary official source": "the rule, designation or notice as published by the body that issued it — settles what the measure actually says",
  "independent context source": "one independent report on the same fact — settles whether the primary source is being read the way the market reads it",
  "dated retrieval note": "the date each source was retrieved — settles how stale this screen is when someone reads it next month",
  "sanctions authority": "list extracts from the authorities named above, with list version and date — settles designation status at a point in time",
  "trade finance": "the bank's or insurer's own clause on this transaction — settles whether the money leg survives the risk, which is where these deals actually fail",
  "ownership/counterparty": "registry extract and beneficial-ownership chain — settles the 50-percent-rule question that direct-name screening cannot",
  "shipping or logistics": "carrier routing note and vessel history, including any ship-to-ship transfers — settles what the cargo did between the two ports on the paperwork",
  "corridor operator": "port or corridor operator notice for the transit window — settles whether the declared route was open",
  "customs/transport authority": "customs declaration and transit documents — settles that the declared route is the route",
  "state-company or IFI source": "state-company or development-bank documentation where the counterparty is state-linked",
  "maritime security": "security advisories current at the voyage date — settles the routing and insurance assumptions",
  "energy/shipping market": "freight and premium data for the transit window — settles the cost side of a diversion",
  "regional official statement": "the official statement from the regional authority involved",
  "EU institution": "the Official Journal text of the applicable package",
  "national regulator": "the national regulator's own guidance or implementing act",
  "Official Journal or court source": "the Official Journal entry or court decision, not a summary of it"
};

function evidenceRequestLine(category) {
  const detail = EVIDENCE_REQUESTS[category];
  return detail ? `${category} — ${detail}` : category;
}

// The named-regime block, assembled from whatever the caller named.
//
// Order matters: jurisdiction first (who can designate), then chokepoint (what
// the voyage runs through), then commodity (what the goods themselves trigger).
// Deduplicated because two jurisdictions frequently point at the same list.
function regimesForSubject(subject) {
  const rows = [];
  for (const jurisdiction of subject.jurisdictions) {
    for (const row of JURISDICTION_REGIMES[jurisdiction] || []) rows.push(`${jurisdiction}: ${row}`);
  }
  for (const chokepoint of subject.chokepoints) {
    for (const row of CHOKEPOINT_REGIMES[chokepoint] || []) rows.push(`${chokepoint}: ${row}`);
  }
  for (const commodity of subject.commodities) {
    for (const row of COMMODITY_REGIMES[commodity] || []) rows.push(`${commodity}: ${row}`);
  }
  return [...new Set(rows)];
}

// One line naming what the request was read as. Empty when the caller named
// nothing recognisable — an empty subject line is honest, an invented one is
// not.
function subjectLine(subject) {
  const parts = [];
  if (subject.jurisdictions.length) parts.push(`jurisdictions ${subject.jurisdictions.join(", ")}`);
  if (subject.chokepoints.length) parts.push(`transit ${subject.chokepoints.join(", ")}`);
  if (subject.commodities.length) parts.push(`cargo ${subject.commodities.join(", ")}`);
  if (subject.actions.length) parts.push(`asked to ${subject.actions.join("; ")}`);
  return parts.length ? parts.join(" | ") : "";
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
  const subject = subjectForText(text);
  // The risk signal named the same four nouns for every corridor question.
  // Naming what the caller named costs nothing and is the difference between
  // a sentence about their deal and a sentence about the category.
  const namedSubject = [...subject.jurisdictions, ...subject.chokepoints].slice(0, 4);
  const subjectQualifier = namedSubject.length ? ` Named in this request: ${namedSubject.join(", ")}.` : "";
  return {
    intent,
    risk_signal: `${riskSignal}${subjectQualifier}`,
    subject,
    subject_line: subjectLine(subject),
    applicable_regimes: regimesForSubject(subject),
    port_notes: portNotesFor(text),
    affected_regions: affectedRegionsForModules(modules),
    source_categories_required: sourceCategories,
    // Kept in the shape older callers parse; the note now renders
    // evidence_requests instead, which says what each item settles.
    evidence_gaps: missingSourceCategories
      .slice(0, 5)
      .map((category) => `No caller-supplied ${category} evidence in this live A2A request.`),
    evidence_requests: missingSourceCategories.slice(0, 6).map((category) => evidenceRequestLine(category)),
    // The bare category names, for the person-led offer. Feeding it the
    // sentence form put "No caller-supplied primary official source evidence
    // in this live A2A request" inside the offer twice over, which read as the
    // endpoint scolding the caller in the one paragraph meant to invite them.
    open_items: missingSourceCategories.slice(0, 6),
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

// The raw user-agent, truncated. classifyClient() collapses it into a handful
// of buckets, which is enough for volume but not for answering "who was that
// one caller from Singapore" — every unrecognised agent lands in "unknown".
// Kept deliberately coarse: no IP, no cookie, no header dump.
const USER_AGENT_MAX_CHARS = 120;
const USER_AGENT_STAT_ROWS = 15;

function userAgentSummary(request) {
  const raw = (request.headers.get("user-agent") || "").trim();
  return raw ? raw.slice(0, USER_AGENT_MAX_CHARS) : null;
}

// A request that arrives from another Cloudflare Worker carries `cf-worker`
// with the calling zone. It is the only handle on a caller that sends no user
// agent, and the whole reason for recording it is one measurement: over
// 2026-08-19..22, of 12,155 raw log rows, 50 carried a `cf-worker` zone and 49
// of those were probes that already name themselves in the user agent
// (ProofBench, mcpqueen-grader, x402-observatory, Cloudflare's own
// infrastructure). The fiftieth sent no user agent at all and was the single
// external non-probe call in the window. So this field is not a new layer of
// data — it is a signature on the one row a year where nothing else identifies
// the caller. Kept because the source it came from, Workers Logs, is destroyed
// after three days.
function callerZone(request) {
  const raw = (request.headers.get("cf-worker") || "").trim().toLowerCase();
  if (!raw) return null;
  // Header shape is a hostname. Anything else is either a mistake or someone
  // testing what this endpoint stores, and is recorded as such rather than
  // dropped, so the anomaly stays visible.
  return /^[a-z0-9]([a-z0-9.-]{0,62}[a-z0-9])?$/.test(raw) ? raw : "malformed";
}

// Our own conformance and smoke runs name themselves in the user agent, and so
// does every directory probe, auditor and census bot observed so far. That
// makes the classification cheap to read, but it also means only one of these
// buckets carries information that was not already available: `unsigned_external`,
// a caller that sent no user agent. Measured over the same window: 55 requests
// of 12,155, and the only non-probe among them was the one that mattered.
//
// A manual `curl` run by the operator lands in `external`, not `self_test` —
// the scripted paths set their own agent, an ad-hoc shell call does not. Read
// `external` as "not identified as ours or as a probe", not as "a stranger".
//
// The rule reads the `agenda-intelligence-` prefix rather than a list of tool
// names. It used to name two, `a2a-conformance` and `live-smoke`. On
// 2026-08-24 a third scripted path appeared, `agenda-intelligence-post-deploy-verifier`,
// which followed the same naming convention and was still counted as
// `external` because it was not on the list. A list has to be edited from a
// second repository every time a tool is added; a prefix does not.
//
// This does not make `external` mean "a stranger". The same day, that bucket
// held 36 non-probe calls: 5 genuinely outside, 3 from the verifier this
// change reclassifies, and 28 from the operator's own `curl`, which stays in
// `external` by the rule above and cannot be told apart from anyone else's
// `curl` at this layer. Separating those needs the calling network, which the
// Worker does not judge on and the archive does.
const SELF_TEST_USER_AGENT = /^agenda-intelligence-/i;

// Two ways an automated caller declares itself, and both are needed.
//
// The keyword list catches an agent that says what it does. It is not enough on
// its own: measured across 2026-08-20..22, the two highest-volume crawlers here
// name neither a role nor a bot suffix — `agent-tools.cloud-a2a/0.1` and
// `Waggle/1.0` — and 411 requests over those three days landed in `external`,
// the bucket that is supposed to mean "not a probe". The largest single
// contributor was 224 requests from one scheduled crawler.
//
// The second rule reads the convention instead of the vocabulary: a
// parenthesised contact prefixed with `+`, as in `(+https://example.com/bot)`
// or `(+someone@example.com)`. Anything shipping that has published a way to be
// contacted about its crawling, which is what "self-identified" means. Every
// crawler in the observed population that the keywords missed carries it.
const SERVICE_PROBE_KEYWORD =
  /audit|probe|scan|liveness|registry|monitor|census|health|grader|bot\b|crawler|spider|beat\//i;
const SERVICE_PROBE_SELF_ID = /\(\+/;

function callerKind(request) {
  const raw = (request.headers.get("user-agent") || "").trim();
  if (!raw) return "unsigned_external";
  if (SELF_TEST_USER_AGENT.test(raw)) return "self_test";
  if (SERVICE_PROBE_KEYWORD.test(raw) || SERVICE_PROBE_SELF_ID.test(raw)) return "service_probe";
  return "external";
}

// modules_used reaches this function in two shapes: the routed analyze path
// passes result.metadata entries ([{ module, role }, ...]), while the
// single-profile worker branches pass plain strings (["cis_secondary_sanctions"]).
// Reading .module off a string yielded [undefined], which persisted as [null]
// and aggregated as "unknown" — i.e. every profile except the routed one
// reported no modules at all. Accept both shapes.
function normalizeModules(modulesUsed) {
  if (!Array.isArray(modulesUsed)) return [];
  return modulesUsed
    .map((item) => (typeof item === "string" ? item : item?.module))
    .filter((name) => typeof name === "string" && name.length > 0);
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
  // Absent rather than zero when a caller path does not produce one, so a
  // reader can tell "this profile parsed nothing" from "nobody measured".
  const structuredChars = Number.isFinite(details.structured_chars) ? details.structured_chars : null;

  return {
    event: "agenda_intelligence_a2a_usage",
    // 4: prompt_chars became the size of what arrived rather than the size of
    // what this profile could parse, and structured_chars carries the latter.
    // Rows at version 3 and below measured a plain-text request to a gate as
    // zero, and their likely_probe follows from that number.
    event_version: 4,
    timestamp: new Date().toISOString(),
    source: "cloudflare_worker",
    method: request.method,
    path: url.pathname,
    host: url.hostname,
    jsonrpc_method: details.jsonrpc_method || null,
    jsonrpc_id_present: Boolean(details.jsonrpc_id_present),
    agent_profile: details.agent_profile || agentProfile(request),
    prompt_chars: promptChars,
    structured_chars: structuredChars,
    modules_used: normalizeModules(details.modules_used),
    live_retrieval: details.live_retrieval || { status: null, upstream: null, billable: false, cost_eur: 0 },
    client: classifyClient(request),
    user_agent: userAgentSummary(request),
    caller_kind: callerKind(request),
    caller_zone: callerZone(request),
    referrer_host: headerHost(request, "referer"),
    cf: {
      colo: cf.colo || null,
      country: cf.country || null,
      as_org: cf.asOrganization || null
    },
    outcome: details.outcome || { decision: null, status: null, score: null },
    likely_probe: Boolean(details.likely_probe)
  };
}

function logUsageEvent(request, details) {
  const event = buildUsageEvent(request, details);
  console.log(event);
  return event;
}

// The KV usage log only records message/send, so the steps before a call —
// someone opening the card, the landing page, the docs — are invisible, and
// with a handful of visitors a week that is exactly where the drop-off is.
// These go to Workers Logs via console.log rather than KV: the free KV tier
// allows 1,000 writes a day and discovery GETs already run 250-480, on a
// namespace shared with the rate limiter and the sanctions-snapshot cache.
// Workers Logs takes 200,000 events a day at no cost.
const FUNNEL_SILENT_PATHS = new Set([
  "/health",
  "/status",
  "/robots.txt",
  "/stats",
  "/.well-known/jwks.json",
  AGENSTRY_VERIFICATION_PATH
]);

function funnelStepForPath(pathname) {
  if (FUNNEL_SILENT_PATHS.has(pathname)) return null;
  if (pathname === "/") return "landing";
  if (pathname === "/.well-known/agent-card.json") return "card";
  if (pathname.startsWith("/okf") || pathname.startsWith("/profiles/")) return "docs";
  if (pathname.startsWith("/.well-known/") || pathname === "/entitymap.json" || pathname === "/api/openapi.json") {
    return "discovery";
  }
  return null;
}

function logFunnelEvent(request, step) {
  if (!step) return null;
  const url = new URL(request.url);
  const cf = request.cf || {};
  const event = {
    event: "agenda_intelligence_a2a_funnel",
    event_version: 2,
    timestamp: new Date().toISOString(),
    step,
    method: request.method,
    path: url.pathname,
    host: url.hostname,
    client: classifyClient(request),
    user_agent: userAgentSummary(request),
    caller_kind: callerKind(request),
    caller_zone: callerZone(request),
    referrer_host: headerHost(request, "referer"),
    country: cf.country || null,
    as_org: cf.asOrganization || null,
    colo: cf.colo || null
  };
  console.log(event);
  return event;
}

// Uniform per-call outcome, so /stats can answer "of the real calls, how many
// ended with nothing usable". Every vertical profile carries a
// readiness_contract; the base signal-screen profile does not.
function callOutcome(result) {
  if (result?.status?.state === "TASK_STATE_FAILED") {
    return { decision: "invalid_request", status: "invalid_request", score: null };
  }
  const contract = result?.metadata?.response?.readiness_contract;
  if (contract && typeof contract === "object") {
    return {
      decision: contract.routing?.value || contract.status || "unknown",
      status: contract.status || "unknown",
      score: Number.isInteger(contract.score) ? contract.score : null
    };
  }
  return { decision: "completed", status: "completed", score: null };
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
      user_agent: event.user_agent || "unknown",
      caller_kind: event.caller_kind || "external",
      caller_zone: event.caller_zone || "none",
      referrer_host: event.referrer_host || "none",
      country: event.cf?.country || "unknown",
      colo: event.cf?.colo || "unknown",
      as_org: event.cf?.as_org || "unknown",
      outcome: event.outcome?.decision || "unknown",
      outcome_score: Number.isInteger(event.outcome?.score) ? event.outcome.score : null,
      modules_used: Array.isArray(event.modules_used) ? event.modules_used : [],
      live_retrieval: event.live_retrieval || { status: null, upstream: null, billable: false, cost_eur: 0 }
    })
  );
}

function incrementMap(map, key) {
  const safeKey = key || "unknown";
  map.set(safeKey, (map.get(safeKey) || 0) + 1);
}

function sortedMap(map, limit = 0) {
  const rows = [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  return limit > 0 ? rows.slice(0, limit) : rows;
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
  const referrers = new Map();
  const networks = new Map();
  const userAgents = new Map();
  const callerKinds = new Map();
  const callerZones = new Map();
  const outcomes = new Map();
  let emptyHanded = 0;
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
    incrementMap(referrers, event.referrer_host);
    incrementMap(networks, event.as_org);
    incrementMap(userAgents, event.user_agent);
    incrementMap(callerKinds, event.caller_kind);
    // Only zones that actually sent one: "none" is every ordinary caller and
    // would bury the handful of rows this map exists to show.
    if (event.caller_zone && event.caller_zone !== "none") incrementMap(callerZones, event.caller_zone);
    incrementMap(outcomes, event.outcome);
    // A caller who supplied nothing usable: the gate could not act on the
    // request. Counted among non-probe calls only — monitors send deliberately
    // empty payloads, so including them made the ratio read "5 of 1".
    if (
      !event.likely_probe &&
      (event.outcome === "insufficient_information" || event.outcome === "invalid_request")
    ) {
      emptyHanded += 1;
    }
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
      billable_calls: billableCalls,
      empty_handed: emptyHanded
    },
    cost: {
      estimated_cost_eur: round2(estimatedCostEur),
      billable_upstreams: sortedMap(upstreams),
      budget: budgetStatus(env, estimatedCostEur)
    },
    clients: sortedMap(clients),
    // Who called, in the only split that separates real traffic from noise.
    // `unsigned_external` is the one worth reading: a caller that identified
    // itself with nothing at all. `external` means "not ours and not a
    // self-declared probe", which includes an ad-hoc curl from this desk.
    caller_kinds: sortedMap(callerKinds),
    // Calling Cloudflare Worker zones, from the `cf-worker` header. Empty on
    // most days by design — see callerZone() for what this is for.
    caller_zones: sortedMap(callerZones),
    outcomes: sortedMap(outcomes),
    agent_profiles: sortedMap(agentProfiles),
    hosts: sortedMap(hosts),
    countries: sortedMap(countries),
    networks: sortedMap(networks),
    referrers: sortedMap(referrers),
    // High-cardinality by nature (every crawler ships its own string), so this
    // one is capped — it exists to name unrecognised callers, not to be complete.
    user_agents: sortedMap(userAgents, USER_AGENT_STAT_ROWS),
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

function routingMarkdown(text, modules, profile = "agenda", triageOverride = null, extras = {}) {
  const { engagement = null, relatedAgents = [], hostedMcpTools = [] } = extras;
  const triageText =
    profile === "kazakhstan"
      ? `${text}\nKazakhstan Central Asia Caspian Middle Corridor sanctions corridor risk`
      : text;
  const triage = triageOverride || triageForText(triageText, modules, profile);
  const screen = triage.signal_screen;
  const sourceList = triage.source_plan.map((item) => `- ${item}`).join("\n");
  const qualityList = triage.quality_gates.map((item) => `- ${item}`).join("\n");
  const actionList = triage.next_actions.map((item) => `- ${item}`).join("\n");
  const regionList = screen.affected_regions.map((item) => `- ${item}`).join("\n");
  const gapList = (screen.evidence_requests || screen.evidence_gaps).map((item) => `- ${item}`).join("\n");
  const watchList = screen.watch_next.map((item) => `- ${item}`).join("\n");
  const regimeList = (screen.applicable_regimes || []).map((item) => `- ${item}`).join("\n");
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
  // The first line is a receipt for the caller's own question, not a greeting
  // from the server. When the caller named nothing this vocabulary knows, it
  // says so plainly rather than inventing a subject.
  //
  // The gate still names itself, because a caller that fanned a question out
  // across several endpoints has to be able to tell the answers apart. What it
  // no longer does is spend the first three lines on itself.
  const responder =
    profile === "kazakhstan" ? "Kazakhstan / Middle Corridor Deal Risk Gate" : "Agenda Intelligence MD";
  const subjectHeading = screen.subject_line
    ? `${responder} read this as: ${screen.subject_line}.`
    : `${responder} read this as a strategic-risk question with no jurisdiction, transit leg, or cargo named — the screen below stays generic until one is.`;
  const regimeBlock = regimeList ? ["Regimes and lists that apply to what you named:", regimeList, ""].join("\n") : "";
  const portBlock = (screen.port_notes || []).length
    ? ["Places you named:", screen.port_notes.map((item) => `- ${item}`).join("\n"), ""].join("\n")
    : "";
  // Order is the fix, not decoration.
  //
  // Measured 2026-08-26 against the live endpoint: the note opened with the
  // server describing itself and a `pip install` line, and reached anything
  // about the caller's subject on line 12. A reader deciding in three seconds
  // whether this endpoint understood them saw a brochure. The answer now runs
  // first — what was read, what applies, what to collect — and the packaging
  // sits at the bottom where a caller who already wants more will look for it.
  return [
    subjectHeading,
    "",
    dealGateBlock,
    dealContractBlock,
    "Signal screen:",
    `Risk signal: ${screen.risk_signal}`,
    "",
    "Affected regions:",
    regionList,
    "",
    portBlock,
    regimeBlock,
    "Collect next (each line says what it settles):",
    gapList,
    "",
    "Watch next:",
    watchList,
    "",
    "Quality gates:",
    qualityList,
    "",
    "Next actions:",
    actionList,
    "",
    // The full source-category checklist used to print here too. Measured on
    // the live note 2026-08-26: all six categories in "Collect next" were
    // repeated verbatim in the checklist, 1,059 bytes of the 7,442-byte note
    // saying a second and third time what the caller had already read. The
    // machine-readable part still carries the complete list under
    // signal_screen.source_categories_required for a caller that wants it.
    "Evidence/source plan:",
    sourceList,
    "",
    "Boundaries: no live retrieval, no factual-truth verification, no legal/financial/compliance advice.",
    relatedAgentsMarkdown(relatedAgents),
    engagementMarkdown(engagement),
    "",
    "Deeper analysis runs in the installable MCP server:",
    "```bash",
    "pip install agenda-intelligence-md",
    "agenda-intelligence-mcp",
    "```",
    recommendedToolLine(screen.recommended_mcp_tool, hostedMcpTools),
    `Modules applied: ${modules.map((item) => item.module).join(", ")}. Intent read as: ${triage.intent}.`,
    promptLine
  ]
    // dealGateBlock, dealContractBlock and the engagement block are empty
    // strings on the profiles that do not produce them. Joined as-is they left
    // runs of three and four newlines in the middle of the note, which reads as
    // a rendering fault to anyone printing the text part.
    .filter((block) => block !== "")
    .join("\n")
    // The prompt echo carries its own leading blank line, so filtering empty
    // blocks is not enough on its own; collapse whatever is left.
    .replace(/\n{3,}/g, "\n\n");
}

// An agent that cannot serve the request should hand back the ones that can.
//
// The signal screen already names the affected regions, but the response
// carried no address for any sibling gate: a caller asking about a corridor
// deal got a taxonomy and no way to act on it without reading the site. The
// four rows are returned unfiltered rather than matched to the detected
// regions on purpose — a keyword-to-gate map is the kind of rule that scores
// well on the cases it was written against and transfers badly, and a calling
// model can pick from four one-line descriptions itself.
// The recommended tool is a dead end unless the caller is told where it runs.
//
// Measured 2026-08-25 against the live endpoint: the note recommends
// audit_claims, source_coverage or analyze, and the hosted /mcp endpoint on the
// same host serves none of them — a caller that follows the recommendation gets
// "Unknown tool". Those three live in the installable stdio server. The hosted
// list is read from the same source that serves tools/list so the two cannot
// disagree.
function recommendedToolLine(recommended, hostedMcpTools) {
  const base = `Recommended MCP tool: ${recommended}`;
  if (!hostedMcpTools.length) return base;
  if (hostedMcpTools.includes(recommended)) return `${base} (served by this host at /mcp).`;
  return (
    `${base} — runs in the installable stdio server (pip install agenda-intelligence-md). ` +
    `This host's /mcp endpoint serves: ${hostedMcpTools.join(", ")}.`
  );
}

function relatedAgentsMarkdown(gates) {
  if (!Array.isArray(gates) || !gates.length) return "";
  return [
    "",
    "Gates that take a structured request on this subject:",
    ...gates.map((gate) => `- ${gate.name} — use when ${gate.use_when}. A2A: ${gate.a2a}`)
  ].join("\n");
}

// Excluded by address, not by profile name: the Middle Corridor gate is served
// under product profile "kazakhstan", so filtering on the profile string would
// have left that worker advertising itself to its own callers.
function relatedAgentsFor(request) {
  const own = workerNameFromUrl(originFromRequest(request));
  return CORRIDOR_ASSISTANT_GATES.filter((gate) => workerNameFromUrl(gate.a2a) !== own).map((gate) => ({ ...gate }));
}

// The worker name is the first label of the host. Comparing whole origins
// breaks the moment the request arrives on any host but the canonical one —
// a preview deployment, a custom domain, or a test — and the failure is silent:
// the gate quietly starts advertising itself.
function workerNameFromUrl(value) {
  try {
    return new URL(value).hostname.split(".")[0];
  } catch {
    return "";
  }
}

// The same contact the metadata carries, repeated in the text part.
//
// A caller that reads only the markdown part — measured 2026-08-25, the one
// external caller that returned on a second day sends a plain HTTP POST and
// gets back two parts, of which the text one is what a person would print —
// never sees `metadata.engagement`. Both parts are built from one object here
// so the two cannot drift apart.
function engagementMarkdown(engagement) {
  if (!engagement) return "";
  return [
    "",
    "Person-led work:",
    engagement.offer,
    engagement.next_step,
    `Contact: ${engagement.contact_email} (${engagement.support_hours}). ` +
      `Page for a person to read: ${engagement.human_page}`
  ].join("\n");
}

// A request with nothing in it used to come back TASK_STATE_COMPLETED.
//
// Measured 2026-08-25 against the live endpoint: `params: {}` and an empty
// `parts: []` both returned a full routing note and a completed task. Every
// structured gate refuses the same input and says what it needs, so the base
// profile was the one surface that told a machine caller its malformed request
// had worked. It also logged as a completed call with zero prompt characters,
// which is the same shape a real call has in the usage record.
//
// The Middle Corridor profile already has a request guide, so it reuses the
// gate refusal. The base profile takes plain text, not a structured request,
// and needs its own wording.
function emptyRequestResult(profile, request) {
  if (GATE_REQUEST_GUIDES[profile]) {
    return invalidRequestResult(
      profile,
      "/v1/middle-corridor/deal-risk",
      "schemas/v1/middle-corridor-deal-risk-request.schema.json",
      ["No structured deal-risk request and no text in params.message.parts."]
    );
  }

  const gates = relatedAgentsFor(request);
  const example = {
    jsonrpc: "2.0",
    id: "1",
    method: "message/send",
    params: {
      message: {
        role: "user",
        parts: [
          {
            kind: "text",
            text:
              "Aluminium extrusions, Aktau to Jebel Ali via Baku and Poti. Buyer is a UAE company " +
              "incorporated in 2025, payment through a Georgian bank. What evidence will a bank ask " +
              "for before this moves?"
          }
        ]
      }
    }
  };
  const errors = ["No text and no structured request in params.message.parts."];
  const text = [
    "# Nothing to route",
    "",
    "This endpoint read the request and found no question in it. Nothing was screened.",
    "",
    "## Why it stopped",
    ...errors.map((error) => `- ${error}`),
    "",
    "## What it needs",
    "- one text part naming the route, counterparty, or document, and the decision it feeds",
    "- or a structured Middle Corridor deal-risk request, which the Kazakhstan profile also accepts",
    "",
    "## A request that works",
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    "",
    "## Gates that take a structured request",
    ...gates.map((gate) => `- ${gate.name} — use when ${gate.use_when}. A2A: ${gate.a2a}`),
    "",
    "## If you would rather talk to a person",
    `Email ${SUPPORT_CONTACT_EMAIL} with a one-line route or counterparty and the next decision or review.`,
    "Fit, scope, fee, and timing are confirmed before work starts.",
    "",
    "This endpoint triages evidence readiness. It does not verify facts, retrieve live sources, or replace human review."
  ].join("\n");

  return {
    id: crypto.randomUUID(),
    status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "agenda-intelligence-request-guidance",
        name: "Agenda Intelligence — how to send a request this endpoint can route",
        parts: [
          { text, mediaType: "text/markdown" },
          {
            data: {
              valid: false,
              errors,
              required_fields: [
                "params.message.parts — at least one text part with the question, route, counterparty, or document",
                "or params.message.parts[0].data — a structured Middle Corridor deal-risk request"
              ],
              example_request: example,
              related_agents: gates,
              front_door: "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev",
              support_contact: SUPPORT_CONTACT_EMAIL
            },
            mediaType: "application/json"
          }
        ]
      }
    ],
    metadata: {
      product_profile: profile,
      valid: false,
      errors,
      related_agents: gates,
      support_contact: SUPPORT_CONTACT_EMAIL,
      engagement: engagementBlock(request)
    }
  };
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
  if (!structuredRequest && !text.trim()) {
    return emptyRequestResult(profile, request);
  }
  const triageText =
    profile === "kazakhstan"
      ? `${text}\nKazakhstan Central Asia Caspian Middle Corridor sanctions corridor risk`
      : text;
  const modules = routeModulesForProfile(text, profile);
  const triage = triageForText(triageText, modules, profile, structuredRequest);
  const engagement = engagementBlock(request, {
    profile,
    // The same payload the JSON part exposes, so the offer can only name items
    // the caller can also see.
    response: triage.deal_risk_contract || triage.deal_risk_gate || triage
  });
  const relatedAgents = relatedAgentsFor(request);
  const hostedMcpTools = mcpToolsForProfile(profile).map((tool) => tool.name);
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
            text: routingMarkdown(text, modules, profile, triage, { engagement, relatedAgents, hostedMcpTools }),
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
      product_profile: profile,
      related_agents: relatedAgents,
      hosted_mcp_tools: hostedMcpTools,
      engagement
    }
  };
}

// A machine that called this endpoint has no way to reach a person.
//
// The agent card carries `support`, the landing page carries a mailto, and the
// corridor assistant puts an `engagement` block in its orientation response.
// The base profile's successful response carries none of that: measured
// 2026-08-22 against the live endpoint, a `message/send` to agenda-intelligence
// returns agent_card, repository, package, mcp_transport, modules_used and
// triage, and no contact anywhere in the payload.
//
// That is the exact path the only external non-probe caller in the observed
// record took, arriving from another Cloudflare Worker with no user agent, no
// referer and no origin. Such a caller cannot be identified from the logs and
// will never render an HTML page — so the response itself is the only surface
// that can hand it a way back. This block is that surface and nothing more: no
// price, no customer claim, no urgency.
function engagementBlock(request, { profile = "agenda", response = null } = {}) {
  const subject = ENGAGEMENT_SUBJECTS[profile] || ENGAGEMENT_SUBJECTS.agenda;
  const open = engagementOpenItems(response);
  const outcome = engagementOutcome(response);
  return {
    offer: engagementOffer(subject, outcome, open),
    contact_email: SUPPORT_CONTACT_EMAIL,
    support_hours: SUPPORT_HOURS_LOCAL,
    next_step:
      `Email a one-line description of ${subject} and the decision or review it feeds. ` +
      "Fit, scope, fee, and timing are confirmed before work starts.",
    // The landing page, not the agent card: the card is already in this
    // metadata, and the person behind an integration needs a page they can read.
    human_page: originFromRequest(request)
  };
}

// What this profile actually looked at, in the caller's words rather than the
// registry's. Used in both the offer and the next step so the two name the same
// thing.
const ENGAGEMENT_SUBJECTS = Object.freeze({
  agenda: "this corridor, counterparty, or evidence pack",
  kazakhstan: "this Middle Corridor deal file",
  middle_corridor_deal_risk: "this Middle Corridor deal file",
  cis_secondary_sanctions: "this counterparty's secondary-sanctions exposure",
  gulf_maritime_exposure: "this voyage's Gulf chokepoint exposure",
  market_entry_readiness: "this Kazakhstan market-entry file",
  kazakhstan_market_entry_readiness: "this Kazakhstan market-entry file",
  agentic_interaction_trust: "this agent-to-agent interaction",
  agent_output_verification: "this evidence pack",
  corridor_sanctions_assistant: "this corridor or sanctions file"
});

// Every profile names the things standing between its verdict and a human
// decision, and each one names them in its own field. The list is ordered from
// the narrowest reading of "still missing" to the broadest, because the first
// field that has entries wins.
//
// `minimum_sources_before_go` and `missing_sources` were found absent after the
// 2026-08-26 deploy: the Middle Corridor deal-risk gate — the busiest host in
// the funnel — was returning `escalate_before_signature` with seven named gaps
// and still offering the generic sentence, because it names them in neither of
// the two fields the first version knew about.
const ENGAGEMENT_OPEN_ITEM_FIELDS = Object.freeze([
  "open_items",
  "minimum_sources_before_review",
  "minimum_sources_before_action",
  "minimum_sources_before_go",
  "evidence_gaps",
  "blocking_gaps",
  "owner_actions",
  "missing_sources"
]);

const ENGAGEMENT_OUTCOME_FIELDS = Object.freeze([
  "triage_recommendation",
  "gate_decision",
  "decision",
  "readiness_label",
  "decision_readiness_label",
  "reason_code"
]);

// Descends one level, because the profiles do not agree on where the gaps sit:
// the vertical gates put them at the top of the response, the base profile puts
// them under `signal_screen`. One level covers every shipped payload and cannot
// wander into an unrelated array the way a full walk could.
function engagementOpenItems(response) {
  const direct = engagementOpenItemsIn(response);
  if (direct.length) return direct;
  if (!response || typeof response !== "object") return [];
  for (const value of Object.values(response)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = engagementOpenItemsIn(value);
    if (nested.length) return nested;
  }
  return [];
}

function engagementOpenItemsIn(source) {
  if (!source || typeof source !== "object") return [];
  for (const field of ENGAGEMENT_OPEN_ITEM_FIELDS) {
    const value = source[field];
    if (!Array.isArray(value) || value.length === 0) continue;
    const items = value.map(engagementItemLabel).filter(Boolean);
    if (items.length) return items;
  }
  return [];
}

const ENGAGEMENT_ITEM_MAX_CHARS = 90;

function engagementItemLabel(item) {
  const label =
    typeof item === "string"
      ? item.trim()
      : item && typeof item === "object"
        ? [item.source_type || item.gap || item.owner_function || "", item.next_action || item.description || ""]
            .filter(Boolean)
            .join(": ")
            .trim()
        : "";
  // Gaps arrive both as bare nouns ("vessel_registry_extract") and as full
  // sentences; the trailing stop has to go or the joined list reads as broken
  // punctuation. One verbose gap must not turn the offer into a wall of text.
  const trimmed = label.replace(/[.\s]+$/u, "");
  return trimmed.length > ENGAGEMENT_ITEM_MAX_CHARS
    ? `${trimmed.slice(0, ENGAGEMENT_ITEM_MAX_CHARS - 1).trimEnd()}\u2026`
    : trimmed;
}

function engagementOutcome(response) {
  const direct = engagementOutcomeIn(response);
  if (direct) return direct;
  if (!response || typeof response !== "object") return "";
  for (const value of Object.values(response)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = engagementOutcomeIn(value);
    if (nested) return nested;
  }
  return "";
}

function engagementOutcomeIn(source) {
  if (!source || typeof source !== "object") return "";
  for (const field of ENGAGEMENT_OUTCOME_FIELDS) {
    if (typeof source[field] === "string" && source[field].trim()) return source[field].trim();
  }
  return "";
}

// A generic "email us" line is a signature, and a signature gets skipped like
// one. Measured 2026-08-18..26: twelve substantive external calls from one
// caller, every one TASK_STATE_COMPLETED, and no reply to a contact that was
// already in the agent card, on the landing page, and — from 2026-08-25 — in
// the base profile's own response text. So the offer names this caller's own
// unfinished business: the verdict it just got and the items its file is still
// short of. Nothing else changes; there is still no price and no traction claim.
function engagementOffer(subject, outcome, open) {
  if (!open.length) {
    return `Person-led review of ${subject}, scoped and quoted before work starts.`;
  }
  const named = open.slice(0, 2).join(", ");
  const rest = open.length > 2 ? `, and ${open.length - 2} more` : "";
  const count = open.length === 1 ? "one item" : `${open.length} items`;
  const verdict = outcome ? `came back ${outcome} and ` : "";
  return (
    `This run ${verdict}left ${count} open before a human can decide on ${subject}: ${named}${rest}. ` +
    "Closing those is person-led work, scoped and quoted before it starts."
  );
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function invalidParamsError(id, violations) {
  return jsonRpcError(id, -32602, "Invalid parameters", [
    {
      "@type": "type.googleapis.com/google.rpc.BadRequest",
      fieldViolations: violations
    }
  ]);
}

function versionNotSupportedError(id, requestedVersion) {
  return jsonRpcError(id, -32009, "A2A protocol version not supported", [
    {
      "@type": "type.googleapis.com/google.rpc.ErrorInfo",
      reason: "VERSION_NOT_SUPPORTED",
      domain: "a2a-protocol.org",
      metadata: {
        requestedVersion: requestedVersion || "invalid",
        supportedVersions: A2A_PROTOCOL_VERSION
      }
    }
  ]);
}

function v1SendMessageResponse(task) {
  return {
    task: {
      ...task,
      contextId: task.contextId || crypto.randomUUID()
    }
  };
}

async function _handleJsonRpcInner(payload, request, env = {}, ctx = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonRpcError(null, -32600, "Request payload validation error");
  }

  const id = payload.id ?? null;
  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(id, -32600, "Request payload validation error");
  }

  const version = requestedA2aVersion(request, payload);
  if (
    version === null ||
    (version !== A2A_PROTOCOL_VERSION && version !== A2A_LEGACY_PROTOCOL_VERSION)
  ) {
    return versionNotSupportedError(id, version || request.headers.get("a2a-version"));
  }

  const isV1SendMessage = V1_MESSAGE_SEND_METHODS.has(payload.method);
  const isLegacySendMessage = LEGACY_MESSAGE_SEND_METHODS.has(payload.method);
  const methodMatchesVersion =
    (version === A2A_PROTOCOL_VERSION && isV1SendMessage) ||
    (version === A2A_LEGACY_PROTOCOL_VERSION && isLegacySendMessage);

  if ((isV1SendMessage || isLegacySendMessage) && methodMatchesVersion) {
    if (isV1SendMessage) {
      const violations = v1MessageViolations(payload.params);
      if (violations.length) return invalidParamsError(id, violations);
    }
    const params = payload.params ?? {};
    const profile = agentProfile(request, env);
    const { result, promptChars, structuredChars, modulesUsed } = await runProfileRequest(profile, params, request, env);
    const likelyProbe =
      classifyClient(request) === "agenstry" || promptChars < PROBE_PROMPT_CHAR_THRESHOLD;
    const event = logUsageEvent(request, {
      jsonrpc_method: payload.method,
      jsonrpc_id_present: payload.id !== undefined,
      agent_profile: result.metadata.product_profile,
      prompt_chars: promptChars,
      structured_chars: structuredChars,
      modules_used: modulesUsed,
      live_retrieval: billableUpstreamCost(result),
      likely_probe: likelyProbe,
      outcome: callOutcome(result)
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
      result: isV1SendMessage ? v1SendMessageResponse(result) : result
    };
  }

  if (payload.method === "GetExtendedAgentCard") {
    return jsonRpcError(id, -32004, "Operation not supported", [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "UNSUPPORTED_OPERATION",
        domain: "a2a-protocol.org"
      }
    ]);
  }

  if (
    version === A2A_LEGACY_PROTOCOL_VERSION &&
    (payload.method === "agent/card" || payload.method === "agentCard")
  ) {
    return {
      jsonrpc: "2.0",
      id,
      result: toSpecWireCard(agentCard(request, env))
    };
  }

  return jsonRpcError(id, -32601, "Method not found", {
    supported_methods:
      version === A2A_PROTOCOL_VERSION
        ? ["SendMessage"]
        : ["message/send", "tasks/send", "agent/card"]
  });
}

function mcpServerIdentity() {
  return { name: "agenda-intelligence-md", version: VERSION };
}

function mcpResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      ...result,
      // Required since 2026-07-28. This server never returns the
      // "input_required" interim result: triage is a pure function of the
      // supplied evidence, so it never has to stop and ask the human mid-call.
      resultType: "complete",
      _meta: { [MCP_META_SERVER_INFO]: mcpServerIdentity() }
    }
  };
}

function mcpRequestedProtocolVersion(params) {
  const meta = params && typeof params === "object" ? params._meta : null;
  if (meta && typeof meta === "object" && typeof meta[MCP_META_PROTOCOL_VERSION] === "string") {
    return meta[MCP_META_PROTOCOL_VERSION];
  }
  return null;
}

function mcpTaskFailed(result) {
  return result?.status?.state === "TASK_STATE_FAILED";
}

function mcpPayloadForResult(result) {
  if (!result || typeof result !== "object") {
    return { error: "EMPTY_TOOL_RESULT", message: "The worker returned no result." };
  }
  if (mcpTaskFailed(result)) {
    return {
      error: "INVALID_TOOL_INPUT",
      message: "The supplied arguments do not satisfy this tool's input contract.",
      details: result.metadata?.errors || result.metadata?.required_fields || []
    };
  }
  if (result.metadata?.response && typeof result.metadata.response === "object") {
    return result.metadata.response;
  }
  for (const artifact of result.artifacts || []) {
    for (const part of artifact.parts || []) {
      if (part?.data && typeof part.data === "object") return part.data;
    }
  }
  return {
    status: result.status?.state || "TASK_STATE_COMPLETED",
    product_profile: result.metadata?.product_profile || "unknown"
  };
}

function mcpResultSummary(payload, isError) {
  if (isError) {
    return `${payload.error || "TOOL_ERROR"}: ${payload.message || "The tool could not complete the request."}`;
  }
  const fields = [
    "verdict",
    "decision",
    "reason_code",
    "triage_recommendation",
    "gate_decision",
    "risk_signal",
    "secondary_exposure_signal",
    "exposure_signal",
    "trust_signal",
    "readiness_score",
    "decision_readiness_score",
    "readiness_label",
    "decision_readiness_label",
    "human_review_required"
  ];
  const values = fields
    .filter((field) => ["string", "number", "boolean"].includes(typeof payload[field]))
    .map((field) => `${field}=${payload[field]}`);
  return `${values.join("; ") || "Tool call completed"}. See structuredContent for the complete result.`;
}

function mcpToolResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: mcpResultSummary(payload, isError) }],
    structuredContent: payload,
    isError
  };
}

function mcpLegacyToolResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError
  };
}

// Streamable HTTP MCP, stateless. No session id, no initialize handshake, no
// resumable stream — every request stands alone, which is the only reason this
// fits on a Worker at all.
async function handleMcpJsonRpc(payload, request, env = {}, ctx = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonRpcError(null, -32600, "Invalid Request");
  }
  const id = payload.id ?? null;
  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(id, -32600, "Invalid Request");
  }

  const params = payload.params ?? {};
  const requestedVersion = mcpRequestedProtocolVersion(params);
  if (requestedVersion && !MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)) {
    return jsonRpcError(id, MCP_UNSUPPORTED_PROTOCOL_VERSION, `Unsupported protocol version: ${requestedVersion}`, {
      supported: [...MCP_SUPPORTED_PROTOCOL_VERSIONS]
    });
  }

  const profile = agentProfile(request, env);

  if (payload.method === "notifications/initialized") return null;

  if (payload.method === "server/discover") {
    return mcpResponse(id, {
      protocolVersions: [...MCP_SUPPORTED_PROTOCOL_VERSIONS],
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        prompts: { listChanged: false }
      },
      serverInfo: mcpServerIdentity(),
      instructions: profileInstructions(profile)
    });
  }

  // Removed from the protocol in 2026-07-28, still answered for clients that
  // have not moved. There is no session to create, so this costs nothing.
  if (payload.method === "initialize") {
    const echoed = typeof params.protocolVersion === "string" ? params.protocolVersion : MCP_PROTOCOL_VERSION;
    return mcpResponse(id, {
      protocolVersion: echoed,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        prompts: { listChanged: false }
      },
      serverInfo: mcpServerIdentity(),
      instructions: profileInstructions(profile)
    });
  }

  if (payload.method === "ping") return mcpResponse(id, {});

  if (payload.method === "resources/list") {
    return mcpResponse(id, {
      resources: mcpResourcesList()
    });
  }

  if (payload.method === "resources/read") {
    const uri = params.uri;
    if (typeof uri !== "string") {
      return jsonRpcError(id, -32602, "resources/read requires a string uri parameter");
    }
    const resource = mcpResourceRead(uri);
    if (!resource) {
      return jsonRpcError(id, -32602, `Resource not found: ${uri}`);
    }
    return mcpResponse(id, {
      contents: [resource]
    });
  }

  if (payload.method === "prompts/list") {
    return mcpResponse(id, {
      prompts: mcpPromptsList()
    });
  }

  if (payload.method === "prompts/get") {
    const name = params.name;
    if (typeof name !== "string") {
      return jsonRpcError(id, -32602, "prompts/get requires a string name parameter");
    }
    const prompt = mcpPromptGet(name, params.arguments || {});
    if (!prompt) {
      return jsonRpcError(id, -32602, `Prompt not found: ${name}`);
    }
    return mcpResponse(id, prompt);
  }

  if (payload.method === "tools/list") {
    return mcpResponse(id, {
      tools: mcpToolsForProfile(profile),
      ttlMs: MCP_TOOL_LIST_TTL_MS,
      cacheScope: MCP_TOOL_LIST_CACHE_SCOPE
    });
  }

  if (payload.method === "tools/call") {
    const name = params.name;
    if (typeof name !== "string") {
      return jsonRpcError(id, -32602, "tools/call requires a string tool name");
    }
    const spec = mcpToolSpecForProfile(profile, name);
    if (!spec) {
      const available = mcpToolsForProfile(profile).map((tool) => tool.name);
      return mcpResponse(id, mcpToolResult({ error: `Unknown tool: ${name}`, available }, true));
    }
    const toolArguments = params.arguments ?? {};
    const legacyRequestWrapper = mcpUsesLegacyRequestWrapper(profile, toolArguments, name);
    const callParams = mcpArgumentsToParams(profile, toolArguments, name);
    const { result, promptChars, structuredChars, modulesUsed } = await runProfileRequest(profile, callParams, request, env);
    const event = logUsageEvent(request, {
      jsonrpc_method: "tools/call",
      jsonrpc_id_present: payload.id !== undefined,
      agent_profile: result.metadata.product_profile,
      prompt_chars: promptChars,
      structured_chars: structuredChars,
      modules_used: modulesUsed,
      live_retrieval: billableUpstreamCost(result),
      likely_probe: classifyClient(request) === "agenstry" || promptChars < PROBE_PROMPT_CHAR_THRESHOLD,
      outcome: callOutcome(result)
    });
    const statsPromise = recordUsageStats(env, event).catch((error) => {
      console.warn("usage stats write failed", error);
    });
    if (typeof ctx.waitUntil === "function") ctx.waitUntil(statsPromise);
    if (legacyRequestWrapper) {
      return mcpResponse(id, mcpLegacyToolResult(result, Boolean(result.error)));
    }
    const toolPayload = mcpPayloadForResult(result);
    return mcpResponse(id, mcpToolResult(toolPayload, mcpTaskFailed(result) || Boolean(result.error)));
  }

  return jsonRpcError(id, -32601, "Method not found", {
    supported_methods: [
      "server/discover",
      "tools/list",
      "tools/call",
      "resources/list",
      "resources/read",
      "prompts/list",
      "prompts/get"
    ]
  });
}

function mcpResourcesList() {
  return [
    {
      uri: "agenda://manifest",
      name: "Agenda Manifest",
      description: "Public manifest of Agenda Intelligence tools, schemas, and capabilities",
      mimeType: "application/json"
    },
    {
      uri: "agenda://protocol/core",
      name: "Agenda Protocol Core",
      description: "Core protocol principles and verification boundary rules",
      mimeType: "text/markdown"
    },
    {
      uri: "agenda://schemas/v1/middle-corridor-deal-risk-request",
      name: "Middle Corridor Deal Risk Request Schema",
      description: "JSON schema for Middle Corridor deal-risk requests",
      mimeType: "application/json"
    },
    {
      uri: "agenda://schemas/v1/cis-secondary-sanctions-request",
      name: "CIS Secondary Sanctions Request Schema",
      description: "JSON schema for CIS secondary sanctions requests",
      mimeType: "application/json"
    },
    {
      uri: "agenda://schemas/v1/critical-minerals-due-diligence-request",
      name: "Critical Minerals Due Diligence Request Schema",
      description: "JSON schema for Critical Minerals due diligence requests",
      mimeType: "application/json"
    },
    {
      uri: "agenda://schemas/v1/pre-action-check-request",
      name: "Pre-Action Check Request Schema",
      description: "JSON schema for pre-action check requests",
      mimeType: "application/json"
    }
  ];
}

function mcpResourceRead(uri) {
  if (uri === "agenda://manifest") {
    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(
        {
          schema_version: "v1",
          version: VERSION,
          product: "Agenda Intelligence MD",
          documentation_url: REPOSITORY_URL
        },
        null,
        2
      )
    };
  }
  if (uri === "agenda://protocol/core") {
    return {
      uri,
      mimeType: "text/markdown",
      text: [
        "# Agenda Intelligence Core Protocol",
        "",
        "1. Deterministic evidence triage over probabilistic guessing.",
        "2. Structure validation before policy evaluation.",
        "3. Mandatory human review on high-stakes routing.",
        "4. Content-provenance and reproducibility on all outputs."
      ].join("\n")
    };
  }
  if (uri.startsWith("agenda://schemas/v1/")) {
    const schemaName = uri.replace("agenda://schemas/v1/", "");
    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(
        {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          title: schemaName,
          description: `Agenda Intelligence schema for ${schemaName}`
        },
        null,
        2
      )
    };
  }
  return null;
}

function mcpPromptsList() {
  return [
    {
      name: "draft_evidence_memo",
      description: "Draft a structured evidence-backed analysis memo for review",
      arguments: [
        { name: "topic", description: "Subject matter of the memo", required: true },
        { name: "evidence_summary", description: "Summary of available evidence", required: false }
      ]
    },
    {
      name: "self_correct_packet",
      description: "Generate instructions to repair an evidence packet with gaps",
      arguments: [
        { name: "packet_json", description: "Current evidence packet JSON", required: true },
        { name: "diagnostics_json", description: "Audit or verification failure details", required: false }
      ]
    },
    {
      name: "audit_evidence_claims",
      description: "Audit claims against cited evidence sources",
      arguments: [
        { name: "claims_text", description: "Extracted claims to audit", required: true },
        { name: "sources_text", description: "Source text to verify against", required: true }
      ]
    }
  ];
}

function mcpPromptGet(name, args = {}) {
  if (name === "draft_evidence_memo") {
    const topic = args.topic || "[TOPIC]";
    const summary = args.evidence_summary || "";
    return {
      description: `Draft an evidence memo for: ${topic}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `# Drafting Task: Evidence-Backed Memo on "${topic}"`,
              "",
              "Please draft a structured, decision-grade memo backed by verifiable evidence citations.",
              summary ? `Available evidence summary: ${summary}` : "",
              "",
              "Requirements:",
              "- Every factual assertion must cite a verifiable source in the evidence ledger.",
              "- Explicitly distinguish confirmed facts from analyst assumptions.",
              "- Identify remaining evidence gaps before human sign-off."
            ]
              .filter(Boolean)
              .join("\n")
          }
        }
      ]
    };
  }
  if (name === "self_correct_packet") {
    const packet = args.packet_json || "{}";
    const diag = args.diagnostics_json || "";
    return {
      description: "Repair and complete evidence packet",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "# Evidence Packet Self-Correction Task",
              "",
              "Review the following evidence packet and diagnostics to close evidence gaps:",
              `Packet: ${packet}`,
              diag ? `Diagnostics: ${diag}` : "",
              "",
              "Please output the corrected evidence packet JSON with all cited evidence IDs resolved."
            ]
              .filter(Boolean)
              .join("\n")
          }
        }
      ]
    };
  }
  if (name === "audit_evidence_claims") {
    const claims = args.claims_text || "";
    const sources = args.sources_text || "";
    return {
      description: "Audit claims against sources",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "# Audit Claims Against Sources",
              "",
              "Audit each claim against the provided sources and classify support level:",
              `Claims:\n${claims}`,
              "",
              `Sources:\n${sources}`,
              "",
              "Classify each claim as supported, weakly_supported, or unsupported."
            ].join("\n")
          }
        }
      ]
    };
  }
  return null;
}

function profileInstructions(profile) {
  const names = mcpToolsForProfile(profile).map((tool) => tool.name).join(" or ");
  return (
    `Call ${names} with the structured evidence you already hold. ` +
    "It reports what the file is missing before human review; it does not retrieve sources or decide the outcome."
  );
}

async function handleMcpPost(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse(jsonRpcError(null, -32700, "Parse error"), 200);
  }
  // tools/call is the production route, so it inherits the same access gate and
  // throttle as message/send. Discovery and listing stay open, like agent/card.
  if (payload && typeof payload === "object" && payload.method === "tools/call") {
    const profile = agentProfile(request, env);
    if (!isProductionAuthorized(request, env, profile)) {
      return jsonResponse(
        jsonRpcError(payload.id ?? null, -32001, "Unauthorized: the production route requires a valid Bearer access key", {
          security_scheme: "productionBearer",
          profile
        }),
        401,
        { "www-authenticate": "Bearer", "cache-control": "no-store" }
      );
    }
    const rate = await checkRateLimit(request, env, profile);
    if (rate.limited) {
      return jsonResponse(
        jsonRpcError(payload.id ?? null, -32002, "Rate limit exceeded: too many requests from this client.", {
          limit_per_hour: rate.limit,
          profile
        }),
        429,
        { "retry-after": "3600", "cache-control": "no-store" }
      );
    }
  }
  const response = await handleMcpJsonRpc(payload, request, env, ctx);
  if (response === null) return new Response(null, { status: 202 });
  return jsonResponse(response, 200, { "cache-control": "no-store" });
}

// Single dispatch from a deployed profile to its triage result. Shared by the
// A2A message/send route and the MCP tools/call route so the two transports
// cannot drift into different verdicts for the same payload.
// What the caller actually sent, in characters, independent of whether this
// profile could parse it.
//
// Every branch of runProfileRequest below measures the request after its own
// schema has had a go at it, so a question a gate cannot use measures zero. On
// 2026-08-24..26 that recorded AgenstryBot's four-character plain-text probe as
// `prompt_chars: 0` on the five structured gates and as 4 on the three
// conversational endpoints — the same request, two answers — and it is why a
// failing outcome column, read without a payload column, was misread as a
// protocol bug for a day.
//
// The consequence that matters is not the reporting. `likely_probe` is derived
// from this number, and the archive keeps whole rows only for non-probes, so a
// real question written in prose to a gate would be labelled a probe and its
// row never kept: the caller most worth reading about is the one the record
// throws away. No such caller appears in the 2026-08-25..27 raw window — the
// largest external body was 1,492 bytes and was measured correctly — so this
// corrects the instrument rather than recovering anything lost.
//
// Two shapes reach here: an A2A message with parts, and MCP tool arguments.
// Both are the caller's content with the protocol envelope removed.
function receivedChars(params) {
  if (!params || typeof params !== "object") return 0;

  const parts = params.message && Array.isArray(params.message.parts) ? params.message.parts : null;
  if (parts) {
    return parts.reduce((total, part) => {
      if (!part || typeof part !== "object") return total;
      if (typeof part.text === "string") return total + part.text.length;
      if (typeof part.raw === "string") return total + part.raw.length;
      if (typeof part.url === "string") return total + part.url.length;
      if (part.data !== undefined) return total + safeJsonLength(part.data);
      return total;
    }, 0);
  }

  // MCP tools/call, where the arguments are the content.
  return safeJsonLength(params);
}

// A caller can send a structure this cannot stringify — a cycle is the usual
// one. Measuring zero would put such a request back in the bucket this function
// exists to empty, so an unmeasurable body counts as present rather than absent.
function safeJsonLength(value) {
  try {
    const text = JSON.stringify(value);
    return typeof text === "string" ? text.length : 0;
  } catch {
    return PROBE_PROMPT_CHAR_THRESHOLD;
  }
}

async function runProfileRequest(profile, params, request, env = {}) {
  {
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
    } else if (profile === "agent_output_verification") {
      if (params.capability === "decision_policies_list") {
        result = a2aResultForDecisionPoliciesList(params);
        promptChars = 0;
        modulesUsed = ["decision_gate"];
      } else if (params.capability === "decision_check") {
        result = await a2aResultForDecisionCheck(params, request, env);
        const structured = structuredAgentOutputVerificationRequestFromParams(params);
        promptChars =
          structured && Array.isArray(structured.claims)
            ? structured.claims.reduce((total, claim) => total + String((claim && claim.claim) || "").length, 0)
            : 0;
        modulesUsed = ["agent_output_verification", "decision_gate"];
      } else if (params.capability === "decision_verify") {
        result = await a2aResultForDecisionVerify(params, request, env);
        promptChars = String((params.request && params.request.receipt) || "").length;
        modulesUsed = ["decision_gate"];
      } else {
        result = a2aResultForAgentOutputVerification(params);
        const structured = structuredAgentOutputVerificationRequestFromParams(params);
        promptChars =
          structured && Array.isArray(structured.claims)
            ? structured.claims.reduce((total, claim) => total + String((claim && claim.claim) || "").length, 0)
            : 0;
        modulesUsed = ["agent_output_verification"];
      }
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
    } else if (profile === "critical_minerals_due_diligence") {
      result = a2aResultForCriticalMinerals(params);
      const structured = structuredCriticalMineralsRequestFromParams(params);
      promptChars = structured && structured.decision_question ? structured.decision_question.length : 0;
      modulesUsed = ["critical_minerals_due_diligence"];
    } else if (profile === "dual_use_technology_export") {
      result = a2aResultForDualUseTechnologyExport(params);
      const structured = structuredDualUseTechnologyExportRequestFromParams(params);
      promptChars = structured && structured.risk_question ? structured.risk_question.length : 0;
      modulesUsed = ["dual_use_technology_export"];
    } else if (profile === "corridor_sanctions_assistant") {
      result = a2aResultForCorridorSanctionsAssistant(params);
      promptChars = extractText(params).length;
      modulesUsed = ["corridor_sanctions_assistant"];
    } else {
      result = a2aResult(params, request, env);
      const structuredRequest = structuredDealRiskRequestFromParams(params);
      const text = structuredRequest ? textFromStructuredDealRiskRequest(structuredRequest) : extractText(params);
      promptChars = text.length;
      modulesUsed = result.metadata.modules_used;
    }
    // promptChars above is what this profile could parse. receivedChars is what
    // arrived. Both are reported, because the difference between them is the
    // signal that a caller sent something the gate could not read.
    return {
      result: withEngagementOffer(result, profile, request),
      promptChars: receivedChars(params),
      structuredChars: promptChars,
      modulesUsed
    };
  }
}

// The offer is attached here, at the one point every profile passes through,
// rather than inside each result builder.
//
// Per builder it would be seven edits now and an eighth one forgotten when the
// next profile ships. Here a new profile cannot ship without it. Two rules keep
// it from firing where it does not belong: only a completed task gets an offer,
// because the failure paths already carry `support_contact` and a caller whose
// request did not parse needs a different next step than one whose file is
// merely short of evidence; and a result that already carries an engagement —
// the base profile builds its own into the routing note, the corridor assistant
// into its orientation payload — is left exactly as it is.
function withEngagementOffer(result, profile, request) {
  if (!result || result.status?.state !== "TASK_STATE_COMPLETED") return result;
  if (hasEngagement(result)) return result;
  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  const engagement = engagementBlock(request, {
    profile,
    response: engagementResponsePayload(result, artifacts)
  });
  return {
    ...result,
    artifacts: artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, parts: partsWithEngagement(artifact.parts, engagement) } : artifact
    ),
    metadata: { ...(result.metadata || {}), engagement }
  };
}

function hasEngagement(result) {
  if (result.metadata && result.metadata.engagement) return true;
  return Boolean(result.metadata && result.metadata.response && result.metadata.response.engagement);
}

// The offer may only name items the caller can also see, so it reads the same
// payload the JSON part carries.
function engagementResponsePayload(result, artifacts) {
  if (result.metadata && result.metadata.response) return result.metadata.response;
  for (const artifact of artifacts) {
    for (const part of Array.isArray(artifact.parts) ? artifact.parts : []) {
      if (part && part.mediaType === "application/json" && part.data) return part.data;
    }
  }
  return null;
}

function partsWithEngagement(parts, engagement) {
  if (!Array.isArray(parts)) return parts;
  let stamped = false;
  return parts.map((part) => {
    if (stamped || !part || part.mediaType !== "text/markdown" || typeof part.text !== "string") return part;
    stamped = true;
    return { ...part, text: `${part.text}\n${engagementMarkdown(engagement)}` };
  });
}

async function handlePost(request, env, ctx) {
  const startedAt = Date.now();
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const error = jsonRpcError(null, -32005, "Content type not supported", [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "CONTENT_TYPE_NOT_SUPPORTED",
        domain: "a2a-protocol.org",
        metadata: { expected: "application/json" }
      }
    ]);
    logProtocolEvent(request, env, null, null, error, startedAt);
    return jsonResponse(error, 415);
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_RPC_BODY_BYTES) {
    const error = invalidParamsError(null, [
      {
        field: "body",
        description: `JSON-RPC body exceeds ${MAX_JSON_RPC_BODY_BYTES} bytes`
      }
    ]);
    logProtocolEvent(request, env, null, null, error, startedAt);
    return jsonResponse(error, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_JSON_RPC_BODY_BYTES) {
    const error = invalidParamsError(null, [
      {
        field: "body",
        description: `JSON-RPC body exceeds ${MAX_JSON_RPC_BODY_BYTES} bytes`
      }
    ]);
    logProtocolEvent(request, env, null, null, error, startedAt);
    return jsonResponse(error, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_error) {
    const error = jsonRpcError(null, -32700, "Invalid JSON payload");
    logProtocolEvent(request, env, null, null, error, startedAt);
    return jsonResponse(error, 200);
  }
  const method = payload && typeof payload === "object" ? payload.method : null;
  if (MESSAGE_SEND_METHODS.has(method)) {
    const profile = agentProfile(request, env);
    if (!isProductionAuthorized(request, env, profile)) {
      const error = jsonRpcError(
          payload.id ?? null,
          -32001,
          "Unauthorized: the production route requires a valid Bearer access key",
          { security_scheme: "productionBearer", profile }
      );
      logProtocolEvent(request, env, payload.id, method, error, startedAt);
      return jsonResponse(error, 401, {
        "www-authenticate": "Bearer",
        "cache-control": "no-store"
      });
    }
    const rate = await checkRateLimit(request, env, profile);
    if (rate.limited) {
      const error = jsonRpcError(
          payload.id ?? null,
          -32002,
          "Rate limit exceeded: too many requests from this client. Request API access for higher limits.",
          { limit_per_hour: rate.limit, profile }
      );
      logProtocolEvent(request, env, payload.id, method, error, startedAt);
      return jsonResponse(error, 429, {
        "retry-after": "3600",
        "cache-control": "no-store"
      });
    }
  }
  const response = await handleJsonRpc(payload, request, env, ctx);
  logProtocolEvent(request, env, payload?.id, method, response, startedAt);
  return jsonResponse(response);
}

function logProtocolEvent(request, env, requestId, method, response, startedAt) {
  const safeRequestId =
    typeof requestId === "string" || typeof requestId === "number"
      ? String(requestId).slice(0, 80)
      : null;
  console.log(
    JSON.stringify({
      event: "a2a_jsonrpc",
      worker: agentProfile(request, env),
      request_id: safeRequestId,
      method: typeof method === "string" ? method.slice(0, 80) : null,
      success: Boolean(response && !response.error),
      protocol_error_code: response?.error?.code ?? null,
      latency_ms: Math.max(0, Date.now() - startedAt)
    })
  );
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

function normalizedIntakeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validIntakeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function hexBytes(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function cisReviewEmailSignature(secret, timestamp, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hexBytes(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`)));
}

async function sendCisReviewEmailNotification(record, env, fetcher = fetch) {
  const webhookUrl = normalizedIntakeText(env?.CIS_REVIEW_EMAIL_WEBHOOK_URL, 1000);
  const webhookSecret = normalizedIntakeText(env?.CIS_REVIEW_EMAIL_WEBHOOK_SECRET, 500);
  if (!webhookUrl || !webhookSecret) return { sent: false, reason: "not_configured" };

  let endpoint;
  try {
    endpoint = new URL(webhookUrl);
  } catch (_error) {
    return { sent: false, reason: "invalid_url" };
  }
  if (endpoint.protocol !== "https:" || endpoint.hostname !== "script.google.com") {
    return { sent: false, reason: "invalid_url" };
  }

  try {
    const payload = JSON.stringify({
      event: "cis_review_request_received",
      request: record
    });
    const timestamp = String(Date.now());
    const signature = await cisReviewEmailSignature(webhookSecret, timestamp, payload);
    const response = await fetcher(endpoint.href, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timestamp, payload, signature }),
      redirect: "follow",
      signal: AbortSignal.timeout(8000)
    });
    const responseBody = await response.text();
    if (!response.ok || responseBody.trim() !== "OK") {
      throw new Error(`notification rejected with ${response.status}`);
    }
    console.log(
      JSON.stringify({
        event: "cis_review_email_notification",
        request_id: record.request_id,
        status: "sent"
      })
    );
    return { sent: true, reason: null };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "cis_review_email_notification",
        request_id: record.request_id,
        status: "failed",
        error_type: error instanceof Error ? error.name : "Error"
      })
    );
    return { sent: false, reason: "delivery_failed" };
  }
}

async function checkIntakeRateLimit(request, env) {
  const kv = env?.AGENDA_USAGE;
  if (!kv) return { limited: false, limit: 5 };
  const ip = clientIpFromRequest(request);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const token = [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const hour = new Date().toISOString().slice(0, 13);
  const key = `rate:cis-review-intake:${token}:${hour}`;
  try {
    const current = Number.parseInt((await kv.get(key)) || "0", 10) || 0;
    if (current >= 5) return { limited: true, limit: 5 };
    await kv.put(key, String(current + 1), { expirationTtl: 7200 });
    return { limited: false, limit: 5 };
  } catch (_error) {
    return { limited: false, limit: 5 };
  }
}

async function handleCisReviewIntake(request, env, ctx, notificationFetcher = fetch) {
  const headers = intakeCorsHeaders(request);
  if (agentProfile(request, env) !== "cis_secondary_sanctions") {
    return jsonResponse({ error: "Not found" }, 404, headers);
  }
  if (!isAllowedIntakeOrigin(request)) {
    return jsonResponse({ error: "Origin is not allowed" }, 403, headers);
  }
  if (!env.AGENDA_USAGE || typeof env.AGENDA_USAGE.put !== "function") {
    return jsonResponse({ error: "Intake storage is unavailable" }, 503, headers);
  }
  const rate = await checkIntakeRateLimit(request, env);
  if (rate.limited) {
    return jsonResponse({ error: "Too many requests. Try again in one hour." }, 429, {
      ...headers,
      "retry-after": "3600"
    });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > CIS_REVIEW_INTAKE_MAX_BYTES) {
    return jsonResponse({ error: "Request is too large" }, 413, headers);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse({ error: "Request must be valid JSON" }, 400, headers);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ error: "Request must be a JSON object" }, 400, headers);
  }
  if (JSON.stringify(payload).length > CIS_REVIEW_INTAKE_MAX_BYTES) {
    return jsonResponse({ error: "Request is too large" }, 413, headers);
  }

  const requestId = crypto.randomUUID();
  if (normalizedIntakeText(payload.website, 200)) {
    return jsonResponse({ received: true, request_id: requestId }, 202, headers);
  }

  const email = normalizedIntakeText(payload.email, 254);
  const roleDealType = normalizedIntakeText(payload.role_deal_type, 240);
  const blocked = normalizedIntakeText(payload.blocked, 120);
  const evidenceHeld = normalizedIntakeText(payload.evidence_held, 1800);
  const reviewerRequest = normalizedIntakeText(payload.reviewer_request, 1800);
  const deadline = normalizedIntakeText(payload.deadline, 240);
  const locale = payload.locale === "ru" ? "ru" : "en";
  const errors = [];
  if (!validIntakeEmail(email)) errors.push("email must be a valid work email");
  if (!roleDealType) errors.push("role_deal_type is required");
  if (!blocked) errors.push("blocked is required");
  if (!reviewerRequest) errors.push("reviewer_request is required");
  if (payload.consent !== true) errors.push("consent is required");
  if (errors.length) {
    return jsonResponse({ error: "Invalid intake", fields: errors }, 422, headers);
  }

  const submittedAt = new Date().toISOString();
  const retentionUntil = new Date(Date.now() + CIS_REVIEW_INTAKE_RETENTION_SECONDS * 1000).toISOString();
  const key = `intake:cis-review:${submittedAt.slice(0, 10).replaceAll("-", "")}:${requestId}`;
  const record = {
    schema_version: "1.0",
    request_id: requestId,
    submitted_at: submittedAt,
    retention_until: retentionUntil,
    locale,
    email,
    role_deal_type: roleDealType,
    blocked,
    evidence_held: evidenceHeld,
    reviewer_request: reviewerRequest,
    deadline,
    source: "cis-secondary-sanctions-service-page"
  };
  await env.AGENDA_USAGE.put(key, JSON.stringify(record), {
    expirationTtl: CIS_REVIEW_INTAKE_RETENTION_SECONDS
  });

  const notification = sendCisReviewEmailNotification(record, env, notificationFetcher);
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(notification);
  } else {
    await notification;
  }

  return jsonResponse(
    {
      received: true,
      request_id: requestId,
      retention_until: retentionUntil,
      response_window: "one business day"
    },
    201,
    headers
  );
}

async function handleCisReviewIntakeList(request, env) {
  const headers = intakeCorsHeaders(request);
  if (agentProfile(request, env) !== "cis_secondary_sanctions") {
    return jsonResponse({ error: "Not found" }, 404, headers);
  }
  if (!isStatsAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401, headers);
  }
  if (!env.AGENDA_USAGE || typeof env.AGENDA_USAGE.list !== "function") {
    return jsonResponse({ error: "Intake storage is unavailable" }, 503, headers);
  }
  const listed = await env.AGENDA_USAGE.list({ prefix: "intake:cis-review:", limit: 50 });
  const records = (
    await Promise.all(
      listed.keys.map(async ({ name }) => {
        const value = await env.AGENDA_USAGE.get(name);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch (_error) {
          return null;
        }
      })
    )
  )
    .filter(Boolean)
    .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at));
  return jsonResponse({ count: records.length, records }, 200, headers);
}

function healthInfo(request, env) {
  const card = agentCard(request, env);
  const origin = originFromRequest(request);
  return {
    ok: true,
    name: card.name,
    // Some directories register the origin root as the card URL and never
    // follow the agent_card link below. Observed 2026-08-14 on
    // agent-tools.cloud: two of the listed workers had card_url set to the
    // root, so their public entries carried a name, a version and nothing
    // else — no description, no provider, no skills — while the one entry
    // whose card_url pointed at /.well-known/agent-card.json read correctly.
    // Repeating the descriptive fields here costs a few hundred bytes and
    // makes the root usable by a crawler that stops at it.
    description: card.description,
    provider: card.provider,
    documentation_url: card.documentationUrl,
    skills: (card.skills || []).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description
    })),
    version: VERSION,
    profile: agentProfile(request, env),
    ai_catalog: `${origin}/.well-known/ai-catalog.json`,
    agent_card: `${origin}/.well-known/agent-card.json`,
    mcp_server_card: `${origin}/.well-known/mcp/server-card.json`,
    did: `${origin}/.well-known/did.json`,
    api_catalog: `${origin}/.well-known/api-catalog`,
    openapi: `${origin}/api/openapi.json`,
    entitymap: `${origin}/entitymap.json`,
    okf_bundle: okfUrl(origin),
    confidential_project_room_profile: confidentialProjectRoomUrl(origin),
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
    a2a_protocol_version: agentCardProtocolVersion(card),
    ai_catalog_url: `${origin}/.well-known/ai-catalog.json`,
    agent_card_url: `${origin}/.well-known/agent-card.json`,
    mcp_server_card_url: `${origin}/.well-known/mcp/server-card.json`,
    did_url: `${origin}/.well-known/did.json`,
    api_catalog_url: `${origin}/.well-known/api-catalog`,
    openapi_url: `${origin}/api/openapi.json`,
    entitymap_url: `${origin}/entitymap.json`,
    okf_bundle_url: okfUrl(origin),
    confidential_project_room_profile_url: confidentialProjectRoomUrl(origin),
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
        "Per ADR 0014 / ADR 0020, live retrieval upstreams are declared but not activated in this environment. Set SNAPSHOT_INDEX_URL ($0 static snapshot), WATCHMAN_URL (free self-host of moov-io/watchman), or OPENSANCTIONS_API_KEY (paid €0.10/call) to activate. Profile currently operates on user-supplied evidence only.";
    }
  }
  return status;
}

function robotsTxt(request) {
  const origin = originFromRequest(request);
  return [
    "User-agent: *",
    "Allow: /",
    "Content-Signal: ai-train=no, search=yes, ai-input=yes",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    `Agentmap: ${origin}/.well-known/ai-catalog.json`
  ].join("\n");
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
  -H 'A2A-Version: 1.0' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "SendMessage",
    "params": {
      "message": {
        "messageId": "message-demo-1",
        "role": "ROLE_USER",
        "parts": [
          { "text": "Screen Kazakhstan Middle Corridor sanctions exposure for a logistics route." }
        ]
      }
    }
  }'`
    : isAgentic
      ? `curl -X POST ${origin}/message/send \\
  -H 'content-type: application/json' \\
  -H 'A2A-Version: 1.0' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "agentic-demo-1",
    "method": "SendMessage",
    "params": {
      "message": {
        "messageId": "message-agentic-demo-1",
        "role": "ROLE_USER",
        "parts": [{"data": {
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
        }}]
      }
    }
  }'`
    : `curl -X POST ${origin}/message/send \\
  -H 'content-type: application/json' \\
  -H 'A2A-Version: 1.0' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "SendMessage",
    "params": {
      "message": {
        "messageId": "message-demo-1",
        "role": "ROLE_USER",
        "parts": [
          { "text": "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure." }
        ]
      }
    }
  }'`;

  const flagshipBlock = isKazakhstan
    ? `<p>This worker is a live Kazakhstan / Middle Corridor Deal Risk Gate demo. It accepts route + cargo + counterparties + dated sources and returns an auditable triage with evidence gaps, missing source categories, decision-readiness score, and a three-value recommendation (insufficient_information, pre_signature_escalate, ready_for_human_review). It has no paying customers yet; usage is illustrative. Human review is required before any commercial action.</p>`
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
<link rel="ai-catalog" href="${origin}/.well-known/ai-catalog.json">
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
    <span class="badge">A2A ${escapeHtml(agentCardProtocolVersion(card))}</span>
    <span class="badge">Profile: ${escapeHtml(profile)}</span>
  </div>

  <h2>What this is</h2>
  ${flagshipBlock}
  <p><strong>Not</strong> legal, compliance, sanctions, financial, investment, or insurance advice. <strong>Not</strong> a factuality verifier — schemas enforce structure, not truth. <strong>No</strong> autonomous live source retrieval.</p>

  <h2>Try it (curl)</h2>
  <pre>${escapeHtml(tryItCurl)}</pre>

  <h2>Endpoints</h2>
  <ul class="endpoints">
    <li><span class="label">AI catalog:</span> <a href="${origin}/.well-known/ai-catalog.json">/.well-known/ai-catalog.json</a></li>
    <li><span class="label">Agent card:</span> <a href="${origin}/.well-known/agent-card.json">/.well-known/agent-card.json</a></li>
    <li><span class="label">MCP card:</span> <a href="${origin}/.well-known/mcp/server-card.json">/.well-known/mcp/server-card.json</a></li>
    <li><span class="label">DID:</span> <a href="${origin}/.well-known/did.json">/.well-known/did.json</a></li>
    <li><span class="label">API catalog:</span> <a href="${origin}/.well-known/api-catalog">/.well-known/api-catalog</a></li>
    <li><span class="label">OpenAPI:</span> <a href="${origin}/api/openapi.json">/api/openapi.json</a></li>
    <li><span class="label">Entity map:</span> <a href="${origin}/entitymap.json">/entitymap.json</a></li>
    <li><span class="label">OKF bundle:</span> <a href="${origin}/okf/index.md">/okf/index.md</a></li>
    <li><span class="label">Project room:</span> <a href="${origin}/profiles/confidential-project-room">/profiles/confidential-project-room</a></li>
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

  <h2>Talk to a person</h2>
  <p>${escapeHtml(SUPPORT_HOURS_LOCAL)}. If you have a live file, say what decision it feeds and when it is due — that is enough to start.</p>
  <ul>
    <li><span class="label">Email:</span> <a href="mailto:${SUPPORT_CONTACT_EMAIL}?subject=${encodeURIComponent(card.name)}">${SUPPORT_CONTACT_EMAIL}</a></li>
    <li><span class="label">Who runs this:</span> <a href="${PROVIDER_SITE_URL}">${PROVIDER_SITE_URL.replace("https://", "")}</a></li>
  </ul>

  <footer>
    <p>Hosted on Cloudflare Workers. No payments, no wallets, no autonomous live retrieval, no factual-truth verification. Human review required before any commercial action.</p>
    <p>This live wrapper is intentionally limited. Full product behavior remains in the installable stdio MCP server (<code>pip install agenda-intelligence-md</code>).</p>
  </footer>
</main>
</body>
</html>`;
}

function buildRepairPromptJs(packet, response) {
  const lines = [
    "# Evidence Packet Repair Prompt",
    "",
    "You are an AI assistant tasked with repairing an evidence packet to make it decision-ready.",
    "",
    `Current Status: ${response.readiness_label || response.verdict || "not_decision_ready"}`,
    `Readiness Score: ${response.readiness_score || 0}/100`,
    ""
  ];
  if (response.unsafe_claims && response.unsafe_claims.length) {
    lines.push("## Unsafe / Unsupported Claims to Fix or Remove:");
    for (const u of response.unsafe_claims) {
      lines.push(`- Claim ${u.claim_id}: "${u.claim}" (Reason: ${u.reason})`);
    }
    lines.push("");
  }
  if (response.evidence_gaps && response.evidence_gaps.length) {
    lines.push("## Evidence Gaps:");
    for (const gap of response.evidence_gaps) {
      lines.push(`- ${gap}`);
    }
    lines.push("");
  }
  if (response.owner_actions && response.owner_actions.length) {
    lines.push("## Required Actions:");
    for (const act of response.owner_actions) {
      lines.push(`- ${act}`);
    }
    lines.push("");
  }
  lines.push("Please supply the required evidence or adjust claims to address the points above.");
  return lines.join("\n");
}

async function handleEvidencePacketCheck(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }
  const packet = body.packet || body;
  if (!packet || typeof packet !== "object") {
    return jsonResponse({ ok: false, error: "Expected evidence packet object" }, 400);
  }
  const verification = agentOutputVerificationResult(packet).response;
  const prompt = buildRepairPromptJs(packet, verification);
  return jsonResponse(
    {
      valid: true,
      packet_status: verification.readiness_label,
      response: {
        ...verification,
        repair_guidance: prompt
      },
      run_provenance: {
        contract_version: VERSION,
        endpoint: "/v1/evidence-packet/check"
      }
    },
    200
  );
}

async function handleEvidencePacketRepairPrompt(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }
  const packet = body.packet || body;
  const verification =
    body.response ||
    (packet && typeof packet === "object" ? agentOutputVerificationResult(packet).response : null);
  if (!verification) {
    return jsonResponse({ ok: false, error: "Expected evidence packet or verification response" }, 400);
  }
  const prompt = buildRepairPromptJs(packet, verification);
  return jsonResponse(
    {
      valid: true,
      packet_status: verification.readiness_label || "not_decision_ready",
      repair_prompt: prompt
    },
    200
  );
}

async function handleCriticalMineralsDirect(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }
  const errors = criticalMineralsErrors(body);
  if (errors.length) {
    return jsonResponse({ ok: false, error: "Invalid Critical minerals due diligence request", errors }, 400);
  }
  const result = criticalMineralsResult(body);
  return jsonResponse(result.response, 200);
}

export async function handleRequest(request, env = {}, ctx = {}) {
  const url = new URL(request.url);

  if (request.method === "GET") {
    logFunnelEvent(request, funnelStepForPath(url.pathname));
  }

  if (url.pathname === CIS_REVIEW_INTAKE_PATH && request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: intakeCorsHeaders(request) });
  }

  if (url.pathname === CIS_REVIEW_INTAKE_PATH && request.method === "POST") {
    return handleCisReviewIntake(request, env, ctx);
  }

  if (url.pathname === CIS_REVIEW_INTAKE_PATH && request.method === "GET") {
    return handleCisReviewIntakeList(request, env);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-client-id, authorization, mcp-method, mcp-name"
      }
    });
  }

  if (request.method === "GET" && url.pathname === AGENSTRY_VERIFICATION_PATH) {
    const token = agenstryVerificationToken(env);
    return token ? textResponse(token, 200, { "cache-control": "no-store" }) : textResponse("Not found", 404);
  }

  if (request.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
    const card = toSpecWireCard(agentCard(request, env));
    const signed = await maybeSignCard(card, env);
    return jsonResponse(signed, 200, aiCatalogHeaders(request));
  }

  if (request.method === "GET" && url.pathname === "/.well-known/ai-catalog.json") {
    return jsonResponse(aiCatalog(request, env), 200, {
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (request.method === "GET" && url.pathname === "/.well-known/api-catalog") {
    return jsonResponse(apiCatalog(request), 200, {
      "content-type": "application/linkset+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (request.method === "GET" && url.pathname === "/api/openapi.json") {
    return jsonResponse(openApiDocument(request), 200, {
      "content-type": "application/vnd.oai.openapi+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/.well-known/mcp/server-card.json" ||
      url.pathname === "/.well-known/mcp-server.json")
  ) {
    return jsonResponse(mcpServerCard(request, env), 200, {
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (request.method === "GET" && url.pathname === "/.well-known/did.json") {
    return jsonResponse(didDocument(request), 200, {
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (request.method === "GET" && url.pathname === "/entitymap.json") {
    return jsonResponse(entityMap(request), 200, {
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/okf" || url.pathname === "/okf/" || OKF_PATHS.includes(url.pathname))
  ) {
    return markdownResponse(okfMarkdown(url.pathname), 200, aiCatalogHeaders(request));
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/profiles/confidential-project-room" ||
      url.pathname === "/profiles/confidential-project-room/" ||
      PROFILE_PATHS.includes(url.pathname))
  ) {
    const body = profileContent(url.pathname);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": profileContentType(url.pathname),
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
        ...aiCatalogHeaders(request)
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
    return jsonResponse(buildJwks(env.AGENT_CARD_SIGNING_KEY || env.AGENT_CARD_PRIVATE_JWK), 200, {
      "cache-control": "public, max-age=3600",
      ...aiCatalogHeaders(request)
    });
  }

  if (request.method === "GET" && url.pathname === "/") {
    if (acceptsHtml(request)) {
      return htmlResponse(landingHtml(request, env), 200, aiCatalogHeaders(request));
    }
    return jsonResponse(healthInfo(request, env), 200, aiCatalogHeaders(request));
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse(healthInfo(request, env), 200, aiCatalogHeaders(request));
  }

  if (request.method === "GET" && url.pathname === "/status") {
    return jsonResponse(statusInfo(request, env), 200, aiCatalogHeaders(request));
  }

  if (request.method === "GET" && url.pathname === "/robots.txt") {
    return textResponse(robotsTxt(request), 200, aiCatalogHeaders(request));
  }

  if (request.method === "GET" && url.pathname === "/stats") {
    return handleStats(request, env);
  }

  if (request.method === "POST" && url.pathname === "/v1/evidence-packet/check") {
    return handleEvidencePacketCheck(request, env);
  }

  if (request.method === "POST" && url.pathname === "/v1/evidence-packet/repair-prompt") {
    return handleEvidencePacketRepairPrompt(request, env);
  }

  if (request.method === "POST" && url.pathname === "/v1/critical-minerals/due-diligence") {
    return handleCriticalMineralsDirect(request, env);
  }

  if (request.method === "POST" && url.pathname === MCP_ENDPOINT_PATH) {
    return handleMcpPost(request, env, ctx);
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
  aiCatalog,
  apiCatalog,
  agentCard,
  GATE_REQUEST_GUIDES,
  buildUsageEvent,
  buildRepairPromptJs,
  callOutcome,
  criticalMineralsResult,
  dealRiskContractResponseForRequest,
  entityMap,
  funnelStepForPath,
  handleCisReviewIntake,
  handleCisReviewIntakeList,
  handleCriticalMineralsDirect,
  handleEvidencePacketCheck,
  handleEvidencePacketRepairPrompt,
  sendCisReviewEmailNotification,
  logFunnelEvent,
  handleJsonRpc,
  handleMcpJsonRpc,
  handleMcpPost,
  healthInfo,
  didDocument,
  checkRateLimit,
  isProductionAuthorized,
  isStatsAuthorized,
  mcpServerCard,
  okfMarkdown,
  openApiDocument,
  profileContent,
  productionAuthKey,
  rateLimitPerHour,
  landingHtml,
  recordUsageStats,
  robotsTxt,
  routeModules,
  signalScreenForText,
  statusInfo,
  toSpecWireCard,
  triageForText,
  usageStats
};
function generateHtmlDashboard(profile, response) {
  const jsonStr = JSON.stringify(response, null, 2);
  let actions = '';
  const ownerActions = response.owner_actions || [];
  if (ownerActions.length > 0) {
    actions = ownerActions.map(action =>
      '<li class="flex items-start"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center mr-3 mt-0.5 text-xs">!</span><span class="text-sm text-gray-700">' + action + '</span></li>'
    ).join('');
  } else {
    actions = '<p class="text-sm text-gray-500 italic">No pending actions. Packet is fully grounded.</p>';
  }

  const statusStr = String(response.packet_status || response.decision || 'completed').toUpperCase();
  const profileName = String(profile).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${profileName} Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .agenda-gradient {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
        }
    </style>
</head>
<body class="bg-gray-50 text-gray-900 font-sans antialiased">
    <div class="max-w-6xl mx-auto py-8 px-4">
        <header class="agenda-gradient text-white rounded-xl shadow-lg p-8 mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold mb-2">${profileName}</h1>
                <p class="text-blue-100 opacity-90">Agenda Intelligence Interactive Audit</p>
            </div>
            <div class="bg-white/20 px-4 py-2 rounded-lg text-sm font-semibold tracking-wide">
                STATUS: ${statusStr}
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <!-- Main Audit Log -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 class="text-xl font-bold mb-4 flex items-center">
                        <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        Structured Output
                    </h2>
                    <pre class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm"><code>${jsonStr}</code></pre>
                </div>
            </div>

            <div class="space-y-6">
                <!-- Action Items -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 class="text-lg font-bold mb-4">Required Actions</h3>
                    <ul class="space-y-3">
                        ${actions}
                    </ul>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

async function handleJsonRpc(payload, request, env = {}, ctx = {}) {
  const response = await _handleJsonRpcInner(payload, request, env, ctx);

  try {
    const method = payload && payload.method;
    if (method && (method === "message/send" || method === "tasks/send" || method === "SendMessage")) {
      const params = payload.params || {};
      const requestedOutput = params.requested_output || "markdown";

      if ((requestedOutput === "html" || requestedOutput === "both") && response && response.result) {
        const result = response.result;
        const state = result.status && result.status.state;

        if (state === "TASK_STATE_COMPLETED" || state === "TASK_STATE_FAILED") {
          const metadata = result.metadata || {};
          const profile = metadata.product_profile || "agenda";
          const innerResponse = metadata.response;

          if (innerResponse) {
            const htmlContent = generateHtmlDashboard(profile, innerResponse);
            if (!result.artifacts) result.artifacts = [];
            if (result.artifacts.length > 0) {
              if (!result.artifacts[0].parts) result.artifacts[0].parts = [];
              result.artifacts[0].parts.push({
                text: htmlContent,
                mediaType: "text/html"
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to generate HTML dashboard wrapper:", err);
  }

  return response;
}
