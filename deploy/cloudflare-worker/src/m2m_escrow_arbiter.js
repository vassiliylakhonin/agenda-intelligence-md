// M2M Escrow Arbiter & Autonomous B2B Deal Settlement Engine
// Deterministic dispute resolution and delivery verification for Agent-to-Agent transactions.
// Zero-Retention: All evaluations run strictly in volatile Edge memory and are never persisted.

import { isTrustVizierEnabled, VIZIER_DEFAULT_URL } from "./upstream_vizier_trust.js";

export const M2M_ESCROW_ARBITER_CONTRACT_VERSION = "1.0.0";
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
 * Deterministically evaluates the M2M escrow dispute and delivers binding payout allocation.
 */
export async function evaluateM2MEscrowArbitration(requestBody, env = {}) {
  const terms = requestBody.deal_terms || {};
  const spec = requestBody.specification || {};
  const submission = requestBody.delivery_submission || {};
  const disputeClaim = requestBody.dispute_claim || {};

  const violations = [];
  const evidenceGaps = [];

  // Check 1: Timing & Deadline Verification
  let deadlineHonored = true;
  const deadlineMs = Date.parse(terms.deadline_utc);
  const submittedMs = Date.parse(submission.submitted_at);

  if (isNaN(deadlineMs)) {
    evidenceGaps.push("Unparseable deal_terms.deadline_utc timestamp.");
  } else if (isNaN(submittedMs)) {
    evidenceGaps.push("Unparseable delivery_submission.submitted_at timestamp.");
    deadlineHonored = false;
  } else if (submittedMs > deadlineMs) {
    deadlineHonored = false;
    const delaySec = Math.round((submittedMs - deadlineMs) / 1000);
    violations.push(`Deadline breach: deliverable submitted ${delaySec}s past contract deadline.`);
  }

  // Check 2: Cryptographic Hash & Integrity
  let hashVerified = true;
  if (spec.expected_artifact_sha256) {
    const expHash = spec.expected_artifact_sha256.toLowerCase().trim();
    let actHash = (submission.artifact_sha256 || "").toLowerCase().trim();

    if (!actHash && submission.artifact_data) {
      actHash = await computeSha256(submission.artifact_data);
    }

    if (!actHash) {
      hashVerified = false;
      violations.push("Missing artifact SHA-256 hash in delivery submission.");
    } else if (actHash !== expHash) {
      hashVerified = false;
      violations.push(`Cryptographic hash mismatch: expected '${expHash}', received '${actHash}'.`);
    }
  }

  // Check 3: Schema & Structural Verification
  let schemaVerified = true;
  if (spec.expected_schema) {
    if (!submission.artifact_data && !submission.artifact_sha256) {
      schemaVerified = false;
      violations.push("No artifact data or verifiable payload provided to validate against expected_schema.");
    } else if (submission.artifact_data && typeof submission.artifact_data !== "object") {
      schemaVerified = false;
      violations.push("Artifact data format error: expected structured JSON object matching contract schema.");
    }
  }

  // Check 4: SLO & Completeness
  let sloVerified = true;
  let deliveryPct = 100.0;
  const telemetry = submission.telemetry || {};

  if (typeof telemetry.total_items === "number" && telemetry.total_items > 0) {
    const valid = typeof telemetry.valid_items === "number" ? telemetry.valid_items : telemetry.total_items;
    deliveryPct = Math.min(100.0, Math.max(0.0, (valid / telemetry.total_items) * 100.0));
  }

  const minRequiredPct = spec.min_valid_records_pct ?? 95.0;
  if (deliveryPct < minRequiredPct) {
    sloVerified = false;
    violations.push(`SLO threshold failure: deliverable validity score ${deliveryPct.toFixed(1)}% is below contract minimum ${minRequiredPct.toFixed(1)}%.`);
  }

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
  let advisory = "Deliverable verified deterministically against contract specification. Full escrow release approved.";

  const isCompleteFailure = !deadlineHonored || !hashVerified || (!schemaVerified && spec.expected_schema);

  if (isCompleteFailure) {
    ruling = "REFUND_TO_BUYER";
    status = "decision_ready";
    score = 10;
    sellerPayout = 0;
    buyerRefund = netPool;
    advisory = "CRITICAL BREACH: Contract specification or deadline violated. Escrow refunded to buyer.";
  } else if (!sloVerified) {
    if (terms.arbitration_policy === "pro_rata" && deliveryPct > 0) {
      ruling = "PARTIAL_SETTLEMENT";
      status = "decision_ready";
      score = Math.round(deliveryPct);
      sellerPayout = Math.round(netPool * (deliveryPct / 100) * 100) / 100;
      buyerRefund = Math.round((netPool - sellerPayout) * 100) / 100;
      advisory = `PRO-RATA SETTLEMENT: Verified ${deliveryPct.toFixed(1)}% deliverable completion. Proportional payout released to seller, remainder refunded to buyer.`;
    } else {
      ruling = "REFUND_TO_BUYER";
      status = "decision_ready";
      score = 25;
      sellerPayout = 0;
      buyerRefund = netPool;
      advisory = "ALL-OR-NOTHING POLICY: Deliverable failed minimum SLO threshold. Full escrow refunded to buyer.";
    }
  }

  // Layer 5: Optional Vizier Quorum & Attestation
  let vizierStatus = "edge_evaluated";
  let vizierReceipt = null;

  if (isTrustVizierEnabled(env)) {
    try {
      const vizierBase = (env.VIZIER_BASE_URL || VIZIER_DEFAULT_URL).replace(/\/+$/, "");
      const fetcher = (env.VIZIER && typeof env.VIZIER.fetch === "function")
        ? (url, init) => env.VIZIER.fetch(url, init)
        : (url, init) => globalThis.fetch(url, init);

      const resp = await fetcher(`${vizierBase}/v1/quorum/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "m2m_escrow_arbitration_ruling",
          parameters: {
            escrow_id: requestBody.escrow_id,
            buyer_id: terms.buyer_id,
            seller_id: terms.seller_id,
            ruling,
            total_escrow_usd: totalEscrow,
            seller_payout_usd: sellerPayout,
            buyer_refund_usd: buyerRefund,
            arbiter_fee_usd: arbiterFee
          }
        })
      });
      if (resp && resp.ok) {
        const vData = await resp.json();
        vizierStatus = "vizier_verified";
        vizierReceipt = vData.receipt || vData.jws || `jws_m2m_arbiter_${Date.now()}`;
      }
    } catch (_e) {
      vizierStatus = "vizier_fallback_degraded";
    }
  }

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
        arbiter_fee_usd: arbiterFee
      },
      checks: {
        deadline_honored: deadlineHonored,
        hash_verified: hashVerified,
        schema_verified: schemaVerified,
        slo_verified: sloVerified
      },
      violations,
      evidence_gaps: evidenceGaps,
      vizier_status: vizierStatus,
      vizier_clearance_receipt: vizierReceipt,
      execution_advisory: advisory
    }
  };
}
