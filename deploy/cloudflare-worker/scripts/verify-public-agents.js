#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAgentCard } from "./verify-agent-card.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const workerSubdomain = process.env.WORKERS_SUBDOMAIN || "vassiliy-lakhonin";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function workerOrigin(name) {
  return `https://${name}.${workerSubdomain}.workers.dev`;
}

const auditClaims = readJson("examples/a2a/audit-claims.request.json").params.audit_json;

const ACTIVE_AGENTS = [
  {
    key: "agenda",
    origin: workerOrigin("agenda-intelligence-a2a"),
    representative: { text: "Route a strategic-risk question with explicit evidence gaps." }
  },
  {
    key: "middle-corridor",
    origin: workerOrigin("middle-corridor-deal-risk-gate-a2a"),
    representative: { data: readJson("examples/a2a/middle-corridor-deal-risk.request.json").params.request }
  },
  {
    key: "cis-secondary-sanctions",
    origin: workerOrigin("cis-secondary-sanctions-a2a"),
    representative: {
      data: readJson("examples/cis-secondary-sanctions/contract/escalate_before_onboarding.request.json")
    }
  },
  {
    key: "agentic-interaction-trust",
    origin: workerOrigin("agentic-interaction-trust-a2a"),
    representative: {
      data: readJson("examples/agentic-interaction-trust/contract/checkout_step_up.request.json")
    }
  },
  {
    key: "gulf-maritime-exposure",
    origin: workerOrigin("gulf-maritime-exposure-a2a"),
    representative: {
      data: readJson("examples/gulf-maritime-exposure/contract/escalate_before_fixture.request.json")
    }
  },
  {
    key: "kazakhstan-market-entry",
    origin: workerOrigin("kazakhstan-market-entry-readiness-a2a"),
    representative: {
      data: readJson("examples/kazakhstan-market-entry-readiness/contract/pre_signature_validation.request.json")
    }
  },
  {
    key: "agent-output-verification",
    origin: workerOrigin("agent-output-verification-a2a"),
    representative: { data: auditClaims }
  },
  {
    key: "corridor-sanctions-assistant",
    origin: workerOrigin("corridor-sanctions-assistant-a2a"),
    representative: { text: "Which gate fits a Kazakhstan route and counterparty question?" }
  },
  {
    key: "critical-minerals-due-diligence",
    origin: workerOrigin("critical-minerals-due-diligence-a2a"),
    representative: {
      data: readJson("examples/critical-minerals-due-diligence/contract/pre_signature_escalate.request.json")
    }
  },
  {
    key: "dual-use-technology-export",
    origin: workerOrigin("dual-use-technology-export-a2a"),
    representative: {
      data: readJson("examples/dual-use-technology-export/contract/decision_ready.request.json")
    }
  }
];

const requestedAgents = new Set(process.argv.slice(2));
const agentsToVerify = requestedAgents.size
  ? ACTIVE_AGENTS.filter((agent) => requestedAgents.has(agent.key))
  : ACTIVE_AGENTS;

