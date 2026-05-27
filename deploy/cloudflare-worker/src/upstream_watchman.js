// Watchman (moov-io) live-fetch adapter for the Cloudflare Worker.
//
// Watchman is an open-source (Apache 2.0) self-hosted OFAC / EU / UK OFSI / UN
// consolidated sanctions search engine maintained by Moov Financial. It exposes
// /v2/search?name=...&type=...&limit=...&minMatch=... and returns
// entity objects with a `match` score (0-1) and `sourceList` (OFAC, EU, UK,
// UN, etc.).
//
// Used as a per-profile live retrieval upstream for the `cis_secondary_sanctions`
// profile (per ADR 0014). Selected when env.WATCHMAN_URL is set. Activation is
// "free" in the sense that watchman is self-hostable on small free-tier
// containers (Fly.io, Railway, Render, etc.); the operator brings the deploy.
//
// Boundary discipline:
//   - Only queries the operator-configured WATCHMAN_URL host.
//   - In-process KV cache reusing AGENDA_USAGE with the `watchman:` prefix.
//   - Graceful degrade: network failure, non-200, timeout, or unset WATCHMAN_URL
//     returns status !== "success" with no matches; the caller MUST NOT
//     fail the user request on this.
//   - Attribution surfaced via WATCHMAN_ATTRIBUTION on every response that
//     includes upstream data.

export const WATCHMAN_PROJECT_URL = "https://github.com/moov-io/watchman";
export const WATCHMAN_LICENSE = "Apache-2.0";
export const WATCHMAN_ATTRIBUTION =
  "Sanctions list matches via Watchman (https://github.com/moov-io/watchman), Apache-2.0, against the operator's self-hosted instance.";

export const DEFAULT_TIMEOUT_MS = 6000;
export const DEFAULT_CACHE_TTL_SECONDS = 24 * 3600;
export const DEFAULT_MAX_MATCHES = 5;
export const DEFAULT_MIN_MATCH = 0.75;
export const CACHE_KEY_PREFIX = "watchman:";

// Watchman sourceList → canonical source_type used by the cis-secondary-sanctions schema.
const SOURCE_LIST_TO_SOURCE_TYPE = {
  "us-ofac-sdn": "ofac_sdn_extract",
  "us_ofac_sdn": "ofac_sdn_extract",
  "ofac": "ofac_sdn_extract",
  "us-ofac-non-sdn": "ofac_sdn_extract",
  "us-ofac-cons": "ofac_sdn_extract",
  "eu-csl": "eu_consolidated_extract",
  "eu-consolidated": "eu_consolidated_extract",
  "eu": "eu_consolidated_extract",
  "uk-csl": "uk_ofsi_extract",
  "uk-ofsi": "uk_ofsi_extract",
  "uk": "uk_ofsi_extract",
  "un-sc": "un_security_council_extract",
  "un": "un_security_council_extract"
};

export function attributionBlock() {
  return {
    upstream: "Watchman",
    url: WATCHMAN_PROJECT_URL,
    license: WATCHMAN_LICENSE,
    notice: WATCHMAN_ATTRIBUTION
  };
}

