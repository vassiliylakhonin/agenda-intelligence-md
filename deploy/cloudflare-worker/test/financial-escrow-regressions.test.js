import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAgentFinancialTransaction } from "../src/agent_financial_guard.js";
import { evaluateM2MEscrowArbitration } from "../src/m2m_escrow_arbiter.js";

const financial = () => ({
  run_id: "regression",
  transaction: {
    network: "base",
    token: "USDC",
    amount_usd: 1,
    recipient: "0x1111111111111111111111111111111111111111"
  },
  intent: { prompt: "Pay invoice" },
  policy_limits: { velocity_24h_usd: 0, daily_velocity_limit_usd: 99999999 }
});
const escrow = () => ({
  escrow_id: "regression",
  deal_terms: {
    buyer_id: "buyer",
    seller_id: "seller",
    amount_usd: 100,
    currency: "USDC",
    deadline_utc: "2026-10-01T00:00:00Z",
    arbitration_policy: "all_or_nothing"
  },
  specification: {
    deliverable_type: "json_data",
    expected_schema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
      additionalProperties: false
    }
  },
  delivery_submission: { submitted_at: "2026-09-19T00:00:00Z", artifact_data: { name: "valid" } }
});

test("empty Vizier response cannot manufacture verified clearance", async () => {
  const env = { VIZIER: { fetch: async () => Response.json({}) } };
  for (const result of [
    (await evaluateAgentFinancialTransaction(financial(), env)).financial_guard_verdict,
    (await evaluateM2MEscrowArbitration(escrow(), env)).arbitration_ruling
  ]) {
    assert.notEqual(result.vizier_status, "vizier_verified");
    assert.equal(result.vizier_clearance_receipt, null);
  }
});
test("caller-declared velocity cannot authorize a financial transaction", async () => {
  const result = (await evaluateAgentFinancialTransaction(financial(), {})).financial_guard_verdict;
  assert.equal(result.decision, "step_up_human_required");
  assert.equal(result.checks.velocity_limits, false);
  assert.equal(result.checks.sanctions_aml, false);
});
test("escrow validates required properties rather than merely accepting an object", async () => {
  const request = escrow();
  request.delivery_submission.artifact_data = { wrong: true };
  const result = (await evaluateM2MEscrowArbitration(request, {})).arbitration_ruling;
  assert.equal(result.checks.schema_verified, false);
  assert.notEqual(result.ruling, "RELEASE_TO_SELLER");
});
test("valid schema and delivery remain supported", async () => {
  const result = (await evaluateM2MEscrowArbitration(escrow(), {})).arbitration_ruling;
  assert.equal(result.checks.schema_verified, true);
  assert.equal(result.ruling, "RELEASE_TO_SELLER");
});

import { readFileSync } from "node:fs";
import { validateEscrowArtifact } from "../src/escrow-schema.js";
import { handleRequest, handleMcpJsonRpc, handleJsonRpc } from "../src/index.js";
const cases = JSON.parse(readFileSync(new URL("../../../tests/fixtures/escrow-schema-cases.json", import.meta.url)));
for (const entry of cases) {
  test(`escrow schema: ${entry.name}`, () => {
    assert.equal(validateEscrowArtifact(entry.schema, entry.artifact, !entry.missing).status, entry.status);
  });
}

test("evaluation never creates a quorum proposal or trusts arbitrary receipts", async () => {
  let calls = 0;
  const env = {
    VIZIER: {
      fetch: async () => {
        calls++;
        throw new Error("Must not create proposals");
      }
    }
  };
  for (const result of [
    (await evaluateAgentFinancialTransaction(financial(), env)).financial_guard_verdict,
    (await evaluateM2MEscrowArbitration(escrow(), env)).arbitration_ruling
  ]) {
    assert.equal(result.vizier_status, "attestation_unavailable");
    assert.equal(result.vizier_clearance_receipt, null);
  }
  assert.equal(calls, 0);
});

test("hash-only delivery and unsupported schemas hold escrow without calculating a payable fee", async () => {
  for (const schema of [{ type: "object" }, { $ref: "https://example.invalid/schema" }, "named-schema"]) {
    const request = escrow();
    request.specification.expected_schema = schema;
    delete request.delivery_submission.artifact_data;
    request.delivery_submission.artifact_sha256 = "a".repeat(64);
    const result = (await evaluateM2MEscrowArbitration(request)).arbitration_ruling;
    assert.equal(result.ruling, "ESCALATE_HUMAN");
    assert.equal(result.status, "not_decision_ready");
    assert.equal(result.checks.schema_verified, false);
    assert.equal(result.payout_breakdown.seller_payout_usd, 0);
    assert.equal(result.payout_breakdown.buyer_refund_usd, 0);
    assert.equal(result.payout_breakdown.arbiter_fee_usd, 0);
  }
});

test("REST, MCP and A2A preserve financial human-review decisions", async () => {
  const input = financial();
  const env = { AGENT_PROFILE: "agent_financial_guard" };
  const req = new Request("https://guard.example/v1/agent-financial/pre-sign-check", {
    method: "POST",
    body: JSON.stringify(input)
  });
  const rest = await (await handleRequest(req, env)).json();
  assert.equal(rest.financial_guard_verdict.decision, "step_up_human_required");
  const mcp = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "agent_financial_pre_sign_check", arguments: input }
    },
    req,
    env
  );
  assert.match(JSON.stringify(mcp.result), /step_up_human_required/);
  const a2a = await handleJsonRpc(
    { jsonrpc: "2.0", id: 1, method: "message/send", params: { request: input } },
    req,
    env
  );
  assert.match(JSON.stringify(a2a.result), /step_up_human_required/);
});


test("unsafe integer commitments hold escrow rather than matching rounded values", async () => {
  const request = escrow();
  request.specification.expected_schema = '{"const":9007199254740993}';
  request.delivery_submission.artifact_data = 9007199254740992;
  const ruling = (await evaluateM2MEscrowArbitration(request)).arbitration_ruling;
  assert.equal(ruling.ruling, "ESCALATE_HUMAN");
  assert.equal(ruling.checks.schema_verified, false);
  assert.equal(ruling.payout_breakdown.seller_payout_usd, 0);
});