if (requestedAgents.size && agentsToVerify.length !== requestedAgents.size) {
  const known = ACTIVE_AGENTS.map((agent) => agent.key).join(", ");
  throw new Error(`Unknown agent key. Known keys: ${known}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function responseJson(url, init = {}) {
  const startedAt = performance.now();
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_error) {
    throw new Error(`HTTP ${response.status} returned non-JSON: ${text.slice(0, 120)}`);
  }
  return {
    response,
    body,
    latencyMs: Math.round(performance.now() - startedAt)
  };
}

function sendMessageBody(id, part) {
  return {
    jsonrpc: "2.0",
    id,
    method: "SendMessage",
    params: {
      message: {
        messageId: `message-${id}`,
        role: "ROLE_USER",
        parts: [part]
      }
    }
  };
}

function rpcInit(body) {
  return {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "a2a-version": "1.0",
      "user-agent": "agenda-intelligence-a2a-conformance/1.0"
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  };
}

async function verifyAgent(agent) {
  const cardUrl = `${agent.origin}/.well-known/agent-card.json`;
  const cardResult = await responseJson(cardUrl, {
    headers: { accept: "application/json", "user-agent": "agenda-intelligence-a2a-conformance/1.0" }
  });
  assert(cardResult.response.status === 200, `card HTTP ${cardResult.response.status}`);
  assert(
    cardResult.response.headers.get("content-type")?.startsWith("application/json"),
    `card Content-Type ${cardResult.response.headers.get("content-type")}`
  );
  const cardErrors = validateAgentCard(cardResult.body, cardUrl);
  assert(cardErrors.length === 0, `card: ${cardErrors.join("; ")}`);

  const primary = cardResult.body.supportedInterfaces[0];
  assert(primary.protocolBinding === "JSONRPC", "primary interface is not JSONRPC");
  assert(primary.protocolVersion === "1.0", "primary interface is not A2A 1.0");

  const health = await responseJson(`${agent.healthOrigin || agent.origin}/health`, {
    headers: { accept: "application/json" }
  });
  assert(health.response.status === 200 && health.body.ok === true, "health check failed");

  const rpcId = `verify-${agent.key}`;
  const rpc = await responseJson(
    primary.url,
    rpcInit(sendMessageBody(rpcId, agent.representative))
  );
  assert(rpc.response.status === 200, `SendMessage HTTP ${rpc.response.status}`);
  assert(
    rpc.response.headers.get("content-type")?.startsWith("application/json"),
    `SendMessage Content-Type ${rpc.response.headers.get("content-type")}`
  );
  assert(rpc.body.jsonrpc === "2.0", "SendMessage jsonrpc is not 2.0");
  assert(rpc.body.id === rpcId, "SendMessage response id does not match request id");
  assert(rpc.body.result?.task || rpc.body.result?.message, "SendMessage result lacks task/message wrapper");
  if (rpc.body.result?.task) {
    assert(typeof rpc.body.result.task.id === "string", "Task id is missing");
    assert(typeof rpc.body.result.task.status?.state === "string", "Task status is missing");
  }

  const parseError = await responseJson(primary.url, rpcInit("{"));
  assert(parseError.body.error?.code === -32700, "invalid JSON did not return -32700");

  const invalidRequest = await responseJson(
    primary.url,
    rpcInit({ jsonrpc: "1.0", id: "invalid-request", method: "SendMessage" })
  );
  assert(invalidRequest.body.error?.code === -32600, "invalid request did not return -32600");

  const unknownMethod = await responseJson(
    primary.url,
    rpcInit({ jsonrpc: "2.0", id: "unknown-method", method: "NoSuchMethod", params: {} })
  );
  assert(unknownMethod.body.error?.code === -32601, "unknown method did not return -32601");

  const invalidParams = await responseJson(
    primary.url,
    rpcInit({ jsonrpc: "2.0", id: "invalid-params", method: "SendMessage", params: {} })
  );
  assert(invalidParams.body.error?.code === -32602, "invalid params did not return -32602");

  return {
    cardStatus: cardResult.response.status,
    rpcStatus: rpc.response.status,
    cardLatencyMs: cardResult.latencyMs,
    rpcLatencyMs: rpc.latencyMs,
    contentType: rpc.response.headers.get("content-type"),
    state: rpc.body.result?.task?.status?.state || "MESSAGE"
  };
}

let failed = 0;
for (const agent of agentsToVerify) {
  try {
    const result = await verifyAgent(agent);
    console.log(
      `PASS ${agent.key} card_http=${result.cardStatus} card=${result.cardLatencyMs}ms ` +
        `rpc_http=${result.rpcStatus} rpc=${result.rpcLatencyMs}ms ` +
        `content_type=${result.contentType} state=${result.state}`
    );
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${agent.key} ${error.message}`);
  }
}

console.log(`SUMMARY pass=${agentsToVerify.length - failed} fail=${failed}`);
if (failed) process.exitCode = 1;
