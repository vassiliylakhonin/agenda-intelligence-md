import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyCriticalMineralsWithVizier,
  isCriticalMineralsVizierEnabled,
  criticalMineralsAttributionBlock
} from "../src/upstream_vizier_critical_minerals.js";
import { handleRequest } from "../src/index.js";

const SAMPLE_CRITICAL_MINERALS_REQUEST = {
  project_name: "Balkhash Copper-Cobalt Processing Facility",
  commodity: "cobalt",
  origin_jurisdiction: "Kazakhstan",
  processing_jurisdiction: "Kazakhstan",
  target_market: "eu",
  decision_question: "Can we proceed with offtake agreement and tolling contract for cobalt cathode?",
  decision_stage: "pre_offtake_agreement",
  counterparties: [
    {
      name: "Balkhash Mining & Metallurgy LLP",
      role: "mine_operator",
      jurisdiction: "Kazakhstan",
      beneficial_owners: ["Eurasian Resources Group"]
    },
    {
      name: "Caspian Refining Operations Ltd",
      role: "refinery_processor",
      jurisdiction: "Kazakhstan",
      beneficial_owners: ["Clean Holdings SA"]
    }
  ],
  supplied_sources: [
    {
      source_type: "subsoil_use_contract",
      title: "Subsoil license agreement KZ-2024-MIN",
      date: "2024-05-15",
      verified_by_counsel: true
    },
    {
      source_type: "assay_report",
      title: "Independent metallurgical assay verification",
      date: "2026-01-10",
      verified_by_counsel: true
    }
  ],
  assumptions: [
    "Refinery emissions meet EU CSDDD standards."
  ],
  blockers: []
};

test("upstream_vizier_critical_minerals: isCriticalMineralsVizierEnabled accurately detects configuration", () => {
  assert.equal(isCriticalMineralsVizierEnabled({}), false);
  assert.equal(isCriticalMineralsVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isCriticalMineralsVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isCriticalMineralsVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isCriticalMineralsVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isCriticalMineralsVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isCriticalMineralsVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_critical_minerals: criticalMineralsAttributionBlock returns proper notice", () => {
  const attr = criticalMineralsAttributionBlock();
  assert.equal(attr.upstream, "Vizier Critical Minerals Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("OFAC 50% Rule"));
});

test("upstream_vizier_critical_minerals: verifies clean critical minerals file and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Balkhash Mining & Metallurgy LLP",
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

  const res = await verifyCriticalMineralsWithVizier(mockEnv, SAMPLE_CRITICAL_MINERALS_REQUEST);
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.sanctions_screening.checked, true);
  assert.equal(res.sanctions_screening.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_critical_minerals: detects sanctioned mine operator under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.sanctions.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.includes("Rusal")) {
            return new Response(
              JSON.stringify({
                entity_name: "Rusal Mining Co",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN_MATCH"],
                explanation: "Designated under Russian metals & mining sanctions",
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
    ...SAMPLE_CRITICAL_MINERALS_REQUEST,
    counterparties: [
      { role: "mine_operator", name: "Rusal Mining Co", jurisdiction: "Russia" }
    ]
  };

  const res = await verifyCriticalMineralsWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].name, "Rusal Mining Co");
  assert.equal(res.sanctions_screening.matches[0].aggregate_blocked_percentage, 100);
});

test("upstream_vizier_critical_minerals: detects sanctioned beneficial owner under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.bo.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name === "Oleg Deripaska") {
            return new Response(
              JSON.stringify({
                entity_name: "Oleg Deripaska",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN_MATCH"],
                explanation: "OFAC SDN Individual",
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
    ...SAMPLE_CRITICAL_MINERALS_REQUEST,
    counterparties: [
      {
        role: "mine_operator",
        name: "Nominal Intermediate Ltd",
        jurisdiction: "Cyprus",
        beneficial_owners: ["Oleg Deripaska"]
      }
    ]
  };

  const res = await verifyCriticalMineralsWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].name, "Oleg Deripaska");
  assert.equal(res.sanctions_screening.matches[0].role, "beneficial_owner");
});

test("upstream_vizier_critical_minerals: detects secret leak in mineral dossier parameters via DLP scan", async () => {
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
                  detector: "mining_cadastre_api_key",
                  path: "parameters.assumptions",
                  snippet_masked: "cadastre_******9999"
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
    ...SAMPLE_CRITICAL_MINERALS_REQUEST,
    assumptions: ["Mining cadastre integration token: cadastre_live_1234567890abcdef9999"]
  };

  const res = await verifyCriticalMineralsWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.findings.length, 1);
});

test("upstream_vizier_critical_minerals: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Upstream Gateway Timeout", { status: 504 });
      }
    }
  };

  const res = await verifyCriticalMineralsWithVizier(mockEnv, SAMPLE_CRITICAL_MINERALS_REQUEST);
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("504"));
});

