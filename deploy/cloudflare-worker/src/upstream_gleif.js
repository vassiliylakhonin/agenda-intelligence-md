// GLEIF (Global Legal Entity Identifier Foundation) ownership-enrichment
// adapter for the Cloudflare Worker.
//
// GLEIF publishes the global LEI (Legal Entity Identifier) pool and the
// "who owns whom" Level-2 relationship data (direct parent, ultimate parent)
// free of charge (CC0-1.0), via a public JSON:API at api.gleif.org with no
// API key. Docs: https://www.gleif.org/en/lei-data/gleif-api
//
// Used by the `cis_secondary_sanctions` profile as an OWNERSHIP-ENRICHMENT
// upstream that runs ALONGSIDE the sanctions-list match (Snapshot / Watchman /
// OpenSanctions), not instead of it. It contributes disclosed-ownership
// evidence (`ownership_chain_evidence`, `beneficial_ownership_source`), which
// reduces the corresponding evidence gaps when the counterparty holds an LEI.
//
// Boundary discipline (per ADR 0014 / ADR 0022):
//   - Off by default. Enabled only when env.GLEIF_ENABLED is truthy.
//   - Only queries the public api.gleif.org host; no key, no PII beyond the
//     openly published LEI relationship pool.
//   - In-process KV cache reusing AGENDA_USAGE with the `gleif:` prefix.
//   - Graceful degrade: network failure, non-200 search, timeout, or unset
//     GLEIF_ENABLED returns status !== "success" with no matches; the caller
//     MUST NOT fail the user request on this.
//   - A missing parent relationship (GLEIF returns 404/errors on the
//     /direct-parent or /ultimate-parent shortcut) is NORMAL, not a failure.
//   - Disclosed ownership only: GLEIF reports the parents an entity has
//     declared, not hidden nominee or multi-layer beneficial-ownership graphs.
//   - Attribution surfaced via GLEIF_ATTRIBUTION on every response that
//     includes upstream data.

export const GLEIF_SEARCH_URL = "https://api.gleif.org/api/v1/lei-records";
export const GLEIF_HOMEPAGE = "https://www.gleif.org";
export const GLEIF_LICENSE = "CC0-1.0";
export const GLEIF_ATTRIBUTION =
  "Disclosed ownership (LEI direct/ultimate parent) via GLEIF (https://www.gleif.org), CC0-1.0. Disclosed relationships only, not hidden or multi-layer beneficial ownership.";

export const DEFAULT_TIMEOUT_MS = 6000;
export const DEFAULT_CACHE_TTL_SECONDS = 24 * 3600;
export const CACHE_KEY_PREFIX = "gleif:";

const ACCEPT_HEADER = "application/vnd.api+json";
const USER_AGENT =
  "agenda-intelligence-md/cis_secondary_sanctions (+https://github.com/vassiliylakhonin/agenda-intelligence-md)";

export function attributionBlock() {
  return {
    upstream: "GLEIF",
    url: GLEIF_HOMEPAGE,
    license: GLEIF_LICENSE,
    notice: GLEIF_ATTRIBUTION
  };
}

export function isEnabled(env = {}) {
  const flag = (env.GLEIF_ENABLED || "").toString().trim().toLowerCase();
  if (!(flag === "1" || flag === "true" || flag === "yes")) return false;
  const disabled = (env.GLEIF_DISABLED || "").toString().trim().toLowerCase();
  return !(disabled === "1" || disabled === "true" || disabled === "yes");
}

function nowIso() {
  return new Date().toISOString();
}

