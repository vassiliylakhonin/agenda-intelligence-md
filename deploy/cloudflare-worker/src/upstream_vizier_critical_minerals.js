// Vizier Critical Minerals & Strategic Raw Materials Counterparty Sanctions (OFAC 50% Rule) & DLP Firewall Adapter.
//
// Connects Worker #8 (critical-minerals-due-diligence-a2a, profile: critical_minerals_due_diligence)
// to the Vizier security kernel, enabling real-time screening of mining operators, concession holders,
// refineries, smelters, trading intermediaries, offtake buyers, and beneficial owners under the
// OFAC 50% Rule, as well as supply-chain dossier DLP inspection across concession rights, assay reports,
// and tolling agreements.
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
export const CRITICAL_MINERALS_NOTICE =
  "Critical minerals & strategic raw materials counterparty sanctions screening (OFAC 50% Rule) & supply chain dossier DLP firewall via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function criticalMineralsAttributionBlock() {
  return {
    upstream: "Vizier Critical Minerals Firewall",
    url: VIZIER_DEFAULT_URL,
    notice: CRITICAL_MINERALS_NOTICE
  };
}

export function isCriticalMineralsVizierEnabled(env = {}) {
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
 * Verifies a Critical Minerals due diligence file against Vizier for sanctions (OFAC 50% Rule) and DLP leaks.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} request - CriticalMineralsDueDiligenceRequest object
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function verifyCriticalMineralsWithVizier(env = {}, request = {}, options = {}) {
  if (!isCriticalMineralsVizierEnabled(env)) {
    return {
      status: "disabled",
      clean: true,
      violation: false,
      sanctions_screening: { checked: false, entities_screened: [], violation: false, matches: [] },
      dlp_screening: { clean: true, findings: [], total_leaks_prevented: 0 },
      receipt: null,
      attribution: criticalMineralsAttributionBlock(),
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
      "agenda-intelligence-md/critical_minerals_due_diligence (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

  let latestReceipt = null;
  const entitiesToScreen = [];
  const seenNames = new Set();

  if (Array.isArray(request.counterparties)) {
    for (const cp of request.counterparties) {
      if (cp && typeof cp.name === "string") {
        const name = cp.name.trim();
        const key = name.toLowerCase();
        if (name && !seenNames.has(key)) {
          seenNames.add(key);
          entitiesToScreen.push({ name, role: cp.role || "counterparty" });
        }
      }
      // Also screen beneficial owners under the OFAC 50% Rule
      if (cp && Array.isArray(cp.beneficial_owners)) {
        for (const bo of cp.beneficial_owners) {
          if (typeof bo === "string") {
            const boName = bo.trim();
            const boKey = boName.toLowerCase();
            if (boName && !seenNames.has(boKey)) {
              seenNames.add(boKey);
              entitiesToScreen.push({ name: boName, role: "beneficial_owner" });
            }
          }
        }
      }
    }
  }

  let sanctionsViolation = false;
  const sanctionsMatches = [];

  try {
    // 1. Screen all mining counterparties and beneficial owners against Vizier sanctions engine (OFAC 50% Rule)
    for (const entity of entitiesToScreen) {
      const sanctionsUrl = `${base}/v1/sanctions/screen-entity`;
      const sanctionsRes = await fetchWithTimeout(
        fetcher,
        sanctionsUrl,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            entity_name: entity.name,
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
          sanctions_screening: {
            checked: true,
            entities_screened: entitiesToScreen.map((e) => e.name),
            violation: false,
            matches: []
          },
          dlp_screening: { clean: true, findings: [], total_leaks_prevented: 0 },
          receipt: latestReceipt,
          attribution: criticalMineralsAttributionBlock(),
          queried_at: nowIso(),
          degrade_reason: `Vizier returned HTTP status ${sanctionsRes.status} on sanctions screen for ${entity.name}`
        };
      }

      const sanctionsData = await sanctionsRes.json();
      if (sanctionsData.receipt) {
        latestReceipt = sanctionsData.receipt;
      }
      if (sanctionsData.violation) {
        sanctionsViolation = true;
        sanctionsMatches.push({
          name: entity.name,
          role: entity.role,
          aggregate_blocked_percentage: Number(sanctionsData.aggregate_blocked_percentage || 0),
          reason_codes: Array.isArray(sanctionsData.reason_codes) ? sanctionsData.reason_codes : [],
          explanation: String(sanctionsData.explanation || ""),
          receipt: sanctionsData.receipt || null
        });
      }
    }

    // 2. Screen critical minerals dossier parameters with Vizier DLP Firewall
    const dlpUrl = `${base}/v1/dlp/scan`;
    const dlpParams = {
      project_name: request.project_name,
      commodity: request.commodity,
      origin_jurisdiction: request.origin_jurisdiction,
      processing_jurisdiction: request.processing_jurisdiction,
      target_market: request.target_market,
      decision_question: request.decision_question,
      decision_stage: request.decision_stage,
      counterparties: request.counterparties,
      supplied_sources: request.supplied_sources,
      dated_sources: request.dated_sources,
      assumptions: request.assumptions,
      blockers: request.blockers
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
        sanctions_screening: {
          checked: entitiesToScreen.length > 0,
          entities_screened: entitiesToScreen.map((e) => e.name),
          violation: sanctionsViolation,
          matches: sanctionsMatches
        },
        dlp_screening: { clean: false, findings: [], total_leaks_prevented: 0 },
        receipt: latestReceipt,
        attribution: criticalMineralsAttributionBlock(),
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

    const isViolation = sanctionsViolation || !dlpClean;
    const isClean = !sanctionsViolation && dlpClean;

    return {
      status: "success",
      engine: "vizier_critical_minerals",
      clean: isClean,
      violation: isViolation,
      sanctions_screening: {
        checked: entitiesToScreen.length > 0,
        entities_screened: entitiesToScreen.map((e) => e.name),
        violation: sanctionsViolation,
        matches: sanctionsMatches
      },
      dlp_screening: {
        clean: dlpClean,
        findings: dlpFindings,
        total_leaks_prevented: dlpFindings.length
      },
      receipt: latestReceipt,
      attribution: criticalMineralsAttributionBlock(),
      queried_at: nowIso()
    };
  } catch (error) {
    return {
      status: "degraded",
      clean: false,
      violation: false,
      sanctions_screening: {
        checked: entitiesToScreen.length > 0,
        entities_screened: entitiesToScreen.map((e) => e.name),
        violation: false,
        matches: []
      },
      dlp_screening: { clean: false, findings: [], total_leaks_prevented: 0 },
      receipt: latestReceipt,
      attribution: criticalMineralsAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
