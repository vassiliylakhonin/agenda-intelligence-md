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