export function isDisabled(env = {}) {
  const flag = (env.WATCHMAN_DISABLED || "").toString().trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function baseUrl(env = {}) {
  const url = (env.WATCHMAN_URL || "").toString().trim();
  return url ? url.replace(/\/+$/, "") : null;
}

function nowIso() {
  return new Date().toISOString();
}

function cacheKey(name, jurisdiction, type) {
  const j = (jurisdiction || "").toLowerCase();
  const n = name.trim().toLowerCase();
  return `${CACHE_KEY_PREFIX}${type}|${j}|${n}`;
}

function mapSourceListToSourceType(sourceList) {
  if (!sourceList) return "user_provided_note";
  const key = String(sourceList).toLowerCase();
  return SOURCE_LIST_TO_SOURCE_TYPE[key] || "user_provided_note";
}

async function readCache(env, key) {
  const kv = env && env.AGENDA_USAGE;
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

async function writeCache(env, key, payload, ttlSeconds) {
  const kv = env && env.AGENDA_USAGE;
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(payload), { expirationTtl: ttlSeconds });
  } catch (_error) {
    // ignore cache write failures
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function degradedResult(reason) {
  return {
    status: "degraded",
    matches: [],
    attribution: attributionBlock(),
    queried_at: nowIso(),
    degrade_reason: reason
  };
}

function disabledResult(reason) {
  return {
    status: "disabled",
    matches: [],
    attribution: attributionBlock(),
    queried_at: nowIso(),
    degrade_reason: reason
  };
}

function parseEntities(payload, maxMatches) {
  // Watchman v2/search returns an object; the top-level array may be `entities`
  // or per-list keys depending on the deployment. Normalize defensively.
  const candidates =
    (payload && (payload.entities || payload.results)) ||
    [].concat(payload?.SDNs || [], payload?.altNames || [], payload?.addresses || []);
  if (!Array.isArray(candidates)) return [];
  const matches = [];
  for (const entity of candidates.slice(0, maxMatches)) {
    if (!entity || typeof entity !== "object") continue;
    const sourceList = entity.sourceList || (entity.sourceData && entity.sourceData.list) || "";
    const sourceType = mapSourceListToSourceType(sourceList);
    const name = entity.name || (entity.sourceData && entity.sourceData.sdnName) || "";
    const score = typeof entity.match === "number" ? entity.match : null;
    const entityType = entity.entityType || (entity.sourceData && entity.sourceData.sdnType) || null;
    const programs =
      (entity.sourceData && Array.isArray(entity.sourceData.program) && entity.sourceData.program) || [];
    matches.push({
      name,
      schema: entityType || "Company",
      datasets: sourceList ? [String(sourceList)] : [],
      source_type: sourceType,
      score,
      opensanctions_id: null,
      topics: programs.map(String),
      jurisdictions: [],
      watchman_source_id: entity.sourceID || null
    });
  }
  return matches;
}

export async function matchCounterparty(env, options = {}) {
  const {
    name,
    jurisdiction,
    schema = "Company",
    maxMatches = DEFAULT_MAX_MATCHES,
    minMatch = DEFAULT_MIN_MATCH,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtl = DEFAULT_CACHE_TTL_SECONDS
  } = options;

  if (!name || typeof name !== "string" || !name.trim()) {
    return degradedResult("empty counterparty name");
  }

  if (isDisabled(env)) {
    return disabledResult("WATCHMAN_DISABLED env flag is set");
  }

  const root = baseUrl(env);
  if (!root) {
    return disabledResult(
      "WATCHMAN_URL env var is not set. Self-host Watchman from https://github.com/moov-io/watchman (Apache-2.0, fits on free-tier Fly.io / Railway) and point WATCHMAN_URL at it."
    );
  }

  const type = schema === "Person" ? "person" : "business";
  const ck = cacheKey(name, jurisdiction, type);
  const cached = await readCache(env, ck);
  if (cached) return cached;

  const url = new URL(`${root}/v2/search`);
  url.searchParams.set("name", name.trim());
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(maxMatches));
  url.searchParams.set("minMatch", String(minMatch));

  let response;
  try {
    response = await fetchWithTimeout(
      url.toString(),
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent":
            "agenda-intelligence-md/cis_secondary_sanctions (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
        }
      },
      timeoutMs
    );
  } catch (error) {
    return degradedResult(`network error: ${error && error.name ? error.name : "unknown"}`);
  }

  if (!response.ok) {
    return degradedResult(`upstream HTTP ${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_error) {
    return degradedResult("upstream returned malformed JSON");
  }

  const matches = parseEntities(payload, maxMatches);
  const result = {
    status: "success",
    matches,
    attribution: attributionBlock(),
    queried_at: nowIso(),
    degrade_reason: null
  };
  await writeCache(env, ck, result, cacheTtl);
  return result;
}
