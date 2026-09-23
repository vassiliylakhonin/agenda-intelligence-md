/**
 * AgentFinancialGuardClient
 * High-performance, zero-dependency client for pre-sign transaction safety checks on Cloudflare Edge.
 */

import type { ClientConfig, TransactionCheckInput, TransactionCheckResult } from "./types.js";
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
        evaluated_by: "edge_worker"
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
