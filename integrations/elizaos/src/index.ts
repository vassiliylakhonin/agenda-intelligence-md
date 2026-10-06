/**
 * Evidence checks for proposed transactions and escrow deliveries.
 * These checks do not sign transactions, perform live sanctions clearance,
 * or authorize settlement. Human review remains required.
 */
import { createRetainedPaidCall, PaymentAdmissionError } from './paid-call.js';
export { PaymentAdmissionError, NetworkRequestError } from './paid-call.js';
export type { PaymentProof, RetainedPaidCall } from './paid-call.js';

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
  human_review_required: true;
  evidence_gaps: string[];
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
    deliverable_type: "json_data" | "code_artifact" | "model_weights" | "api_service" | "analysis_report" | "other";
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

export interface AgendaGuardClientConfig {
  /** Financial Guard base URL or full REST endpoint. */
  endpoint?: string;
  /** Escrow base URL or full REST endpoint; independent of the financial URL. */
  escrowEndpoint?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

function restEndpoint(base: string, path: string): string {
  const normalized = base.replace(/\/+$/, '');
  return normalized.endsWith(path) ? normalized : normalized + path;
}

export class AgendaGuardClient {
  private readonly endpoint: string;
  private readonly escrowEndpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: string | AgendaGuardClientConfig = {}) {
    const options = typeof config === 'string' ? {endpoint:config} : config;
    this.endpoint = restEndpoint(options.endpoint ||
      'https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev', '/v1/agent-financial/pre-sign-check');
    this.escrowEndpoint = restEndpoint(options.escrowEndpoint ||
      'https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev', '/v1/m2m-escrow/evaluate-dispute');
    this.timeoutMs = options.timeoutMs ?? 8000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('timeoutMs must be positive');
    this.fetchImpl = options.fetch || globalThis.fetch?.bind(globalThis);
    if (!this.fetchImpl) throw new Error('AgendaGuardClient requires fetch');
  }

  async checkTransactionSafety(
    params: TransactionSafetyRequest
  ): Promise<TransactionSafetyVerdict> {
    return this.createTransactionCheck(params).evaluate();
  }

  /** Keep this object for explicit signed payment retries and response recovery. */
  createTransactionCheck(params: TransactionSafetyRequest) {
    if (!validTransaction(params)) throw new Error('A structured recipient and non-negative finite amount_usd are required');
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

    return createRetainedPaidCall<TransactionSafetyVerdict>(this.endpoint, payload, this.fetchImpl, this.timeoutMs, data => {
      const verdict = data?.financial_guard_verdict || data;
      if (!verdict || !['allow','reject','step_up_human_required'].includes(verdict.decision)) {
        throw new Error('Missing bounded Financial Guard result');
      }
      return {
        decision: verdict.decision === "allow" ? "step_up_human_required" : verdict.decision,
        status: "not_decision_ready",
        score: Number.isFinite(verdict.score) ? verdict.score : 0,
        // Legacy endpoints cannot supply authoritative wallet history.
        is_safe: false,
        violations: Array.isArray(verdict.violations) ? verdict.violations : [],
        human_review_required: true,
        evidence_gaps: Array.isArray(verdict.evidence_gaps) ? verdict.evidence_gaps : [],
        execution_advisory: verdict.decision === "allow"
          ? "Legacy authorization is unverified; human review is required before signing."
          : verdict.execution_advisory || data.execution_advisory || "",
      };
    });
  }

  async evaluateDispute(
    params: EscrowDisputeRequest
  ): Promise<EscrowDisputeRuling> {
    return this.createDispute(params).evaluate();
  }

  /** No automatic payment, signing, retries or escrow settlement. */
  createDispute(params: EscrowDisputeRequest) {
    return createRetainedPaidCall<EscrowDisputeRuling>(this.escrowEndpoint, params, this.fetchImpl, this.timeoutMs, data => {
      const result = data?.arbitration_ruling || data;
      if (!result || typeof result.ruling !== 'string') {
        throw new Error('Missing bounded Escrow result');
      }
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
    });
  }
}

/**
 * ElizaOS Plugin Definition.
 */
function validTransaction(value: any): value is TransactionSafetyRequest {
  return Boolean(value && typeof value.recipient === 'string' && value.recipient.trim().length > 0 &&
    typeof value.amount_usd === 'number' && Number.isFinite(value.amount_usd) && value.amount_usd >= 0);
}

function actionRequest(message: any, options?: any): unknown {
  return options?.transactionSafetyRequest || (validTransaction(options) ? options : undefined) ||
    message?.content?.data?.transactionSafetyRequest;
}

export const agendaGuardPlugin = {
  name: "agenda-guard",
  description:
    "Evidence checks for proposed transactions and escrow deliveries; human review is required.",
  actions: [
    {
      name: "CHECK_TRANSACTION_SAFETY",
      description:
        "Checks supplied transaction evidence and known risk patterns; does not authorize signing.",
      similes: [],
      examples: [],
      validate: async (_runtime: any, message: any) => validTransaction(actionRequest(message)),
      handler: async (runtime: any, message: any, state: any, options: any, callback: any) => {
        const params = actionRequest(message, options);
        if (!validTransaction(params)) return {success:false, error:'Provide content.data.transactionSafetyRequest with recipient and amount_usd'};
        const configured = runtime?.getSetting?.('AGENDA_GUARD_ENDPOINT');
        const client = new AgendaGuardClient(typeof configured === 'string' ? configured : undefined);
        let verdict: TransactionSafetyVerdict;
        try { verdict = await client.checkTransactionSafety(params); }
        catch (error) {
          // The action never funds or retries on behalf of a conversational agent.
          return {success:false, error:error instanceof Error ? error.message : 'Evaluation failed',
            data: error instanceof PaymentAdmissionError ? {
              status:error.status, payment_details:error.details, payment_trace_id:error.paymentTraceId
            } : undefined,
            values:{signing_authorized:false,human_review_required:true}};
        }
        if (callback) {
          await callback({
            text: `[Agenda Guard] Risk Score: ${verdict.score}/100. Verdict: ${verdict.decision.toUpperCase()}. ${verdict.execution_advisory}`,
            data: verdict,
          });
        }
        return {success:true, data:{...verdict}, values:{signing_authorized:false,human_review_required:true}};
      },
    },
  ],
  // No wallet interception or automatic compliance evaluator is implemented.
  evaluators: [],
};

export default agendaGuardPlugin;
