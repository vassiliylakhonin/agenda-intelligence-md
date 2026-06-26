// Snapshot live-retrieval adapter for the Cloudflare Worker.
//
// Server-side name screening against a fresh, compact public-list name index
// published by the portfolio site (built by scripts/sanctions_name_index.py
// from OFAC SDN + OFAC consolidated + EU consolidated + UK FCDO source files).
// This is the "$0, no external host" upstream for the cis_secondary_sanctions
// profile (per ADR 0014): there is no Watchman/OpenSanctions container to run,
// the worker fetches one static JSON snapshot and matches in-process.
//
// Matching is deliberately cheap (Worker CPU budget): exact normalized-name
// match plus significant-token overlap. No per-request Levenshtein / fuzzy pass
// (that stays browser-side where the CPU is the user's). A match is a possible
// string match only — not identity verification or a sanctions determination.
//
// Boundary discipline:
//   - Only fetches the operator-configured SNAPSHOT_INDEX_URL.
//   - Parsed index cached in module-global scope, reused across requests in the
//     same isolate; re-fetched after SNAPSHOT_CACHE_TTL_MS.
//   - Graceful degrade: unset URL, network failure, non-200, timeout, or a
//     malformed/oversized index returns status !== "success" with no matches;
//     the caller MUST NOT fail the user request on this.
//   - Attribution surfaced via SNAPSHOT_ATTRIBUTION on every response that
//     includes upstream data.

export const SNAPSHOT_PROJECT_URL = "https://vassiliylakhonin.github.io/cis-secondary-sanctions.html";
export const SNAPSHOT_LICENSE = "Public official sanctions lists (OFAC / EU / UK)";
export const SNAPSHOT_ATTRIBUTION =
  "Possible name matches via a static public-list snapshot (OFAC SDN + consolidated, EU consolidated, UK FCDO). " +
  "String match only; not identity verification, ownership analysis, or a sanctions determination.";

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_MATCHES = 5;
export const DEFAULT_CACHE_TTL_MS = 6 * 3600 * 1000;
// Tokens appearing in more than this many names are corporate noise
// ("TRADING", "COMPANY", "LLC"...); skipped from postings to bound memory/CPU.
const MAX_TOKEN_POSTINGS = 1500;
const MIN_TOKEN_LEN = 3;
const MIN_OVERLAP_SCORE = 0.82;

const AUTHORITY_TO_SOURCE_TYPE = {
  "US OFAC": "ofac_sdn_extract",
  "EUROPEAN UNION": "eu_consolidated_extract",
  "UNITED KINGDOM FCDO": "uk_ofsi_extract"
};

const STOPWORDS = {
  LLC: 1, LTD: 1, LIMITED: 1, LLP: 1, JSC: 1, OOO: 1, AO: 1, PAO: 1, PJSC: 1,
  COMPANY: 1, CO: 1, INC: 1, CORPORATION: 1, CORP: 1, BANK: 1, THE: 1,
  TRADING: 1, GROUP: 1, HOLDING: 1, AND: 1, FOR: 1, OAO: 1, ZAO: 1, GMBH: 1
};

export function attributionBlock() {
  return {
    upstream: "Snapshot",
    url: SNAPSHOT_PROJECT_URL,
    license: SNAPSHOT_LICENSE,
    notice: SNAPSHOT_ATTRIBUTION
  };
}

