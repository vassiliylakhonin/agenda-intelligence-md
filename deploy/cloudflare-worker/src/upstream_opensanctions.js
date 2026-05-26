// OpenSanctions live-fetch adapter for the Cloudflare Worker.
//
// Mirrors src/agenda_intelligence/upstream_opensanctions.py for the JS runtime.
// Used by the `cis_secondary_sanctions` profile per ADR 0014.
//
// Boundary discipline:
//   - Only queries the public api.opensanctions.org host.
//   - In-process KV cache keyed on the query payload (prefix `opensanctions:`)
//     reusing the AGENDA_USAGE KV namespace to avoid spinning a new namespace.
//   - Graceful degrade: network failure, non-200, timeout, or missing API key
//     returns status !== "success" with no matches; the caller MUST NOT
//     fail the user request on this.
//   - Attribution is mandatory on every response that includes upstream data
//     (CC-BY 4.0). See OPENSANCTIONS_ATTRIBUTION.

export const OPENSANCTIONS_MATCH_URL = "https://api.opensanctions.org/match/default";
export const OPENSANCTIONS_HOMEPAGE = "https://www.opensanctions.org";
export const OPENSANCTIONS_LICENSE = "CC-BY-4.0";
export const OPENSANCTIONS_ATTRIBUTION =
  "Sanctions list matches via OpenSanctions (https://www.opensanctions.org), CC-BY 4.0.";

export const DEFAULT_TIMEOUT_MS = 6000;
export const DEFAULT_CACHE_TTL_SECONDS = 24 * 3600;
export const DEFAULT_MAX_MATCHES = 5;
export const CACHE_KEY_PREFIX = "opensanctions:";

const DATASET_TO_SOURCE_TYPE = {
  us_ofac_sdn: "ofac_sdn_extract",
  us_ofac_cons: "ofac_sdn_extract",
  eu_fsf: "eu_consolidated_extract",
  eu_sanctions_map: "eu_consolidated_extract",
  gb_hmt_sanctions: "uk_ofsi_extract",
  gb_fcdo_sanctions: "uk_ofsi_extract",
  un_sc_sanctions: "un_security_council_extract"
};

export function attributionBlock() {
  return {
    upstream: "OpenSanctions",
    url: OPENSANCTIONS_HOMEPAGE,
    license: OPENSANCTIONS_LICENSE,
    notice: OPENSANCTIONS_ATTRIBUTION
  };
}

export function isDisabled(env = {}) {
  const flag = (env.OPENSANCTIONS_DISABLED || "").toString().trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function apiKey(env = {}) {
  const key = (env.OPENSANCTIONS_API_KEY || "").toString().trim();
  return key || null;
}

function nowIso() {
  return new Date().toISOString();
}

function cacheKey(name, jurisdiction, schema) {
  const j = (jurisdiction || "").toLowerCase();
  const n = name.trim().toLowerCase();
  return `${CACHE_KEY_PREFIX}${schema}|${j}|${n}`;
}

function mapDatasetToSourceType(datasets) {
  for (const dataset of datasets) {
    const mapped = DATASET_TO_SOURCE_TYPE[dataset];
    if (mapped) return mapped;
  }
  return "user_provided_note";
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

function parseMatches(payload, schema, maxMatches) {
  const results = ((payload && payload.responses && payload.responses.counterparty) || {}).results || [];
  const matches = [];
  for (const match of results.slice(0, maxMatches)) {
    if (!match || typeof match !== "object") continue;
    const properties = match.properties || {};
    const names = properties.name || [match.caption || ""];
    const datasets = Array.isArray(match.datasets) ? match.datasets.map(String) : [];
    const topics = Array.isArray(properties.topics) ? properties.topics.map(String) : [];
    const jurisdictions = Array.isArray(properties.country)
      ? properties.country.map(String)
      : Array.isArray(properties.jurisdiction)
      ? properties.jurisdiction.map(String)
      : [];
    matches.push({
      name: (Array.isArray(names) && names[0]) || match.caption || "",
      schema: match.schema || schema,
      datasets,
      source_type: mapDatasetToSourceType(datasets),
      score: typeof match.score === "number" ? match.score : null,
      opensanctions_id: match.id || null,
      topics,
      jurisdictions
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
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtl = DEFAULT_CACHE_TTL_SECONDS
  } = options;

  if (!name || typeof name !== "string" || !name.trim()) {
    return degradedResult("empty counterparty name");
  }

  if (isDisabled(env)) {
    return disabledResult("OPENSANCTIONS_DISABLED env flag is set");
  }

  const key = apiKey(env);
  if (!key) {
    return disabledResult(
      "OPENSANCTIONS_API_KEY env var is not set. Register a free key at https://www.opensanctions.org/api/."
    );
  }

  const ck = cacheKey(name, jurisdiction, schema);
  const cached = await readCache(env, ck);
  if (cached) return cached;

  const properties = { name: [name.trim()] };
  if (jurisdiction) properties.country = [jurisdiction.toString().trim().toLowerCase()];
  const body = JSON.stringify({
    queries: {
      counterparty: { schema, properties }
    }
  });

  let response;
  try {
    response = await fetchWithTimeout(
      OPENSANCTIONS_MATCH_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `ApiKey ${key}`,
          "user-agent":
            "agenda-intelligence-md/cis_secondary_sanctions (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
        },
        body
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

  const matches = parseMatches(payload, schema, maxMatches);
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
