// Vizier Maritime Sanctions & Beneficial Ownership Adapter for Cloudflare Worker.
//
// Connects Worker #3 (gulf_maritime_exposure) to the Vizier security kernel,
// enabling live maritime sanctions screening and OFAC 50% Rule checks across
// vessels and maritime counterparties (owners, operators, managers, charterers, insurers).
//
// Dual transport:
//   1. Cloudflare Service Binding (env.VIZIER.fetch) when running inside the
//      Cloudflare Workers edge runtime (<0.5ms in-process V8 isolate call, $0 bandwidth).
//   2. HTTP fetch (env.VIZIER_BASE_URL) as transparent fallback for local dev
//      and standalone environments.

export const VIZIER_DEFAULT_URL = "https://vizier.vassiliy-lakhonin.workers.dev";
export const DEFAULT_TIMEOUT_MS = 5000;
export const MARITIME_NOTICE =
  "Maritime sanctions screening & JWS cryptographic clearance via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function maritimeAttributionBlock() {
  return {
    upstream: "Vizier Maritime Firewall",
    url: VIZIER_DEFAULT_URL,
    notice: MARITIME_NOTICE
  };
}

export function isMaritimeVizierEnabled(env = {}) {
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
 * Screens a maritime request (vessel + counterparties) with Vizier.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} request - GulfMaritimeExposureRequest object
 * @returns {Promise<object>}
 */
export async function screenMaritimeExposureWithVizier(env = {}, request = {}) {
  if (!isMaritimeVizierEnabled(env)) {
    return {
      status: "disabled",
      violation: false,
      clean: true,
      matches: [],
      attribution: maritimeAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: "Vizier integration is not enabled in this environment"
    };
  }

  // Collect candidate targets: vessel + counterparties
  const candidates = [];

  if (request.vessel && typeof request.vessel === "object") {
    const vesselName = (request.vessel.name || "").toString().trim();
    if (vesselName) {
      candidates.push({
        name: vesselName,
        role: "vessel",
        country: request.vessel.flag || undefined,
        imo: request.vessel.imo || undefined
      });
    }
  }

  if (Array.isArray(request.counterparties)) {
    for (const cp of request.counterparties) {
      if (!cp || typeof cp !== "object") continue;
      const name = (cp.name || "").toString().trim();
      if (name) {
        candidates.push({
          name,
          role: cp.role || "counterparty",
          country: cp.jurisdiction || undefined,
          shareholders: Array.isArray(cp.shareholders) ? cp.shareholders : undefined
        });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      status: "success",
      violation: false,
      clean: true,
      matches: [],
      receipt: null,
      attribution: maritimeAttributionBlock(),
      queried_at: nowIso()
    };
  }

  // Transport configuration
  let fetcher;
  let endpointUrl;

  const base = (env.VIZIER_BASE_URL || VIZIER_DEFAULT_URL).replace(/\/+$/, "");
  if (env.VIZIER && typeof env.VIZIER.fetch === "function") {
    fetcher = (url, init) => env.VIZIER.fetch(url, init);
    endpointUrl = `${base}/v1/sanctions/screen-entity`;
  } else {
    fetcher = (url, init) => globalThis.fetch(url, init);
    endpointUrl = `${base}/v1/sanctions/screen-entity`;
  }

  const headers = {
    "Content-Type": "application/json",
    "User-Agent":
      "agenda-intelligence-md/gulf_maritime_exposure (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

  const matches = [];
  let latestReceipt = null;
  let anyViolation = false;
  let allClean = true;

  try {
    for (const candidate of candidates) {
      const requestBody = {
        entity_name: candidate.name,
        country: candidate.country || undefined,
        shareholders: Array.isArray(candidate.shareholders)
          ? candidate.shareholders.map((s) => ({
              name: String(s.name || "").trim(),
              percentage: Number(s.percentage || 0),
              ...(s.jurisdiction || s.country ? { country: String(s.jurisdiction || s.country).trim() } : {})
            }))
          : [],
        threshold_percentage: 50.0
      };

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
          attribution: maritimeAttributionBlock(),
          queried_at: nowIso(),
          degrade_reason: `Vizier returned HTTP status ${response.status}`
        };
      }

      const data = await response.json();
      if (data.receipt) {
        latestReceipt = data.receipt;
      }

      if (data.violation) {
        anyViolation = true;
        allClean = false;
        matches.push({
          name: candidate.name,
          role: candidate.role,
          country: candidate.country,
          aggregate_blocked_percentage: Number(data.aggregate_blocked_percentage || 0),
          blocked_shareholders: data.blocked_shareholders || [],
          reason_codes: data.reason_codes || [],
          explanation: data.explanation || "",
          receipt: data.receipt || null
        });
      } else if (!data.clean) {
        allClean = false;
      }
    }

    return {
      status: "success",
      engine: "vizier_maritime_sanctions",
      violation: anyViolation,
      clean: allClean,
      matches,
      receipt: latestReceipt,
      attribution: maritimeAttributionBlock(),
      queried_at: nowIso()
    };
  } catch (error) {
    return {
      status: "degraded",
      violation: false,
      clean: false,
      matches: [],
      attribution: maritimeAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
