// Vizier Dual-Use Technology & Export Controls Counterparty Sanctions (OFAC 50% Rule) & DLP Firewall Adapter.
//
// Connects Worker #9 (dual-use-technology-export-a2a, profile: dual_use_technology_export)
// to the Vizier security kernel, enabling real-time screening of exporters, consignees,
// transit operators, and beneficial owners under the OFAC 50% Rule, as well as export dossier
// DLP inspection across technical specifications, classification notes, and end-user statements.
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
export const DUAL_USE_NOTICE =
  "Dual-use technology & export controls counterparty sanctions screening (OFAC 50% Rule) & export dossier DLP firewall via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function dualUseAttributionBlock() {
  return {
    upstream: "Vizier Dual-Use Technology Export Firewall",
    url: VIZIER_DEFAULT_URL,
    notice: DUAL_USE_NOTICE
  };
}

export function isDualUseVizierEnabled(env = {}) {
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
 * Verifies a Dual-Use Technology Export file against Vizier for sanctions (OFAC 50% Rule) and DLP leaks.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} request - DualUseTechnologyExportRequest object
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function verifyDualUseWithVizier(env = {}, request = {}, options = {}) {
  if (!isDualUseVizierEnabled(env)) {
    return {
      status: "disabled",
      clean: true,
      violation: false,
      sanctions_screening: { checked: false, entities_screened: [], violation: false, matches: [] },
      dlp_screening: { clean: true, findings: [], total_leaks_prevented: 0 },
      receipt: null,
      attribution: dualUseAttributionBlock(),
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
      "agenda-intelligence-md/dual_use_technology_export (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

  let latestReceipt = null;
  const entitiesToScreen = [];
  const seenNames = new Set();

  function addEntity(name, role) {
    if (typeof name !== "string") return;
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seenNames.has(key)) {
      seenNames.add(key);
      entitiesToScreen.push({ name: trimmed, role });
    }
  }

  const shipment = request.shipment || {};
  if (shipment.origin) addEntity(shipment.origin, "origin_jurisdiction");
  if (shipment.destination) addEntity(shipment.destination, "destination_jurisdiction");
  if (Array.isArray(shipment.transit_countries)) {
    for (const tc of shipment.transit_countries) {
      addEntity(tc, "transit_jurisdiction");
    }
  }
  if (typeof shipment.consignee === "string") addEntity(shipment.consignee, "consignee");
  else if (shipment.consignee && typeof shipment.consignee.name === "string") {
    addEntity(shipment.consignee.name, "consignee");
    if (Array.isArray(shipment.consignee.beneficial_owners)) {
      for (const bo of shipment.consignee.beneficial_owners) addEntity(bo, "beneficial_owner");
    }
  }
  if (typeof shipment.exporter === "string") addEntity(shipment.exporter, "exporter");
  else if (shipment.exporter && typeof shipment.exporter.name === "string") {
    addEntity(shipment.exporter.name, "exporter");
    if (Array.isArray(shipment.exporter.beneficial_owners)) {
      for (const bo of shipment.exporter.beneficial_owners) addEntity(bo, "beneficial_owner");
    }
  }

  // Caller-supplied counterparties
  const counterparties = Array.isArray(request.counterparties)
    ? request.counterparties
    : Array.isArray(shipment.counterparties)
      ? shipment.counterparties
      : [];
  for (const cp of counterparties) {
    if (cp && typeof cp.name === "string") {
      addEntity(cp.name, cp.role || "counterparty");
    }
    if (cp && Array.isArray(cp.beneficial_owners)) {
      for (const bo of cp.beneficial_owners) {
        addEntity(bo, "beneficial_owner");
      }
    }
  }

  let sanctionsViolation = false;
  const sanctionsMatches = [];

  try {
    // 1. Screen entities/parties against Vizier sanctions engine (OFAC 50% Rule)
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
          attribution: dualUseAttributionBlock(),
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

    // 2. Screen dual-use export dossier parameters with Vizier DLP Firewall
    const dlpUrl = `${base}/v1/dlp/scan`;
    const dlpParams = {
      shipment: request.shipment,
      dated_sources: request.dated_sources,
      risk_question: request.risk_question,
      counterparties: request.counterparties
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
        attribution: dualUseAttributionBlock(),
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
      engine: "vizier_dual_use",
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
      attribution: dualUseAttributionBlock(),
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
      attribution: dualUseAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
