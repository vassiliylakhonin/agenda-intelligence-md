import assert from "node:assert/strict";
import test from "node:test";

import { agentCard, buildUsageEvent, handleJsonRpc, routeModules } from "../src/index.js";

const request = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

test("agent card uses request origin for live endpoints", () => {
  const card = agentCard(request);

  assert.equal(card.protocolVersion, "1.0");
  assert.equal(card.url, "https://agenda-intelligence-a2a.example.workers.dev");
  assert.deepEqual(card.supportedInterfaces, ["JSONRPC"]);
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
    assert.deepEqual(response.result.metadata.modules_used, [
      { module: "global-think-tank-analyst", role: "reasoning_method" },
      { module: "central-asia-caspian", role: "regional_specialist" },
      { module: "sanctions-sector", role: "sector_specialist" }
    ]);
  } finally {
    console.log = originalLog;
  }
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
