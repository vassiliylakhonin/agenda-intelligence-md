/**
 * M2MEscrowClient
 * Autonomous arbitration and delivery verification client for Agent-to-Agent deals.
 */

import type { ClientConfig, EscrowDisputeInput, EscrowDisputeResult } from "./types.js";

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
   * Deterministically evaluates an M2M escrow dispute and delivers binding payout allocations.
   */
  async evaluateDispute(input: EscrowDisputeInput): Promise<EscrowDisputeResult> {
    const payload = {
      escrow_id: input.escrow_id,
      deal_terms: input.deal_terms,
      specification: input.specification,
      delivery_submission: input.delivery_submission
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AgendaGuardMobile/1.0.0"
    };

    if (input.x402_payment_tx) {
      headers["X-Payment-Tx"] = input.x402_payment_tx;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`M2M Escrow Arbiter returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const rulingObj = data?.arbitration_ruling || {};

      return {
        ruling: rulingObj.ruling || "ESCALATE_HUMAN",
        status: rulingObj.status || "not_decision_ready",
        score: rulingObj.score ?? 0,
        payout_breakdown: rulingObj.payout_breakdown || {
          total_escrow_usd: input.deal_terms.amount_usd,
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
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      throw new Error(
        `M2MEscrowClient failed to evaluate dispute: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
