// Vizier DLP Secret & PII Firewall and Output Verification Adapter for Cloudflare Worker.
//
// Connects Worker #4 (agent_output_verification) to the Vizier security kernel,
// enabling real-time scanning of agent outputs, claim sets, and evidence citations
// for leaked API keys, tokens, credentials, private keys, and PII.
//
// Dual transport:
//   1. Cloudflare Service Binding (env.VIZIER.fetch) when running inside the
//      Cloudflare Workers edge runtime (<0.5ms in-process V8 isolate call, $0 bandwidth).
//   2. HTTP fetch (env.VIZIER_BASE_URL) as transparent fallback for local dev
//      and standalone environments.
//
// Boundary discipline:
//   - Graceful degrade: network failure, non-200, or timeout returns status !== "success"
//     without crashing the caller or failing benign requests.
//   - Cryptographic verification: captures and forwards Vizier's signed JWS clearance receipt.

export const VIZIER_DEFAULT_URL = "https://vizier.vassiliy-lakhonin.workers.dev";
export const DEFAULT_TIMEOUT_MS = 5000;
export const VERIFICATION_NOTICE =
  "Output verification, DLP secret/PII firewall & JWS cryptographic clearance via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function verificationAttributionBlock() {
  return {
    upstream: "Vizier Output Firewall",
    url: VIZIER_DEFAULT_URL,
    notice: VERIFICATION_NOTICE
  };
}

export function isVerificationVizierEnabled(env = {}) {
  const disabled = (env.VIZIER_DISABLED || "").toString().trim().toLowerCase();
  if (disabled === "1" || disabled === "true" || disabled === "yes") return false;
  return Boolean(
    env.VIZIER ||
      env.VIZIER_ENABLED === "1" ||
      env.VIZIER_BASE_URL ||
      env.VIZIER_API_KEY
  );
}

function nowIso() {
  return new Date().toISOString();
}

async function fetchWithTimeout(fetcher, url, init, timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scans an agent output request (claims, evidence, actions) with Vizier DLP.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} request - Structured agent output verification or pre-action request
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function scanOutputWithVizierDlp(env = {}, request = {}, options = {}) {
  if (!isVerificationVizierEnabled(env)) {
    return {
      status: "disabled",
      clean: true,
      findings: [],
      total_leaks_prevented: 0,
      receipt: null,
      attribution: verificationAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: "Vizier integration is not enabled in this environment"
    };
  }

  const claims = Array.isArray(request.claims) ? request.claims : [];
  const evidence = Array.isArray(request.evidence) ? request.evidence : [];

  // If there are no claims or evidence to scan
  if (claims.length === 0 && evidence.length === 0 && !request.requested_action) {
    return {
      status: "success",
      clean: true,
      findings: [],
      total_leaks_prevented: 0,
      receipt: null,
      attribution: verificationAttributionBlock(),
      queried_at: nowIso()
    };
  }

  let fetcher;
  let endpointUrl;

  const base = (env.VIZIER_BASE_URL || VIZIER_DEFAULT_URL).replace(/\/+$/, "");
  if (env.VIZIER && typeof env.VIZIER.fetch === "function") {
    fetcher = (url, init) => env.VIZIER.fetch(url, init);
    endpointUrl = `${base}/v1/dlp/scan`;
  } else {
    fetcher = (url, init) => globalThis.fetch(url, init);
    endpointUrl = `${base}/v1/dlp/scan`;
  }

  const headers = {
    "Content-Type": "application/json",
    "User-Agent":
      "agenda-intelligence-md/agent_output_verification (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

  const parameters = {
    claims,
    evidence
  };
  if (request.requested_action) parameters.requested_action = request.requested_action;
  if (request.actor) parameters.actor = request.actor;
  if (request.target) parameters.target = request.target;

  const requestBody = {
    parameters,
    ...(options.allowed_categories ? { allowed_categories: options.allowed_categories } : {})
  };

  try {
    const response = await fetchWithTimeout(
      fetcher,
      endpointUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!response.ok) {
      return {
        status: "degraded",
        clean: false,
        findings: [],
        total_leaks_prevented: 0,
        receipt: null,
        attribution: verificationAttributionBlock(),
        queried_at: nowIso(),
        degrade_reason: `Vizier returned HTTP status ${response.status}`
      };
    }

    const data = await response.json();
    const clean = Boolean(data.clean);
    const findings = Array.isArray(data.findings) ? data.findings : [];
    const totalLeaks = Number(data.total_leaks_prevented || findings.length);

    return {
      status: "success",
      engine: "vizier_dlp_firewall",
      clean,
      findings,
      total_leaks_prevented: totalLeaks,
      receipt: data.receipt || null,
      attribution: verificationAttributionBlock(),
      queried_at: nowIso()
    };
  } catch (error) {
    return {
      status: "degraded",
      clean: false,
      findings: [],
      total_leaks_prevented: 0,
      receipt: null,
      attribution: verificationAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
