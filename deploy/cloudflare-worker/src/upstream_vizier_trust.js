// Vizier Agentic Interaction Trust, Operator Sanctions & DLP Firewall Adapter.
//
// Connects Worker #5 (agentic_interaction_trust) to the Vizier security kernel,
// enabling real-time screening of agent operators/principals under the OFAC 50%
// Rule, and payload DLP inspection across checkout, API, and tool call surfaces.
//
// Dual transport:
//   1. Cloudflare Service Binding (env.VIZIER.fetch) when running inside the
//      Cloudflare Workers edge runtime (<0.5ms in-process V8 isolate call, $0 bandwidth).
//   2. HTTP fetch (env.VIZIER_BASE_URL) as transparent fallback for local dev
//      and standalone environments.
//
// Boundary discipline:
//   - Graceful degrade: network failure, non-200, or timeout returns status !== "success"
//     without failing benign caller requests.
//   - Cryptographic verification: captures and forwards Vizier's signed JWS clearance receipt.

export const VIZIER_DEFAULT_URL = "https://vizier.vassiliy-lakhonin.workers.dev";
export const DEFAULT_TIMEOUT_MS = 5000;
export const TRUST_NOTICE =
  "Agentic interaction trust, operator sanctions screening & DLP firewall via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function trustAttributionBlock() {
  return {
    upstream: "Vizier Agentic Trust Firewall",
    url: VIZIER_DEFAULT_URL,
    notice: TRUST_NOTICE
  };
}

export function isTrustVizierEnabled(env = {}) {
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
 * Verifies an agentic interaction trust request against Vizier.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} request - AgenticInteractionTrustRequest object
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function verifyAgenticTrustWithVizier(env = {}, request = {}, options = {}) {
  if (!isTrustVizierEnabled(env)) {
    return {
      status: "disabled",
      clean: true,
      violation: false,
      operator_screening: { checked: false, operator: null, violation: false, match: null },
      dlp_screening: { clean: true, findings: [], total_leaks_prevented: 0 },
      receipt: null,
      attribution: trustAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: "Vizier integration is not enabled in this environment"
    };
  }

  const base = (env.VIZIER_BASE_URL || VIZIER_DEFAULT_URL).replace(/\/+$/, "");
  let fetcher;

  if (env.VIZIER && typeof env.VIZIER.fetch === "function") {
    fetcher = (url, init) => env.VIZIER.fetch(url, init);
  } else {
    fetcher = (url, init) => globalThis.fetch(url, init);
  }

  const headers = {
    "Content-Type": "application/json",
    "User-Agent":
      "agenda-intelligence-md/agentic_interaction_trust (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

  let latestReceipt = null;
  let operatorSanctionsViolation = false;
  let operatorSanctionsMatch = null;
  const operatorName =
    request.actor && typeof request.actor === "object" && request.actor.operator
      ? String(request.actor.operator).trim()
      : "";

  try {
    // 1. Operator Sanctions & 50% Rule Screening (if operator is specified)
    if (operatorName) {
      const sanctionsUrl = `${base}/v1/sanctions/screen-entity`;
      const sanctionsRes = await fetchWithTimeout(
        fetcher,
        sanctionsUrl,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            entity_name: operatorName,
            threshold_percentage: 50.0
          })
        },
        DEFAULT_TIMEOUT_MS
      );

      if (!sanctionsRes.ok) {
        return {
          status: "degraded",
          clean: false,
          violation: false,
          operator_screening: { checked: true, operator: operatorName, violation: false, match: null },
          dlp_screening: { clean: true, findings: [], total_leaks_prevented: 0 },
          receipt: null,
          attribution: trustAttributionBlock(),
          queried_at: nowIso(),
          degrade_reason: `Vizier returned HTTP status ${sanctionsRes.status} on operator sanctions screen`
        };
      }

      const sanctionsData = await sanctionsRes.json();
      if (sanctionsData.receipt) {
        latestReceipt = sanctionsData.receipt;
      }
      if (sanctionsData.violation) {
        operatorSanctionsViolation = true;
        operatorSanctionsMatch = {
          name: operatorName,
          aggregate_blocked_percentage: Number(sanctionsData.aggregate_blocked_percentage || 0),
          reason_codes: Array.isArray(sanctionsData.reason_codes) ? sanctionsData.reason_codes : [],
          explanation: String(sanctionsData.explanation || ""),
          receipt: sanctionsData.receipt || null
        };
      }
    }

    // 2. Interaction Payload DLP Firewall Screening
    const dlpUrl = `${base}/v1/dlp/scan`;
    const dlpParams = {
      actor: request.actor,
      requested_action: request.requested_action,
      target_surface: request.target_surface,
      asset_or_resource: request.asset_or_resource,
      notes: request.notes,
      dated_sources: request.dated_sources
    };

    const dlpRes = await fetchWithTimeout(
      fetcher,
      dlpUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ parameters: dlpParams })
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!dlpRes.ok) {
      return {
        status: "degraded",
        clean: false,
        violation: false,
        operator_screening: { checked: Boolean(operatorName), operator: operatorName || null, violation: operatorSanctionsViolation, match: operatorSanctionsMatch },
        dlp_screening: { clean: false, findings: [], total_leaks_prevented: 0 },
        receipt: latestReceipt,
        attribution: trustAttributionBlock(),
        queried_at: nowIso(),
        degrade_reason: `Vizier returned HTTP status ${dlpRes.status} on DLP scan`
      };
    }

    const dlpData = await dlpRes.json();
    if (dlpData.receipt) {
      latestReceipt = dlpData.receipt;
    }
    const dlpClean = Boolean(dlpData.clean);
    const dlpFindings = Array.isArray(dlpData.findings) ? dlpData.findings : [];

    const isViolation = operatorSanctionsViolation || !dlpClean;
    const isClean = !operatorSanctionsViolation && dlpClean;

    return {
      status: "success",
      engine: "vizier_agentic_trust",
      clean: isClean,
      violation: isViolation,
      operator_screening: {
        checked: Boolean(operatorName),
        operator: operatorName || null,
        violation: operatorSanctionsViolation,
        match: operatorSanctionsMatch
      },
      dlp_screening: {
        clean: dlpClean,
        findings: dlpFindings,
        total_leaks_prevented: dlpFindings.length
      },
      receipt: latestReceipt,
      attribution: trustAttributionBlock(),
      queried_at: nowIso()
    };
  } catch (error) {
    return {
      status: "degraded",
      clean: false,
      violation: false,
      operator_screening: { checked: Boolean(operatorName), operator: operatorName || null, violation: false, match: null },
      dlp_screening: { clean: false, findings: [], total_leaks_prevented: 0 },
      receipt: latestReceipt,
      attribution: trustAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
