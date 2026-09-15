import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyAssistantWithVizier,
  isAssistantVizierEnabled,
  assistantAttributionBlock,
  extractAssistantEntities
} from "../src/upstream_vizier_assistant.js";
import { handleRequest } from "../src/index.js";

const corridorRequest = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/message/send", {
  headers: {
    Host: "corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev",
    "Content-Type": "application/json"
  }
});

test("upstream_vizier_assistant: isAssistantVizierEnabled accurately detects configuration", () => {
  assert.equal(isAssistantVizierEnabled({}), false);
  assert.equal(isAssistantVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isAssistantVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isAssistantVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isAssistantVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isAssistantVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isAssistantVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_assistant: assistantAttributionBlock returns proper notice", () => {
  const attr = assistantAttributionBlock();
  assert.equal(attr.upstream, "Vizier Corridor Sanctions Assistant Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("OFAC 50% Rule"));
  assert.ok(attr.notice.includes("DLP firewall"));
});

test("upstream_vizier_assistant: extractAssistantEntities extracts from params and query text", () => {
  // From params
  const entitiesFromParams = extractAssistantEntities("I want to check a route", {
    counterparty: "KazMunayGas",
    entities: ["Transneft", "Acme Logistics"]
  });
  const namesFromParams = entitiesFromParams.map((e) => e.name);
  assert.ok(namesFromParams.includes("KazMunayGas"));
  assert.ok(namesFromParams.includes("Transneft"));
  assert.ok(namesFromParams.includes("Acme Logistics"));

  // From text - known monitored entities
  const entitiesFromText = extractAssistantEntities("Can we ship steel using Sovcomflot vessels via Middle Corridor?");
  const namesFromText = entitiesFromText.map((e) => e.name);
  assert.ok(namesFromText.includes("Sovcomflot"));
  // Geographic stop words filtered out
  assert.ok(!namesFromText.includes("Middle Corridor"));
  assert.ok(!namesFromText.includes("Kazakhstan"));

  // From text - explicit counterparty mention
  const entitiesExplicit = extractAssistantEntities("Counterparty is Caspian Intermodal LLC for this deal");
  const namesExplicit = entitiesExplicit.map((e) => e.name);
  assert.ok(namesExplicit.some((n) => n.includes("Caspian Intermodal")));
});

test("upstream_vizier_assistant: returns disabled status when Vizier is not configured", async () => {
  const res = await verifyAssistantWithVizier({}, "Steel export inquiry");
  assert.equal(res.status, "disabled");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.sanctions_screening.checked, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, null);
});

test("upstream_vizier_assistant: verifies clean assistant query and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "test",
              violation: false,
              clean: true,
              aggregate_blocked_percentage: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/v1/dlp/scan")) {
          return new Response(
            JSON.stringify({
              clean: true,
              findings: [],
              total_leaks_prevented: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }
    }
  };

  const res = await verifyAssistantWithVizier(mockEnv, "I am shipping wheat from Kazakhstan to Italy via Caspian Sea");
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_assistant: detects sanctioned counterparty under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.sanctions.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.toLowerCase().includes("sovcomflot")) {
            return new Response(
              JSON.stringify({
                entity_name: "Sovcomflot",
                violation: true,
                clean: false,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN_50_RULE", "DIRECT_MATCH"],
                explanation: "Entity is 100% blocked under OFAC SDN and OFAC 50% Rule.",
                receipt: fakeJws
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        }
        if (url.includes("/v1/dlp/scan")) {
          return new Response(
            JSON.stringify({
              clean: true,
              findings: [],
              total_leaks_prevented: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }
    }
  };

  const res = await verifyAssistantWithVizier(mockEnv, "Can we route shipments using Sovcomflot?");
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].name, "Sovcomflot");
  assert.equal(res.sanctions_screening.matches[0].aggregate_blocked_percentage, 100);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_assistant: intercepts sensitive credentials with Vizier DLP Firewall", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.dlp.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/dlp/scan")) {
          return new Response(
            JSON.stringify({
              clean: false,
              findings: [
                {
                  category: "api_key",
                  detector: "openai_api_key",
                  path: "text",
                  snippet_masked: "sk-p******1234"
                }
              ],
              total_leaks_prevented: 1,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }
    }
  };

  const res = await verifyAssistantWithVizier(mockEnv, "Here is our token: sk-proj-1234567890abcdef1234567890 for API integration");
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.total_leaks_prevented, 1);
  assert.equal(res.dlp_screening.findings[0].detector, "openai_api_key");
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_assistant: degrades gracefully when Vizier returns HTTP 500 error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response("Internal Server Error", { status: 500 });
        }
        return new Response("OK", { status: 200 });
      }
    }
  };

  const res = await verifyAssistantWithVizier(mockEnv, "Inquiry about Sovcomflot");
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("HTTP status 500"));
});

