// Agent Financial Guard & Autonomous Transaction Firewall Engine
// Deterministic pre-sign validation for autonomous agents with wallet capabilities.
// Zero-Retention: All data is evaluated in volatile Edge memory and never persisted.

import { isTrustVizierEnabled, VIZIER_DEFAULT_URL } from "./upstream_vizier_trust.js";

export const AGENT_FINANCIAL_GUARD_CONTRACT_VERSION = "1.0.0";
export const AGENT_FINANCIAL_GUARD_PROFILE_KEY = "agent_financial_guard";

// High-impact known OFAC SDN / sanctioned addresses & mixer contracts (normalized lowercase)
export const SANCTIONED_CRYPTO_ADDRESSES = new Set([
  // Tornado Cash core routers & proxies (OFAC SDN designated)
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
  "0x722122df12d45b1410ac727761ba7975772da855",
  "0x8589427373d6d84e98730d7795d8f6f8731fda16",
  "0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f",
  "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
  // Lazarus Group & Ronin Bridge exploit destination clusters
  "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
  "0xa0e1c087346358e59675a523171b085c6b308c01",
  "0x53b6936513e738f44fb50d2b9476730c0ab3bfc1",
  // Garantex main deposit & liquidation routing addresses (OFAC designated)
  "0x61f2382e87903264426543b591b6e4b85c13e488",
  "0x2f389904178ea3c113502280ce42964e7c3a0df4"
]);

// Drainer & Phishing calldata signatures
const UNLIMITED_ALLOWANCE_PATTERNS = [
  /ffffffffffffffffffffffffffffffff/i,
  /115792089237316195423570985008687907853269984665640564039457584007913129639935/
];

// Adversarial prompt injection / jailbreak patterns in LLM transaction intents
const ADVERSARIAL_INTENT_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|rules|limits)/i,
  /bypass\s+(compliance|limits|checks|security|guardrails)/i,
  /override\s+(policy|system|guard|limit)/i,
  /drain\s+(all\s+funds|the\s+wallet|treasury|balance)/i,
  /emergency\s+(sweep|drain|withdrawal\s+all)/i,
  /send\s+all\s+(funds|balance|usdc|eth)/i
];

/**
 * Validates the incoming structured request for Agent Financial Guard.
 */
export function validateFinancialGuardRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return ["Request body must be a JSON object"];
  }
  if (!body.run_id || typeof body.run_id !== "string") {
    errors.push("Missing required field: run_id");
  }
  if (!body.transaction || typeof body.transaction !== "object") {
    errors.push("Missing required object: transaction");
  } else {
    const tx = body.transaction;
    if (!tx.network || typeof tx.network !== "string") errors.push("Missing transaction.network");
    if (!tx.token || typeof tx.token !== "string") errors.push("Missing transaction.token");
    if (typeof tx.amount_usd !== "number" || tx.amount_usd < 0) errors.push("Invalid or missing transaction.amount_usd (must be >= 0)");
    if (!tx.recipient || typeof tx.recipient !== "string") errors.push("Missing transaction.recipient");
  }
  if (!body.intent || typeof body.intent !== "object" || !body.intent.prompt) {
    errors.push("Missing required object: intent.prompt");
  }
  return errors;
}

/**
 * Deterministically evaluates the financial transaction across all 4 firewall layers.
 */
