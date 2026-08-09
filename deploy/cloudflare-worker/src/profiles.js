import { OPENSANCTIONS_HOMEPAGE, OPENSANCTIONS_LICENSE } from "./upstream_opensanctions.js";
import { WATCHMAN_LICENSE, WATCHMAN_PROJECT_URL } from "./upstream_watchman.js";
import { SNAPSHOT_LICENSE, SNAPSHOT_PROJECT_URL } from "./upstream_snapshot.js";

export const SUPPORT_CONTACT_EMAIL = "vassiliy.lakhonin@gmail.com";
export const SUPPORT_HOURS_LOCAL = "Mon–Fri 09:00–18:00 Asia/Almaty (UTC+5)";
export const SUPPORT_TIMEZONE = "Asia/Almaty";

export const VERSION = "1.2.0";
export const REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md";
export const DOCS_URL = `${REPOSITORY_URL}/blob/main/MCP.md`;
export const PACKAGE_URL = "https://pypi.org/project/agenda-intelligence-md/";
export const A2A_EXAMPLES_URL = `${REPOSITORY_URL}/tree/main/examples/a2a`;
export const OKF_BUNDLE_REPO_URL = `${REPOSITORY_URL}/blob/main/okf/index.md`;
export const SCHEMAS_URL = `${REPOSITORY_URL}/tree/main/schemas/v1`;
export const SOURCE_POLICY_URL = `${REPOSITORY_URL}/blob/main/SOURCE_POLICY.md`;
export const DISCOVERY_UPDATED_AT = "2026-08-09";

export const CONFIDENTIAL_PROJECT_ROOM_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/trust/confidential-project-workflow.md`;
export const CONFIDENTIAL_PROJECT_ROOM_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/confidential-project-room-profile.schema.json`;

export const MIDDLE_CORRIDOR_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/kazakhstan-middle-corridor.md`;
export const MIDDLE_CORRIDOR_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/middle-corridor-deal-risk-request.schema.json`;
export const MIDDLE_CORRIDOR_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/middle-corridor-deal-risk-response.schema.json`;
export const MIDDLE_CORRIDOR_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/middle-corridor-deal-risk.json`;

export const CIS_SECONDARY_SANCTIONS_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/cis-secondary-sanctions.md`;
export const CIS_SECONDARY_SANCTIONS_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/cis-secondary-sanctions-request.schema.json`;
export const CIS_SECONDARY_SANCTIONS_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/cis-secondary-sanctions-response.schema.json`;
export const CIS_SECONDARY_SANCTIONS_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/cis-secondary-sanctions.json`;
export const CIS_SECONDARY_SANCTIONS_ADR_URL = `${REPOSITORY_URL}/blob/main/docs/adr/0014-per-profile-live-retrieval.md`;

export const AGENTIC_INTERACTION_TRUST_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/agentic-interaction-trust.md`;
export const AGENTIC_INTERACTION_TRUST_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agentic-interaction-trust-request.schema.json`;
export const AGENTIC_INTERACTION_TRUST_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agentic-interaction-trust-response.schema.json`;
export const AGENTIC_INTERACTION_TRUST_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/agentic-interaction-trust.json`;

export const GULF_MARITIME_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/gulf-maritime-exposure.md`;
export const GULF_MARITIME_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/gulf-maritime-exposure-request.schema.json`;
export const GULF_MARITIME_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/gulf-maritime-exposure-response.schema.json`;
export const GULF_MARITIME_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/gulf-maritime-exposure.json`;

