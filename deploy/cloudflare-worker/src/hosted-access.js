// Shared configuration for enforcement and discovery. Never expose key values.
import { outputTrialEnabled, outputTrialTerms } from './output-trial.js';
// Unset per-profile secrets leave demo access open. A configured key enables
// the existing Bearer gate without changing its authentication behavior.
export function productionAuthKey(profile, env = {}) {
  if (profile === "kazakhstan") return env.MIDDLE_CORRIDOR_API_KEY || "";
  if (profile === "agentic_interaction_trust") return env.AGENTIC_INTERACTION_TRUST_API_KEY || "";
  if (profile === "cis_secondary_sanctions") return env.CIS_SECONDARY_SANCTIONS_API_KEY || "";
  return "";
}

// Zero/unset quotas are disabled. Storage consistency and failure handling stay
// in the dispatcher; this module only resolves configuration.
export function rateLimitPerHour(env = {}) {
  const raw = Number.parseInt(env.RATE_LIMIT_PER_HOUR, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function hostedAccess(profile, env, origin) {
  const quota = rateLimitPerHour(env);
  return {
    authentication: productionAuthKey(profile, env) ? "bearer_required" : "none",
    base_call_price: env?.BILLING_MODE === "pay_per_call" ? "paid" : "free",
    billing_mode: env?.BILLING_MODE || "freemium",
    discovery_is_free: true,
    quota_per_hour: env?.BILLING_MODE === "pay_per_call" ? null : quota && env?.AGENDA_USAGE ? quota : null,
    quota_enforcement: quota && env?.AGENDA_USAGE ? "best_effort" : "not_configured",
    pricing_url: `${origin}/.well-known/x402`,
    ...(outputTrialEnabled(profile, env) ? { free_trial: outputTrialTerms() } : {}),
    on_quota_exceeded: "Wait for the next UTC hour or review optional paid access; do not pay automatically.",
    payment_integration: "Legacy transaction-hash integration; standard x402 interoperability is not certified."
  };
}

export function hostedAccessNote(access) {
  if (!access) return "Hosted base calls are free; authentication and hourly quotas depend on deployment configuration. Check the serving endpoint's /.well-known/x402 before calling or paying.";
  if (access.billing_mode === "pay_per_call") return `${access.free_trial ? `Output Verification offers two free trial attempts at ${access.free_trial.endpoint}; shared networks share the allowance and daily capacity is limited. ` : ''}Evaluation on paid endpoints requires a signed Base USDC payment for the exact request, or Pro access. Discovery is free. Keep the original request and X-Payment-Signature for result recovery within 24 hours. Current prices: ${access.pricing_url}. Do not pay automatically.`;
  const auth = access.authentication === "bearer_required"
    ? "A Bearer access key is required; a missing or incorrect key returns HTTP 401."
    : "No account or authentication is required for this deployment.";
  const quota = access.quota_per_hour
    ? `A best-effort quota of ${access.quota_per_hour} calls per client IP/profile/UTC hour applies; quota exhaustion returns HTTP 429. Wait for the next hour or review optional paid access.`
    : "No hourly quota is configured for this deployment.";
  return `Base call: free. ${auth} ${quota} Optional paid features are separate; do not pay automatically. Current offerings: ${access.pricing_url}.`;
}
