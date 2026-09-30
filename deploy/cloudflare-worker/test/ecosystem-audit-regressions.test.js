import test from "node:test";
import assert from "node:assert/strict";
import {
  handleRequest,
  handleMcpJsonRpc,
  GATE_REQUEST_GUIDES,
} from "../src/index.js";
import {
  evaluateAgentFinancialTransaction,
  validateFinancialGuardRequest,
} from "../src/agent_financial_guard.js";
import { validateM2MEscrowRequest } from "../src/m2m_escrow_arbiter.js";
import {
  generateBankabilityScreen,
  validateBankabilityRequest,
} from "../src/corridor_bankability.js";
const financial = () => ({
  run_id: "regression",
  transaction: {
    network: "base",
    token: "USDC",
    amount_usd: 1,
    recipient: "0x1111111111111111111111111111111111111111",
  },
  intent: { prompt: "Pay invoice" },
});
const escrow = () => ({
  escrow_id: "regression",
  deal_terms: {
    buyer_id: "buyer",
    seller_id: "seller",
    amount_usd: 100,
    currency: "USDC",
    deadline_utc: "2026-10-01T00:00:00Z",
    arbitration_policy: "all_or_nothing",
  },
  specification: { deliverable_type: "json_data" },
  delivery_submission: { submitted_at: "2026-09-30T00:00:00Z" },
});
const bank = () => ({
  project_name: "Documented terminal",
  corridor_leg: "Aktau-Baku",
  capex_usd_m: 100,
  ifi_debt_usd_m: 60,
  dscr_min: 0.8,
  has_sovereign_guarantee: false,
});
async function post(path, body, profile = "agenda") {
  return handleRequest(
    new Request(`https://audit.example${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { AGENT_PROFILE: profile },
  );
}
test("all financial method/calldata non-string types return controlled HTTP 400", async () => {
  for (const key of ["method", "calldata"])
    for (const value of [{}, [], 7, true, null]) {
      const request = financial();
      request.transaction[key] = value;
      assert.ok(validateFinancialGuardRequest(request).length);
      assert.equal(
        (
          await post(
            "/v1/agent-financial/pre-sign-check",
            request,
            "agent_financial_guard",
          )
        ).status,
        400,
      );
    }
});
test("ERC20 max allowance is rejected even when caller names another method", async () => {
  const calldata =
    "0x095ea7b3" + "0".repeat(24) + "1".repeat(40) + "f".repeat(64);
  for (const method of ["transfer", "approve", undefined]) {
    const request = financial();
    Object.assign(request.transaction, { method, calldata });
    const verdict = (await evaluateAgentFinancialTransaction(request))
      .financial_guard_verdict;
    assert.equal(verdict.decision, "reject");
    assert.equal(verdict.checks.contract_security, false);
  }
  const limited = financial();
  limited.transaction.calldata =
    "0x095ea7b3" +
    "0".repeat(24) +
    "1".repeat(40) +
    "0".repeat(32) +
    "f".repeat(32);
  assert.equal(
    (await evaluateAgentFinancialTransaction(limited)).financial_guard_verdict
      .checks.contract_security,
    true,
  );
});
test("payment never manufactures attestation or clearance", async () => {
  const verdict = (
    await evaluateAgentFinancialTransaction(
      financial(),
      {},
      { paymentProof: { valid: true, tx_hash: "synthetic" } },
    )
  ).financial_guard_verdict;
  assert.equal(verdict.vizier_status, "attestation_unavailable");
  assert.equal(verdict.vizier_clearance_receipt, null);
  assert.equal(verdict.payment_status, "verified");
  assert.equal(verdict.human_review_required, true);
});
test("escrow rejects malformed digest, unknown policy and negative or excessive fee", async () => {
  const mutations = [
    (r) => (r.delivery_submission.artifact_sha256 = 7),
    (r) => (r.deal_terms.arbitration_fee_pct = -5),
    (r) => (r.deal_terms.arbitration_fee_pct = 101),
    (r) => (r.deal_terms.arbitration_policy = "invented"),
  ];
  for (const mutate of mutations) {
    const request = escrow();
    mutate(request);
    assert.ok(validateM2MEscrowRequest(request).length);
    assert.equal(
      (
        await post(
          "/v1/m2m-escrow/evaluate-dispute",
          request,
          "m2m_escrow_arbiter",
        )
      ).status,
      400,
    );
  }
});
test("bankability never invents metrics or coerces string guarantees", async () => {
  const result = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: "empty",
      method: "tools/call",
      params: { name: "corridor_bankability_screen", arguments: {} },
    },
    new Request("https://audit.example/mcp"),
    {},
  );
  assert.equal(result.result.isError, true);
  const request = bank();
  request.has_sovereign_guarantee = "false";
  assert.ok(validateBankabilityRequest(request).length);
  assert.equal(
    (await post("/v1/corridor-bankability/screen", request)).status,
    400,
  );
  assert.throws(() => generateBankabilityScreen({}), TypeError);
  const valid = generateBankabilityScreen(bank());
  assert.equal(valid.bankability_status, "HIGH_DEFAULT_RISK");
  assert.equal(valid.human_signoff_required, true);
  const debtFree = bank();
  debtFree.ifi_debt_usd_m = 0;
  assert.equal(
    generateBankabilityScreen(debtFree).financial_metrics.ifi_debt_usd_m,
    0,
  );
});

test("output verification requests quotes and content even when an evidence id is present", async () => {
  const request = structuredClone(
    GATE_REQUEST_GUIDES.agent_output_verification.example,
  );
  for (const claim of request.claims) delete claim.supporting_quotes;
  const response = await post(
    "/v1/agent-output/verification",
    request,
    "agent_output_verification",
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.grounded_claim_count, 0);
  assert.ok(
    data.evidence_gaps.some((gap) => gap.includes("no supporting quote")),
  );
  assert.ok(
    data.owner_actions.some((action) => action.includes("supporting quote")),
  );
});

import { verifyAgenticTrustWithVizier } from "../src/upstream_vizier_trust.js";
import { verifyDualUseWithVizier } from "../src/upstream_vizier_dual_use.js";
test("a later DLP failure cannot erase an earlier upstream violation", async () => {
  const env = { VIZIER: { fetch: async (url) => {
    if (url.includes("/dlp/")) throw new Error("synthetic transport failure");
    return Response.json({ violation: true, aggregate_blocked_percentage: 100, reason_codes: ["synthetic-block"] });
  } } };
  const trust = await verifyAgenticTrustWithVizier(env, {actor:{operator:"Synthetic operator"}});
  const dualUse = await verifyDualUseWithVizier(env, {shipment:{consignee:"Synthetic consignee"}});
  for (const result of [trust, dualUse]) {
    assert.equal(result.status, "degraded");
    assert.equal(result.violation, true);
    assert.equal(result.clean, false);
    assert.equal(result.receipt_scope, "none");
  }
  assert.equal(trust.operator_screening.violation, true);
  assert.equal(dualUse.sanctions_screening.matches.length, 1);
});