test("upstream_vizier_assistant: degrades gracefully on network failure", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        throw new Error("Worker isolate connection timeout");
      }
    }
  };

  const res = await verifyAssistantWithVizier(mockEnv, "Query text");
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("connection timeout"));
});

test("upstream_vizier_assistant: full A2A handleRequest integration with clean query", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.clean.sig";
  const mockEnv = {
    AGENT_PROFILE: "corridor_sanctions_assistant",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "test",
              violation: false,
              clean: true,
              aggregate_blocked_percentage: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/v1/dlp/scan")) {
          return new Response(
            JSON.stringify({
              clean: true,
              findings: [],
              total_leaks_prevented: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }
    }
  };

  const req = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "test-csa-clean",
      method: "message/send",
      params: {
        message: {
          parts: [{ kind: "text", text: "Shipping grain from Kazakhstan to Turkey via Middle Corridor" }]
        }
      }
    })
  });

  const resp = await handleRequest(req, mockEnv);
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.jsonrpc, "2.0");
  assert.equal(data.id, "test-csa-clean");
  assert.equal(data.result.metadata.product_profile, "corridor_sanctions_assistant");
  assert.equal(data.result.metadata.vizier_status, "success");
  assert.equal(data.result.metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(data.result.metadata.assistant_verification.clean, true);
});

test("upstream_vizier_assistant: full A2A handleRequest integration with sanctioned entity and DLP leak", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.alert.sig";
  const mockEnv = {
    AGENT_PROFILE: "corridor_sanctions_assistant",
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Sovcomflot",
              violation: true,
              clean: false,
              aggregate_blocked_percentage: 100,
              reason_codes: ["OFAC_SDN_50_RULE"],
              explanation: "Blocked under OFAC 50% Rule",
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/v1/dlp/scan")) {
          return new Response(
            JSON.stringify({
              clean: false,
              findings: [
                {
                  category: "api_key",
                  detector: "openai_api_key",
                  path: "text",
                  snippet_masked: "sk-p******1234"
                }
              ],
              total_leaks_prevented: 1,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }
    }
  };

  const req = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "test-csa-sanctioned-dlp",
      method: "message/send",
      params: {
        message: {
          parts: [{ kind: "text", text: "Can we use Sovcomflot? Token: sk-proj-1234567890abcdef1234" }]
        }
      }
    })
  });

  const resp = await handleRequest(req, mockEnv);
  assert.equal(resp.status, 200);
  const data = await resp.json();
  const res = data.result;
  assert.equal(res.metadata.vizier_status, "success");
  assert.equal(res.metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(res.metadata.assistant_verification.violation, true);
  assert.equal(res.metadata.assistant_verification.sanctions_screening.violation, true);
  assert.equal(res.metadata.assistant_verification.dlp_screening.clean, false);

  const inner = res.metadata.response;
  assert.ok(inner.sanctions_advisory);
  assert.equal(inner.sanctions_advisory.status, "escalate");
  assert.ok(inner.message.includes("SANCTIONS ADVISORY"));
  assert.ok(inner.message.includes("SECURITY NOTICE"));

  // Check caller_text sanitized
  assert.ok(inner.caller_text.includes("******"));
  assert.ok(!inner.caller_text.includes("sk-proj-1234567890abcdef1234"));

  // Check markdown artifact
  const mdText = res.artifacts[0].parts[0].text;
  assert.ok(mdText.includes("Sanctions Screening Warning (OFAC 50% Rule)"));
  assert.ok(mdText.includes("Vizier DLP Security Notice"));
});

