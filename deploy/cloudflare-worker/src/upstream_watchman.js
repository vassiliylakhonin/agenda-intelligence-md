// Watchman (moov-io) live-fetch adapter for the Cloudflare Worker.
//
// Watchman is an open-source (Apache 2.0) self-hosted OFAC / EU / UK OFSI / UN
// consolidated sanctions search engine maintained by Moov Financial. It exposes
// /search?name=...&type=...&limit=...&minMatch=... and returns grouped list
// results with a `match` score (0-1).
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

// Watchman source/list identifiers -> canonical source_type used by the
// cis-secondary-sanctions schema.
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

const RESULT_KEY_TO_SOURCE_TYPE = {
  SDNs: "ofac_sdn_extract",
  altNames: "ofac_sdn_extract",
  addresses: "ofac_sdn_extract",
  sectoralSanctions: "ofac_sdn_extract",
  deniedPersons: "dual_use_export_evidence",
  bisEntities: "dual_use_export_evidence",
  militaryEndUsers: "dual_use_export_evidence",
  unverifiedCSL: "dual_use_export_evidence",
  euConsolidatedSanctionsList: "eu_consolidated_extract",
  ukConsolidatedSanctionsList: "uk_ofsi_extract",
  ukSanctionsList: "uk_ofsi_extract"
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

function mapSourceListToSourceType(sourceList, resultKey) {
  if (resultKey && RESULT_KEY_TO_SOURCE_TYPE[resultKey]) {
    return RESULT_KEY_TO_SOURCE_TYPE[resultKey];
  }
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

function firstNonEmpty(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const first = value.find((item) => item !== null && item !== undefined && String(item).trim());
      if (first !== undefined) return String(first);
    } else if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return "";
}

function normalizePrograms(entity) {
  const programs = entity.program || entity.Programs || entity.topics || [];
  return Array.isArray(programs) ? programs.map(String) : [];
}

function normalizeDatasets(entity, resultKey) {
  const sourceList = entity.sourceList || entity.SourceList || entity.source_list || "";
  if (sourceList) return [String(sourceList)];
  return resultKey ? [String(resultKey)] : [];
}

function parseEntities(payload, maxMatches) {
  // Watchman /search returns grouped arrays keyed by list name. Older or custom
  // deployments may return a flat `entities` / `results` array, so keep that
  // shape as a compatibility fallback.
  const grouped = [];
  if (payload && Array.isArray(payload.entities)) grouped.push(["entities", payload.entities]);
  if (payload && Array.isArray(payload.results)) grouped.push(["results", payload.results]);
  for (const key of Object.keys(RESULT_KEY_TO_SOURCE_TYPE)) {
    if (Array.isArray(payload?.[key])) grouped.push([key, payload[key]]);
  }

  if (grouped.length === 0) return [];
  const matches = [];
  for (const [resultKey, entities] of grouped) {
    for (const entity of entities) {
      if (!entity || typeof entity !== "object") continue;
      const sourceList = entity.sourceList || (entity.sourceData && entity.sourceData.list) || "";
      const sourceType = mapSourceListToSourceType(sourceList, resultKey);
      const name = firstNonEmpty(
        entity.name,
        entity.sdnName,
        entity.Name,
        entity.Names,
        entity.NameAliasWholeNames,
        entity.AlternateNames,
        entity.alternateName,
        entity.sourceData && entity.sourceData.sdnName
      );
      const score = typeof entity.match === "number" ? entity.match : null;
      const entityType =
        entity.entityType || entity.Type || entity.GroupType || (entity.sourceData && entity.sourceData.sdnType) || null;
      matches.push({
        name,
        schema: entityType || "Company",
        datasets: normalizeDatasets(entity, resultKey),
        source_type: sourceType,
        score,
        opensanctions_id: null,
        topics: normalizePrograms(entity),
        jurisdictions: [],
        watchman_source_id: entity.sourceID || entity.entityID || entity.EntityID || entity.GroupID || null
      });
      if (matches.length >= maxMatches) return matches;
    }
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

  const url = new URL(`${root}/search`);
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
