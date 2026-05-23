import assert from "node:assert/strict";
import test from "node:test";

import {
  agentCard,
  buildUsageEvent,
  handleJsonRpc,
  handleRequest,
  isStatsAuthorized,
  recordUsageStats,
  routeModules,
  triageForText,
  usageStats
} from "../src/index.js";

const request = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async list({ prefix }) {
    return {
      keys: [...this.store.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .map((name) => ({ name })),
      list_complete: true
    };
  }
}

test("agent card uses request origin for live endpoints", () => {
  const card = agentCard(request);

  assert.equal(card.protocolVersion, "1.0");
  assert.equal(card.version, "0.9.3");
  assert.equal(card.url, "https://agenda-intelligence-a2a.example.workers.dev");
  assert.deepEqual(card.supportedInterfaces, [
    {
      url: "https://agenda-intelligence-a2a.example.workers.dev/message/send",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0"
    }
  ]);
  assert.equal(
    card.x_agenda_intelligence.jsonrpc_endpoint,
    "https://agenda-intelligence-a2a.example.workers.dev/message/send"
  );
  assert.equal(card.x_agenda_intelligence.hosted_wrapper, true);
  assert.equal(card.x_agenda_intelligence.mcp.server_command, "agenda-intelligence-mcp");
  assert.equal(card.capabilities.extendedAgentCard, false);
  assert.deepEqual(
    card.skills.map((skill) => skill.id),
    [
      "agenda-analyze",
      "agenda-validate-memo",
      "agenda-audit-claims",
      "agenda-source-coverage",
      "agenda-quote-verification",
      "agenda-signals"
    ]
  );
  assert.equal(card.skills[0].name, "Strategic-risk signal triage");
  assert.ok(card.skills[0].tags.includes("geopolitical-risk"));
  assert.equal(
    card.x_agenda_intelligence.wrapper_scope,
    "A2A/JSON-RPC discovery, lightweight triage, and routing response only"
  );
});

test("message/send returns JSON-RPC result with routing metadata", () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "probe-1",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "text",
                text: "Route a sanctions question about Kazakhstan and the Middle Corridor."
              }
            ]
          }
        }
      },
      request
    );

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.id, "probe-1");
    assert.equal(response.result.status.state, "completed");
    assert.equal(response.result.artifacts[0].parts[0].kind, "text");
    assert.match(response.result.artifacts[0].parts[0].text, /Evidence\/source plan:/);
    assert.match(response.result.artifacts[0].parts[0].text, /Quality gates:/);
    assert.match(response.result.artifacts[0].parts[0].text, /Next actions:/);
    assert.deepEqual(response.result.metadata.modules_used, [
      { module: "global-think-tank-analyst", role: "reasoning_method" },
      { module: "central-asia-caspian", role: "regional_specialist" },
      { module: "sanctions-sector", role: "sector_specialist" }
    ]);
    assert.equal(response.result.metadata.triage.intent, "strategic_risk_triage");
    assert.ok(
      response.result.metadata.triage.source_plan.includes(
        "sanctions authority pages and list entries, such as OFAC, EU, UK OFSI, UN, or relevant national regulators"
      )
    );
  } finally {
    console.log = originalLog;
  }
});

test("triage classifies source coverage requests and returns quality gates", () => {
  const triage = triageForText(
    "Check source coverage for EU sanctions evidence around Red Sea shipping.",
    routeModules("EU sanctions around Red Sea shipping")
  );

  assert.equal(triage.intent, "source_coverage");
  assert.ok(triage.source_plan.some((item) => item.includes("EU institution")));
  assert.ok(triage.source_plan.some((item) => item.includes("Gulf/Middle East")));
  assert.ok(triage.quality_gates[0].includes("source-category coverage"));
  assert.equal(triage.install.mcp_server_command, "agenda-intelligence-mcp");
});

test("unknown method returns method-not-found error", () => {
  const response = handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "unknown/method"
    },
    request
  );

  assert.equal(response.error.code, -32601);
  assert.deepEqual(response.error.data.supported_methods, ["message/send", "tasks/send", "agent/card"]);
});

