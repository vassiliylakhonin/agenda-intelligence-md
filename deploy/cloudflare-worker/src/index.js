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

const SUPPORT_CONTACT_EMAIL = "vassiliy.lakhonin@gmail.com";
const SUPPORT_HOURS_LOCAL = "Mon–Fri 09:00–18:00 Asia/Almaty (UTC+5)";
const SUPPORT_TIMEZONE = "Asia/Almaty";

const VERSION = "1.0.1";
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
      "access-control-allow-headers": "content-type, x-client-id",
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
    env.AGENT_PROFILE === "kazakhstan" ||
    host.includes("middle-corridor-deal-risk-gate-a2a")
  ) {
    return "kazakhstan";
  }
  return "agenda";
}

function agentCard(request, env = {}) {
  const origin = originFromRequest(request);
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
            "Optional caller identifier for observability and abuse triage. The public lightweight triage endpoint does not require an access key."
        }
      }
    },
    securityRequirements: [],
    security: [],
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
  if (profile !== "kazakhstan") return card;

  const origin = originFromRequest(request);
  card.name = "Kazakhstan / Middle Corridor Deal Risk Gate";
  card.documentationUrl = MIDDLE_CORRIDOR_DOCS_URL;
  card.description =
    "A2A-compatible evidence-readiness gate for Kazakhstan-Caspian / Middle Corridor logistics, trade-finance, procurement, and insurance-adjacent workflows. Bring route, cargo, counterparties, and dated sources; get structured deal-risk triage, missing source categories, evidence gaps, watch-next indicators, decision-readiness score, risk signal, and human-review routing.";
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
    canonical_input_mode: "structured_json",
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
    "management or client risk-memo quality gate"
  ];
  card.x_agenda_intelligence.commercial_positioning =
    "Route + cargo + counterparties + dated sources -> auditable corridor-risk triage, evidence gaps, source coverage, watch-next indicators, and human-review escalation.";
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
    canonical_input_mode: "structured_json",
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

