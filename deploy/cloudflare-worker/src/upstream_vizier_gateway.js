// Vizier Root Gateway Counterparty Sanctions (OFAC 50% Rule) & Query DLP Firewall Adapter.
//
// Connects Worker #11 (agenda-intelligence-a2a, profile: agenda) — the root discovery router
// and central gateway for the vertical fleet — to the Vizier security kernel.
// Enables real-time screening of mentioned counterparties across global gateway inquiries
// under the OFAC 50% Rule, as well as prompt / query DLP firewall inspection across free-form
// caller requests and structured parameters to prevent credential and sensitive data leaks.
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
export const GATEWAY_NOTICE =
  "Global A2A Gateway counterparty sanctions screening (OFAC 50% Rule) & query DLP firewall via Vizier Action Firewall (https://vizier.vassiliy-lakhonin.workers.dev).";

export function gatewayAttributionBlock() {
  return {
    upstream: "Vizier Root Gateway Action Firewall",
    url: VIZIER_DEFAULT_URL,
    notice: GATEWAY_NOTICE
  };
}

export function isGatewayVizierEnabled(env = {}) {
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

const KNOWN_MONITORED_ENTITIES = [
  "Sovcomflot",
  "Garantex",
  "Sberbank",
  "VTB",
  "Gazprombank",
  "Alrosa",
  "Rusal",
  "Wagner",
  "Rosneft",
  "Novatek",
  "Severstal"
];

const GEOGRAPHIC_STOP_WORDS = new Set([
  "kazakhstan",
  "eu",
  "uk",
  "us",
  "usa",
  "uae",
  "cis",
  "china",
  "russia",
  "europe",
  "asia",
  "central asia",
  "georgia",
  "turkey",
  "azerbaijan",
  "italy",
  "germany",
  "poland",
  "caspian sea",
  "caspian",
  "black sea",
  "baltic sea",
  "middle corridor",
  "corridor",
  "middle",
  "deal",
  "desk",
  "bank",
  "compliance",
  "office",
  "review",
  "work",
  "email",
  "grain",
  "wheat",
  "steel",
  "oil"
]);

/**
 * Extracts candidate counterparty / entity names from gateway query text and parameters.
 *
 * @param {string} text - Caller text inquiry
 * @param {object} [params] - Optional structured parameters
 * @returns {Array<{ name: string, role: string }>}
 */
export function extractGatewayEntities(text = "", params = {}) {
  const entitiesToScreen = [];
  const seenNames = new Set();

  function addEntity(name, role = "counterparty") {
    if (typeof name !== "string") return;
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seenNames.has(key) && !GEOGRAPHIC_STOP_WORDS.has(key)) {
      seenNames.add(key);
      entitiesToScreen.push({ name: trimmed, role });
    }
  }

  // 1. Check explicit fields in params
  if (params && typeof params === "object") {
    if (typeof params.counterparty === "string") {
      addEntity(params.counterparty, "counterparty");
    } else if (params.counterparty && typeof params.counterparty.name === "string") {
      addEntity(params.counterparty.name, params.counterparty.role || "counterparty");
    }

    if (Array.isArray(params.counterparties)) {
      for (const cp of params.counterparties) {
        if (typeof cp === "string") addEntity(cp, "counterparty");
        else if (cp && typeof cp.name === "string") addEntity(cp.name, cp.role || "counterparty");
      }
    }

    if (typeof params.entity === "string") {
      addEntity(params.entity, "entity");
    } else if (params.entity && typeof params.entity.name === "string") {
      addEntity(params.entity.name, params.entity.role || "entity");
    }

    if (Array.isArray(params.entities)) {
      for (const ent of params.entities) {
        if (typeof ent === "string") addEntity(ent, "entity");
        else if (ent && typeof ent.name === "string") addEntity(ent.name, ent.role || "entity");
      }
    }

    if (Array.isArray(params.parties)) {
      for (const p of params.parties) {
        if (typeof p === "string") addEntity(p, "party");
        else if (p && typeof p.name === "string") addEntity(p.name, p.role || "party");
      }
    }

    if (typeof params.vessel === "string") addEntity(params.vessel, "vessel");
    if (typeof params.operator === "string") addEntity(params.operator, "operator");
    if (typeof params.carrier === "string") addEntity(params.carrier, "carrier");
    if (typeof params.bank === "string") addEntity(params.bank, "bank");
    if (typeof params.trader === "string") addEntity(params.trader, "trader");
  }

  // 2. Scan text for known monitored/sanctioned entities
  if (typeof text === "string" && text.length > 0) {
    for (const known of KNOWN_MONITORED_ENTITIES) {
      const regex = new RegExp(`\\b${known}\\b`, "i");
      if (regex.test(text)) {
        addEntity(known, "mentioned_counterparty");
      }
    }

    // 3. Scan text for explicit role mentions
    const explicitRegex = /(?:counterparty|entity|company|vessel|partner|operator|forwarder|trader|carrier|firm|bank)(?:\s+is|\s*:|\s+called|\s+named)?\s+([A-Z][a-zA-Z0-9_\-&]+(?:\s+[A-Z][a-zA-Z0-9_\-&]+)*)/gi;
    let match;
    while ((match = explicitRegex.exec(text)) !== null) {
      if (match[1]) {
        addEntity(match[1], "mentioned_counterparty");
      }
    }

    // 4. Scan text for carrier / operator mentions
    const carrierRegex = /(?:chartered\s+with|handled\s+by|shipping\s+via|forwarded\s+by)\s+([A-Z][a-zA-Z0-9_\-&]+(?:\s+[A-Z][a-zA-Z0-9_\-&]+)?)/gi;
    while ((match = carrierRegex.exec(text)) !== null) {
      if (match[1]) {
        addEntity(match[1], "route_carrier");
      }
    }
  }

  return entitiesToScreen.slice(0, 5);
}

