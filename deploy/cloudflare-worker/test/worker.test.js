import assert from "node:assert/strict";
import test from "node:test";

import { agentCard, handleJsonRpc, routeModules } from "../src/index.js";

const request = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send");

test("agent card uses request origin for live endpoints", () => {
  const card = agentCard(request);

  assert.equal(card.protocolVersion, "1.0");
  assert.equal(card.url, "https://agenda-intelligence-a2a.example.workers.dev/message/send");
  assert.deepEqual(card.supportedInterfaces, ["JSONRPC"]);
  assert.equal(
    card.x_agenda_intelligence.jsonrpc_endpoint,
    "https://agenda-intelligence-a2a.example.workers.dev/message/send"
  );
  assert.equal(card.x_agenda_intelligence.hosted_wrapper, true);
  assert.equal(card.x_agenda_intelligence.mcp.server_command, "agenda-intelligence-mcp");
  assert.equal(card.capabilities.extendedAgentCard, false);
});

test("message/send returns JSON-RPC result with routing metadata", () => {
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
  assert.equal(response.result.task.status.state, "TASK_STATE_COMPLETED");
  assert.deepEqual(response.result.task.artifacts[0].parts[0].mediaType, "text/markdown");
  assert.deepEqual(response.result.task.metadata.modules_used, [
    { module: "global-think-tank-analyst", role: "reasoning_method" },
    { module: "central-asia-caspian", role: "regional_specialist" },
    { module: "sanctions-sector", role: "sector_specialist" }
  ]);
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