export function isDisabled(env = {}) {
  const flag = (env.SNAPSHOT_DISABLED || "").toString().trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function indexUrl(env = {}) {
  const url = (env.SNAPSHOT_INDEX_URL || "").toString().trim();
  return url || null;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(value) {
  return String(value == null ? "" : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(norm) {
  const out = [];
  for (const tok of norm.split(" ")) {
    if (tok.length >= MIN_TOKEN_LEN && !STOPWORDS[tok]) out.push(tok);
  }
  return out;
}

function sourceTypeFor(authority, list) {
  const a = String(authority || "").toUpperCase();
  if (AUTHORITY_TO_SOURCE_TYPE[a]) return AUTHORITY_TO_SOURCE_TYPE[a];
  const l = String(list || "").toUpperCase();
  if (l.includes("OFAC") || l.includes("SDN")) return "ofac_sdn_extract";
  if (l.includes("EU")) return "eu_consolidated_extract";
  if (l.includes("UK")) return "uk_ofsi_extract";
  return "user_provided_note";
}

function degradedResult(reason) {
  return { status: "degraded", matches: [], attribution: attributionBlock(), queried_at: nowIso(), degrade_reason: reason };
}

function disabledResult(reason) {
  return { status: "disabled", matches: [], attribution: attributionBlock(), queried_at: nowIso(), degrade_reason: reason };
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

// Module-global parsed-index cache (per isolate). Built once, reused until TTL.
let INDEX_CACHE = null;

function buildIndex(raw) {
  const src = Array.isArray(raw.src) ? raw.src : [];
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const names = new Array(entries.length);
  const srcIdx = new Int16Array(entries.length);
  const tokenCount = new Uint8Array(entries.length);
  const exact = new Map();
  const postings = new Map();
  for (let i = 0; i < entries.length; i++) {
    const row = entries[i];
    const name = row[0];
    names[i] = name;
    srcIdx[i] = row[1] | 0;
    const norm = normalizeName(name);
    if (!exact.has(norm)) exact.set(norm, i);
    const toks = significantTokens(norm);
    tokenCount[i] = Math.min(toks.length, 255);
    const seen = new Set();
    for (const tok of toks) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      let list = postings.get(tok);
      if (!list) {
        list = [];
        postings.set(tok, list);
      }
      list.push(i);
    }
  }
  // Drop corporate-noise tokens with oversized postings.
  for (const [tok, list] of postings) {
    if (list.length > MAX_TOKEN_POSTINGS) postings.delete(tok);
  }
  return {
    generated_at_utc: raw.generated_at_utc || null,
    name_count: entries.length,
    src,
    names,
    srcIdx,
    tokenCount,
    exact,
    postings
  };
}

function matchInIndex(index, name, maxMatches) {
  const qNorm = normalizeName(name);
  if (qNorm.length < 3) return [];
  const out = [];
  const taken = new Set();

  const exactIdx = index.exact.get(qNorm);
  if (exactIdx !== undefined) {
    out.push(makeMatch(index, exactIdx, 1));
    taken.add(exactIdx);
  }

  const qTokens = significantTokens(qNorm);
  if (qTokens.length >= 2) {
    const shared = new Map();
    const qSeen = new Set();
    for (const tok of qTokens) {
      if (qSeen.has(tok)) continue;
      qSeen.add(tok);
      const list = index.postings.get(tok);
      if (!list) continue;
      for (let k = 0; k < list.length; k++) {
        const idx = list[k];
        shared.set(idx, (shared.get(idx) || 0) + 1);
      }
    }
    const scored = [];
    for (const [idx, count] of shared) {
      if (count < 2 || taken.has(idx)) continue;
      const denom = Math.max(qTokens.length, index.tokenCount[idx] || count);
      const score = count / denom;
      if (score >= MIN_OVERLAP_SCORE) scored.push([idx, score]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < scored.length && out.length < maxMatches; i++) {
      out.push(makeMatch(index, scored[i][0], scored[i][1]));
    }
  }
  return out.slice(0, maxMatches);
}

function makeMatch(index, idx, score) {
  const pair = index.src[index.srcIdx[idx]] || ["", ""];
  const authority = pair[0];
  const list = pair[1];
  return {
    name: index.names[idx],
    schema: "Company",
    datasets: [list ? `${authority} / ${list}` : authority],
    source_type: sourceTypeFor(authority, list),
    score: Math.round(score * 100) / 100,
    opensanctions_id: null,
    topics: [],
    jurisdictions: [],
    watchman_source_id: null
  };
}

export async function matchCounterparty(env, options = {}) {
  const { name, maxMatches = DEFAULT_MAX_MATCHES, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options;

  if (!name || typeof name !== "string" || !name.trim()) {
    return degradedResult("empty counterparty name");
  }
  if (isDisabled(env)) {
    return disabledResult("SNAPSHOT_DISABLED env flag is set");
  }
  const url = indexUrl(env);
  if (!url) {
    return disabledResult(
      "SNAPSHOT_INDEX_URL env var is not set. Point it at the published compact name index " +
        "(sanctions-name-index-compact.json) to activate $0 server-side name screening."
    );
  }

  const fresh = INDEX_CACHE && INDEX_CACHE.url === url && Date.now() - INDEX_CACHE.builtAt < cacheTtlMs;
  if (!fresh) {
    let response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "user-agent": "agenda-intelligence-md/cis_secondary_sanctions (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
          },
          cf: { cacheTtl: 3600, cacheEverything: true }
        },
        timeoutMs
      );
    } catch (error) {
      return degradedResult(`network error: ${error && error.name ? error.name : "unknown"}`);
    }
    if (!response.ok) return degradedResult(`upstream HTTP ${response.status}`);
    let raw;
    try {
      raw = await response.json();
    } catch (_error) {
      return degradedResult("snapshot index is malformed JSON");
    }
    try {
      INDEX_CACHE = { url, builtAt: Date.now(), index: buildIndex(raw) };
    } catch (error) {
      return degradedResult(`snapshot index build failed: ${error && error.name ? error.name : "unknown"}`);
    }
  }

  const matches = matchInIndex(INDEX_CACHE.index, name, maxMatches);
  return {
    status: "success",
    matches,
    attribution: attributionBlock(),
    queried_at: nowIso(),
    snapshot_generated_at: INDEX_CACHE.index.generated_at_utc,
    degrade_reason: null
  };
}

// Test seam: reset the module-global cache between unit tests.
export function __resetCache() {
  INDEX_CACHE = null;
}
