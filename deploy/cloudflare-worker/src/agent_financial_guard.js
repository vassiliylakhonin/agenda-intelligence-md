// Agent Financial Guard & Autonomous Transaction Firewall Engine
// Deterministic pre-sign validation for autonomous agents with wallet capabilities.
// Evaluation is stateless; transport telemetry has its own retention policy.



export const AGENT_FINANCIAL_GUARD_CONTRACT_VERSION = "1.0.0";
export const AGENT_FINANCIAL_GUARD_PROFILE_KEY = "agent_financial_guard";

// Legacy local risk denylist. Not an authoritative or current sanctions dataset.
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
  "0x2f389904178ea3c113502280ce42964e7c3a0df4",
  // Solana exploit & designated clusters
  "9wzdxwbbmkg8ztbnmquxvqrayrzzdsgydlvl9zytawwm",
  "5q544fkrfoe6tseb7s8emxgtjyakttvhaw5q5pge4j1",
  "4pu12z8m8a4qyvk4uw4n4wwc9u4z3p5gb6q4g3q7g8x9"
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
    if (!Number.isFinite(tx.amount_usd) || tx.amount_usd < 0) errors.push("Invalid or missing transaction.amount_usd (must be >= 0)");
    if (!tx.recipient || typeof tx.recipient !== "string") errors.push("Missing transaction.recipient");
  }
  if (!body.intent || typeof body.intent !== "object" || typeof body.intent.prompt !== "string" || !body.intent.prompt) {
    errors.push("Missing required object: intent.prompt");
  }
  if (body.policy_limits !== undefined) {
    if (!body.policy_limits || typeof body.policy_limits !== "object" || Array.isArray(body.policy_limits)) {
      errors.push("policy_limits must be an object");
    } else {
      for (const key of ["max_single_limit_usd", "daily_velocity_limit_usd", "velocity_24h_usd"]) {
        if (Object.hasOwn(body.policy_limits, key) && (!Number.isFinite(body.policy_limits[key]) || body.policy_limits[key] < 0)) {
          errors.push(`Invalid policy_limits.${key}`);
        }
      }
    }
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
    violations.push(`Recipient address (${rawRecipient}) matches the local risk denylist; current sanctions status is not established.`);
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
  } else if (method === "setauthority" || method === "closeaccount") {
    contractSecurityPassed = false;
    violations.push(`Dangerous account authority modification method detected: '${method}'. Potential account takeover vector.`);
  }

  // Layer 3: Velocity & Spending Limits
  const maxSingle = limits.max_single_limit_usd ?? 1000;
  const dailyVelocity = limits.daily_velocity_limit_usd ?? 5000;
  const currentVelocity = limits.velocity_24h_usd ?? 0;

  let requiresStepUp = false;

  if (tx.amount_usd > maxSingle) {
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
  let decision = "step_up_human_required";
  let status = "not_decision_ready";
  let score = 55;
  let advisory = "Human review required before signing.";

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

  // The caller controls both the spending policy and reported history. Neither
  // authorizes a wallet action, and absence from this local list is not an AML
  // clearance. Until an authenticated wallet ledger and authoritative screening
  // are integrated, all non-rejected requests require independent human review.
  evidenceGaps.push("Authoritative wallet spending history and enforced policy are unavailable; caller-reported velocity is unverified.");
  evidenceGaps.push("Current network-specific sanctions/AML screening is unavailable; only a local risk denylist was checked.");
  sanctionsPassed = false;
  velocityLimitsPassed = false;
  if (!hasCriticalViolations) {
    decision = "step_up_human_required";
    status = "not_decision_ready";
    score = 55;
    advisory = "Human review required before signing: spending history, policy authority, and current sanctions status are unverified.";
  }

  // /v1/quorum/propose creates a pending proposal, not a clearance receipt.
  // No attestation protocol is configured for this evaluator. Never fabricate
  // a token or treat HTTP success as verification, and do not create proposals
  // as a side effect of an evidence check.
  const vizierStatus = "attestation_unavailable";
  const vizierReceipt = null;

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
      human_review_required: true,
      not_advice_notice: "Heuristic pre-sign review only; not transaction authorization or sanctions clearance.",
      check_scope: { sanctions_aml: "local_denylist_only", velocity_limits: "caller_reported_unverified" },
      execution_advisory: advisory
    }
  };
}