/**
 * Verifies a root gateway inquiry against Vizier for sanctions (OFAC 50% Rule) and DLP leaks.
 *
 * @param {object} env - Worker environment bindings
 * @param {string} text - Caller text inquiry
 * @param {object} [params] - Request parameters
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function verifyGatewayWithVizier(env = {}, text = "", params = {}, options = {}) {
  if (!isGatewayVizierEnabled(env)) {
    return {
      status: "disabled",
      clean: true,
      violation: false,
      sanctions_screening: { checked: false, entities_screened: [], violation: false, matches: [] },
      dlp_screening: { clean: true, findings: [], total_leaks_prevented: 0 },
      receipt: null,
      attribution: gatewayAttributionBlock(),
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
      "agenda-intelligence-md/root_gateway (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
  };

  const apiKey = (env.VIZIER_API_KEY || "").toString().trim();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-Vizier-Key"] = apiKey;
  }

  let latestReceipt = null;
  const entitiesToScreen = extractGatewayEntities(text, params);
  let sanctionsViolation = false;
  const sanctionsMatches = [];

  try {
    // 1. Screen extracted entities against Vizier sanctions engine (OFAC 50% Rule)
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
          attribution: gatewayAttributionBlock(),
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

    // 2. Screen prompt text & parameters with Vizier DLP Firewall
    const dlpUrl = `${base}/v1/dlp/scan`;
    const dlpRes = await fetchWithTimeout(
      fetcher,
      dlpUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: text || "",
          parameters: params && typeof params === "object" ? params : {}
        })
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
        attribution: gatewayAttributionBlock(),
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
      engine: "vizier_gateway",
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
      attribution: gatewayAttributionBlock(),
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
      attribution: gatewayAttributionBlock(),
      queried_at: nowIso(),
      degrade_reason: error instanceof Error ? error.message : "Network error"
    };
  }
}