test("routeModules detects Gulf and EU terms", () => {
  assert.deepEqual(routeModules("EU sanctions around Red Sea shipping and Iran"), [
    { module: "global-think-tank-analyst", role: "reasoning_method" },
    { module: "gulf-middle-east", role: "regional_specialist" },
    { module: "eu", role: "regional_specialist" },
    { module: "sanctions-sector", role: "sector_specialist" }
  ]);
});

test("usage analytics event keeps only privacy-safe request metadata", () => {
  const analyticsRequest = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: {
      "user-agent": "Agenstry probe",
      referer: "https://agenstry.com/agents/agenda-intelligence-a2a.example.workers.dev",
      cookie: "session=secret"
    }
  });

  const event = buildUsageEvent(analyticsRequest, {
    jsonrpc_method: "message/send",
    jsonrpc_id_present: true,
    prompt_chars: 68,
    modules_used: routeModules("Kazakhstan sanctions risk"),
    likely_probe: true
  });

  assert.equal(event.event, "agenda_intelligence_a2a_usage");
  assert.equal(event.path, "/message/send");
  assert.equal(event.jsonrpc_method, "message/send");
  assert.equal(event.prompt_chars, 68);
  assert.deepEqual(event.modules_used, [
    "global-think-tank-analyst",
    "central-asia-caspian",
    "sanctions-sector"
  ]);
  assert.equal(event.client, "agenstry");
  assert.equal(event.referrer_host, "agenstry.com");
  assert.equal(event.likely_probe, true);
  assert.equal(event.prompt_text, undefined);
  assert.equal(event.cookie, undefined);
  assert.equal(event.authorization, undefined);
  assert.equal(event.ip, undefined);
});

test("usage stats aggregates daily counters from KV", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };
  const event = {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-05-22T16:23:44.481Z",
    jsonrpc_method: "message/send",
    likely_probe: false,
    client: "curl",
    cf: {
      country: "KZ"
    },
    modules_used: ["global-think-tank-analyst", "eu", "sanctions-sector"]
  };

  await recordUsageStats(env, event);
  await recordUsageStats(env, { ...event, likely_probe: true, client: "agenstry" });

  const stats = await usageStats(env, "2026-05-22");

  assert.equal(stats.configured, true);
  assert.equal(stats.counters.total, 2);
  assert.equal(stats.counters.non_probe, 1);
  assert.equal(stats.counters.likely_probe, 1);
  assert.deepEqual(stats.clients, [
    { name: "agenstry", count: 1 },
    { name: "curl", count: 1 }
  ]);
  assert.deepEqual(stats.countries, [{ name: "KZ", count: 2 }]);
  assert.deepEqual(stats.methods, [{ name: "message/send", count: 2 }]);
  assert.deepEqual(stats.modules, [
    { name: "eu", count: 2 },
    { name: "global-think-tank-analyst", count: 2 },
    { name: "sanctions-sector", count: 2 }
  ]);
});

test("stats endpoint returns JSON for requested date", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv, STATS_TOKEN: "test-token" };
  await recordUsageStats(
    env,
    {
      event: "agenda_intelligence_a2a_usage",
      timestamp: "2026-05-22T12:00:00.000Z",
      jsonrpc_method: "message/send",
      likely_probe: false,
      client: "browser",
      cf: { country: "US" },
      modules_used: ["global-think-tank-analyst"]
    }
  );

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?date=2026-05-22&token=test-token"),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.date, "2026-05-22");
  assert.equal(body.counters.total, 1);
  assert.deepEqual(body.clients, [{ name: "browser", count: 1 }]);
});

test("stats endpoint requires token", async () => {
  const env = { AGENDA_USAGE: new MemoryKv(), STATS_TOKEN: "test-token" };

  assert.equal(
    isStatsAuthorized(new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?token=test-token"), env),
    true
  );
  assert.equal(
    isStatsAuthorized(
      new Request("https://agenda-intelligence-a2a.example.workers.dev/stats", {
        headers: { "x-stats-token": "test-token" }
      }),
      env
    ),
    true
  );
  assert.equal(
    isStatsAuthorized(new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?token=wrong"), env),
    false
  );
  assert.equal(
    isStatsAuthorized(new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?token=test-token"), {
      AGENDA_USAGE: new MemoryKv()
    }),
    false
  );

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/stats"),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Unauthorized");
});
