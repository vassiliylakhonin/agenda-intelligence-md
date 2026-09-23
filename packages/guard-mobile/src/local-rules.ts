/**
 * Local offline security heuristics for on-device fallback.
 * Allows mobile agents to block known malicious addresses and drainers even without connectivity.
 */

import type { TransactionCheckInput, TransactionCheckResult } from "./types.js";

export const LOCAL_SANCTIONED_ADDRESSES = new Set([
  // Tornado Cash core routers & proxies
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
  "0x722122df12d45b1410ac727761ba7975772da855",
  "0x8589427373d6d84e98730d7795d8f6f8731fda16",
  "0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f",
  "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
  // Lazarus Group / Ronin exploit
  "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
  "0xa0e1c087346358e59675a523171b085c6b308c01",
  "0x53b6936513e738f44fb50d2b9476730c0ab3bfc1",
  // Garantex main deposit addresses
  "0x61f2382e87903264426543b591b6e4b85c13e488",
  "0x2f389904178ea3c113502280ce42964e7c3a0df4"
]);

export const UNLIMITED_ALLOWANCE_PATTERNS = [
  /ffffffffffffffffffffffffffffffff/i,
  /115792089237316195423570985008687907853269984665640564039457584007913129639935/
];

export const ADVERSARIAL_INTENT_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|rules|limits)/i,
  /bypass\s+(compliance|limits|checks|security|guardrails)/i,
  /override\s+(policy|system|guard|limit)/i,
  /drain\s+(all\s+funds|the\s+wallet|treasury|balance)/i,
  /emergency\s+(sweep|drain|withdrawal\s+all)/i,
  /send\s+all\s+(funds|balance|usdc|eth)/i
];

export function evaluateLocalFallback(input: TransactionCheckInput): TransactionCheckResult {
  const violations: string[] = [];
  const evidenceGaps: string[] = ["Offline local fallback evaluation used; authoritative edge screening unavailable."];

  let sanctionsPassed = true;
  let contractSecurityPassed = true;
  let velocityLimitsPassed = true;
  let promptInjectionPassed = true;

  // 1. Sanctions / Denylist Check
  const recipient = (input.recipient || "").trim().toLowerCase();
  if (LOCAL_SANCTIONED_ADDRESSES.has(recipient)) {
    sanctionsPassed = false;
    violations.push(`Recipient address (${recipient}) matches known OFAC/SDN or exploit denylist.`);
  }

  // 2. Contract Drainer Check
  const method = (input.method || "").toLowerCase();
  const calldata = (input.calldata || "").toLowerCase();
  if (method === "approve" || calldata.startsWith("0x095ea7b3")) {
    const isUnlimited = UNLIMITED_ALLOWANCE_PATTERNS.some(pat => pat.test(calldata)) || (input.amount_usd > 1000000);
    if (isUnlimited) {
      contractSecurityPassed = false;
      violations.push("Unconstrained infinite token approval (approve max uint256) detected.");
    }
  }

  // 3. Velocity & Spending Limits
  const limits = input.policy_limits || {};
  const maxSingle = limits.max_single_limit_usd ?? 1000;
  const dailyVelocity = limits.daily_velocity_limit_usd ?? 5000;
  const currentVelocity = limits.velocity_24h_usd ?? 0;

  let requiresStepUp = false;
  if (input.amount_usd > maxSingle) {
    requiresStepUp = true;
    evidenceGaps.push(`Transaction amount ($${input.amount_usd.toFixed(2)}) exceeds single-action ceiling ($${maxSingle.toFixed(2)}).`);
  }

  if (currentVelocity + input.amount_usd > dailyVelocity) {
    velocityLimitsPassed = false;
    violations.push(`Transaction exceeds 24h budget: current $${currentVelocity.toFixed(2)} + $${input.amount_usd.toFixed(2)} > daily cap $${dailyVelocity.toFixed(2)}.`);
  }

  // 4. Intent Prompt Injection Check
  const intentPrompt = input.intent_prompt || "";
  for (const pattern of ADVERSARIAL_INTENT_PATTERNS) {
    if (pattern.test(intentPrompt)) {
      promptInjectionPassed = false;
      violations.push(`Adversarial intent or prompt injection pattern detected: matches '${pattern}'.`);
      break;
    }
  }

  const hasCritical = !sanctionsPassed || !contractSecurityPassed || !promptInjectionPassed || (!velocityLimitsPassed && violations.length > 0);

  if (hasCritical) {
    return {
      isSafe: false,
      decision: "reject",
      score: 95,
      advisory: "CRITICAL SECURITY BLOCK (Offline Fallback): Transaction violates compliance or contract security boundaries.",
      checks: {
        sanctions_aml: sanctionsPassed,
        contract_security: contractSecurityPassed,
        velocity_limits: velocityLimitsPassed,
        prompt_injection: promptInjectionPassed
      },
      violations,
      evidence_gaps: evidenceGaps,
      human_review_required: true,
      evaluated_by: "local_fallback"
    };
  }

  if (requiresStepUp) {
    return {
      isSafe: false,
      decision: "step_up_human_required",
      score: 55,
      advisory: "POLICY ESCALATION: Transaction exceeds single-action limit. Human 2FA required.",
      checks: {
        sanctions_aml: true,
        contract_security: true,
        velocity_limits: true,
        prompt_injection: true
      },
      violations,
      evidence_gaps: evidenceGaps,
      human_review_required: true,
      evaluated_by: "local_fallback"
    };
  }

  return {
    isSafe: true,
    decision: "allow",
    score: 20,
    advisory: "Local heuristics passed. Transaction appears safe within offline policy boundaries.",
    checks: {
      sanctions_aml: true,
      contract_security: true,
      velocity_limits: true,
      prompt_injection: true
    },
    violations: [],
    evidence_gaps: evidenceGaps,
    human_review_required: false,
    evaluated_by: "local_fallback"
  };
}
