import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyAgenticTrustWithVizier,
  isTrustVizierEnabled,
  trustAttributionBlock
} from "../src/upstream_vizier_trust.js";
import { handleRequest } from "../src/index.js";

const FULL_DATED_SOURCES = [
  { id: "src-1", source_type: "agent_identity_claim", title: "Identity Claim", date: "2026-05-28" },
  { id: "src-2", source_type: "operator_or_principal_authorization", title: "Auth Header", date: "2026-05-28" },
  { id: "src-3", source_type: "agent_card_or_manifest", title: "Agent Card", date: "2026-05-28" },
  { id: "src-4", source_type: "tool_scope_or_permission_evidence", title: "Tool Scope", date: "2026-05-28" },
  { id: "src-5", source_type: "session_authentication_evidence", title: "Session Auth", date: "2026-05-28" },
  { id: "src-6", source_type: "action_intent_evidence", title: "Intent Evidence", date: "2026-05-28" },
  { id: "src-7", source_type: "transaction_or_target_action_evidence", title: "Target Action", date: "2026-05-28" }
];

test("upstream_vizier_trust: isTrustVizierEnabled accurately detects configuration", () => {
  assert.equal(isTrustVizierEnabled({}), false);
  assert.equal(isTrustVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isTrustVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isTrustVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isTrustVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isTrustVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isTrustVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_trust: trustAttributionBlock returns proper notice", () => {
  const attr = trustAttributionBlock();
  assert.equal(attr.upstream, "Vizier Agentic Trust Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("Vizier Action Firewall"));
});

test("upstream_vizier_trust: verifies clean agent interaction and captures JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Acme Autonomous Corp",
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

  const req = {
    actor: {
      declared_type: "ai_agent",
      declared_name: "CheckoutAssistant",
      operator: "Acme Autonomous Corp",
      authentication_context: "api_key"
    },
    target_surface: "checkout",
    requested_action: "execute_purchase_order",
    decision_stage: "pre_execution",
    dated_sources: FULL_DATED_SOURCES,
    risk_question: "Is this agent authorized to transact?"
  };

  const res = await verifyAgenticTrustWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.violation, false);
  assert.equal(res.operator_screening.checked, true);
  assert.equal(res.operator_screening.violation, false);
  assert.equal(res.dlp_screening.clean, true);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_trust: detects sanctioned operator under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.sanctions.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
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

  const req = {
    actor: {
      declared_type: "ai_agent",
      declared_name: "TradingBot",
      operator: "Garantex Europe"
    },
    target_surface: "api",
    requested_action: "transfer_assets",
    decision_stage: "pre_execution",
    dated_sources: FULL_DATED_SOURCES,
    risk_question: "Can bot trade?"
  };

  const res = await verifyAgenticTrustWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.operator_screening.violation, true);
  assert.equal(res.operator_screening.match.aggregate_blocked_percentage, 100);
});

test("upstream_vizier_trust: detects secret leak in interaction payload", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.dlp.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Acme Autonomous Corp",
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
                  path: "parameters.notes",
                  snippet_masked: "sk-p******9999"
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
    actor: {
      declared_type: "ai_agent",
      declared_name: "HelperBot",
      operator: "Acme Autonomous Corp"
    },
    target_surface: "mcp_tool",
    requested_action: "execute_tool",
    decision_stage: "in_session",
    dated_sources: FULL_DATED_SOURCES,
    risk_question: "Is tool execution safe?",
    notes: "API token: sk-proj-1234567890abcdef9999"
  };

  const res = await verifyAgenticTrustWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.violation, true);
  assert.equal(res.dlp_screening.clean, false);
  assert.equal(res.dlp_screening.findings.length, 1);
});

test("upstream_vizier_trust: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Upstream failure", { status: 502 });
      }
    }
  };

  const req = {
    actor: {
      declared_type: "ai_agent",
      declared_name: "HelperBot",
      operator: "SomeCorp"
    },
    target_surface: "api",
    requested_action: "query",
    decision_stage: "pre_execution",
    dated_sources: FULL_DATED_SOURCES,
    risk_question: "Is this query safe?"
  };

  const res = await verifyAgenticTrustWithVizier(mockEnv, req);
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("502"));
});