export const CORRIDOR_SANCTIONS_ASSISTANT_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/corridor-sanctions-assistant.md`;

export const MARKET_ENTRY_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/kazakhstan-market-entry-readiness.md`;
export const MARKET_ENTRY_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/market-entry-readiness-request.schema.json`;
export const MARKET_ENTRY_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/market-entry-readiness-response.schema.json`;
export const MARKET_ENTRY_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/kazakhstan-market-entry-readiness.json`;

export const AGENT_OUTPUT_VERIFICATION_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/evidence-audit.schema.json`;
export const AGENT_OUTPUT_VERIFICATION_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agent-output-verification-response.schema.json`;

// Canonical input mode shared by per-profile product_contract blocks and the
// top-level x_agent_contract discoverability extension.
export const CANONICAL_INPUT_MODE = "structured_json";

// Versioned independently of the package/card VERSION: this is the
// discoverability contract surfaced to catalogs and agents, not a package
// release.
export const MIDDLE_CORRIDOR_AGENT_CONTRACT_VERSION = "1.0";

// Intent strings the Middle Corridor endpoint can actually emit. Mirrors
// classifyIntent / classifyIntentForProfile / triageForText; verify-agent-card.js
// asserts the primary intent so this list cannot silently drift from routing.
export const MIDDLE_CORRIDOR_SUPPORTED_INTENTS = [
  "middle_corridor_deal_risk_contract",
  "deal_risk_gate",
  "sanctions_policy_signal_screen",
  "source_coverage",
  "evidence_audit",
  "memo_validation",
  "signal_monitoring",
  "strategic_risk_triage"
];

// Per-profile live retrieval CAPABILITY declarations. Actual runtime activation
// is env-derived in index.js via activeUpstreamOption / isLiveRetrievalActive.
export const PROFILE_LIVE_RETRIEVAL = {
  agenda: { capability_declared: false, upstream_options: [] },
  kazakhstan: { capability_declared: false, upstream_options: [] },
  agentic_interaction_trust: { capability_declared: false, upstream_options: [] },
  agent_output_verification: { capability_declared: false, upstream_options: [] },
  gulf_maritime_exposure: { capability_declared: false, upstream_options: [] },
  cis_secondary_sanctions: {
    capability_declared: true,
    upstream_options: [
      {
        name: "Snapshot",
        license: SNAPSHOT_LICENSE,
        homepage: SNAPSHOT_PROJECT_URL,
        activation_env_var: "SNAPSHOT_INDEX_URL",
        disable_env_var: "SNAPSHOT_DISABLED",
        cost_model: "static public-list snapshot fetched by the worker; $0, no external host"
      },
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

function productContract({ request_schema, response_schema, source_taxonomy, runnable_examples, demo_input_modes }) {
  return Object.freeze({
    request_schema,
    response_schema,
    source_taxonomy,
    runnable_examples,
    canonical_input_mode: CANONICAL_INPUT_MODE,
    demo_input_modes: Object.freeze([...demo_input_modes])
  });
}

function frozenArray(values) {
  return Object.freeze([...values]);
}

const SHARED_PROVIDER_SAME_AS = frozenArray([
  "https://github.com/vassiliylakhonin",
  "https://pypi.org/project/agenda-intelligence-md/",
  "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md"
]);

const middleCorridorProfile = Object.freeze({
  profile_key: "kazakhstan",
  product_profile: "middle_corridor_deal_risk",
  canonical_product_name: "Kazakhstan / Middle Corridor Deal Risk Gate",
  documentation_url: MIDDLE_CORRIDOR_DOCS_URL,
  provider_same_as: frozenArray([
    ...SHARED_PROVIDER_SAME_AS,
    "https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev"
  ]),
  wrapper_scope:
    "A2A/JSON-RPC discovery, Kazakhstan and Middle Corridor deal-risk triage, evidence gating, source coverage, and routing response only",
  supported_contracts: frozenArray(["middle_corridor_deal_risk_contract", "lightweight_text_triage"]),
  buyer_use_cases: frozenArray([
    "pre-signature logistics deal review",
    "pre-shipment evidence completeness check",
    "trade-finance or compliance-adjacent file readiness",
    "insurance-adjacent source-pack handoff",
    "management or client risk-memo quality gate",
    "counterparty dossier-completeness check before presenting evidence to a bank, insurer, or counterparty"
  ]),
  commercial_positioning:
    "Pre-screening evidence triage: identifies which due-diligence documents are still missing before a deal's counterparties are committed to a sanctions-screening or network-intelligence tool. It complements those tools rather than replacing them, and performs no screening, name-matching, or data retrieval itself. Route + cargo + counterparties + dated sources -> auditable corridor-risk triage, evidence gaps, source coverage, watch-next indicators, and human-review escalation. The same evidence-gap picture is also returned outward as counterparty_readiness: a dossier-completeness view (status + supplied-vs-required counts + outstanding documents) for the party that must present enhanced-due-diligence evidence to a bank, insurer, or counterparty. Completeness only, not clearance or a sanctions determination.",
  focus: frozenArray([
    "Kazakhstan and Middle Corridor deal-risk triage",
    "sanctions-adjacent evidence gates",
    "source coverage for dated evidence packs",
    "risk memo quality gates",
    "human-review escalation before signature, committee review, insurer handoff, or client delivery"
  ]),
  product_contract: productContract({
    request_schema: MIDDLE_CORRIDOR_REQUEST_SCHEMA_URL,
    response_schema: MIDDLE_CORRIDOR_RESPONSE_SCHEMA_URL,
    source_taxonomy: MIDDLE_CORRIDOR_SOURCE_TAXONOMY_URL,
    runnable_examples: A2A_EXAMPLES_URL,
    demo_input_modes: ["structured_json", "text_prompt"]
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.kazakhstan
});

const agenticInteractionTrustProfile = Object.freeze({
  profile_key: "agentic_interaction_trust",
  product_profile: "agentic_interaction_trust",
  canonical_product_name: "Agentic Interaction Trust Gate",
  documentation_url: AGENTIC_INTERACTION_TRUST_DOCS_URL,
  provider_same_as: SHARED_PROVIDER_SAME_AS,
  wrapper_scope:
    "A2A/JSON-RPC discovery, counterparty-agent trust triage before a delegated action or transaction, evidence gating, and routing response only",
  supported_contracts: frozenArray(["agentic_interaction_trust_contract"]),
  buyer_use_cases: frozenArray([
    "verify an unknown A2A counterparty agent before granting a capability or settling a payment",
    "agent-to-agent (x402 / delegated-payment) transaction step-up before it executes",
    "MCP tool-scope and permission evidence triage before an external agent invokes a tool",
    "AI shopping-agent checkout step-up review",
    "API partner delegated-action evidence readiness",
    "trust-and-safety human-review queue preparation"
  ]),
  commercial_positioning:
    "Before you let a counterparty agent transact or invoke a capability, check whether the evidence to trust that interaction is present. Actor identity claim + target surface + requested action + dated evidence -> auditable trust-routing triage with the missing evidence categories, a decision-readiness score, watch-next indicators, and human-review escalation. Evidence-readiness only: it surfaces what is missing before a policy engine or a human decides. It is not identity verification, authentication, or transaction authorization.",
  focus: frozenArray([
    "counterparty-agent trust triage before a delegated action or agent-to-agent transaction",
    "A2A and MCP endpoint invocation evidence gates",
    "delegated-action authority and permission evidence",
    "agent-mediated checkout and account action triage",
    "human-review escalation for consequential agentic actions"
  ]),
  product_contract: productContract({
    request_schema: AGENTIC_INTERACTION_TRUST_REQUEST_SCHEMA_URL,
    response_schema: AGENTIC_INTERACTION_TRUST_RESPONSE_SCHEMA_URL,
    source_taxonomy: AGENTIC_INTERACTION_TRUST_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/agentic-interaction-trust`,
    demo_input_modes: ["structured_json"]
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.agentic_interaction_trust
});