test("corridor_sanctions_assistant: free text mentioning dual-use or HS codes attaches guidance", async () => {
  const req = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "test-csa-dual-use-text",
      method: "message/send",
      params: {
        message: {
          parts: [{ kind: "text", text: "We need to export HS 8542.31 microcontrollers transiting Kazakhstan" }]
        }
      }
    })
  });

  const resp = await handleRequest(req, {});
  assert.equal(resp.status, 200);
  const data = await resp.json();
  const res = data.result;
  assert.ok(res.metadata.response.dual_use_guidance);
  assert.ok(res.metadata.response.dual_use_guidance.includes("screen_dual_use_hs_code"));
  assert.ok(res.artifacts[0].parts[0].text.includes("High-Priority Dual-Use Commodity Alert"));
});

test("corridor_sanctions_assistant: MCP tools/call screen_dual_use_hs_code classifies CHPL Tier 1", async () => {
  const req = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mcp-hs-screen-1",
      method: "tools/call",
      params: {
        name: "screen_dual_use_hs_code",
        arguments: {
          hs_code: "8542.31",
          item_description: "Processors and controllers, whether or not combined with memories",
          transit_route: "Middle Corridor (Kazakhstan - Caspian - Azerbaijan)"
        }
      }
    })
  });

  const resp = await handleRequest(req, { AGENT_PROFILE: "corridor_sanctions_assistant" });
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.jsonrpc, "2.0");
  assert.equal(data.id, "mcp-hs-screen-1");

  const sc = data.result.structuredContent;
  assert.equal(sc.hs_code, "8542.31");
  assert.equal(sc.is_high_priority_item, true);
  assert.ok(sc.chpl_tier.includes("Tier 1"));
  assert.equal(sc.clearance_recommendation, "ESCALATE_TO_COMPLIANCE");
  assert.ok(sc.required_diligence_documents.includes("End-User Certificate (EUC)"));
  assert.ok(sc.canonical_dossier_gate.includes("dual-use-technology-export"));
});

test("corridor_sanctions_assistant: MCP tools/call screen_dual_use_hs_code classifies non-CHPL code", async () => {
  const req = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mcp-hs-screen-2",
      method: "tools/call",
      params: {
        name: "screen_dual_use_hs_code",
        arguments: {
          hs_code: "0101.21",
          item_description: "Pure-bred breeding horses"
        }
      }
    })
  });

  const resp = await handleRequest(req, { AGENT_PROFILE: "corridor_sanctions_assistant" });
  assert.equal(resp.status, 200);
  const data = await resp.json();
  const sc = data.result.structuredContent;
  assert.equal(sc.is_high_priority_item, false);
  assert.equal(sc.clearance_recommendation, "STANDARD_REVIEW");
  assert.ok(sc.chpl_tier.includes("Non-CHPL"));
});

test("corridor_sanctions_assistant: MCP tools/call screen_dual_use_hs_code missing hs_code returns failure with schema hint", async () => {
  const req = new Request("https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mcp-hs-screen-fail",
      method: "tools/call",
      params: {
        name: "screen_dual_use_hs_code",
        arguments: {}
      }
    })
  });

  const resp = await handleRequest(req, { AGENT_PROFILE: "corridor_sanctions_assistant" });
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.result.isError, true);
  const sc = data.result.structuredContent;
  assert.ok(sc.schema_hint);
  assert.deepEqual(sc.schema_hint.required_fields, ["hs_code"]);
});

