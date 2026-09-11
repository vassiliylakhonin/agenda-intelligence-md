import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyMarketEntryWithVizier,
  isMarketEntryVizierEnabled,
  marketEntryAttributionBlock
} from "../src/upstream_vizier_market_entry.js";
import { handleRequest } from "../src/index.js";

const SAMPLE_MARKET_ENTRY_REQUEST = {
  project_name: "Kazakhstan EV Distribution Center",
  partner_or_company: "Nordic Electric Mobility AS",
  market: "Kazakhstan / Almaty",
  sector: "mobility",
  commercial_objective: "Establish local distribution hub, dealer network, and warranty service in Almaty.",
  decision_question: "Can the project move from concept review to controlled validation?",
  decision_stage: "pre_signature",
  supplied_sources: [
    { id: "s1", source_type: "partner_company_profile", title: "Nordic Electric Mobility Profile", date: "2026-06-01" },
    { id: "s2", source_type: "product_or_project_description", title: "EV Commercial Fleet Specs", date: "2026-06-01" },
    { id: "s3", source_type: "commercial_objective", title: "Project charter", date: "2026-06-01" },
    { id: "s4", source_type: "kazakhstan_use_case", title: "Local mobility study", date: "2026-06-01" },
    { id: "s5", source_type: "initial_source_links_or_documents", title: "Registry docs", date: "2026-06-01" }
  ],
  counterparties: [
    { role: "distributor", name: "Almaty Auto Logistics LLP", jurisdiction: "Kazakhstan" },
    { role: "bank", name: "Halyk Bank", jurisdiction: "Kazakhstan" }
  ],
  known_assumptions: ["Standard customs tariffs apply at Khorgos border."],
  known_blockers: []
};

test("upstream_vizier_market_entry: isMarketEntryVizierEnabled accurately detects configuration", () => {
  assert.equal(isMarketEntryVizierEnabled({}), false);
  assert.equal(isMarketEntryVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isMarketEntryVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isMarketEntryVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isMarketEntryVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isMarketEntryVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isMarketEntryVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_market_entry: marketEntryAttributionBlock returns proper notice", () => {
  const attr = marketEntryAttributionBlock();
  assert.equal(attr.upstream, "Vizier Market Entry Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("OFAC 50% Rule"));
});

test("upstream_vizier_market_entry: verifies clean market entry dossier and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Nordic Electric Mobility AS",
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

  const res = await verifyMarketEntryWithVizier(mockEnv, SAMPLE_MARKET_ENTRY_REQUEST);
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.sanctions_screening.checked, true);
  assert.equal(res.sanctions_screening.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_market_entry: detects sanctioned investor/partner under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.sanctions.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name === "Garantex Europe") {
            return new Response(
              JSON.stringify({
                entity_name: "Garantex Europe",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN_MATCH"],
                explanation: "Designated under Russian sanctions program",
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
    ...SAMPLE_MARKET_ENTRY_REQUEST,
    partner_or_company: "Garantex Europe"
  };

  const res = await verifyMarketEntryWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.sanctions_screening.violation, true);
  assert.equal(res.sanctions_screening.matches.length, 1);
  assert.equal(res.sanctions_screening.matches[0].aggregate_blocked_percentage, 100);
});

test("upstream_vizier_market_entry: detects secret leak in dossier parameters", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.dlp.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Nordic Electric Mobility AS",
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
                  detector: "openai_api_key",
                  path: "parameters.known_assumptions[0]",
                  snippet_masked: "sk-p******8888"
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
    ...SAMPLE_MARKET_ENTRY_REQUEST,
    known_assumptions: ["API key for customs clearing: sk-proj-1234567890abcdef8888"]
  };

  const res = await verifyMarketEntryWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.findings.length, 1);
});

test("upstream_vizier_market_entry: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Upstream Gateway Timeout", { status: 504 });
      }
    }
  };

  const res = await verifyMarketEntryWithVizier(mockEnv, SAMPLE_MARKET_ENTRY_REQUEST);
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("504"));
});

test("e2e: market_entry_readiness allows clean dossier and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "market_entry_readiness",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Nordic Electric Mobility AS",
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
    id: "me-e2e-01",
    method: "message/send",
    params: {
      capability: "market_entry_readiness",
      request: SAMPLE_MARKET_ENTRY_REQUEST
    }
  };

  const httpRequest = new Request("https://kazakhstan-market-entry-readiness-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.market_entry_verification.clean, true);
  assert.equal(metadata.market_entry_verification.violation, false);

  const responseBody = metadata.response;
  assert.equal(responseBody.gate_decision, "proceed_to_validation");
  assert.equal(responseBody.readiness_label, "validation_ready");
});

test("e2e: market_entry_readiness stops dossier when sanctioned partner is identified", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "market_entry_readiness",
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          const body = JSON.parse(init.body);
          if (body.entity_name.includes("Garantex")) {
            return new Response(
              JSON.stringify({
                entity_name: "Garantex Europe",
                violation: true,
                aggregate_blocked_percentage: 100,
                reason_codes: ["OFAC_SDN"],
                explanation: "Designated under Russian sanctions program",
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
    id: "me-e2e-02",
    method: "message/send",
    params: {
      capability: "market_entry_readiness",
      request: {
        ...SAMPLE_MARKET_ENTRY_REQUEST,
        partner_or_company: "Garantex Europe"
      }
    }
  };

  const httpRequest = new Request("https://kazakhstan-market-entry-readiness-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.market_entry_verification.violation, true);
  assert.equal(metadata.market_entry_verification.sanctions_screening.violation, true);

  const responseBody = metadata.response;
  assert.equal(responseBody.gate_decision, "stop");
  assert.ok(responseBody.strongest_reason_to_pause.includes("Sanctions violation"));
  assert.ok(responseBody.confirmed_facts.some((f) => f.includes("Sanctioned entity")));
  assert.ok(responseBody.evidence_gaps.some((g) => g.source_type === "counterparty_integrity_due_diligence"));
});

test("e2e: market_entry_readiness stops dossier when leaked secret is detected by Vizier DLP", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "market_entry_readiness",
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
                path: "parameters.commercial_objective",
                snippet_masked: "sk-p******7777"
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
    id: "me-e2e-03",
    method: "message/send",
    params: {
      capability: "market_entry_readiness",
      request: {
        ...SAMPLE_MARKET_ENTRY_REQUEST,
        commercial_objective: "Access API with sk-proj-1234567890abcdef7777 to automate clearing."
      }
    }
  };

  const httpRequest = new Request("https://kazakhstan-market-entry-readiness-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.market_entry_verification.violation, true);
  assert.equal(metadata.market_entry_verification.dlp_screening.clean, false);

  const responseBody = metadata.response;
  assert.equal(responseBody.gate_decision, "stop");
  assert.ok(responseBody.strongest_reason_to_pause.includes("Security/DLP violation"));
  assert.ok(responseBody.evidence_gaps.some((g) => g.source_type === "counterparty_integrity_due_diligence"));
});

test("e2e: REST POST /v1/market-entry/readiness attaches Vizier provenance and JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "market_entry_readiness",
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

  const httpRequest = new Request("https://kazakhstan-market-entry-readiness-a2a.example.workers.dev/v1/market-entry/readiness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SAMPLE_MARKET_ENTRY_REQUEST)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.gate_decision, "proceed_to_validation");
  assert.equal(data.readiness_label, "validation_ready");
  assert.equal(data.vizier_status, "success");
  assert.equal(data.vizier_clearance_receipt, fakeJws);
  assert.equal(data.market_entry_verification.clean, true);
  assert.equal(data.market_entry_verification.violation, false);
});
