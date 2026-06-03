// x402 seller support for the agentic-interaction-trust profile.
//
// Scope and honesty boundary (read before enabling):
//
// This module implements ONLY the HTTP 402 "payment required" challenge half of
// the x402 seller flow — emitting an `accepts` payment-requirements block plus
// Bazaar discovery metadata. It does NOT verify or settle an incoming payment.
// Verify/settle requires a facilitator client (@x402/core + an EVM scheme
// mechanism), CDP credentials, and a funded payTo wallet on Base. None of that
// is wired here.
//
// Consequence: with the challenge half only, an enabled deployment will 402
// every paid request and serve none (it never accepts an unverified payment, by
// design — see x402Intercept). Therefore KEEP `X402_ENABLED` unset/false until
// verify/settle is implemented against a live facilitator. The flag defaults
// OFF; the worker's behavior is unchanged while unset.
//
// Zero runtime dependencies, matching the rest of this worker. The money
// concern is isolated here so it does not leak into the core service layer.

export const X402_PROFILES = new Set(["agentic_interaction_trust"]);

const DEFAULT_PRICE = "$0.05";
const BASE_MAINNET = "eip155:8453";

export function x402Enabled(env = {}) {
  return String(env.X402_ENABLED || "").toLowerCase() === "true";
}

export function x402AppliesTo(profile, env = {}) {
  return x402Enabled(env) && X402_PROFILES.has(profile);
}

export function x402PaymentPresented(request) {
  return Boolean(request.headers.get("x-payment"));
}

// True once a facilitator is configured for verify/settle. Until that path is
// implemented and a facilitator URL is set, this is false and the gate never
// serves on a presented payment.
export function x402SettlementConfigured(env = {}) {
  return Boolean(env.X402_FACILITATOR_URL);
}

export function x402Accepts(env = {}, origin = "") {
  const entry = {
    scheme: "exact",
    network: env.X402_NETWORK || BASE_MAINNET,
    price: env.X402_PRICE || DEFAULT_PRICE,
    payTo: env.X402_PAY_TO || "",
    maxTimeoutSeconds: 60
  };
  if (origin) entry.resource = `${origin}/message/send`;
  return [entry];
}

// Bazaar discovery metadata, grounded in
// schemas/v1/agentic-interaction-trust-request.schema.json. The CDP Facilitator
// catalogs this into the Bazaar on the first settled payment.
export function x402DiscoveryMetadata() {
  return {
    description:
      "Agentic-interaction trust gate. Send an agent-mediated action, its target surface, decision stage, and dated evidence; returns an auditable trust-routing decision (allow / step-up / human-review / block-until-verified) with evidence gaps and watch-next indicators. Evidence-sufficiency triage only. Not fraud adjudication, identity verification, transaction authorization, autonomous blocking, legal/compliance/financial advice, live retrieval, or factual-truth verification. Human review required before any action.",
    mimeType: "application/json",
    input: {
      actor: {
        declared_type: "ai_agent",
        declared_name: "Example Shopping Agent",
        operator: "Example Consumer",
        authentication_context: "session_cookie"
      },
      target_surface: "checkout",
      requested_action: "complete purchase of two restricted-delivery items",
      asset_or_resource: "order-123",
      decision_stage: "pre_execution",
      dated_sources: [
        {
          id: "ait-1",
          source_type: "agent_identity_claim",
          title: "Declared agent identity header",
          date: "2026-05-28"
        }
      ],
      risk_question: "Is this agent-mediated checkout ready to allow, step up, or route to human review?",
      requested_output: "structured_json"
    },
    inputSchema: {
      type: "object",
      required: ["actor", "target_surface", "requested_action", "decision_stage", "dated_sources", "risk_question"],
      properties: {
        actor: {
          type: "object",
          required: ["declared_type", "declared_name"],
          properties: {
            declared_type: {
              type: "string",
              enum: [
                "ai_agent",
                "automation_script",
                "api_client",
                "browser_bot",
                "human_delegated_agent",
                "unknown",
                "other"
              ]
            },
            declared_name: { type: "string" },
            operator: { type: "string" },
            authentication_context: {
              type: "string",
              enum: ["anonymous", "session_cookie", "api_key", "oauth", "mTLS", "signed_agent_manifest", "unknown", "other"]
            }
          }
        },
        target_surface: {
          type: "string",
          enum: [
            "checkout",
            "account",
            "api",
            "mcp_tool",
            "a2a_endpoint",
            "content_or_catalog",
            "auth_flow",
            "support_or_messaging",
            "other"
          ]
        },
        requested_action: { type: "string" },
        asset_or_resource: { type: "string" },
        decision_stage: {
          type: "string",
          enum: ["pre_execution", "in_session", "post_alert", "policy_review", "committee_review", "other"]
        },
        dated_sources: {
          type: "array",
          items: { type: "object", required: ["id", "source_type", "title", "date"] }
        },
        risk_question: { type: "string" },
        requested_output: {
          type: "string",
          enum: ["structured_json", "markdown_summary", "both"],
          default: "structured_json"
        }
      }
    },
    output: {
      example: {
        routing_decision: "step_up",
        decision_readiness_score: 41,
        evidence_gaps: ["No operator/principal authorization supplied.", "No tool-scope or permission evidence supplied."],
        watch_next: ["new authorization evidence", "session re-authentication"],
        human_review_required: true,
        not_advice_notice: true
      }
    }
  };
}

export function x402ChallengeBody(env = {}, origin = "") {
  return {
    x402Version: 1,
    accepts: x402Accepts(env, origin),
    ...x402DiscoveryMetadata(),
    error: "payment required"
  };
}

// Returns a `{ status, body }` to short-circuit the request with an HTTP 402, or
// null to let the normal (Bearer / free-demo) path proceed.
//
// - x402 disabled or non-matching profile -> null (no change).
// - enabled, no X-PAYMENT header           -> 402 challenge (accepts + metadata).
// - enabled, X-PAYMENT present but no       -> 402, settlement-not-active. We never
//   facilitator configured                    serve on an unverified payment.
export function x402Intercept(profile, request, env = {}, origin = "") {
  if (!x402AppliesTo(profile, env)) return null;
  if (!x402PaymentPresented(request)) {
    return { status: 402, body: x402ChallengeBody(env, origin) };
  }
  if (!x402SettlementConfigured(env)) {
    return {
      status: 402,
      body: {
        x402Version: 1,
        accepts: x402Accepts(env, origin),
        error: "x402 settlement is not active on this deployment; verify/settle is not configured"
      }
    };
  }
  // Facilitator configured: verify/settle wiring goes here (not yet implemented).
  // Until implemented, treat as not-active rather than serving unverified.
  return {
    status: 402,
    body: {
      x402Version: 1,
      accepts: x402Accepts(env, origin),
      error: "x402 verify/settle not yet implemented"
    }
  };
}
