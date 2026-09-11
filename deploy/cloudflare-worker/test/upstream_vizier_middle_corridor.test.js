import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyMiddleCorridorWithVizier,
  isMiddleCorridorVizierEnabled,
  middleCorridorAttributionBlock
} from "../src/upstream_vizier_middle_corridor.js";
import { handleRequest } from "../src/index.js";

const SAMPLE_MIDDLE_CORRIDOR_REQUEST = {
  route: "Altynkol -> Aktau -> Baku -> Poti",
  cargo: "industrial equipment",
  shipment_value: {
    amount: 2400000,
    currency: "USD"
  },
  counterparties: [
    { role: "forwarder", name: "Caspian Logistics Forwarding LLP", jurisdiction: "Kazakhstan" },
    { role: "carrier", name: "Aktau Marine Shipping Co", jurisdiction: "Kazakhstan" },
    { role: "port_agent", name: "Baku Port Agency", jurisdiction: "Azerbaijan" },
    { role: "consignee", name: "Batumi Terminal LLC", jurisdiction: "Georgia" }
  ],
  dated_sources: [
    {
      id: "e1",
      source_type: "port_operator_notice",
      title: "Port operator berth confirmation",
      date: "2026-06-01"
    },
    {
      id: "e2",
      source_type: "sanctions_list_extract",
      title: "Consolidated sanctions screening extract",
      date: "2026-06-01"
    }
  ],
  risk_question: "Should this transit be escalated before contract signature and what evidence is required?",
  decision_stage: "pre_signature",
  notes: "Scheduled transit for containerized dry industrial turbines."
};

test("upstream_vizier_middle_corridor: isMiddleCorridorVizierEnabled accurately detects configuration", () => {
  assert.equal(isMiddleCorridorVizierEnabled({}), false);
  assert.equal(isMiddleCorridorVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isMiddleCorridorVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isMiddleCorridorVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isMiddleCorridorVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isMiddleCorridorVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isMiddleCorridorVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_middle_corridor: middleCorridorAttributionBlock returns proper notice", () => {
  const attr = middleCorridorAttributionBlock();
  assert.equal(attr.upstream, "Vizier Middle Corridor Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("OFAC 50% Rule"));
});

test("upstream_vizier_middle_corridor: verifies clean middle corridor transit file and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Caspian Logistics Forwarding LLP",
              violation: false,
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

  const res = await verifyMiddleCorridorWithVizier(mockEnv, SAMPLE_MIDDLE_CORRIDOR_REQUEST);
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.sanctions_screening.checked, true);
  assert.equal(res.sanctions_screening.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_middle_corridor: detects sanctioned counterparty/carrier under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.sanctions.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name === "Sovcomflot") {
            return new Response(
              JSON.stringify({
                entity_name: "Sovcomflot",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN_MATCH"],
                explanation: "Designated under Russian maritime sanctions",
                receipt: fakeJws
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({
              entity_name: body.entity_name,
              violation: false,
              aggregate_blocked_percentage: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/v1/dlp/scan")) {
          return new Response(
            JSON.stringify({ clean: true, findings: [], total_leaks_prevented: 0, receipt: fakeJws }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }
    }
  };

  const req = {
    ...SAMPLE_MIDDLE_CORRIDOR_REQUEST,
    counterparties: [
      { role: "carrier", name: "Sovcomflot", jurisdiction: "Russia" }
    ]
  };

  const res = await verifyMiddleCorridorWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].name, "Sovcomflot");
  assert.equal(res.sanctions_screening.matches[0].aggregate_blocked_percentage, 100);
});

test("upstream_vizier_middle_corridor: detects secret leak in transit parameters via DLP scan", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.dlp.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Aktau Marine Shipping Co",
              violation: false,
              aggregate_blocked_percentage: 0,
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
                  detector: "customs_broker_api_key",
                  path: "parameters.notes",
                  snippet_masked: "key_c******9999"
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

  const req = {
    ...SAMPLE_MIDDLE_CORRIDOR_REQUEST,
    notes: "Customs declaration automated via key_customs_1234567890abcdef9999."
  };

  const res = await verifyMiddleCorridorWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.findings.length, 1);
});

test("upstream_vizier_middle_corridor: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Upstream Gateway Timeout", { status: 504 });
      }
    }
  };

  const res = await verifyMiddleCorridorWithVizier(mockEnv, SAMPLE_MIDDLE_CORRIDOR_REQUEST);
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("504"));
});