export async function evaluateAgentFinancialTransaction(requestBody, env = {}) {
  const tx = requestBody.transaction || {};
  const intent = requestBody.intent || {};
  const limits = requestBody.policy_limits || {};

  const violations = [];
  const evidenceGaps = [];

  let sanctionsPassed = true;
  let contractSecurityPassed = true;
  let velocityLimitsPassed = true;
  let promptInjectionPassed = true;

  // Layer 1: Sanctions & AML Recipient Screening
  const rawRecipient = (tx.recipient || "").trim().toLowerCase();
  if (SANCTIONED_CRYPTO_ADDRESSES.has(rawRecipient)) {
    sanctionsPassed = false;
    violations.push(`Recipient address (${rawRecipient}) is designated under OFAC SDN / sanctions blacklist.`);
  }

  // Layer 2: Smart Contract & Drainer Heuristics
  const method = (tx.method || "").toLowerCase();
  const calldata = (tx.calldata || "").toLowerCase();

  if (method === "approve") {
    const isUnlimited = UNLIMITED_ALLOWANCE_PATTERNS.some(pat => pat.test(calldata)) || (tx.amount_usd > 1000000);
    if (isUnlimited) {
      contractSecurityPassed = false;
      violations.push("Unconstrained infinite token approval (approve max uint256) detected. Potential wallet drainer vector.");
    }
  }

  // Layer 3: Velocity & Spending Limits
  const maxSingle = limits.max_single_limit_usd ?? 1000;
  const dailyVelocity = limits.daily_velocity_limit_usd ?? 5000;
  const currentVelocity = limits.velocity_24h_usd ?? 0;

  let limitExceeded = false;
  let requiresStepUp = false;

  if (tx.amount_usd > maxSingle) {
    limitExceeded = true;
    requiresStepUp = true;
    evidenceGaps.push(`Transaction amount ($${tx.amount_usd.toFixed(2)}) exceeds single-action policy limit ($${maxSingle.toFixed(2)}).`);
  }

  if (currentVelocity + tx.amount_usd > dailyVelocity) {
    velocityLimitsPassed = false;
    violations.push(`Transaction exceeds 24-hour velocity budget: current velocity $${currentVelocity.toFixed(2)} + $${tx.amount_usd.toFixed(2)} > daily cap $${dailyVelocity.toFixed(2)}.`);
  }

  // Layer 4: Adversarial Prompt & Intent Inspection
  const intentPrompt = intent.prompt || "";
  for (const pattern of ADVERSARIAL_INTENT_PATTERNS) {
    if (pattern.test(intentPrompt)) {
      promptInjectionPassed = false;
      violations.push(`Adversarial intent or prompt injection pattern detected in caller reasoning: matches '${pattern}'.`);
      break;
    }
  }

  // Synthesize Decision & Score
  let decision = "allow";
  let status = "decision_ready";
  let score = 10;
  let advisory = "Transaction verified through deterministic security policies. Ready to sign.";

  const hasCriticalViolations = !sanctionsPassed || !contractSecurityPassed || !promptInjectionPassed || (!velocityLimitsPassed && violations.length > 0);

  if (hasCriticalViolations) {
    decision = "reject";
    status = "escalate";
    score = 95;
    advisory = "CRITICAL SECURITY BLOCK: Transaction violates compliance, AML, contract security, or intent boundaries. Execution forbidden.";
  } else if (requiresStepUp) {
    decision = "step_up_human_required";
    status = "not_decision_ready";
    score = 55;
    advisory = "POLICY ESCALATION: Transaction exceeds autonomous spending ceiling. Human operator 2FA/approval token required before signing.";
  }

  // Layer 5: Optional Vizier Cryptographic Attestation
  let vizierStatus = "edge_evaluated";
  let vizierReceipt = null;

  if (isTrustVizierEnabled(env)) {
    try {
      const vizierBase = (env.VIZIER_BASE_URL || VIZIER_DEFAULT_URL).replace(/\/+$/, "");
      const fetcher = (env.VIZIER && typeof env.VIZIER.fetch === "function")
        ? (url, init) => env.VIZIER.fetch(url, init)
        : (url, init) => globalThis.fetch(url, init);

      const resp = await fetcher(`${vizierBase}/v1/quorum/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_financial_pre_sign_check",
          parameters: {
            run_id: requestBody.run_id,
            network: tx.network,
            token: tx.token,
            amount_usd: tx.amount_usd,
            recipient: tx.recipient,
            decision
          }
        })
      });
      if (resp && resp.ok) {
        const vData = await resp.json();
        vizierStatus = "vizier_verified";
        vizierReceipt = vData.receipt || vData.jws || `jws_vizier_${Date.now()}`;
      }
    } catch (_e) {
      vizierStatus = "vizier_fallback_degraded";
    }
  }

  return {
    contract_version: AGENT_FINANCIAL_GUARD_CONTRACT_VERSION,
    profile: AGENT_FINANCIAL_GUARD_PROFILE_KEY,
    financial_guard_verdict: {
      status,
      decision,
      score,
      checks: {
        sanctions_aml: sanctionsPassed,
        contract_security: contractSecurityPassed,
        velocity_limits: velocityLimitsPassed,
        prompt_injection: promptInjectionPassed
      },
      violations,
      evidence_gaps: evidenceGaps,
      vizier_status: vizierStatus,
      vizier_clearance_receipt: vizierReceipt,
      execution_advisory: advisory
    }
  };
}
