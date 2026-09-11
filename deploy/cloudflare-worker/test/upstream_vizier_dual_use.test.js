import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyDualUseWithVizier,
  isDualUseVizierEnabled,
  dualUseAttributionBlock
} from "../src/upstream_vizier_dual_use.js";
import { handleRequest } from "../src/index.js";

const SAMPLE_DUAL_USE_REQUEST = {
  shipment: {
    hs_code: "854231",
    eccn: "3A001.a.2",
    description: "Radiation-hardened monolithic integrated circuits for industrial control units",
    origin: "DE",
    destination: "KZ",
    transit_countries: ["PL", "GE"],
    end_user_sector: "civilian"
  },
  dated_sources: [
    {
      id: "du-1",
      source_type: "classification_note",
      title: "Exporter ECCN self-classification note",
      date: "2026-08-01"
    },
    {
      id: "du-2",
      source_type: "end_user_statement",
      title: "Signed end-use / end-user statement from the Kazakhstan consignee",
      date: "2026-08-05"
    }
  ],
  risk_question: "Is this export file complete enough for export-control human review?"
};

test("upstream_vizier_dual_use: isDualUseVizierEnabled accurately detects configuration", () => {
  assert.equal(isDualUseVizierEnabled({}), false);
  assert.equal(isDualUseVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isDualUseVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isDualUseVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isDualUseVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isDualUseVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isDualUseVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_dual_use: dualUseAttributionBlock returns proper notice", () => {
  const attr = dualUseAttributionBlock();
  assert.equal(attr.upstream, "Vizier Dual-Use Technology Export Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("OFAC 50% Rule"));
});

test("upstream_vizier_dual_use: verifies clean dual-use file and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "DE",
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

  const res = await verifyDualUseWithVizier(mockEnv, SAMPLE_DUAL_USE_REQUEST);
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.sanctions_screening.checked, true);
  assert.equal(res.sanctions_screening.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_dual_use: detects sanctioned counterparty/carrier under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.sanctions.sig";
  const mockEnv = {
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
                reason_codes: ["OFAC_SDN_MATCH"],
                explanation: "Designated under maritime sanctions",
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
    ...SAMPLE_DUAL_USE_REQUEST,
    counterparties: [
      { role: "freight_forwarder", name: "Sovcomflot Logistics", jurisdiction: "Russia" }
    ]
  };

  const res = await verifyDualUseWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].name, "Sovcomflot Logistics");
  assert.equal(res.sanctions_screening.matches[0].aggregate_blocked_percentage, 100);
});

test("upstream_vizier_dual_use: detects secret leak in export dossier via DLP scan", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.dlp.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Clean Co",
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
                  path: "parameters.risk_question",
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
    ...SAMPLE_DUAL_USE_REQUEST,
    risk_question: "Automated export review key: key_customs_1234567890abcdef9999."
  };

  const res = await verifyDualUseWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.findings.length, 1);
});

test("upstream_vizier_dual_use: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Upstream Gateway Timeout", { status: 504 });
      }
    }
  };

  const res = await verifyDualUseWithVizier(mockEnv, SAMPLE_DUAL_USE_REQUEST);
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("504"));
});

test("e2e: dual-use-technology-export allows clean file and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "dual_use_technology_export",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "DE",
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
    id: "du-e2e-01",
    method: "message/send",
    params: {
      message: {
        messageId: "du-msg-01",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: SAMPLE_DUAL_USE_REQUEST
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://dual-use-technology-export-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.dual_use_verification.clean, true);
  assert.equal(metadata.dual_use_verification.violation, false);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.profile, "dual_use_technology_export");
  assert.equal(contractResponse.export_risk_triage.status, "decision_ready");
  assert.equal(contractResponse.export_risk_triage.score, 100);
});

test("e2e: dual-use-technology-export escalates file when sanctioned counterparty is identified", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "dual_use_technology_export",
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
                explanation: "Designated under Russian maritime sanctions",
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
    id: "du-e2e-02",
    method: "message/send",
    params: {
      message: {
        messageId: "du-msg-02",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: {
              ...SAMPLE_DUAL_USE_REQUEST,
              counterparties: [
                { role: "freight_forwarder", name: "Sovcomflot", jurisdiction: "Russia" }
              ]
            }
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://dual-use-technology-export-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.dual_use_verification.violation, true);
  assert.equal(metadata.dual_use_verification.sanctions_screening.violation, true);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.export_risk_triage.status, "escalate");
  assert.equal(contractResponse.export_risk_triage.score, 0);
  assert.ok(contractResponse.export_risk_triage.primary_risk_vectors.some((r) => r.includes("OFAC 50% Rule")));
});

test("e2e: dual-use-technology-export escalates file when secret leak is detected by Vizier DLP", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "dual_use_technology_export",
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
                path: "parameters.risk_question",
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
    id: "du-e2e-03",
    method: "message/send",
    params: {
      message: {
        messageId: "du-msg-03",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: {
              ...SAMPLE_DUAL_USE_REQUEST,
              risk_question: "Export clearance key: sk-proj-1234567890abcdef5555"
            }
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://dual-use-technology-export-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.dual_use_verification.violation, true);
  assert.equal(metadata.dual_use_verification.dlp_screening.clean, false);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.export_risk_triage.status, "escalate");
  assert.ok(contractResponse.export_risk_triage.primary_risk_vectors.some((r) => r.includes("DLP Firewall detected")));
});

test("e2e: MCP tools/call dual_use_technology_export receives Vizier security screening", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "dual_use_technology_export",
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
                explanation: "Designated under Russian maritime sanctions",
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
    id: "mcp-du-01",
    method: "tools/call",
    params: {
      name: "dual_use_technology_export",
      arguments: {
        ...SAMPLE_DUAL_USE_REQUEST,
        counterparties: [
          { role: "freight_forwarder", name: "Sovcomflot", jurisdiction: "Russia" }
        ]
      }
    }
  };

  const httpRequest = new Request("https://dual-use-technology-export-a2a.example.workers.dev/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.ok(data.result);
  assert.ok(data.result.structuredContent);
  assert.equal(data.result.structuredContent.export_risk_triage.status, "escalate");
  assert.equal(data.result.structuredContent.export_risk_triage.score, 0);
  assert.ok(data.result.structuredContent.export_risk_triage.primary_risk_vectors.some((r) => r.includes("OFAC 50% Rule")));
});