test("e2e: middle-corridor-deal-risk allows clean transit file and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "kazakhstan",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Aktau Marine Shipping Co",
              violation: false,
              aggregate_blocked_percentage: 0,
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
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
    }
  };

  const payload = {
    jsonrpc: "2.0",
    id: "mc-e2e-01",
    method: "message/send",
    params: {
      message: {
        messageId: "mc-msg-01",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: SAMPLE_MIDDLE_CORRIDOR_REQUEST
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  const metadata = data.result.metadata;
  assert.equal(metadata.vizier_status, "success");
  assert.equal(metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(metadata.middle_corridor_verification.clean, true);
  assert.equal(metadata.middle_corridor_verification.violation, false);

  const contractResponse = metadata.response;
  assert.ok(contractResponse.decision_readiness_score !== undefined);
  assert.ok(contractResponse.operational_decision);
});

test("e2e: middle-corridor-deal-risk halts transaction when sanctioned counterparty is identified", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "kazakhstan",
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.includes("Sovcomflot")) {
            return new Response(
              JSON.stringify({
                entity_name: "Sovcomflot",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN"],
                explanation: "Designated under maritime blocking sanctions",
                receipt: fakeJws
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ entity_name: body.entity_name, violation: false, aggregate_blocked_percentage: 0, receipt: fakeJws }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ clean: true, findings: [], total_leaks_prevented: 0, receipt: fakeJws }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  };

  const payload = {
    jsonrpc: "2.0",
    id: "mc-e2e-02",
    method: "message/send",
    params: {
      message: {
        messageId: "mc-msg-02",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: {
              ...SAMPLE_MIDDLE_CORRIDOR_REQUEST,
              counterparties: [
                { role: "carrier", name: "Sovcomflot", jurisdiction: "Russia" }
              ]
            }
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  const metadata = data.result.metadata;
  assert.equal(metadata.vizier_status, "success");
  assert.equal(metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(metadata.middle_corridor_verification.violation, true);
  assert.equal(metadata.middle_corridor_verification.sanctions_screening.violation, true);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.risk_signal, "high");
  assert.equal(contractResponse.operational_decision.decision, "hold");
  assert.ok(contractResponse.operational_decision.rationale.includes("OFAC 50% Rule"));
  assert.ok(contractResponse.top_risks.some((r) => r.includes("Sanctions violation")));
  assert.ok(contractResponse.evidence_gaps.some((g) => g.includes("OFAC 50% Rule clearance")));
  assert.ok(contractResponse.limitations.some((l) => l.includes("Vizier Action Firewall")));
});

test("e2e: middle-corridor-deal-risk holds file processing when secret leak is detected by Vizier DLP", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "kazakhstan",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({ entity_name: "Clean Co", violation: false, aggregate_blocked_percentage: 0, receipt: fakeJws }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            clean: false,
            findings: [
              {
                category: "api_key",
                detector: "openai_api_key",
                path: "parameters.notes",
                snippet_masked: "sk-p******5555"
              }
            ],
            total_leaks_prevented: 1,
            receipt: fakeJws
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  };

  const payload = {
    jsonrpc: "2.0",
    id: "mc-e2e-03",
    method: "message/send",
    params: {
      message: {
        messageId: "mc-msg-03",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: {
              ...SAMPLE_MIDDLE_CORRIDOR_REQUEST,
              notes: "Port automation credentials: sk-proj-1234567890abcdef5555."
            }
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  const metadata = data.result.metadata;
  assert.equal(metadata.vizier_status, "success");
  assert.equal(metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(metadata.middle_corridor_verification.violation, true);
  assert.equal(metadata.middle_corridor_verification.dlp_screening.clean, false);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.risk_signal, "high");
  assert.equal(contractResponse.operational_decision.decision, "hold");
  assert.ok(contractResponse.top_risks.some((r) => r.includes("DLP leak detected")));
  assert.ok(contractResponse.evidence_gaps.some((g) => g.includes("Sanitization and credential rotation")));
});

test("e2e: MCP tools/call middle_corridor_deal_risk receives Vizier security screening", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "kazakhstan",
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.includes("Sovcomflot")) {
            return new Response(
              JSON.stringify({
                entity_name: "Sovcomflot",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN"],
                explanation: "Designated under maritime blocking sanctions",
                receipt: fakeJws
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ entity_name: body.entity_name, violation: false, aggregate_blocked_percentage: 0, receipt: fakeJws }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ clean: true, findings: [], total_leaks_prevented: 0, receipt: fakeJws }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  };

  const payload = {
    jsonrpc: "2.0",
    id: "mcp-mc-01",
    method: "tools/call",
    params: {
      name: "middle_corridor_deal_risk",
      arguments: {
        ...SAMPLE_MIDDLE_CORRIDOR_REQUEST,
        counterparties: [
          { role: "carrier", name: "Sovcomflot", jurisdiction: "Russia" }
        ]
      }
    }
  };

  const httpRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.ok(data.result);
  assert.ok(data.result.structuredContent);
  assert.equal(data.result.structuredContent.risk_signal, "high");
  assert.equal(data.result.structuredContent.operational_decision.decision, "hold");
  assert.ok(data.result.structuredContent.operational_decision.rationale.includes("OFAC 50% Rule"));
});
