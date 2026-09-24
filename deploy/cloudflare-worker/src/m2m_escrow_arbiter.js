import { validateEscrowArtifact } from "./escrow-schema.js";
// M2M Escrow Arbiter & Autonomous B2B Deal Settlement Engine
// Deterministic dispute resolution and delivery verification for Agent-to-Agent transactions.
// Evaluation is stateless; transport telemetry has its own retention policy.



export const M2M_ESCROW_ARBITER_CONTRACT_VERSION = "1.1.0";
export const M2M_ESCROW_ARBITER_PROFILE_KEY = "m2m_escrow_arbiter";

/**
 * Validates the incoming structured request for M2M Escrow Arbiter.
 */
export function validateM2MEscrowRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return ["Request body must be a JSON object"];
  }
  if (!body.escrow_id || typeof body.escrow_id !== "string") {
    errors.push("Missing required field: escrow_id");
  }
  if (!body.deal_terms || typeof body.deal_terms !== "object") {
    errors.push("Missing required object: deal_terms");
  } else {
    const terms = body.deal_terms;
    if (!terms.buyer_id || typeof terms.buyer_id !== "string") errors.push("Missing deal_terms.buyer_id");
    if (!terms.seller_id || typeof terms.seller_id !== "string") errors.push("Missing deal_terms.seller_id");
    if (typeof terms.amount_usd !== "number" || terms.amount_usd < 0) {
      errors.push("Invalid or missing deal_terms.amount_usd (must be >= 0)");
    }
    if (!terms.currency || typeof terms.currency !== "string") errors.push("Missing deal_terms.currency");
    if (!terms.deadline_utc || typeof terms.deadline_utc !== "string") errors.push("Missing deal_terms.deadline_utc");
    if (!terms.arbitration_policy || typeof terms.arbitration_policy !== "string") {
      errors.push("Missing deal_terms.arbitration_policy");
    }
  }
  if (!body.specification || typeof body.specification !== "object") {
    errors.push("Missing required object: specification");
  } else {
    if (!body.specification.deliverable_type || typeof body.specification.deliverable_type !== "string") {
      errors.push("Missing specification.deliverable_type");
    }
  }
  if (!body.delivery_submission || typeof body.delivery_submission !== "object") {
    errors.push("Missing required object: delivery_submission");
  } else {
    if (!body.delivery_submission.submitted_at || typeof body.delivery_submission.submitted_at !== "string") {
      errors.push("Missing delivery_submission.submitted_at");
    }
  }
  return errors;
}

/**
 * Computes SHA-256 hash string for payload data.
 */
async function computeSha256(data) {
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(str));
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (_e) {
    return null;
  }
}

/**
 * Deterministically evaluates the M2M escrow dispute and calculates non-binding allocation proposals.
 */
