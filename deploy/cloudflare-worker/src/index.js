const VERSION = "0.9.3";
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
  "tcitr"
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

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
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

function agentCard(request) {
  const origin = originFromRequest(request);
  return {
    protocolVersion: "1.0",
    name: "Agenda Intelligence MD",
    description:
      "Live A2A wrapper for Agenda Intelligence MD, an evidence-discipline MCP layer for strategic-risk agents. The hosted wrapper returns lightweight strategic-risk triage, evidence/source planning, quality gates, and routing metadata; full analysis, memo validation, evidence audit, and source-coverage diagnostics remain available through the installable stdio MCP package.",
    url: origin,
    provider: {
      organization: "Vassiliy Lakhonin",
      url: "https://vassiliylakhonin.github.io/"
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

function classifyIntent(text) {
  const lower = text.toLowerCase();
  if (!lower.trim()) return "health_probe";
  if (hasAny(lower, ["validate", "schema", "contract", "json schema", "memo validation"])) {
    return "memo_validation";
  }
  if (hasAny(lower, ["source", "coverage", "required source", "source plan"])) {
    return "source_coverage";
  }
  if (hasAny(lower, ["audit", "evidence", "claim", "provenance", "unsupported"])) {
    return "evidence_audit";
  }
  if (hasAny(lower, ["signal", "watch", "monitor", "early warning", "indicator"])) {
    return "signal_monitoring";
  }
  return "strategic_risk_triage";
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

function triageForText(text, modules) {
  const intent = classifyIntent(text);
  return {
    intent,
    modules,
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
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  if (userAgent.includes("agenstry")) return "agenstry";
  if (userAgent.includes("curl")) return "curl";
  if (userAgent.includes("wrangler")) return "wrangler";
  if (userAgent.includes("bot") || userAgent.includes("crawler") || userAgent.includes("spider")) return "automation";
  if (userAgent.includes("mozilla")) return "browser";
  return "unknown";
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
  let likelyProbe = 0;
  let promptChars = 0;

  for (const event of events) {
    if (event.likely_probe) likelyProbe += 1;
    promptChars += Number.isFinite(event.prompt_chars) ? event.prompt_chars : 0;
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
    countries: sortedMap(countries),
    methods: sortedMap(methods),
    modules: sortedMap(modules)
  };
}

function routingMarkdown(text, modules) {
  const triage = triageForText(text, modules);
  const moduleList = modules.map((item) => `- ${item.module}: ${item.role}`).join("\n");
  const sourceList = triage.source_plan.map((item) => `- ${item}`).join("\n");
  const qualityList = triage.quality_gates.map((item) => `- ${item}`).join("\n");
  const actionList = triage.next_actions.map((item) => `- ${item}`).join("\n");
  const promptLine = text ? `\n\nReceived prompt excerpt:\n\n> ${text.slice(0, 500)}` : "";
  return [
    "Agenda Intelligence MD live wrapper is responding.",
    "",
    "This endpoint is a free, no-payment A2A/JSON-RPC wrapper for discovery, uptime, lightweight strategic-risk triage, and routing. Full product behavior is in the installable MCP server:",
    "",
    "```bash",
    "pip install agenda-intelligence-md",
    "agenda-intelligence-mcp",
    "```",
    "",
    `Detected intent: ${triage.intent}`,
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

function a2aResult(params, request) {
  const text = extractText(params);
  const modules = routeModules(text);
  const triage = triageForText(text, modules);
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
            text: routingMarkdown(text, modules)
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
      wrapper_scope: "discovery, lightweight triage, and routing response only"
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
    const result = a2aResult(params, request);
    const text = extractText(params);
    const likelyProbe = classifyClient(request) === "agenstry" || text.length === 0;
    const event = logUsageEvent(request, {
      jsonrpc_method: payload.method,
      jsonrpc_id_present: payload.id !== undefined,
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
      result: agentCard(request)
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
        "access-control-allow-headers": "content-type"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
    return jsonResponse(agentCard(request));
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse({
      ok: true,
      name: "Agenda Intelligence MD A2A wrapper",
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
  triageForText
};
