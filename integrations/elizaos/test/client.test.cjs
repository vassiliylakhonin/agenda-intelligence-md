const test = require("node:test");
const assert = require("node:assert/strict");
const { AgendaGuardClient } = require("../dist/index.js");

test("legacy allow cannot become wallet authorization", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    financial_guard_verdict: {decision: "allow", status: "decision_ready", execution_advisory: "Ready to sign"}
  }));
  const result = await new AgendaGuardClient("https://example.invalid").checkTransactionSafety({recipient: "0x1111", amount_usd: 1});
  assert.equal(result.decision, "step_up_human_required");
  assert.equal(result.status, "not_decision_ready");
  assert.equal(result.is_safe, false);
  assert.match(result.execution_advisory, /human review/);
});

test("legacy escrow receipts are never presented as verified", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    arbitration_ruling: {ruling: "RELEASE_TO_SELLER", vizier_status: "vizier_verified", vizier_clearance_receipt: "jws_fake_123"}
  }));
  const result = await new AgendaGuardClient("https://example.invalid").evaluateDispute({});
  assert.equal(result.vizier_status, "attestation_unavailable");
  assert.equal(result.vizier_clearance_receipt, null);
});

test("escrow maps Worker payout_breakdown to the public payout field", async (t) => {
  const payout = {total_escrow_usd: 100, seller_payout_usd: 99, buyer_refund_usd: 0, arbiter_fee_usd: 1};
  t.mock.method(globalThis, "fetch", async () => Response.json({
    arbitration_ruling: {ruling: "RELEASE_TO_SELLER", status: "decision_ready", score: 95, payout_breakdown: payout}
  }));
  const result = await new AgendaGuardClient().evaluateDispute({});
  assert.deepEqual(result.payout, payout);
  assert.equal(result.human_review_required, true);
});

for (const ruling of ["ESCALATE_HUMAN", "UNKNOWN_RULING"]) {
  test(`escrow ${ruling} cannot expose a payout authorization`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({
      arbitration_ruling: {ruling, status: "decision_ready", payout_breakdown: {total_escrow_usd: 100, seller_payout_usd: 99}, execution_advisory: "Release funds"}
    }));
    const result = await new AgendaGuardClient().evaluateDispute({});
    assert.equal(result.ruling, "ESCALATE_HUMAN");
    assert.equal(result.status, "not_decision_ready");
    assert.equal(result.payout.seller_payout_usd, 0);
    assert.equal(result.payout.buyer_refund_usd, 0);
    assert.equal(result.payout.arbiter_fee_usd, 0);
    assert.equal(result.payout_breakdown, undefined);
    assert.match(result.execution_advisory, /human review/);
  });
}