function cacheKey(name, jurisdiction) {
  const j = (jurisdiction || "").toLowerCase();
  const n = name.trim().toLowerCase();
  return `${CACHE_KEY_PREFIX}${j}|${n}`;
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

function entityName(record) {
  const name = record && record.attributes && record.attributes.entity && record.attributes.entity.legalName;
  return (name && name.name) || "";
}

function entityCountry(record) {
  const addr = record && record.attributes && record.attributes.entity && record.attributes.entity.legalAddress;
  return (addr && addr.country) || null;
}

// Fetch a parent shortcut (/direct-parent or /ultimate-parent). GLEIF returns
// 404 with an `errors` body when the relationship is not reported — that is a
// normal "no parent on file" outcome, returned here as null (not an error).
async function fetchParent(lei, kind, timeoutMs) {
  const url = `${GLEIF_SEARCH_URL}/${encodeURIComponent(lei)}/${kind}`;
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      { headers: { accept: ACCEPT_HEADER, "user-agent": USER_AGENT } },
      timeoutMs
    );
  } catch (_error) {
    return null;
  }
  if (!response.ok) return null;
  let payload;
  try {
    payload = await response.json();
  } catch (_error) {
    return null;
  }
  const record = payload && payload.data;
  if (!record || !record.id) return null;
  return { lei: record.id, name: entityName(record), country: entityCountry(record) };
}

// Resolve a counterparty name to LEI ownership evidence.
//
// Returns matches shaped for the CIS auto-fetch merge:
//   { name, source_type, lei, relationship_role, jurisdictions, score }
// where source_type is `ownership_chain_evidence` for the resolved entity and
// its direct parent, and `beneficial_ownership_source` for the ultimate parent.
export async function fetchOwnership(env, options = {}) {
  const { name, jurisdiction, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtl = DEFAULT_CACHE_TTL_SECONDS } = options;

  if (!name || typeof name !== "string" || !name.trim()) {
    return degradedResult("empty counterparty name");
  }
  if (!isEnabled(env)) {
    return disabledResult("GLEIF_ENABLED env flag is not set");
  }

  const ck = cacheKey(name, jurisdiction);
  const cached = await readCache(env, ck);
  if (cached) return cached;

  const searchUrl =
    `${GLEIF_SEARCH_URL}?filter%5Bentity.legalName%5D=${encodeURIComponent(name.trim())}&page%5Bsize%5D=1`;

  let response;
  try {
    response = await fetchWithTimeout(
      searchUrl,
      { headers: { accept: ACCEPT_HEADER, "user-agent": USER_AGENT } },
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

  const record = payload && Array.isArray(payload.data) ? payload.data[0] : null;
  // No LEI on file for this name is a successful, empty result: many small
  // CIS/forwarder counterparties simply do not hold an LEI.
  if (!record || !record.id) {
    const empty = {
      status: "success",
      matches: [],
      attribution: attributionBlock(),
      queried_at: nowIso(),
      degrade_reason: null
    };
    await writeCache(env, ck, empty, cacheTtl);
    return empty;
  }

  const lei = record.id;
  const country = entityCountry(record);
  const matches = [
    {
      name: entityName(record) || name.trim(),
      source_type: "ownership_chain_evidence",
      lei,
      relationship_role: "resolved_entity",
      jurisdictions: country ? [country] : [],
      score: 1
    }
  ];

  const [directParent, ultimateParent] = await Promise.all([
    fetchParent(lei, "direct-parent", timeoutMs),
    fetchParent(lei, "ultimate-parent", timeoutMs)
  ]);

  if (directParent) {
    matches.push({
      name: directParent.name,
      source_type: "ownership_chain_evidence",
      lei: directParent.lei,
      relationship_role: "direct_parent",
      jurisdictions: directParent.country ? [directParent.country] : [],
      score: 1
    });
  }
  if (ultimateParent && (!directParent || ultimateParent.lei !== directParent.lei)) {
    matches.push({
      name: ultimateParent.name,
      source_type: "beneficial_ownership_source",
      lei: ultimateParent.lei,
      relationship_role: "ultimate_parent",
      jurisdictions: ultimateParent.country ? [ultimateParent.country] : [],
      score: 1
    });
  }

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
