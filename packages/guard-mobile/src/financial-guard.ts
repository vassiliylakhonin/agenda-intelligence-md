/**
 * AgentFinancialGuardClient
 * High-performance, zero-dependency client for pre-sign transaction safety checks on Cloudflare Edge.
 */

import {
  type ClientConfig,
  type ProtectOptions,
  type TransactionCheckInput,
  type TransactionCheckResult,
  TransactionBlockedError,
  TransactionStepUpRequiredError
} from "./types.js";
import { evaluateLocalFallback } from "./local-rules.js";
import { createRetainedPaidCall, NetworkRequestError } from "./paid-call.js";

export const DEFAULT_FINANCIAL_GUARD_URL =
  "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check";

export class AgentFinancialGuardClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly enableLocalFallback: boolean;
  private readonly offlineFailClosed: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ClientConfig = {}) {
    this.endpoint = config.financialGuardUrl || DEFAULT_FINANCIAL_GUARD_URL;
    this.timeoutMs = config.timeoutMs ?? 8000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("timeoutMs must be positive");
    this.enableLocalFallback = config.enableLocalFallback ?? true;
    this.offlineFailClosed = config.offlineFailClosed ?? true;
    this.fetchImpl = config.fetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined as unknown as typeof fetch);

    if (!this.fetchImpl) {
      throw new Error(
        "AgentFinancialGuardClient requires global fetch or config.fetch to be provided."
      );
    }
  }

  /**
   * Fast convenience check returning a simple boolean.
   * Useful for mobile UI gates: `if (!(await guard.isSafe(tx))) alert("Blocked");`
   */
  async isSafe(input: TransactionCheckInput): Promise<boolean> {
    const res = await this.check(input);
    return res.isSafe;
  }

  /**
   * Zero-boilerplate execution wrapper.
   * Evaluates transaction safety BEFORE calling the user's execution callback.
   * Throws `TransactionBlockedError` if decision === "reject".
   * Requires an explicit approving onStepUp callback whenever human review is required.
   *
   * @example
   * const { executionResult, checkResult } = await guard.protect(
   *   tx,
   *   () => wallet.sendTransaction(tx)
   * );
   */
  async protect<T>(
    input: TransactionCheckInput,
    executor: () => Promise<T> | T,
    options: ProtectOptions = {}
  ): Promise<{ executionResult: T; checkResult: TransactionCheckResult }> {
    const checkResult = await this.check(input);

    if (checkResult.decision === "reject") {
      throw new TransactionBlockedError(checkResult);
    }

    if (checkResult.decision === "step_up_human_required" || checkResult.human_review_required || !checkResult.isSafe) {
      if (options.onStepUp) {
        const approved = await options.onStepUp(checkResult);
        if (approved !== true) {
          throw new TransactionStepUpRequiredError(checkResult);
        }
      } else {
        throw new TransactionStepUpRequiredError(checkResult);
      }
    }

    const executionResult = await executor();
    return { executionResult, checkResult };
  }

  /**
   * Submit an existing payment hash. A hash alone returns a signature challenge;
   * use createCheck() to retain the exact request for explicit signed recovery.
   *
   * @param input Transaction check payload
   * @param paymentTxHash Confirmed Base USDC transaction hash for $0.05 evaluation fee
   */
  async checkWithAttestation(
    input: TransactionCheckInput,
    paymentTxHash: string
  ): Promise<TransactionCheckResult> {
    return this.check({
      ...input,
      x402_payment_tx: paymentTxHash
    });
  }

  /**
   * Submit a pre-sign evidence review. Local risk flags are not current
   * sanctions clearance or verified spending history; review the evidence gaps.
   */
  async check(input: TransactionCheckInput): Promise<TransactionCheckResult> {
    const snapshot = structuredClone(input);
    const call = this.createCheck(snapshot);
    try { return await call.evaluate(); }
    catch (error) {
      if (error instanceof NetworkRequestError && !call.hasPayment() && this.enableLocalFallback) {
        return evaluateLocalFallback(snapshot, {failClosed:this.offlineFailClosed});
      }
      throw error;
    }
  }

  /** Keep the returned call for exact-request challenge and lost-response recovery. */
  createCheck(input: TransactionCheckInput) {
    if (!input || typeof input.amount_usd !== "number" || !Number.isFinite(input.amount_usd) || input.amount_usd < 0) {
      throw new Error("amount_usd must be a non-negative finite number");
    }
    if (typeof input.recipient !== "string" || !input.recipient.trim()) throw new Error("recipient is required");
    for (const [name, value] of Object.entries(input.policy_limits || {})) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number`);
    }
    const runId = input.run_id || `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const payload = {
      run_id: runId,
      agent: {
        id: "mobile-agent-client",
        model: "on-device-client",
        operator: "autonomous"
      },
      transaction: {
        network: input.network || "base_mainnet",
        token: input.token || "USDC",
        amount_usd: input.amount_usd,
        recipient: input.recipient,
        method: input.method || "transfer",
        calldata: input.calldata || "0x"
      },
      intent: {
        prompt: input.intent_prompt
      },
      policy_limits: {
        max_single_limit_usd: input.policy_limits?.max_single_limit_usd ?? 1000,
        daily_velocity_limit_usd: input.policy_limits?.daily_velocity_limit_usd ?? 5000,
        velocity_24h_usd: input.policy_limits?.velocity_24h_usd ?? 0
      }
    };

    return createRetainedPaidCall<TransactionCheckResult>(this.endpoint, payload, this.fetchImpl, this.timeoutMs, data => {
      const verdict = data?.financial_guard_verdict;
      if (!verdict || !["allow", "reject", "step_up_human_required"].includes(verdict.decision)) {
        throw new Error("Missing bounded Financial Guard result");
      }

      // ADR 0027: legacy claims cannot restore wallet permission. This client
      // has no authenticated, signed, request-bound authorization verifier.
      const decision = verdict.decision === "allow" ? "step_up_human_required" : verdict.decision;
      const isSafe = false;

      return {
        isSafe,
        decision,
        score: Number.isFinite(verdict.score) && verdict.score >= 0 && verdict.score <= 100 ? verdict.score : 50,
        advisory: verdict.decision === "allow" ? "Unverified legacy authorization; human review is required before signing." :
          typeof verdict.execution_advisory === "string" ? verdict.execution_advisory : "Pre-sign evidence review completed; human review is required.",
        checks: {
          sanctions_aml: verdict.checks?.sanctions_aml === true,
          contract_security: verdict.checks?.contract_security === true,
          velocity_limits: verdict.checks?.velocity_limits === true,
          prompt_injection: verdict.checks?.prompt_injection === true
        },
        violations: Array.isArray(verdict.violations) ? verdict.violations.filter((value: unknown) => typeof value === "string") : [],
        evidence_gaps: Array.isArray(verdict.evidence_gaps) ? verdict.evidence_gaps.filter((value: unknown) => typeof value === "string") : [],
        human_review_required: true,
        evaluated_by: "edge_worker",
        vizier_clearance_receipt: verdict.vizier_clearance_receipt ?? null,
        attestation: verdict.attestation ?? null,
        x402_challenge: verdict.x402_challenge ?? null
      };
    }, input.x402_payment_tx);
  }
}