test("e2e: agentic_interaction_trust allows clean agent interaction and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agentic_interaction_trust",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Legit Company Inc",
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
    id: "ait-e2e-01",
    method: "message/send",
    params: {
      capability: "agentic_interaction_trust",
      request: {
        actor: {
          declared_type: "ai_agent",
          declared_name: "ServiceAgent",
          operator: "Legit Company Inc",
          authentication_context: "oauth"
        },
        target_surface: "checkout",
        requested_action: "sync_records",
        decision_stage: "pre_execution",
        dated_sources: FULL_DATED_SOURCES,
        risk_question: "Is sync authorized?"
      }
    }
  };

  const httpRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.trust_verification.clean, true);
  assert.equal(metadata.trust_verification.violation, false);

  const responseBody = metadata.response;
  assert.equal(responseBody.trust_signal, "high");
  assert.equal(responseBody.triage_recommendation, "allow_low_risk");
});

test("e2e: agentic_interaction_trust blocks sanctioned operator under OFAC 50% Rule", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agentic_interaction_trust",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
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
    id: "ait-e2e-02",
    method: "message/send",
    params: {
      capability: "agentic_interaction_trust",
      request: {
        actor: {
          declared_type: "ai_agent",
          declared_name: "TradingAgent",
          operator: "Garantex Europe",
          authentication_context: "api_key"
        },
        target_surface: "checkout",
        requested_action: "execute_crypto_swap",
        decision_stage: "pre_execution",
        dated_sources: FULL_DATED_SOURCES,
        risk_question: "Can swap execute?"
      }
    }
  };

  const httpRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.trust_verification.violation, true);
  assert.equal(metadata.trust_verification.operator_screening.violation, true);

  const responseBody = metadata.response;
  assert.equal(responseBody.triage_recommendation, "block_until_verified");
  assert.equal(responseBody.trust_signal, "low");
  assert.ok(responseBody.top_risk_dimensions.some((d) => d.includes("Sanctioned operator/principal")));
  assert.ok(responseBody.evidence_gaps.some((g) => g.includes("is subject to sanctions")));
});

test("e2e: agentic_interaction_trust blocks leaked secrets detected by Vizier DLP", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agentic_interaction_trust",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Acme Corp",
              violation: false,
              aggregate_blocked_percentage: 0,
              receipt: fakeJws
            }),
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
                snippet_masked: "sk-p******5678"
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
    id: "ait-e2e-03",
    method: "message/send",
    params: {
      capability: "agentic_interaction_trust",
      request: {
        actor: {
          declared_type: "ai_agent",
          declared_name: "ToolUser",
          operator: "Acme Corp",
          authentication_context: "api_key"
        },
        target_surface: "mcp_tool",
        requested_action: "read_database",
        decision_stage: "in_session",
        dated_sources: FULL_DATED_SOURCES,
        risk_question: "Is query safe?",
        notes: "Here is the key sk-proj-1234567890abcdef5678"
      }
    }
  };

  const httpRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.trust_verification.violation, true);
  assert.equal(metadata.trust_verification.dlp_screening.clean, false);

  const responseBody = metadata.response;
  assert.equal(responseBody.triage_recommendation, "block_until_verified");
  assert.equal(responseBody.trust_signal, "low");
  assert.ok(responseBody.top_risk_dimensions.some((d) => d.includes("DLP secret/PII leak detected")));
  assert.ok(responseBody.evidence_gaps.some((g) => g.includes("Payload contains leaked secret/credential")));
});

test("e2e: REST POST /v1/agentic-interaction/trust attaches Vizier provenance and JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agentic_interaction_trust",
    VIZIER: {
      fetch: async (url) => {
        if (url.includes("/v1/sanctions/screen-entity")) {
          return new Response(
            JSON.stringify({
              entity_name: "Legit Company Inc",
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

  const httpRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/v1/agentic-interaction/trust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor: {
        declared_type: "ai_agent",
        declared_name: "ServiceAgent",
        operator: "Legit Company Inc",
        authentication_context: "oauth"
      },
      target_surface: "checkout",
      requested_action: "sync_records",
      decision_stage: "pre_execution",
      dated_sources: FULL_DATED_SOURCES,
      risk_question: "Is sync authorized?"
    })
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.vizier_status, "success");
  assert.equal(data.vizier_clearance_receipt, fakeJws);
  assert.equal(data.trust_verification.clean, true);
  assert.equal(data.trust_verification.violation, false);
  assert.equal(data.trust_signal, "high");
  assert.equal(data.triage_recommendation, "allow_low_risk");
});