test("e2e: critical-minerals-due-diligence allows clean file and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "critical_minerals_due_diligence",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Balkhash Mining & Metallurgy LLP",
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
    id: "cm-e2e-01",
    method: "message/send",
    params: {
      message: {
        messageId: "cm-msg-01",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: SAMPLE_CRITICAL_MINERALS_REQUEST
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://critical-minerals-due-diligence-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.critical_minerals_verification.clean, true);
  assert.equal(metadata.critical_minerals_verification.violation, false);

  const contractResponse = metadata.response;
  assert.ok(contractResponse.decision_readiness_score !== undefined);
  assert.ok(contractResponse.operational_decision);
  assert.notEqual(contractResponse.operational_decision.decision, "stop");
});

test("e2e: critical-minerals-due-diligence stops transaction when sanctioned entity is identified", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "critical_minerals_due_diligence",
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.includes("Rusal")) {
            return new Response(
              JSON.stringify({
                entity_name: "Rusal",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN"],
                explanation: "Designated under Russian metals & mining sanctions",
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
    id: "cm-e2e-02",
    method: "message/send",
    params: {
      message: {
        messageId: "cm-msg-02",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: {
              ...SAMPLE_CRITICAL_MINERALS_REQUEST,
              counterparties: [
                { role: "mine_operator", name: "Rusal", jurisdiction: "Russia" }
              ]
            }
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://critical-minerals-due-diligence-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.critical_minerals_verification.violation, true);
  assert.equal(metadata.critical_minerals_verification.sanctions_screening.violation, true);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.risk_signal, "high");
  assert.equal(contractResponse.operational_decision.decision, "stop");
  assert.equal(contractResponse.operational_decision.reason_code, "sanctions_violation_ofac_50");
  assert.ok(contractResponse.operational_decision.blocking_gaps.some((g) => g.includes("OFAC 50% Rule")));
  assert.ok(contractResponse.top_risks.some((r) => r.category.includes("Sanctions") || r.description.includes("OFAC 50% Rule")));
});

test("e2e: critical-minerals-due-diligence stops transaction when secret leak is detected by Vizier DLP", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "critical_minerals_due_diligence",
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
                detector: "mining_cadastre_api_key",
                path: "parameters.assumptions",
                snippet_masked: "cadastre_******5555"
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
    id: "cm-e2e-03",
    method: "message/send",
    params: {
      message: {
        messageId: "cm-msg-03",
        role: "ROLE_USER",
        parts: [
          {
            kind: "data",
            mediaType: "application/json",
            data: {
              ...SAMPLE_CRITICAL_MINERALS_REQUEST,
              assumptions: [
                "Mining cadastre live key: cadastre_live_1234567890abcdef5555"
              ]
            }
          }
        ]
      }
    }
  };

  const httpRequest = new Request("https://critical-minerals-due-diligence-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.critical_minerals_verification.violation, true);
  assert.equal(metadata.critical_minerals_verification.dlp_screening.clean, false);

  const contractResponse = metadata.response;
  assert.equal(contractResponse.risk_signal, "high");
  assert.equal(contractResponse.operational_decision.decision, "stop");
  assert.equal(contractResponse.operational_decision.reason_code, "dlp_secret_leak_detected");
  assert.ok(contractResponse.top_risks.some((r) => r.description.includes("DLP leak detected")));
  assert.ok(contractResponse.operational_decision.blocking_gaps.some((g) => g.includes("Security/DLP violation")));
});

test("e2e: direct REST POST /v1/critical-minerals/due-diligence receives Vizier screening and provenance", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "critical_minerals_due_diligence",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({ entity_name: "Clean Co", violation: false, aggregate_blocked_percentage: 0, receipt: fakeJws }),
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

  const httpRequest = new Request("https://critical-minerals-due-diligence-a2a.example.workers.dev/v1/critical-minerals/due-diligence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SAMPLE_CRITICAL_MINERALS_REQUEST)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.vizier_status, "success");
  assert.equal(data.vizier_clearance_receipt, fakeJws);
  assert.ok(data.critical_minerals_verification);
  assert.equal(data.critical_minerals_verification.clean, true);
  assert.equal(data.commodity, "cobalt");
  assert.ok(data.operational_decision);
});

test("e2e: MCP tools/call critical_minerals_due_diligence receives Vizier security screening", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "critical_minerals_due_diligence",
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.includes("Rusal")) {
            return new Response(
              JSON.stringify({
                entity_name: "Rusal",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN"],
                explanation: "Designated under Russian metals & mining sanctions",
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
    id: "mcp-cm-01",
    method: "tools/call",
    params: {
      name: "critical_minerals_due_diligence",
      arguments: {
        ...SAMPLE_CRITICAL_MINERALS_REQUEST,
        counterparties: [
          { role: "mine_operator", name: "Rusal", jurisdiction: "Russia" }
        ]
      }
    }
  };

  const httpRequest = new Request("https://critical-minerals-due-diligence-a2a.example.workers.dev/mcp", {
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
  assert.equal(data.result.structuredContent.operational_decision.decision, "stop");
  assert.equal(data.result.structuredContent.operational_decision.reason_code, "sanctions_violation_ofac_50");
  assert.ok(data.result.structuredContent.operational_decision.blocking_gaps.some((g) => g.includes("OFAC 50% Rule")));
});