export async function evaluateM2MEscrowArbitration(requestBody, env = {}) {
  const terms = requestBody.deal_terms || {};
  const spec = requestBody.specification || {};
  const submission = requestBody.delivery_submission || {};
  let needsReview = false;

  const violations = [];
  const evidenceGaps = [];

  // Check 1: Timing & Deadline Verification
  let deadlineHonored = true;
  const deadlineMs = Date.parse(terms.deadline_utc);
  const submittedMs = Date.parse(submission.submitted_at);

  if (isNaN(deadlineMs)) {
    evidenceGaps.push("Unparseable deal_terms.deadline_utc timestamp.");
    deadlineHonored = false;
    needsReview = true;
  } else if (isNaN(submittedMs)) {
    evidenceGaps.push("Unparseable delivery_submission.submitted_at timestamp.");
    deadlineHonored = false;
    needsReview = true;
  } else if (submittedMs > deadlineMs) {
    deadlineHonored = false;
    const delaySec = Math.round((submittedMs - deadlineMs) / 1000);
    violations.push(`Deadline breach: deliverable submitted ${delaySec}s past contract deadline.`);
  }

  // Verification requires the artifact itself, not a caller-supplied digest.
  let hashVerified = false;
  let hashStatus = "not_evaluated";
  const hasArtifact = Object.hasOwn(submission, "artifact_data");
  if (typeof spec.expected_artifact_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(spec.expected_artifact_sha256)) {
    evidenceGaps.push("A valid expected artifact SHA-256 is required.");
    needsReview = true;
  } else if (!hasArtifact) {
    evidenceGaps.push("Artifact content is missing; a supplied digest is not proof of delivery.");
    needsReview = true;
  } else {
    const actual = await computeSha256(submission.artifact_data);
    hashVerified = actual === spec.expected_artifact_sha256.toLowerCase();
    hashStatus = hashVerified ? "passed" : "failed";
    if (!hashVerified) violations.push("Cryptographic hash mismatch for supplied artifact content.");
    if (submission.artifact_sha256 && submission.artifact_sha256.toLowerCase() !== actual) {
      hashVerified = false;
      hashStatus = "failed";
      violations.push("Declared artifact digest does not match supplied content.");
    }
  }

  let schemaVerified = false;
  let schemaStatus = "not_evaluated";
  if (Object.hasOwn(spec, "expected_schema")) {
    const validation = validateEscrowArtifact(spec.expected_schema, submission.artifact_data, hasArtifact);
    schemaVerified = validation.status === "valid";
    schemaStatus = schemaVerified ? "passed" : validation.status === "invalid" ? "failed" : "not_evaluated";
    if (validation.status === "invalid") violations.push(...validation.errors);
    if (validation.status === "unverified") { evidenceGaps.push(...validation.errors); needsReview = true; }
  } else {
    evidenceGaps.push("No expected schema was supplied; schema validation was not performed.");
    needsReview = true;
  }

  // Caller telemetry is an assertion, not independently verified SLO evidence.
  const telemetry = submission.telemetry || {};
  const validCounts = Number.isFinite(telemetry.total_items) && telemetry.total_items > 0 &&
    Number.isFinite(telemetry.valid_items) && telemetry.valid_items >= 0 && telemetry.valid_items <= telemetry.total_items;
  const deliveryPct = validCounts ? telemetry.valid_items / telemetry.total_items * 100 : 0;
  const minRequiredPct = spec.min_valid_records_pct ?? 95;
  const sloVerified = false;
  evidenceGaps.push("SLO telemetry and submission time are caller-reported; independent delivery evidence requires human review.");
  needsReview = true;
  if (validCounts && deliveryPct < minRequiredPct) violations.push("Declared delivery completeness is below the contract threshold.");

  // Synthesize Ruling & Payouts
  const totalEscrow = Number(terms.amount_usd) || 0;
  const feePct = typeof terms.arbitration_fee_pct === "number" ? terms.arbitration_fee_pct : 1.0;
  const arbiterFee = Math.round(totalEscrow * (feePct / 100) * 100) / 100;
  const netPool = Math.max(0, totalEscrow - arbiterFee);

  let ruling = "RELEASE_TO_SELLER";
  let status = "decision_ready";
  let score = 95;
  let sellerPayout = netPool;
  let buyerRefund = 0;
  let advisory = "Deliverable verified deterministically against contract specification. Proposed allocation only; human approval is required.";

  const isCompleteFailure = !deadlineHonored || !hashVerified || !schemaVerified;

  if (isCompleteFailure) {
    ruling = "REFUND_TO_BUYER";
    status = "decision_ready";
    score = 10;
    sellerPayout = 0;
    buyerRefund = netPool;
    advisory = "CRITICAL BREACH: Contract specification or deadline violated. Proposed refund only; no funds moved.";
  } else if (!sloVerified) {
    if (terms.arbitration_policy === "pro_rata" && deliveryPct > 0) {
      ruling = "PARTIAL_SETTLEMENT";
      status = "decision_ready";
      score = Math.round(deliveryPct);
      sellerPayout = Math.round(netPool * (deliveryPct / 100) * 100) / 100;
      buyerRefund = Math.round((netPool - sellerPayout) * 100) / 100;
      advisory = `PRO-RATA SETTLEMENT: Verified ${deliveryPct.toFixed(1)}% deliverable completion. Proposed proportional allocation only; no funds moved.`;
    } else {
      ruling = "REFUND_TO_BUYER";
      status = "decision_ready";
      score = 25;
      sellerPayout = 0;
      buyerRefund = netPool;
      advisory = "ALL-OR-NOTHING POLICY: Deliverable failed minimum SLO threshold. Full escrow refunded to buyer.";
    }
  }

  if (needsReview) {
    ruling = "ESCALATE_HUMAN";
    status = "not_decision_ready";
    score = 0;
    sellerPayout = 0;
    buyerRefund = 0;
    advisory = "Required evidence could not be verified. Hold escrow pending human review; no payout is authorized.";
  }

  // /v1/quorum/propose creates a pending proposal, not a clearance receipt.
  // No attestation protocol is configured for this evaluator. Never fabricate
  // a token or treat HTTP success as verification, and do not create proposals
  // as a side effect of an evidence check.
  const vizierStatus = "attestation_unavailable";
  const vizierReceipt = null;

  return {
    contract_version: M2M_ESCROW_ARBITER_CONTRACT_VERSION,
    profile: M2M_ESCROW_ARBITER_PROFILE_KEY,
    arbitration_ruling: {
      status,
      ruling,
      score,
      escrow_id: requestBody.escrow_id,
      payout_breakdown: {
        total_escrow_usd: totalEscrow,
        seller_payout_usd: sellerPayout,
        buyer_refund_usd: buyerRefund,
        arbiter_fee_usd: needsReview ? 0 : arbiterFee
      },
      checks: {
        deadline_honored: deadlineHonored,
        hash_verified: hashVerified,
        schema_verified: schemaVerified,
        slo_verified: sloVerified
      },
      check_status: {
        deadline: isNaN(deadlineMs) || isNaN(submittedMs) ? "not_evaluated" : deadlineHonored ? "passed" : "failed",
        hash: hashStatus, schema: schemaStatus, slo: "not_evaluated"
      },
      evaluation_scope: "supplied_artifact_only",
      settlement_authorized: false,
      violations,
      evidence_gaps: evidenceGaps,
      vizier_status: vizierStatus,
      vizier_clearance_receipt: vizierReceipt,
      human_review_required: true,
      not_advice_notice: "Evaluation of supplied evidence only; this response does not execute or authorize settlement.",
      execution_advisory: advisory
    }
  };
}