function applyCisSecondarySanctionsProfile(card, request, env = {}) {
  const origin = originFromRequest(request);
  card.name = "CIS Secondary-Sanctions Exposure";
  card.documentationUrl = CIS_SECONDARY_SANCTIONS_DOCS_URL;
  card.description =
    "A2A-compatible secondary-sanctions exposure evidence triage for CIS-domiciled counterparties (Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan, Moldova). Bring counterparty, exposure facets, and dated source extracts; get auto-fetched OpenSanctions name matches (CC-BY 4.0), structured triage, evidence gaps, decision-readiness score, exposure dimensions, and mandatory human-review routing. Targets enhanced due diligence in EU / UK / UAE / Singapore institutions screening counterparties against OFAC EO 14114, EU 14th sanctions package, UK OFSI, and FATF / EAG typologies.";
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
        "Turns a CIS counterparty + exposure facets + dated source extracts into a structured secondary-sanctions exposure triage with OpenSanctions name matches, evidence gaps, decision-readiness score, exposure dimensions, and mandatory human-review escalation.",
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
    "A2A/JSON-RPC discovery, CIS secondary-sanctions exposure triage, OpenSanctions live retrieval, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.documentation = CIS_SECONDARY_SANCTIONS_DOCS_URL;
  card.x_agenda_intelligence.product_contract = {
    request_schema: CIS_SECONDARY_SANCTIONS_REQUEST_SCHEMA_URL,
    response_schema: CIS_SECONDARY_SANCTIONS_RESPONSE_SCHEMA_URL,
    source_taxonomy: CIS_SECONDARY_SANCTIONS_SOURCE_TAXONOMY_URL,
    runnable_examples: `${REPOSITORY_URL}/tree/main/examples/cis-secondary-sanctions`,
    canonical_input_mode: "structured_json",
    demo_input_modes: ["structured_json"]
  };
  card.x_agenda_intelligence.required_before_review = CIS_SECONDARY_SANCTIONS_REQUIRED_BEFORE_REVIEW;
  card.x_agenda_intelligence.helpful_context_sources = CIS_SECONDARY_SANCTIONS_HELPFUL_CONTEXT;
  const activeOption = activeUpstreamOption("cis_secondary_sanctions", env);
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
    "CIS counterparty + exposure facets + dated source extracts -> auditable secondary-sanctions exposure triage with OpenSanctions matches, evidence gaps, decision-readiness score, and mandatory human-review escalation.";
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
    "Live retrieval is enabled for this profile against OpenSanctions only (CC-BY 4.0).",
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

function cisTopExposureDimensions(facets, missing, openSanctionsMatchCount) {
  const dims = [];
  if (openSanctionsMatchCount > 0) {
    dims.push("direct or near-direct match in OpenSanctions consolidated dataset");
  }
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
      status: { state: "failed", timestamp: new Date().toISOString() },
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
  const result = agenticInteractionTrustResult(structured);
  return {
    id: crypto.randomUUID(),
    status: { state: "completed", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "agentic-interaction-trust-response",
        name: "Agentic interaction trust response",
        parts: [
          {
            kind: "text",
            text: agenticArtifactText(result.response)
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

  const limitations = [];
  if (upstreamResult.attribution) limitations.push(upstreamResult.attribution.notice);
  if (upstreamResult.degrade_reason) {
    const label = upstream_name || "upstream";
    limitations.push(`${label} live retrieval degraded: ${upstreamResult.degrade_reason}`);
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
    top_exposure_dimensions: cisTopExposureDimensions(facets, missing, autoFetched.length),
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
      status: { state: "failed", timestamp: new Date().toISOString() },
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
  const result = await cisSecondarySanctionsResult(structured, env);
  return {
    id: crypto.randomUUID(),
    status: { state: "completed", timestamp: new Date().toISOString() },
    artifacts: [
      {
        artifactId: "cis-secondary-sanctions-exposure-response",
        name: "CIS secondary-sanctions exposure response",
        parts: [
          {
            kind: "text",
            text: cisArtifactText(result.response, result.live_retrieval_status)
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

function topRisksForStructuredRequest(missingSources) {
  const risks = ["sanctions adjacency", "Caspian chokepoint dependency"];
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

function dealRiskContractResponseForRequest(request) {
  const suppliedSources = suppliedSourcesFromStructuredRequest(request);
  const minimumSourcesBeforeGo = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.filter(
    (sourceType) => !suppliedSources.includes(sourceType)
  );
  const decisionReadiness = decisionReadinessForStructuredRequest(request, suppliedSources);
  const response = {
    triage_recommendation: triageRecommendationForStructuredRequest(request, minimumSourcesBeforeGo),
    risk_signal: riskSignalForStructuredRequest(request, minimumSourcesBeforeGo),
    decision_readiness_score: decisionReadiness.score,
    decision_readiness_label: decisionReadiness.label,
    route: request.route,
    cargo: request.cargo,
    counterparties: request.counterparties,
    supplied_sources: suppliedSources,
    minimum_sources_before_go: minimumSourcesBeforeGo,
    evidence_gaps: minimumSourcesBeforeGo.map(evidenceGapForSource),
    top_risks: topRisksForStructuredRequest(minimumSourcesBeforeGo),
    watch_next: [
      "new sanctions designations",
      "port delays or operator notices",
      "rail capacity constraints",
      "customs enforcement changes",
      "carrier or vessel history updates",
      "insurance or underwriter terms changes"
    ],
    human_review_required: true,
    not_advice_notice: NOT_ADVICE_NOTICE
  };
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
const PROBE_PROMPT_CHAR_THRESHOLD = 24;

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
      modules_used: Array.isArray(event.modules_used) ? event.modules_used : []
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
  let likelyProbe = 0;
  let promptChars = 0;

  for (const event of events) {
    if (event.likely_probe) likelyProbe += 1;
    promptChars += Number.isFinite(event.prompt_chars) ? event.prompt_chars : 0;
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
      prompt_chars_avg: total > 0 ? Math.round(promptChars / total) : 0
    },
    clients: sortedMap(clients),
    agent_profiles: sortedMap(agentProfiles),
    hosts: sortedMap(hosts),
    countries: sortedMap(countries),
    methods: sortedMap(methods),
    modules: sortedMap(modules)
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
      state: "completed",
      timestamp: new Date().toISOString()
    },
    artifacts: [
      {
        artifactId: "agenda-intelligence-routing-note",
        name: "Agenda Intelligence routing note",
        parts: [
          {
            kind: "text",
            text: routingMarkdown(text, modules, profile, triage)
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
          { "kind": "text", "text": "Screen Kazakhstan Middle Corridor sanctions exposure for a logistics route." }
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
          { "kind": "text", "text": "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure." }
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
  handleJsonRpc,
  healthInfo,
  PROBE_PROMPT_CHAR_THRESHOLD,
  isStatsAuthorized,
  landingHtml,
  recordUsageStats,
  routeModules,
  signalScreenForText,
  statusInfo,
  triageForText,
  usageStats
};
