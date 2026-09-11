import test from "node:test";
import assert from "node:assert/strict";
import {
  scanOutputWithVizierDlp,
  isVerificationVizierEnabled,
  verificationAttributionBlock
} from "../src/upstream_vizier_verification.js";
import { handleRequest } from "../src/index.js";

test("upstream_vizier_verification: isVerificationVizierEnabled accurately detects configuration", () => {
  assert.equal(isVerificationVizierEnabled({}), false);
  assert.equal(isVerificationVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isVerificationVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isVerificationVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isVerificationVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isVerificationVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isVerificationVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_verification: verificationAttributionBlock returns proper notice", () => {
  const attr = verificationAttributionBlock();
  assert.equal(attr.upstream, "Vizier Output Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("Vizier Action Firewall"));
});

test("upstream_vizier_verification: scans clean claims and returns clean with JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
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

  const req = {
    claims: [
      {
        claim_id: "c1",
        claim: "Normal analytical report text.",
        support_level: "direct",
        evidence_ids: ["e1"]
      }
    ],
    evidence: [{ evidence_id: "e1", source_type: "official_document" }]
  };

  const res = await scanOutputWithVizierDlp(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, true);
  assert.equal(res.findings.length, 0);
  assert.equal(res.total_leaks_prevented, 0);
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_verification: detects secret leak and returns findings with masked snippets", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        return new Response(
          JSON.stringify({
            clean: false,
            findings: [
              {
                category: "api_key",
                detector: "openai_api_key",
                path: "parameters.claims[0].claim",
                snippet_masked: "sk-p******1234"
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

  const req = {
    claims: [
      {
        claim_id: "c1",
        claim: "Leaked key: sk-proj-1234567890abcdef1234",
        support_level: "direct",
        evidence_ids: ["e1"]
      }
    ],
    evidence: [{ evidence_id: "e1", source_type: "official_document" }]
  };

  const res = await scanOutputWithVizierDlp(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.clean, false);
  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].detector, "openai_api_key");
  assert.equal(res.findings[0].snippet_masked, "sk-p******1234");
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_verification: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Internal Error", { status: 500 });
      }
    }
  };

  const req = {
    claims: [{ claim_id: "c1", claim: "Test claim", support_level: "direct", evidence_ids: ["e1"] }],
    evidence: [{ evidence_id: "e1", source_type: "official_document" }]
  };

  const res = await scanOutputWithVizierDlp(mockEnv, req);
  assert.equal(res.status, "degraded");
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("500"));
});

test("e2e: agent_output_verification allows clean claims and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agent_output_verification",
    VIZIER: {
      fetch: async () => {
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
    id: "aov-e2e-01",
    method: "message/send",
    params: {
      capability: "agent_output_verification",
      request: {
        claims: [
          {
            claim_id: "c1",
            claim: "Counterparty has verified clean standing.",
            support_level: "direct",
            evidence_ids: ["e1"],
            supporting_quotes: [{ evidence_id: "e1", quote: "Clean standing verified" }]
          }
        ],
        evidence: [
          { evidence_id: "e1", name: "Registry extract", source_type: "official_document" }
        ]
      }
    }
  };

  const httpRequest = new Request("https://agent-output-verification-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.dlp_screening.clean, true);

  const responseBody = metadata.response;
  assert.equal(responseBody.verdict, "allow_relay");
  assert.equal(responseBody.readiness_label, "review_ready");
  assert.equal(responseBody.readiness_score, 100);
  assert.equal(responseBody.human_review_required, false);
});

test("e2e: agent_output_verification blocks relay when secret leak is detected by Vizier DLP", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agent_output_verification",
    VIZIER: {
      fetch: async () => {
        return new Response(
          JSON.stringify({
            clean: false,
            findings: [
              {
                category: "api_key",
                detector: "openai_api_key",
                path: "parameters.claims[0].claim",
                snippet_masked: "sk-p******7890"
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
    id: "aov-e2e-02",
    method: "message/send",
    params: {
      capability: "agent_output_verification",
      request: {
        claims: [
          {
            claim_id: "c1",
            claim: "OpenAI API token was sk-proj-1234567890abcdef7890",
            support_level: "direct",
            evidence_ids: ["e1"]
          }
        ],
        evidence: [
          { evidence_id: "e1", name: "Leaked log", source_type: "user_provided_note" }
        ]
      }
    }
  };

  const httpRequest = new Request("https://agent-output-verification-a2a.example.workers.dev/message/send", {
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
  assert.equal(metadata.dlp_screening.clean, false);
  assert.equal(metadata.dlp_screening.findings.length, 1);

  const responseBody = metadata.response;
  assert.equal(responseBody.verdict, "block_unsafe_claims");
  assert.equal(responseBody.readiness_label, "not_decision_ready");
  assert.ok(responseBody.readiness_score <= 49);
  assert.equal(responseBody.human_review_required, true);
  assert.ok(responseBody.unsafe_claims.some((c) => c.reason.includes("DLP secret/PII leak")));
});

test("e2e: REST POST /v1/agent-output/verification attaches Vizier provenance and JWS receipt", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "agent_output_verification",
    VIZIER: {
      fetch: async () => {
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

  const httpRequest = new Request("https://agent-output-verification-a2a.example.workers.dev/v1/agent-output/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      claims: [
        {
          claim_id: "c1",
          claim: "Verified clean claim.",
          support_level: "direct",
          evidence_ids: ["e1"],
          supporting_quotes: [{ evidence_id: "e1", quote: "Verified clean claim." }]
        }
      ],
      evidence: [
        { evidence_id: "e1", name: "Evidence Doc", source_type: "official_document" }
      ]
    })
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.verdict, "allow_relay");
  assert.equal(data.vizier_status, "success");
  assert.equal(data.vizier_clearance_receipt, fakeJws);
  assert.equal(data.dlp_screening.clean, true);
});
