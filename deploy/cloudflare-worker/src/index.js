const VERSION = "1.0.1";
const REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md";
const DOCS_URL = `${REPOSITORY_URL}/blob/main/MCP.md`;
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

const NOT_ADVICE_NOTICE =
  "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.";

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

function originFromRequest(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function agentProfile(request, env = {}) {
  const host = new URL(request.url).host.toLowerCase();
  if (
    env.AGENT_PROFILE === "kazakhstan" ||
    host.includes("kazakhstan-corridor-risk-a2a") ||
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
  if (agentProfile(request, env) !== "kazakhstan") return card;

  const origin = originFromRequest(request);
  card.name = "Kazakhstan / Middle Corridor Deal Risk Gate";
  card.description =
    "Live no-payment A2A/JSON-RPC deal-risk gate for Kazakhstan and Middle Corridor exposure. Bring route, cargo, counterparties, and dated sources; get corridor-risk triage, sanctions-adjacency evidence gaps, source-coverage diagnostics, watch-next indicators, and human-review escalation routing into the installable Agenda Intelligence MD MCP server.";
  card.provider.legalEntity.sameAs = [
    "https://github.com/vassiliylakhonin",
    "https://pypi.org/project/agenda-intelligence-md/",
    "https://glama.ai/mcp/servers/vassiliylakhonin/agenda-intelligence-md",
    "https://agenstry.com/agents/kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev",
    "https://agenstry.com/agents/middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev"
  ];
  card.skills = [
    {
      id: "middle-corridor-deal-desk-triage",
      name: "Middle Corridor deal desk triage",
      description:
        "Turns a route, cargo, counterparty, and dated-source bundle into a proceed/pause/escalate/reject-for-now triage recommendation with minimum sources required before signature or committee review.",
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
  card.x_agenda_intelligence.product_profile = "kazakhstan_deal_risk_gate";
  card.x_agenda_intelligence.wrapper_scope =
    "A2A/JSON-RPC discovery, Kazakhstan and Middle Corridor deal-risk triage, evidence gating, source coverage, and routing response only";
  card.x_agenda_intelligence.jsonrpc_endpoint = `${origin}/message/send`;
  card.x_agenda_intelligence.commercial_positioning =
    "Route + cargo + counterparties + dated sources -> auditable corridor-risk triage, evidence gaps, source coverage, watch-next indicators, and human-review escalation.";
  card.x_agenda_intelligence.focus = [
    "Kazakhstan and Middle Corridor deal-risk triage",
    "sanctions-adjacent evidence gates",
    "source coverage for dated evidence packs",
    "risk memo quality gates",
    "human-review escalation before signature, committee review, insurer handoff, or client delivery"
  ];
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

function dealRiskContractResponseForRequest(request) {
  const suppliedSources = suppliedSourcesFromStructuredRequest(request);
  const minimumSourcesBeforeGo = MIDDLE_CORRIDOR_REQUIRED_BEFORE_GO.filter(
    (sourceType) => !suppliedSources.includes(sourceType)
  );
  const response = {
    triage_recommendation: triageRecommendationForStructuredRequest(request, minimumSourcesBeforeGo),
    risk_signal: riskSignalForStructuredRequest(request, minimumSourcesBeforeGo),
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
  let likelyProbe = 0;
  let promptChars = 0;

  for (const event of events) {
    if (event.likely_probe) likelyProbe += 1;
    promptChars += Number.isFinite(event.prompt_chars) ? event.prompt_chars : 0;
    incrementMap(agentProfiles, event.agent_profile);
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

function handleJsonRpc(payload, request, env = {}, ctx = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonRpcError(null, -32600, "Invalid Request");
  }

  const id = payload.id ?? null;
  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(id, -32600, "Invalid Request");
  }

  if (payload.method === "message/send" || payload.method === "tasks/send" || payload.method === "SendMessage") {
    const params = payload.params ?? {};
    const result = a2aResult(params, request, env);
    const structuredRequest = structuredDealRiskRequestFromParams(params);
    const text = structuredRequest ? textFromStructuredDealRiskRequest(structuredRequest) : extractText(params);
    const likelyProbe = classifyClient(request) === "agenstry" || text.length === 0;
    const event = logUsageEvent(request, {
      jsonrpc_method: payload.method,
      jsonrpc_id_present: payload.id !== undefined,
      agent_profile: result.metadata.product_profile,
      prompt_chars: text.length,
      modules_used: result.metadata.modules_used,
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
  return jsonResponse(handleJsonRpc(payload, request, env, ctx));
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
    return jsonResponse(agentCard(request, env));
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    const card = agentCard(request, env);
    return jsonResponse({
      ok: true,
      name: card.name,
      version: VERSION,
      agent_card: `${originFromRequest(request)}/.well-known/agent-card.json`,
      message_send: `${originFromRequest(request)}/message/send`,
      stats: `${originFromRequest(request)}/stats`,
      stats_auth: "x-stats-token header or token query parameter",
      repository: REPOSITORY_URL,
      payments: false
    });
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
  isStatsAuthorized,
  recordUsageStats,
  routeModules,
  usageStats,
  signalScreenForText,
  triageForText
};
