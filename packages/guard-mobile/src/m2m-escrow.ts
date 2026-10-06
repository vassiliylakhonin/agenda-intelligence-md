/**
 * M2MEscrowClient
 * Supplied delivery-evidence review; no automatic settlement or verified receipt.
 */

import type { ClientConfig, EscrowDisputeInput, EscrowDisputeResult } from "./types.js";
import { createRetainedPaidCall } from "./paid-call.js";

export const DEFAULT_M2M_ESCROW_URL =
  "https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute";


function boundedPayout(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  const fields = [value.total_escrow_usd, value.seller_payout_usd, value.buyer_refund_usd, value.arbiter_fee_usd];
  if (!fields.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER / 100)) return false;
  const cents = fields.map(n => Math.round(n * 100));
  if (!fields.every((n, i) => Math.abs(n * 100 - cents[i]) <= 0.000001)) return false;
  return cents[1] + cents[2] + cents[3] === cents[0];
}

export class M2MEscrowClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ClientConfig = {}) {
    this.endpoint = config.m2mEscrowUrl || DEFAULT_M2M_ESCROW_URL;
    this.timeoutMs = config.timeoutMs ?? 8000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("timeoutMs must be positive");
    this.fetchImpl = config.fetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined as unknown as typeof fetch);

    if (!this.fetchImpl) {
      throw new Error(
        "M2MEscrowClient requires global fetch or config.fetch to be provided."
      );
    }
  }

  /**
   * Review supplied delivery evidence; reported allocations never authorize settlement.
   */
  async evaluateDispute(input: EscrowDisputeInput): Promise<EscrowDisputeResult> {
    return this.createDispute(input).evaluate();
  }

  /** Retain this object for explicit payment challenge and recovery. No payout. */
  createDispute(input: EscrowDisputeInput) {
    const amount = input?.deal_terms?.amount_usd;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error("amount_usd must be a non-negative finite number");
    const payload = {
      escrow_id: input.escrow_id,
      deal_terms: input.deal_terms,
      specification: input.specification,
      delivery_submission: input.delivery_submission
    };

    return createRetainedPaidCall<EscrowDisputeResult>(this.endpoint, payload, this.fetchImpl, this.timeoutMs, data => {
      const rulingObj = data?.arbitration_ruling;
      if (!rulingObj || !["RELEASE_TO_SELLER", "REFUND_TO_BUYER", "PARTIAL_SETTLEMENT", "ESCALATE_HUMAN"].includes(rulingObj.ruling)) {
        throw new Error("Missing bounded Escrow result");
      }

      const payout = rulingObj.payout_breakdown;
      const ready = rulingObj.status === "decision_ready" && rulingObj.ruling !== "ESCALATE_HUMAN" &&
        Number.isFinite(rulingObj.score) && rulingObj.score >= 0 && rulingObj.score <= 100 &&
        boundedPayout(payout) && Math.round(payout.total_escrow_usd * 100) === Math.round(amount * 100);
      return {
        ruling: ready ? rulingObj.ruling : "ESCALATE_HUMAN",
        status: ready ? "decision_ready" : "not_decision_ready",
        score: ready ? rulingObj.score : 0,
        human_review_required: true,
        settlement_authorized: false,
        payout_breakdown: ready ? payout : {
          total_escrow_usd: amount,
          seller_payout_usd: 0,
          buyer_refund_usd: 0,
          arbiter_fee_usd: 0
        },
        checks: {
          deadline_honored: rulingObj.checks?.deadline_honored === true,
          hash_verified: rulingObj.checks?.hash_verified === true,
          schema_verified: rulingObj.checks?.schema_verified === true,
          slo_verified: rulingObj.checks?.slo_verified === true
        },
        violations: Array.isArray(rulingObj.violations) ? rulingObj.violations.filter((value: unknown) => typeof value === "string") : [],
        evidence_gaps: Array.isArray(rulingObj.evidence_gaps) ? rulingObj.evidence_gaps.filter((value: unknown) => typeof value === "string") : [],
        execution_advisory: ready ? "Proposed allocation only; human review is required. No payout is authorized." :
          "Hold escrow pending human review; no payout is authorized.",
        evaluated_by: "edge_worker"
      };
    }, input.x402_payment_tx);
  }
}
