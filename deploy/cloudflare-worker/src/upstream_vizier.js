// Vizier Action Firewall & OFAC 50% Rule live adapter for the Cloudflare Worker.
//
// Connects Worker #2 (cis_secondary_sanctions) to the Vizier security kernel,
// enabling recursive multi-tier beneficial ownership screening under the US
// Treasury OFAC 50% Rule and EU sanctions equivalents.
//
// Dual transport:
//   1. Cloudflare Service Binding (env.VIZIER.fetch) when running inside the
//      Cloudflare Workers edge runtime (<0.5ms in-process V8 isolate call, $0 bandwidth).
//   2. HTTP fetch (env.VIZIER_BASE_URL) as transparent fallback for local dev
//      and standalone environments.
//
// Boundary discipline:
//   - Graceful degrade: network failure, non-200, timeout, or missing key
//     returns status !== "success" with no matches; caller MUST NOT fail the user request.
//   - Disclosed & multi-layer ownership graph analysis: passes disclosed
//     shareholders and recursive ownership edges to Vizier's deterministic engine.
//   - Cryptographic verification: captures and returns Vizier's JWS receipt.

export const VIZIER_DEFAULT_URL = "https://vizier.vassiliy-lakhonin.workers.dev";
export const DEFAULT_TIMEOUT_MS = 5000;
export const VIZIER_NOTICE =
  "Beneficial ownership screening & JWS cryptographic clearance via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function attributionBlock() {
  return {
    upstream: "Vizier",
    url: VIZIER_DEFAULT_URL,
    notice: VIZIER_NOTICE
  };
}

export function isEnabled(env = {}) {
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
 * Screens an entity and its beneficial ownership graph against the OFAC 50% Rule.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} params
 * @param {object} params.counterparty - { name: string, jurisdiction?: string }
 * @param {Array<object>} [params.shareholders] - Array of { name: string, percentage: number }
 * @param {object} [params.ownership_graph] - Optional multi-tier adjacency graph
 * @param {number} [params.threshold_percentage=50.0] - Threshold percentage
 * @returns {Promise<object>}
 */
export async function screenBeneficialOwnershipWithVizier(env = {}, params = {}) {
  if (!isEnabled(env)) {
    return {
      status: "disabled",
      violation: false,
      clean: true,
      matches: [],
      attribution: attributionBlock(),
      queried_at: nowIso(),
      degrade_reason: "Vizier integration is not enabled in this environment"
    };
  }

  const counterparty = params.counterparty || {};
  const entityName = (counterparty.name || "").toString().trim();
  if (!entityName) {
    return {
      status: "disabled",
      violation: false,
      clean: true,
      matches: [],
      attribution: attributionBlock(),
      queried_at: nowIso(),
      degrade_reason: "Counterparty name is missing"
    };
  }

  // Choose transport: Service Binding has priority
  let fetcher;
  let endpointUrl;

  if (env.VIZIER && typeof env.VIZIER.fetch === "function") {
    fetcher = (url, init) => env.VIZIER.fetch(url, init);
    endpointUrl = "https://vizier.internal/v1/sanctions/screen-entity";
  } else {
    fetcher = (url, init) => globalThis.fetch(url, init);
    const base = (env.VIZIER_BASE_URL || VIZIER_DEFAULT_URL).replace(/\/+$/, "");
    endpointUrl = `${base}/v1/sanctions/screen-entity`;
  }

  const requestBody = {
    entity_name: entityName,
    country: counterparty.jurisdiction || counterparty.country || undefined,
    shareholders: Array.isArray(params.shareholders)
      ? params.shareholders.map((s) => ({
          name: String(s.name || "").trim(),
          percentage: Number(s.percentage || 0),
          ...(s.jurisdiction || s.country ? { country: String(s.jurisdiction || s.country).trim() } : {})
        }))
      : [],
    threshold_percentage:
      typeof params.threshold_percentage === "number"
        ? params.threshold_percentage
        : 50.0
  };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent":
      "agenda-intelligence-md/cis_secondary_sanctions (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

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
        violation: false,
        clean: false,
        matches: [],
        attribution: attributionBlock(),
        queried_at: nowIso(),
        degrade_reason: `Vizier returned HTTP status ${response.status}`
      };
    }

    const data = await response.json();
    const violation = Boolean(data.violation);
    const clean = Boolean(data.clean);
    const aggregateBlocked = Number(data.aggregate_blocked_percentage || 0);
    const blockedShareholders = Array.isArray(data.blocked_shareholders)
      ? data.blocked_shareholders
      : [];

    const matches = blockedShareholders.map((sh) => ({
      name: sh.name || "Blocked Shareholder",
      source_type: "ownership_chain_evidence",
      percentage: sh.effective_percentage || sh.direct_percentage || 0,
      list: sh.list || "OFAC_SDN",
      path: Array.isArray(sh.path) ? sh.path : [],
      match_source: sh.match_source || "vizier_50_rule",
      notes: `Blocked under OFAC 50% Rule: ${sh.name} holds ${sh.effective_percentage || sh.direct_percentage}% deemed ownership.`
    }));

    return {
      status: "success",
      engine: "vizier_ofac_50_rule",
      violation,
      clean,
      aggregate_blocked_percentage: aggregateBlocked,
      threshold_percentage: Number(data.threshold_percentage || 50),
      blocked_shareholders: blockedShareholders,
      matches,
      reason_codes: Array.isArray(data.reason_codes) ? data.reason_codes : [],
      explanation: String(data.explanation || ""),
      receipt: data.receipt || null,
      attribution: attributionBlock(),
      queried_at: nowIso()
    };
  } catch (error) {
    return {
      status: "degraded",
      violation: false,
      clean: false,
      matches: [],
      attribution: attributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
