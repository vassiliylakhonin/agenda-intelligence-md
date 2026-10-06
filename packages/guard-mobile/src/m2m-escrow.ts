/**
 * M2MEscrowClient
 * Autonomous arbitration and delivery verification client for Agent-to-Agent deals.
 */

import type { ClientConfig, EscrowDisputeInput, EscrowDisputeResult } from "./types.js";
import { createRetainedPaidCall } from "./paid-call.js";

export const DEFAULT_M2M_ESCROW_URL =
  "https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute";

export class M2MEscrowClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ClientConfig = {}) {
    this.endpoint = config.m2mEscrowUrl || DEFAULT_M2M_ESCROW_URL;
    this.timeoutMs = config.timeoutMs || 8000;
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
    const amount = input.deal_terms.amount_usd;
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

      return {
        ruling: rulingObj.ruling || "ESCALATE_HUMAN",
        status: rulingObj.status || "not_decision_ready",
        score: rulingObj.score ?? 0,
        payout_breakdown: rulingObj.payout_breakdown || {
          total_escrow_usd: amount,
          seller_payout_usd: 0,
          buyer_refund_usd: 0,
          arbiter_fee_usd: 0
        },
        checks: {
          deadline_honored: rulingObj.checks?.deadline_honored ?? false,
          hash_verified: rulingObj.checks?.hash_verified ?? false,
          schema_verified: rulingObj.checks?.schema_verified ?? false,
          slo_verified: rulingObj.checks?.slo_verified ?? false
        },
        violations: rulingObj.violations || [],
        evidence_gaps: rulingObj.evidence_gaps || [],
        execution_advisory: rulingObj.execution_advisory || "Evaluation completed.",
        evaluated_by: "edge_worker"
      };
    }, input.x402_payment_tx);
  }
}
