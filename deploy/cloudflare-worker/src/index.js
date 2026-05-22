const VERSION = "0.9.2";
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
      "Live discovery wrapper for Agenda Intelligence MD, an evidence-discipline MCP layer for strategic-risk agents. The hosted wrapper supports A2A/JSON-RPC discovery and routing responses; full analysis, memo validation, evidence audit, and source-coverage diagnostics remain available through the installable stdio MCP package.",
    url: `${origin}/message/send`,
    provider: {
      organization: "Vassiliy Lakhonin",
      url: "https://vassiliylakhonin.github.io/"
    },
    version: VERSION,
    documentationUrl: DOCS_URL,
    supportedInterfaces: ["JSONRPC"],
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
        id: "agenda-routing-note",
        name: "Strategic-risk routing note",
        description:
          "Returns a routing note for strategic-risk questions and points callers to the installable MCP server for full analyze, validate_memo, audit_claims, source_coverage, and signal lookup tools.",
        tags: [
          "strategic-risk",
          "policy-analysis",
          "geopolitics",
          "sanctions",
          "mcp",
          "a2a"
        ],
        examples: [
          "How should an agent use Agenda Intelligence for a sanctions-risk memo?",
          "Route this Red Sea shipping question to the relevant Agenda Intelligence modules."
        ],
        inputModes: ["application/json", "text/plain"],
        outputModes: ["application/json", "text/markdown"]
      }
    ],
    x_agenda_intelligence: {
      hosted_wrapper: true,
      wrapper_scope: "A2A/JSON-RPC discovery and routing response only",
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

function routingMarkdown(text, modules) {
  const moduleList = modules.map((item) => `- ${item.module}: ${item.role}`).join("\n");
  const promptLine = text ? `\n\nReceived prompt excerpt:\n\n> ${text.slice(0, 500)}` : "";
  return [
    "Agenda Intelligence MD live wrapper is responding.",
    "",
    "This endpoint is a free, no-payment A2A/JSON-RPC wrapper for discovery, uptime, and lightweight routing. Full product behavior is in the installable MCP server:",
    "",
    "```bash",
    "pip install agenda-intelligence-md",
    "agenda-intelligence-mcp",
    "```",
    "",
    "Suggested modules:",
    moduleList,
    "",
    "Boundaries: no live retrieval, no factual-truth verification, no legal/financial/compliance advice.",
    promptLine
  ].join("\n");
}

function a2aResult(params, request) {
  const text = extractText(params);
  const modules = routeModules(text);
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
            text: routingMarkdown(text, modules),
            mediaType: "text/markdown"
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
      wrapper_scope: "discovery and routing response only"
    }
  };
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function handleJsonRpc(payload, request) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonRpcError(null, -32600, "Invalid Request");
  }

  const id = payload.id ?? null;
  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(id, -32600, "Invalid Request");
  }

  if (payload.method === "message/send" || payload.method === "tasks/send" || payload.method === "SendMessage") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        task: a2aResult(payload.params ?? {}, request)
      }
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

async function handlePost(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse(jsonRpcError(null, -32700, "Parse error"), 200);
  }
  return jsonResponse(handleJsonRpc(payload, request));
}

export async function handleRequest(request) {
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
      repository: REPOSITORY_URL,
      payments: false
    });
  }

  if (request.method === "POST" && (url.pathname === "/message/send" || url.pathname === "/")) {
    return handlePost(request);
  }

  return textResponse("Not found", 404);
}

export default {
  fetch: handleRequest
};

export { agentCard, handleJsonRpc, routeModules };
