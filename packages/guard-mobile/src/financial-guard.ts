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

export const DEFAULT_FINANCIAL_GUARD_URL =
  "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check";

export class AgentFinancialGuardClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly enableLocalFallback: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ClientConfig = {}) {
    this.endpoint = config.financialGuardUrl || DEFAULT_FINANCIAL_GUARD_URL;
    this.timeoutMs = config.timeoutMs || 8000;
    this.enableLocalFallback = config.enableLocalFallback ?? true;
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
   * Throws `TransactionStepUpRequiredError` if strictMode is enabled and decision === "step_up_human_required".
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

    if (checkResult.decision === "step_up_human_required") {
      if (options.onStepUp) {
        const approved = await options.onStepUp(checkResult);
        if (!approved) {
          throw new TransactionStepUpRequiredError(checkResult);
        }
      } else if (options.strictMode) {
        throw new TransactionStepUpRequiredError(checkResult);
      }
    }

    const executionResult = await executor();
    return { executionResult, checkResult };
  }

  /**
   * Evaluates transaction safety AND attaches x402 Base USDC payment tx hash to request
   * an authoritative cryptographic Vizier attestation receipt (vrf_...).
   *
   * @param input Transaction check payload
   * @param paymentTxHash Confirmed Base USDC transaction hash for $0.05 attestation fee
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
   * Performs full deterministic pre-sign verification across 4 layers:
   * 1. OFAC / AML Sanctions screening
   * 2. Smart contract drainer / infinite approval heuristics
   * 3. Velocity & spending limits
   * 4. Adversarial prompt injection & intent inspection
   */
  async check(input: TransactionCheckInput): Promise<TransactionCheckResult> {
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
        amount_usd: Number(input.amount_usd) || 0,
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
        throw new Error(`Edge Worker returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const verdict = data?.financial_guard_verdict || {};

      const decision = verdict.decision || "reject";
      const isSafe = decision === "allow";

      return {
        isSafe,
        decision,
        score: verdict.score ?? 50,
        advisory: verdict.execution_advisory || "Pre-sign check completed.",
        checks: {
          sanctions_aml: verdict.checks?.sanctions_aml ?? false,
          contract_security: verdict.checks?.contract_security ?? false,
          velocity_limits: verdict.checks?.velocity_limits ?? false,
          prompt_injection: verdict.checks?.prompt_injection ?? false
        },
        violations: verdict.violations || [],
        evidence_gaps: verdict.evidence_gaps || [],
        human_review_required: verdict.human_review_required ?? true,
        evaluated_by: "edge_worker",
        vizier_clearance_receipt: verdict.vizier_clearance_receipt ?? null,
        attestation: verdict.attestation ?? null,
        x402_challenge: verdict.x402_challenge ?? null
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (this.enableLocalFallback) {
        return evaluateLocalFallback(input);
      }

      throw new Error(
        `AgentFinancialGuard failed to connect to Edge and local fallback is disabled: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
