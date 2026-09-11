import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyGatewayWithVizier,
  isGatewayVizierEnabled,
  gatewayAttributionBlock,
  extractGatewayEntities
} from "../src/upstream_vizier_gateway.js";
import { handleRequest } from "../src/index.js";

test("upstream_vizier_gateway: isGatewayVizierEnabled accurately detects configuration", () => {
  assert.equal(isGatewayVizierEnabled({}), false);
  assert.equal(isGatewayVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isGatewayVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isGatewayVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isGatewayVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isGatewayVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isGatewayVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_gateway: gatewayAttributionBlock returns proper notice", () => {
  const attr = gatewayAttributionBlock();
  assert.equal(attr.upstream, "Vizier Root Gateway Action Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("OFAC 50% Rule"));
  assert.ok(attr.notice.includes("DLP firewall"));
});

test("upstream_vizier_gateway: extractGatewayEntities extracts from params and query text", () => {
  // From params
  const entitiesFromParams = extractGatewayEntities("Cross-corridor inquiry", {
    counterparty: "KazMunayGas",
    entities: ["Transneft", "Acme Logistics"],
    parties: ["Caspian Trading LLC"]
  });
  const namesFromParams = entitiesFromParams.map((e) => e.name);
  assert.ok(namesFromParams.includes("KazMunayGas"));
  assert.ok(namesFromParams.includes("Transneft"));
  assert.ok(namesFromParams.includes("Acme Logistics"));
  assert.ok(namesFromParams.includes("Caspian Trading LLC"));

  // From text - known monitored entities
  const entitiesFromText = extractGatewayEntities("Can we route dry bulk cargo through Sovcomflot vessels via Caspian Sea?");
  const namesFromText = entitiesFromText.map((e) => e.name);
  assert.ok(namesFromText.includes("Sovcomflot"));
  assert.ok(!namesFromText.includes("Caspian Sea"));
  assert.ok(!namesFromText.includes("Kazakhstan"));

  // From text - explicit counterparty mention
  const entitiesExplicit = extractGatewayEntities("Our primary counterparty is Silk Road Freight Forwarders");
  const namesExplicit = entitiesExplicit.map((e) => e.name);
  assert.ok(namesExplicit.some((n) => n.includes("Silk Road Freight Forwarders")));
});

test("upstream_vizier_gateway: returns disabled status when Vizier is not configured", async () => {
  const res = await verifyGatewayWithVizier({}, "General cross-border corridor inquiry");
  assert.equal(res.status, "disabled");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.sanctions_screening.checked, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, null);
});

test("upstream_vizier_gateway: verifies clean gateway query and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.gateway.clean.sig";
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

  const res = await verifyGatewayWithVizier(mockEnv, "Shipping manufactured goods from Kazakhstan to Germany via Georgia");
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_gateway: detects sanctioned counterparty under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.gateway.sanctions.sig";
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

  const res = await verifyGatewayWithVizier(mockEnv, "Can we route freight with Sovcomflot?");
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].name, "Sovcomflot");
  assert.equal(res.sanctions_screening.matches[0].aggregate_blocked_percentage, 100);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_gateway: intercepts sensitive credentials with Vizier DLP Firewall", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.gateway.dlp.sig";
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

  const res = await verifyGatewayWithVizier(mockEnv, "Here is our root API token: sk-proj-1234567890abcdef1234567890 for routing");
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.total_leaks_prevented, 1);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_gateway: degrades gracefully when Vizier returns HTTP 500 error", async () => {
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

  const res = await verifyGatewayWithVizier(mockEnv, "Inquiry about Sovcomflot");
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("HTTP status 500"));
});

test("upstream_vizier_gateway: degrades gracefully on network failure", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        throw new Error("Worker isolate connection timeout");
      }
    }
  };

  const res = await verifyGatewayWithVizier(mockEnv, "Gateway query");
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("connection timeout"));
});

test("upstream_vizier_gateway: full A2A handleRequest integration on agenda root worker", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.root.clean.sig";
  const mockEnv = {
    AGENT_PROFILE: "agenda",
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

  const req = new Request("https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "test-gateway-clean",
      method: "message/send",
      params: {
        text: "Shipping consumer electronics through Kazakhstan to Europe"
      }
    })
  });

  const resp = await handleRequest(req, mockEnv);
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.jsonrpc, "2.0");
  assert.equal(data.id, "test-gateway-clean");
  assert.equal(data.result.metadata.product_profile, "agenda");
  assert.equal(data.result.metadata.vizier_status, "success");
  assert.equal(data.result.metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(data.result.metadata.gateway_verification.clean, true);
});

test("upstream_vizier_gateway: full A2A handleRequest integration with sanctioned entity and DLP leak", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.root.alert.sig";
  const mockEnv = {
    AGENT_PROFILE: "agenda",
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

  const req = new Request("https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "test-gateway-sanctioned-dlp",
      method: "message/send",
      params: {
        text: "Can we use Sovcomflot? Token: sk-proj-1234567890abcdef1234"
      }
    })
  });

  const resp = await handleRequest(req, mockEnv);
  assert.equal(resp.status, 200);
  const data = await resp.json();
  const res = data.result;
  assert.equal(res.metadata.vizier_status, "success");
  assert.equal(res.metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(res.metadata.gateway_verification.violation, true);
  assert.equal(res.metadata.gateway_verification.sanctions_screening.violation, true);
  assert.equal(res.metadata.gateway_verification.dlp_screening.clean, false);

  const triage = res.metadata.triage;
  assert.ok(triage.sanctions_advisory);
  assert.equal(triage.sanctions_advisory.status, "escalate");

  // Check markdown artifact has security notices
  const mdText = res.artifacts[0].parts[0].text;
  assert.ok(mdText.includes("Gateway Sanctions Warning (OFAC 50% Rule)"));
  assert.ok(mdText.includes("Vizier Gateway DLP Notice"));
  assert.ok(!mdText.includes("sk-proj-1234567890abcdef1234"));
});
