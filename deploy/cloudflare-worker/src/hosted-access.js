import {x402Enabled, X402_FACILITATOR} from './x402-v2.js';
// Shared configuration for enforcement and discovery. Never expose key values.
import { outputTrialEnabled, outputTrialTerms } from './output-trial.js';
import {routingToolForProfile} from './pricing-policy.js';
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
  const routing = routingToolForProfile(profile);
  return {
    authentication: productionAuthKey(profile, env) ? "bearer_required" : "none",
    base_call_price: env?.BILLING_MODE === "pay_per_call" && !routing ? "paid" : "free",
    billing_mode: env?.BILLING_MODE || "freemium",
    discovery_is_free: true,
    quota_per_hour: env?.BILLING_MODE === "pay_per_call" && !routing ? null : quota && env?.AGENDA_USAGE ? quota : null,
    quota_enforcement: quota && env?.AGENDA_USAGE ? "best_effort" : "not_configured",
    pricing_url: `${origin}/.well-known/x402`,
    ...(routing ? {free_routing:{tool:routing,payment_required:false,trial_attempt_consumed:false,
      scope:'Orientation and specialist selection only. Structured checks, HS-code screening and full model exports retain separate admission.'}} : {}),
    ...(outputTrialEnabled(profile, env) ? { free_trial: outputTrialTerms(profile) } : {}),
    on_quota_exceeded: "Wait for the next UTC hour or review optional paid access; do not pay automatically.",
    payment_integration: x402Enabled(env) ? "x402 v2 exact Base native USDC via HTTP payment headers or MCP x402/payment metadata; legacy signed transaction-hash access remains available. EOA signatures only; real settlement has not been exercised by maintainer smoke tests."
      : "Legacy transaction-hash integration; standard x402 interoperability is not certified.",
    ...(x402Enabled(env) ? {standard_x402:{version:2,scheme:'exact',network:'eip155:8453',facilitator:X402_FACILITATOR,http_request_header:'PAYMENT-SIGNATURE',mcp_request_meta:'x402/payment',mcp_response_meta:'x402/payment-response',recovery:'Retry the original request with the same authorization. Do not authorize another payment after an uncertain settlement.'}} : {})
  };
}

export function hostedAccessNote(access) {
  if (!access) return "Hosted base calls are free; authentication and hourly quotas depend on deployment configuration. Check the serving endpoint's /.well-known/x402 before calling or paying.";
  if (access.free_routing) return `Base call: free. Routing through ${access.free_routing.tool} is free, subject to configured authentication. ${access.quota_per_hour ? `A best-effort quota of ${access.quota_per_hour} calls per client IP/profile/UTC hour applies; quota exhaustion returns HTTP 429. Wait for the next UTC hour.` : "No hourly quota is configured for this deployment."} It consumes no trial or Pro allowance. This is orientation and evidence planning, not a specialist evaluation. Other named checks and full model exports retain their own prices and admission; inspect ${access.pricing_url}. Do not send payment material to routing or pay automatically.`;
  if (access.billing_mode === "pay_per_call") return `${access.free_trial ? `This product offers ${access.free_trial.attempts_per_network} free trial attempts for ${access.free_trial.tool}: call MCP free_trial_status, then MCP free_trial with that tool's own inputSchema arguments; no HTTP adapter or wallet is needed. HTTP alternative: ${access.free_trial.endpoint}; GET that URL for input_schema and example_request, then POST raw tool arguments there (not an MCP/A2A envelope). HTTP, MCP and native A2A share the allowance and daily capacity is limited. Other tools are not included in this trial. ` : ''}Evaluation on paid endpoints requires Base USDC payment or Pro access. Standard x402 v2, when enabled, signs a one-transfer authorization and durably binds its first admitted request. Legacy payment uses a funding-wallet signature over the exact request. Discovery is free. Keep the original request and X-Payment-Signature for result recovery within 24 hours. Current prices: ${access.pricing_url}. Do not pay automatically.`;
  const auth = access.authentication === "bearer_required"
    ? "A Bearer access key is required; a missing or incorrect key returns HTTP 401."
    : "No account or authentication is required for this deployment.";
  const quota = access.quota_per_hour
    ? `A best-effort quota of ${access.quota_per_hour} calls per client IP/profile/UTC hour applies; quota exhaustion returns HTTP 429. Wait for the next hour or review optional paid access.`
    : "No hourly quota is configured for this deployment.";
  return `Base call: free. ${auth} ${quota} Optional paid features are separate; do not pay automatically. Current offerings: ${access.pricing_url}.`;
}
