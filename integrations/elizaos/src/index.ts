/**
 * Evidence checks for proposed transactions and escrow deliveries.
 * These checks do not sign transactions, perform live sanctions clearance,
 * or authorize settlement. Human review remains required.
 */

export interface TransactionSafetyRequest {
  recipient: string;
  amount_usd: number;
  network?: string;
  asset?: string;
  calldata?: string;
  intent?: string;
}

export interface TransactionSafetyVerdict {
  decision: "allow" | "reject" | "step_up_human_required";
  status: "clear" | "decision_ready" | "not_decision_ready" | "escalate";
  score: number;
  is_safe: boolean;
  violations: string[];
  execution_advisory: string;
}

export interface EscrowDisputeRequest {
  escrow_id: string;
  dispute_claim: {
    claimant: "buyer" | "seller";
    reason: string;
  };
  deal_terms: {
    buyer_id: string;
    seller_id: string;
    amount_usd: number;
    currency: string;
    deadline_utc: string;
    arbitration_policy: "pro_rata" | "all_or_nothing";
    arbitration_fee_pct?: number;
  };
  specification: {
    deliverable_type: string;
    expected_artifact_sha256?: string;
    expected_schema?: Record<string, unknown> | boolean | string;
    min_valid_records_pct?: number;
  };
  delivery_submission: {
    submitted_at: string;
    artifact_sha256?: string;
    artifact_data?: unknown;
    telemetry?: Record<string, any>;
  };
}

export interface EscrowDisputeRuling {
  ruling: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "PARTIAL_SETTLEMENT" | "ESCALATE_HUMAN";
  status: "decision_ready" | "not_decision_ready";
  human_review_required: true;
  vizier_status: "attestation_unavailable";
  score: number;
  payout: {
    total_escrow_usd: number;
    seller_payout_usd: number;
    buyer_refund_usd: number;
    arbiter_fee_usd: number;
  };
  execution_advisory: string;
  vizier_clearance_receipt: null;
}

export class AgendaGuardClient {
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint =
      endpoint ||
      "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev";
  }

  async checkTransactionSafety(
    params: TransactionSafetyRequest
  ): Promise<TransactionSafetyVerdict> {
    const payload = {
      run_id: `elizaos-${Date.now()}`,
      transaction: {
        network: params.network || "base_mainnet",
        token: params.asset || "USDC",
        amount_usd: params.amount_usd,
        recipient: params.recipient,
        calldata: params.calldata || "0x",
      },
      intent: {
        prompt: params.intent || "ElizaOS agent transaction execution",
      },
    };

    const resp = await fetch(
      `${this.endpoint}/v1/agent-financial/pre-sign-check`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!resp.ok) {
      throw new Error(`Financial guard check failed: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const verdict = data.financial_guard_verdict || data;
    return {
      decision: verdict.decision === "allow" ? "step_up_human_required" : verdict.decision,
      status: verdict.decision === "allow" ? "not_decision_ready" : verdict.status,
      score: verdict.score,
      // Legacy endpoints cannot supply authoritative wallet history.
      is_safe: false,
      violations: verdict.violations || [],
      execution_advisory: verdict.decision === "allow"
        ? "Legacy authorization is unverified; human review is required before signing."
        : verdict.execution_advisory || data.execution_advisory || "",
    };
  }

  async evaluateDispute(
    params: EscrowDisputeRequest
  ): Promise<EscrowDisputeRuling> {
    const arbiterEndpoint =
      "https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute";

    const resp = await fetch(arbiterEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      throw new Error(`Dispute evaluation failed: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const result = data.arbitration_ruling || data;
    const ready = result.status === "decision_ready" &&
      ["RELEASE_TO_SELLER", "REFUND_TO_BUYER", "PARTIAL_SETTLEMENT"].includes(result.ruling);
    const payout = result.payout_breakdown || result.payout || {};
    return {
      score: ready ? result.score : 0,
      ruling: ready ? result.ruling : "ESCALATE_HUMAN",
      status: ready ? "decision_ready" : "not_decision_ready",
      payout: ready ? payout : {
        total_escrow_usd: payout.total_escrow_usd ?? params.deal_terms?.amount_usd ?? 0,
        seller_payout_usd: 0,
        buyer_refund_usd: 0,
        arbiter_fee_usd: 0,
      },
      human_review_required: true,
      vizier_status: "attestation_unavailable",
      vizier_clearance_receipt: null,
      execution_advisory: ready ? result.execution_advisory || "" :
        "Hold escrow pending human review; no payout is authorized.",
    };
  }
}

/**
 * ElizaOS Plugin Definition.
 */
export const agendaGuardPlugin = {
  name: "agenda-guard",
  description:
    "Evidence checks for proposed transactions and escrow deliveries; human review is required.",
  actions: [
    {
      name: "CHECK_TRANSACTION_SAFETY",
      description:
        "Checks supplied transaction evidence and known risk patterns; does not authorize signing.",
      validate: async () => true,
      handler: async (runtime: any, message: any, state: any, options: any, callback: any) => {
        const client = new AgendaGuardClient();
        const verdict = await client.checkTransactionSafety(options);
        if (callback) {
          callback({
            text: `[Agenda Guard] Risk Score: ${verdict.score}/100. Verdict: ${verdict.decision.toUpperCase()}. ${verdict.execution_advisory}`,
            data: verdict,
          });
        }
        return verdict.is_safe;
      },
    },
  ],
  // No wallet interception or automatic compliance evaluator is implemented.
  evaluators: [],
};

export default agendaGuardPlugin;
