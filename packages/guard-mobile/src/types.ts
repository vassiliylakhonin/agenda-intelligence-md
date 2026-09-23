/**
 * Types for @agenda-intelligence/guard-mobile
 * Ultra-lightweight types for mobile & on-device AI agent safety.
 */

export type BlockchainNetwork =
  | "base"
  | "base_mainnet"
  | "ethereum"
  | "ethereum_mainnet"
  | "arbitrum"
  | "arbitrum_one"
  | "optimism"
  | "optimism_mainnet"
  | "solana"
  | "solana_mainnet"
  | "polygon"
  | "polygon_mainnet"
  | string;

export interface PolicyLimits {
  /** Maximum USD allowed for a single autonomous transaction without human 2FA. Default: 1000.0 */
  max_single_limit_usd?: number;
  /** Maximum rolling 24-hour USD budget. Default: 5000.0 */
  daily_velocity_limit_usd?: number;
  /** Caller-tracked spending over the last 24 hours in USD. Default: 0.0 */
  velocity_24h_usd?: number;
}

export interface TransactionCheckInput {
  /** Destination wallet or smart contract address (e.g. 0x...) */
  recipient: string;
  /** Transaction amount converted to USD equivalent */
  amount_usd: number;
  /** Target token symbol (e.g. "USDC", "ETH", "USDT"). Default: "USDC" */
  token?: string;
  /** Target blockchain network. Default: "base_mainnet" */
  network?: BlockchainNetwork;
  /** Agent reasoning / user prompt intent explaining why the transfer is taking place */
  intent_prompt: string;
  /** Calling smart contract method name (e.g. "transfer", "approve"). Optional. */
  method?: string;
  /** Contract calldata hex string (e.g. "0x095ea7b3..."). Optional. */
  calldata?: string;
  /** Optional custom policy limits for this specific check */
  policy_limits?: PolicyLimits;
  /** Optional correlation run ID. Auto-generated if omitted. */
  run_id?: string;
  /** Optional Base USDC tx hash for x402 micropayment settlement ($0.05) */
  x402_payment_tx?: string;
}

export type GuardDecision = "allow" | "reject" | "step_up_human_required";

export interface TransactionCheckResult {
  /** High-level boolean flag: true if the transaction passed all safety checks */
  isSafe: boolean;
  /** Deterministic decision from the firewall */
  decision: GuardDecision;
  /** Risk score (0 = lowest risk, 100 = critical threat) */
  score: number;
  /** Executive guidance for the agent/user */
  advisory: string;
  /** Granular status of individual security layers */
  checks: {
    sanctions_aml: boolean;
    contract_security: boolean;
    velocity_limits: boolean;
    prompt_injection: boolean;
  };
  /** List of triggered security violations */
  violations: string[];
  /** Gaps in evidence requiring review */
  evidence_gaps: string[];
  /** Whether human sign-off/2FA is mandatory before signing */
  human_review_required: boolean;
  /** Whether this verdict was evaluated by live Cloudflare Edge or local offline fallback */
  evaluated_by: "edge_worker" | "local_fallback";
}

export interface DealTerms {
  buyer_id: string;
  seller_id: string;
  amount_usd: number;
  currency: string;
  deadline_utc: string;
  arbitration_policy: "pro_rata" | "all_or_nothing";
  arbitration_fee_pct?: number;
}

export interface Specification {
  deliverable_type: string;
  expected_artifact_sha256?: string;
  expected_schema?: Record<string, unknown>;
  min_valid_records_pct?: number;
}

export interface DeliverySubmission {
  submitted_at: string;
  artifact_sha256?: string;
  artifact_data?: unknown;
  telemetry?: {
    total_items?: number;
    valid_items?: number;
  };
}

export interface EscrowDisputeInput {
  escrow_id: string;
  deal_terms: DealTerms;
  specification: Specification;
  delivery_submission: DeliverySubmission;
  /** Optional Base USDC tx hash for x402 dispute evaluation ($0.50) */
  x402_payment_tx?: string;
}

export type EscrowRuling = "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "PARTIAL_SETTLEMENT" | "ESCALATE_HUMAN";

export interface EscrowDisputeResult {
  ruling: EscrowRuling;
  status: "decision_ready" | "not_decision_ready";
  score: number;
  payout_breakdown: {
    total_escrow_usd: number;
    seller_payout_usd: number;
    buyer_refund_usd: number;
    arbiter_fee_usd: number;
  };
  checks: {
    deadline_honored: boolean;
    hash_verified: boolean;
    schema_verified: boolean;
    slo_verified: boolean;
  };
  violations: string[];
  evidence_gaps: string[];
  execution_advisory: string;
  evaluated_by: "edge_worker" | "local_fallback";
}

export interface ClientConfig {
  /** Custom Edge Worker URL for Financial Guard. Defaults to Cloudflare Anycast edge. */
  financialGuardUrl?: string;
  /** Custom Edge Worker URL for M2M Escrow. Defaults to Cloudflare Anycast edge. */
  m2mEscrowUrl?: string;
  /** Request timeout in milliseconds. Default: 8000ms */
  timeoutMs?: number;
  /** Enable offline local fallback heuristic if network request fails. Default: true */
  enableLocalFallback?: boolean;
  /** Injected fetch implementation (useful for tests or custom environments). */
  fetch?: typeof fetch;
}

export interface ProtectOptions {
  /**
   * If true, even "step_up_human_required" decisions throw TransactionStepUpRequiredError.
   * Default: false (only hard "reject" decisions throw TransactionBlockedError).
   */
  strictMode?: boolean;
  /**
   * Optional custom step-up handler invoked when decision is "step_up_human_required".
   * Return true to proceed with execution, or false to abort and throw.
   */
  onStepUp?: (result: TransactionCheckResult) => Promise<boolean> | boolean;
}

export class TransactionBlockedError extends Error {
  readonly decision: GuardDecision;
  readonly score: number;
  readonly violations: string[];
  readonly advisory: string;
  readonly checkResult: TransactionCheckResult;

  constructor(checkResult: TransactionCheckResult) {
    super(`Transaction blocked by Financial Guard: ${checkResult.advisory}`);
    this.name = "TransactionBlockedError";
    this.decision = checkResult.decision;
    this.score = checkResult.score;
    this.violations = checkResult.violations;
    this.advisory = checkResult.advisory;
    this.checkResult = checkResult;
  }
}

export class TransactionStepUpRequiredError extends Error {
  readonly decision: GuardDecision;
  readonly score: number;
  readonly evidenceGaps: string[];
  readonly advisory: string;
  readonly checkResult: TransactionCheckResult;

  constructor(checkResult: TransactionCheckResult) {
    super(`Transaction requires human 2FA approval: ${checkResult.advisory}`);
    this.name = "TransactionStepUpRequiredError";
    this.decision = checkResult.decision;
    this.score = checkResult.score;
    this.evidenceGaps = checkResult.evidence_gaps;
    this.advisory = checkResult.advisory;
    this.checkResult = checkResult;
  }
}