const gulfMaritimeProfile = Object.freeze({
  profile_key: "gulf_maritime_exposure",
  product_profile: "gulf_maritime_exposure",
  canonical_product_name: "Gulf Maritime Exposure Gate",
  documentation_url: GULF_MARITIME_DOCS_URL,
  provider_same_as: SHARED_PROVIDER_SAME_AS,
  wrapper_scope:
    "A2A/JSON-RPC discovery, maritime sanctions and chokepoint-disruption triage, evidence gating, and routing response only",
  supported_contracts: frozenArray(["gulf_maritime_exposure_contract"]),
  buyer_use_cases: frozenArray([
    "marine and war-risk underwriting before binding cover",
    "tanker chartering fixture clearance through the Gulf or Red Sea",
    "shipowner/operator sanctions clearance before fixture",
    "bunkering and ship-agency dark-fleet exposure triage"
  ]),
  commercial_positioning:
    "Vessel + voyage + counterparties + exposure facets + dated evidence -> auditable exposure triage with evidence gaps, decision-readiness score, chokepoint disruption watch, and human-review escalation. Sits beside a vessel-screening or ownership-resolution tool, not instead of one.",
  product_contract: productContract({
    request_schema: GULF_MARITIME_REQUEST_SCHEMA_URL,
    response_schema: GULF_MARITIME_RESPONSE_SCHEMA_URL,
    source_taxonomy: GULF_MARITIME_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/gulf-maritime-exposure`,
    demo_input_modes: ["structured_json"]
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.gulf_maritime_exposure
});

const cisSecondarySanctionsProfile = Object.freeze({
  profile_key: "cis_secondary_sanctions",
  product_profile: "cis_secondary_sanctions",
  canonical_product_name: "CIS Secondary-Sanctions Exposure",
  documentation_url: CIS_SECONDARY_SANCTIONS_DOCS_URL,
  provider_same_as: SHARED_PROVIDER_SAME_AS,
  wrapper_scope:
    "A2A/JSON-RPC discovery, CIS secondary-sanctions exposure triage, active server-side name matching against a dated public-list snapshot rebuilt on an operator cadence, not a live list feed (Snapshot upstream; Watchman / OpenSanctions alternates), and routing response only",
  supported_contracts: frozenArray(["cis_secondary_sanctions_exposure_contract"]),
  buyer_use_cases: frozenArray([
    "EU / UK / UAE / Singapore enhanced due diligence on CIS counterparties",
    "OFAC EO 14114 secondary-sanctions exposure triage before screening",
    "EU sanctions package transit / re-export risk triage",
    "UK OFSI alignment for CIS-facing trade-finance files",
    "FATF / EAG typology mapping for CIS-domiciled entities"
  ]),
  commercial_positioning:
    "CIS / Caucasus / Central Asia counterparty + exposure facets + dated source extracts -> auditable secondary-sanctions exposure triage with optional sanctions-list name matches (when a list upstream is configured), evidence gaps, decision-readiness score, and mandatory human-review escalation.",
  focus: frozenArray([
    "CIS counterparty secondary-sanctions exposure triage",
    "Public-list snapshot name matching (OFAC SDN / EU / UK)",
    "ownership / transit / correspondent-banking exposure dimensions",
    "FATF / EAG typology references",
    "graceful degrade to user-supplied evidence on upstream failure"
  ]),
  product_contract: productContract({
    request_schema: CIS_SECONDARY_SANCTIONS_REQUEST_SCHEMA_URL,
    response_schema: CIS_SECONDARY_SANCTIONS_RESPONSE_SCHEMA_URL,
    source_taxonomy: CIS_SECONDARY_SANCTIONS_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/cis-secondary-sanctions`,
    demo_input_modes: ["structured_json"]
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.cis_secondary_sanctions
});

const marketEntryReadinessProfile = Object.freeze({
  profile_key: "market_entry_readiness",
  product_profile: "kazakhstan_market_entry_readiness",
  canonical_product_name: "Kazakhstan Market-Entry Readiness Gate",
  documentation_url: MARKET_ENTRY_DOCS_URL,
  provider_same_as: SHARED_PROVIDER_SAME_AS,
  wrapper_scope:
    "A2A/JSON-RPC discovery, market-entry evidence triage, gate decision, and routing response only",
  supported_contracts: frozenArray(["kazakhstan_market_entry_readiness_contract"]),
  buyer_use_cases: frozenArray([
    "foreign company assessing a Kazakhstan distribution / import entry before signature",
    "EPC, renewable-energy, or infrastructure entrant gating committee review",
    "advisor or consultant triaging a client's Kazakhstan market-entry file",
    "partner-entry / technology-transfer readiness before commitment"
  ]),
  commercial_positioning:
    "Company + project + Kazakhstan objective + counterparties + supplied sources -> auditable market-entry triage with a gate decision, readiness label, evidence gaps, owner actions, and human-review escalation. Sits beside legal, tax, and customs advisors, not instead of them.",
  product_contract: productContract({
    request_schema: MARKET_ENTRY_REQUEST_SCHEMA_URL,
    response_schema: MARKET_ENTRY_RESPONSE_SCHEMA_URL,
    source_taxonomy: MARKET_ENTRY_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/kazakhstan-market-entry-readiness`,
    demo_input_modes: ["structured_json"]
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.market_entry_readiness || { capability_declared: false, upstream_options: [] }
});

const agentOutputVerificationProfile = Object.freeze({
  profile_key: "agent_output_verification",
  product_profile: "agent_output_verification",
  canonical_product_name: "Agent Output Verification",
  documentation_url: SCHEMAS_URL,
  provider_same_as: SHARED_PROVIDER_SAME_AS,
  wrapper_scope:
    "A2A/JSON-RPC discovery, claim-level relay-readiness triage of another agent's output, and routing response only",
  supported_contracts: frozenArray(["agent_output_verification_contract"]),
  buyer_use_cases: frozenArray([
    "verify a claim-backed answer received from another agent before relaying or acting on it",
    "gate an agent-to-agent hand-off when the upstream output may contain unsupported claims",
    "pre-publication check that every claim in an agent-drafted memo is grounded",
    "trust-and-safety triage of orchestrated multi-agent output"
  ]),
  commercial_positioning:
    "Claim set + evidence -> auditable relay verdict (allow_relay / verify_before_relay / block_unsafe_claims) with unsafe and weak claims, evidence gaps, and owner actions. Schema-level and structural only: it flags which claims are ungrounded before a consuming agent relays them. Not factual-truth verification, not source retrieval, not an approval or authorization.",
  focus: frozenArray([
    "relay-readiness verdict for one agent verifying another agent's output",
    "unsupported and orphaned claim detection",
    "weak-support and span-grounding gaps",
    "owner actions to make an output safe to relay"
  ]),
  product_contract: productContract({
    request_schema: AGENT_OUTPUT_VERIFICATION_REQUEST_SCHEMA_URL,
    response_schema: AGENT_OUTPUT_VERIFICATION_RESPONSE_SCHEMA_URL,
    source_taxonomy: SCHEMAS_URL,
    runnable_examples: A2A_EXAMPLES_URL,
    demo_input_modes: ["structured_json"]
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.agent_output_verification
});

// Lightweight discovery FRONT profile (Zee-pattern), not a vertical worker: no
// schema, no service function, no triage or retrieval of its own. Its job is a
// human-facing agent card that orients a corridor/sanctions deal-risk question,
// routes to the structured gates, and hands off a free pre-deal screening memo.
// Modeled on the minimal `agenda` / `confidential_project_room` profiles.
const corridorSanctionsAssistantProfile = Object.freeze({
  profile_key: "corridor_sanctions_assistant",
  product_profile: "corridor_sanctions_assistant",
  canonical_product_name: "Corridor & Sanctions Risk Assistant",
  documentation_url: CORRIDOR_SANCTIONS_ASSISTANT_DOCS_URL,
  provider_same_as: SHARED_PROVIDER_SAME_AS,
  wrapper_scope:
    "A2A/JSON-RPC discovery front for corridor and sanctions deal-risk evidence readiness: orientation, routing to the structured gates, and a human pre-deal screening handoff. No triage, scoring, screening, or retrieval of its own.",
  supported_contracts: frozenArray(["orientation_and_routing"]),
  buyer_use_cases: frozenArray([
    "first stop for a Kazakhstan / Middle Corridor deal — what evidence a bank, insurer, or compliance desk will ask for",
    "first stop for CIS / Caucasus / Central Asia secondary-sanctions exposure on a counterparty",
    "get a free one-off pre-deal screening memo on a real deal before committing to a tool or a lawyer",
    "find which structured gate fits a specific deal, counterparty, vessel, or market-entry file"
  ]),
  commercial_positioning:
    "Human-facing front door to the corridor and sanctions evidence-readiness gates. Ask about a specific deal or counterparty; get a plain-language read on what due-diligence evidence is still missing, a pointer to the structured gate that fits, and the option of one free one-off pre-deal screening memo produced by a human. Routing and orientation only — the structured triage, scoring, and any screening happen in the named gates, and human review is required before any commercial action.",
  focus: frozenArray([
    "orientation for corridor and sanctions deal-risk questions",
    "routing to the Middle Corridor, CIS secondary-sanctions, Gulf maritime, and market-entry gates",
    "free pre-deal screening memo handoff to a human",
    "human-review escalation before signature, committee, insurer, or client delivery"
  ]),
  routes_to: frozenArray([
    "middle_corridor_deal_risk",
    "cis_secondary_sanctions",
    "gulf_maritime_exposure",
    "kazakhstan_market_entry_readiness"
  ]),
  engagement: Object.freeze({
    offer: "One free pre-deal screening memo on a real, current deal or counterparty.",
    contact_email: SUPPORT_CONTACT_EMAIL,
    support_hours: SUPPORT_HOURS_LOCAL,
    next_step: "Email a one-line deal (route or counterparty + the decision pending) to book the free memo."
  }),
  live_retrieval: PROFILE_LIVE_RETRIEVAL.agenda
});

const confidentialProjectRoomProfile = Object.freeze({
  profile_key: "confidential_project_room",
  product_profile: "confidential_project_room",
  canonical_product_name: "Confidential Project-Room Workflow",
  documentation_url: CONFIDENTIAL_PROJECT_ROOM_DOCS_URL,
  profile_schema: CONFIDENTIAL_PROJECT_ROOM_SCHEMA_URL
});

export const PROFILE_REGISTRY = Object.freeze({
  agenda: Object.freeze({
    profile_key: "agenda",
    product_profile: "agenda",
    canonical_product_name: "Agenda Intelligence MD",
    documentation_url: DOCS_URL,
    live_retrieval: PROFILE_LIVE_RETRIEVAL.agenda
  }),
  kazakhstan: middleCorridorProfile,
  middle_corridor_deal_risk: middleCorridorProfile,
  agentic_interaction_trust: agenticInteractionTrustProfile,
  agent_output_verification: agentOutputVerificationProfile,
  gulf_maritime_exposure: gulfMaritimeProfile,
  cis_secondary_sanctions: cisSecondarySanctionsProfile,
  market_entry_readiness: marketEntryReadinessProfile,
  kazakhstan_market_entry_readiness: marketEntryReadinessProfile,
  corridor_sanctions_assistant: corridorSanctionsAssistantProfile,
  confidential_project_room: confidentialProjectRoomProfile
});

export function profileDiscovery(profile) {
  const entry = PROFILE_REGISTRY[profile] || PROFILE_REGISTRY.agenda;
  return {
    ...entry,
    provider_same_as: entry.provider_same_as ? [...entry.provider_same_as] : undefined,
    supported_contracts: entry.supported_contracts ? [...entry.supported_contracts] : undefined,
    buyer_use_cases: entry.buyer_use_cases ? [...entry.buyer_use_cases] : undefined,
    focus: entry.focus ? [...entry.focus] : undefined,
    product_contract: entry.product_contract
      ? {
          ...entry.product_contract,
          demo_input_modes: [...entry.product_contract.demo_input_modes]
        }
      : undefined,
    live_retrieval: entry.live_retrieval
      ? {
          ...entry.live_retrieval,
          upstream_options: [...(entry.live_retrieval.upstream_options || [])]
        }
      : undefined
  };
}
