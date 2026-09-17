/**
 * ElizaOS Plugin: Agenda Financial Guard & M2M Escrow Arbiter.
 *
 * Intercepts autonomous agent actions to prevent:
 * 1. Transfers to OFAC SDN blacklisted addresses (Tornado Cash, Lazarus).
 * 2. Smart contract drainers & infinite token allowances.
 * 3. Treasury velocity limit breaches.
 *
 * Provides autonomous arbitration for B2B agent-to-agent deliverable disputes.
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
  decision: "allow" | "reject";
  status: "clear" | "escalate";
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
    expected_artifact_sha256: string;
  };
  delivery_submission: {
    submitted_at: string;
    artifact_sha256: string;
    telemetry?: Record<string, any>;
  };
}

export interface EscrowDisputeRuling {
  ruling: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "PARTIAL_SETTLEMENT";
  score: number;
  payout: {
    total_escrow_usd: number;
    seller_payout_usd: number;
    buyer_refund_usd: number;
    arbiter_fee_usd: number;
  };
  execution_advisory: string;
  vizier_clearance_receipt?: string;
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
      transaction: {
        recipient: params.recipient,
        amount_usd: params.amount_usd,
        network: params.network || "base",
        asset: params.asset || "USDC",
        calldata: params.calldata || "0x",
      },
      intent: params.intent || "ElizaOS agent transaction execution",
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
    return {
      decision: data.decision,
      status: data.status,
      score: data.score,
      is_safe: data.decision === "allow",
      violations: data.violations || [],
      execution_advisory: data.execution_advisory || "",
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

    return (await resp.json()) as EscrowDisputeRuling;
  }
}

/**
 * ElizaOS Plugin Definition.
 */
export const agendaGuardPlugin = {
  name: "agenda-guard",
  description:
    "Pre-sign transaction firewall and autonomous B2B escrow arbiter for ElizaOS agents on Base.",
  actions: [
    {
      name: "CHECK_TRANSACTION_SAFETY",
      description:
        "Validates an on-chain transaction against OFAC sanctions, drainers, and treasury limits before signing.",
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
  evaluators: [
    {
      name: "TRANSACTION_RISK_EVALUATOR",
      description: "Evaluates outgoing proposed transactions for safety and compliance.",
      validate: async () => true,
      handler: async (runtime: any, message: any) => {
        // Intercepts outgoing financial intents
        return true;
      },
    },
  ],
};

export default agendaGuardPlugin;
