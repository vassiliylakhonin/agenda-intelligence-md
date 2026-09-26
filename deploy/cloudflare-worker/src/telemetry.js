import { MCP_ENDPOINT_PATH } from "./mcp.js";
// Usage, funnel classification and decision-journal persistence. No domain decisions.
import { VERSION } from "./profiles.js";
import { sha256Jcs } from "./decision-receipt.js";
import { PROBE_PROMPT_CHAR_THRESHOLD } from "./usage_constants.js";

export function createTelemetry({ agentProfile, jsonResponse, AGENSTRY_VERIFICATION_PATHS, directRoutes }) {
function headerHost(request, headerName) {
  const value = request.headers.get(headerName);
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch (_error) {
    return null;
  }
}

// message/send payloads below this many prompt characters are treated as
// health probes. Real triage requests carry hundreds of characters; the
// known monitors (Agenstry, uptime pingers) send near-empty payloads. This
// catches small-payload probes that do not announce themselves as "agenstry"
// in the user-agent (e.g. untagged uptime checks from monitor colos).

function classifyClient(request) {
  const clientId = request.headers.get("x-client-id");
  if (clientId) return safeClientId(clientId);
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  if (userAgent.includes("agenstry")) return "agenstry";
  if (userAgent.includes("curl")) return "curl";
  if (userAgent.includes("wrangler")) return "wrangler";
  if (userAgent.includes("bot") || userAgent.includes("crawler") || userAgent.includes("spider")) return "automation";
  if (userAgent.includes("mozilla")) return "browser";
  return "unknown";
}

function safeClientId(value) {
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9._:-]/g, "-");
  return normalized.slice(0, 64) || "unknown";
}

// The raw user-agent, truncated. classifyClient() collapses it into a handful
// of buckets, which is enough for volume but not for answering "who was that
// one caller from Singapore" — every unrecognised agent lands in "unknown".
// Kept deliberately coarse: no IP, no cookie, no header dump.
const USER_AGENT_MAX_CHARS = 120;
const USER_AGENT_STAT_ROWS = 15;

function userAgentSummary(request) {
  const raw = (request.headers.get("user-agent") || "").trim();
  return raw ? raw.slice(0, USER_AGENT_MAX_CHARS) : null;
}

// A request that arrives from another Cloudflare Worker carries `cf-worker`
// with the calling zone. It is the only handle on a caller that sends no user
// agent, and the whole reason for recording it is one measurement: over
// 2026-08-19..22, of 12,155 raw log rows, 50 carried a `cf-worker` zone and 49
// of those were probes that already name themselves in the user agent
// (ProofBench, mcpqueen-grader, x402-observatory, Cloudflare's own
// infrastructure). The fiftieth sent no user agent at all and was the single
// external non-probe call in the window. So this field is not a new layer of
// data — it is a signature on the one row a year where nothing else identifies
// the caller. Kept because the source it came from, Workers Logs, is destroyed
// after three days.
function callerZone(request) {
  const raw = (request.headers.get("cf-worker") || "").trim().toLowerCase();
  if (!raw) return null;
  // Header shape is a hostname. Anything else is either a mistake or someone
  // testing what this endpoint stores, and is recorded as such rather than
  // dropped, so the anomaly stays visible.
  return /^[a-z0-9]([a-z0-9.-]{0,62}[a-z0-9])?$/.test(raw) ? raw : "malformed";
}

// Our own conformance and smoke runs name themselves in the user agent, and so
// does every directory probe, auditor and census bot observed so far. That
// makes the classification cheap to read, but it also means only one of these
// buckets carries information that was not already available: `unsigned_external`,
// a caller that sent no user agent. Measured over the same window: 55 requests
// of 12,155, and the only non-probe among them was the one that mattered.
//
// A manual `curl` run by the operator lands in `external`, not `self_test` —
// the scripted paths set their own agent, an ad-hoc shell call does not. Read
// `external` as "not identified as ours or as a probe", not as "a stranger".
//
// The rule reads the `agenda-intelligence-` prefix rather than a list of tool
// names. It used to name two, `a2a-conformance` and `live-smoke`. On
// 2026-08-24 a third scripted path appeared, `agenda-intelligence-post-deploy-verifier`,
// which followed the same naming convention and was still counted as
// `external` because it was not on the list. A list has to be edited from a
// second repository every time a tool is added; a prefix does not.
//
// This does not make `external` mean "a stranger". The same day, that bucket
// held 36 non-probe calls: 5 genuinely outside, 3 from the verifier this
// change reclassifies, and 28 from the operator's own `curl`, which stays in
// `external` by the rule above and cannot be told apart from anyone else's
// `curl` at this layer. Separating those needs the calling network, which the
// Worker does not judge on and the archive does.
const SELF_TEST_USER_AGENT = /^agenda-intelligence-/i;

// Two ways an automated caller declares itself, and both are needed.
//
// The keyword list catches an agent that says what it does. It is not enough on
// its own: measured across 2026-08-20..22, the two highest-volume crawlers here
// name neither a role nor a bot suffix — `agent-tools.cloud-a2a/0.1` and
// `Waggle/1.0` — and 411 requests over those three days landed in `external`,
// the bucket that is supposed to mean "not a probe". The largest single
// contributor was 224 requests from one scheduled crawler.
//
// The second rule reads the convention instead of the vocabulary: a
// parenthesised contact prefixed with `+`, as in `(+https://example.com/bot)`
// or `(+someone@example.com)`. Anything shipping that has published a way to be
// contacted about its crawling, which is what "self-identified" means. Every
// crawler in the observed population that the keywords missed carries it.
//
// Discovery tools observed on 2026-09-08 use role names instead of the older
// contact convention: Scout, Test-Loop, Indexer, and Benchmark. They read cards
// and OpenAPI or replay conformance packets, so those explicit roles are probes;
// generic runtimes such as python-httpx and AutonomousAgent remain external.
const SERVICE_PROBE_KEYWORD =
  /audit|benchmark|probe|scan|liveness|registry|monitor|census|health|grader|bot\b|crawler|spider|beat\//i;
const SERVICE_DISCOVERY_PROBE_KEYWORD = /scout|test[-_ ]?loop|indexer/i;
const SERVICE_PROBE_SELF_ID = /\(\+/;

function isServiceProbeUserAgent(raw) {
  const value = String(raw || "").trim();
  return Boolean(
    value &&
      (SERVICE_PROBE_KEYWORD.test(value) ||
        SERVICE_DISCOVERY_PROBE_KEYWORD.test(value) ||
        SERVICE_PROBE_SELF_ID.test(value))
  );
}

// The owner's own verification traffic declares itself out-of-band: every
// synthetic check carries `X-Client-Id: instinct-owner-*`. Without this bucket
// those runs land in `external` and read as demand — which is exactly the
// confusion a header is there to prevent.
const OWNER_SYNTHETIC_CLIENT_ID = /^instinct-owner/i;

// Named benchmark harnesses observed replaying conformance packets against the
// fleet. Real protocol traffic, but not demand: they get their own bucket
// instead of inflating `external`.
const BENCHMARK_USER_AGENT = /zeromockproof|proofbench|mcpqueen/i;

function callerKind(request) {
  const clientId = (request.headers.get("x-client-id") || "").trim();
  if (clientId && OWNER_SYNTHETIC_CLIENT_ID.test(clientId)) return "owner_synthetic";
  const raw = (request.headers.get("user-agent") || "").trim();
  if (!raw) return "unsigned_external";
  if (SELF_TEST_USER_AGENT.test(raw)) return "self_test";
  if (BENCHMARK_USER_AGENT.test(raw)) return "benchmark_probe";
  if (isServiceProbeUserAgent(raw)) return "service_probe";
  return "external";
}

// A deliberately small classification for the question operators actually
// ask: was this a person, a machine client, monitoring noise, or our own test?
// It is a signal, not identity proof; user-agent strings are self-reported.
function trafficClass(request, likelyProbe = false) {
  const kind = callerKind(request);
  if (kind === "self_test") return "self_test";
  if (kind === "owner_synthetic") return "owner_synthetic";
  if (kind === "benchmark_probe") return "benchmark_probe";
  if (kind === "service_probe" || likelyProbe) return "machine_probe";
  if (classifyClient(request) === "browser") return "human_browser";
  return "machine_client";
}

// One classifier owns the probe decision for every action transport. Keeping
// this separate from callerKind() used to produce contradictory rows: a
// self-identified scanner with a long prompt was traffic_class=machine_probe
// but likely_probe=false, so /stats counted it as product usage. The reason is
// bounded so operators can see which signal made the decision without storing
// any more request data.
function actionProbeReason(request, promptChars) {
  const kind = callerKind(request);
  if (kind === "owner_synthetic") return "owner_synthetic";
  if (kind === "benchmark_probe") return "known_benchmark";
  if (kind === "service_probe") return "self_identified_service";
  if (classifyClient(request) === "agenstry") return "agenstry_client";
  if (promptChars < PROBE_PROMPT_CHAR_THRESHOLD) return "short_prompt";
  return null;
}

function usageRequestKind(path, jsonrpcMethod) {
  if (path === MCP_ENDPOINT_PATH || jsonrpcMethod === "tools/call") return "mcp_action";
  if (path === "/message/send" || path === "/") return "a2a_action";
  return "other_action";
}

function funnelRequestKind(step) {
  if (step === "card" || step === "discovery") return "discovery";
  return step || "unknown";
}

// modules_used reaches this function in two shapes: the routed analyze path
// passes result.metadata entries ([{ module, role }, ...]), while the
// single-profile worker branches pass plain strings (["cis_secondary_sanctions"]).
// Reading .module off a string yielded [undefined], which persisted as [null]
// and aggregated as "unknown" — i.e. every profile except the routed one
// reported no modules at all. Accept both shapes.
function normalizeModules(modulesUsed) {
  if (!Array.isArray(modulesUsed)) return [];
  return modulesUsed
    .map((item) => (typeof item === "string" ? item : item?.module))
    .filter((name) => typeof name === "string" && name.length > 0);
}

// Billable upstreams (per ADR 0014). OpenSanctions hosted API is the only
// paid live-retrieval upstream (€0.10/call); Watchman self-host and the
// deterministic triage path cost €0. Used for per-task cost accounting in
// usageStats — no LLM is called on the Worker path, so upstream calls are
// the only real per-request spend.
const BILLABLE_UPSTREAM_EUR = { OpenSanctions: 0.1 };

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function liveRetrievalReasonCode(status, reason) {
  if (status === "success") return null;
  const value = typeof reason === "string" ? reason.trim() : "";
  if (/no live-retrieval upstream is configured/i.test(value)) return "not_configured";
  if (status === "disabled") return "disabled";
  if (status === "stale") return "stale_snapshot";
  if (!value) return status ? "unknown" : null;
  if (/^network error:/i.test(value)) return "network_error";
  const httpStatus = value.match(/^upstream HTTP (\d{3})$/i);
  if (httpStatus) return `upstream_http_${httpStatus[1]}`;
  if (/malformed JSON/i.test(value)) return "malformed_response";
  if (/index build failed/i.test(value)) return "index_build_failed";
  if (/empty counterparty name/i.test(value)) return "invalid_input";
  if (/SIMULATION_MODE_NO_API_KEY|API_KEY.*not set/i.test(value)) return "not_configured";
  return "unknown";
}

// Extract per-request billable cost from a result's live-retrieval metadata.
// A call is billed only when a paid upstream actually returned data
// (status "success"). "disabled" = no call made; "degraded" = the call
// failed, treated as non-billable (providers typically do not bill failed
// lookups) — conservative on the side of not over-reporting spend.
function billableUpstreamCost(result) {
  const status = result?.metadata?.live_retrieval_status ?? null;
  const upstream = result?.metadata?.live_retrieval_upstream ?? null;
  const reasonCode = result?.metadata?.live_retrieval_reason_code ?? null;
  const unit = upstream ? BILLABLE_UPSTREAM_EUR[upstream] : undefined;
  if (status !== "success" || !unit) {
    return { status, upstream, reason_code: reasonCode, billable: false, cost_eur: 0 };
  }
  return { status, upstream, reason_code: null, billable: true, cost_eur: unit };
}

// End-to-end correlation id. A caller (or the landing-page console) sends
// `X-Trace-Id` (or a `trace_id` query/param value); card, funnel and usage
// events then share one id, so the path from opening the card to invoking the
// gate is readable as a single journey. Absent a caller value a fresh id is
// generated and echoed back in the task metadata, so even an untagged caller
// can be followed.
function traceIdFromRequest(request, details = {}) {
  const candidates = [
    details.trace_id,
    request.headers && typeof request.headers.get === "function" ? request.headers.get("x-trace-id") : null,
    (() => {
      try {
        return new URL(request.url).searchParams.get("trace_id");
      } catch (_error) {
        return null;
      }
    })()
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (/^[A-Za-z0-9._:-]{8,80}$/.test(normalized)) return normalized;
  }
  return crypto.randomUUID();
}

// Privacy-safe caller identity for the demand chain: a truncated SHA-256 over
// the client id, connecting IP and user agent, so repeat callers can be
// counted without storing any of them. A server-side salt (CALLER_HASH_SALT)
// is mixed in when configured; without it the hash stays stable but an IPv4
// address is brute-forceable, which only ever reveals "an address that called
// a public endpoint" — acceptable, and documented here so the tradeoff is
// explicit rather than accidental.
const CALLER_HASH_FALLBACK_PEPPER = "agenda-fleet-caller-hash-v1";

async function callerHash(request, env = {}) {
  const header = (name) =>
    request.headers && typeof request.headers.get === "function" ? (request.headers.get(name) || "").trim() : "";
  const clientId = header("x-client-id");
  const ip = header("cf-connecting-ip");
  const ua = header("user-agent");
  if (!clientId && !ip && !ua) return null;
  const salt = typeof env?.CALLER_HASH_SALT === "string" && env.CALLER_HASH_SALT ? env.CALLER_HASH_SALT : CALLER_HASH_FALLBACK_PEPPER;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${clientId}|${ip}|${ua}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function buildUsageEvent(request, details = {}) {
  const url = new URL(request.url);
  const cf = request.cf || {};
  const promptChars = Number.isFinite(details.prompt_chars) ? details.prompt_chars : 0;
  // Absent rather than zero when a caller path does not produce one, so a
  // reader can tell "this profile parsed nothing" from "nobody measured".
  const structuredChars = Number.isFinite(details.structured_chars) ? details.structured_chars : null;
  const likelyProbe = Boolean(details.likely_probe);

  return {
    event: "agenda_intelligence_a2a_usage",
    // 8: adds trace_id, caller_hash and the x402 payment-header signal.
    // 7: adds bounded input-required diagnostics to outcome. Version 6 added
    // the bounded probe_reason behind likely_probe. Version 5 added
    // traffic_class, request_kind, and live-retrieval reason codes. Version 4
    // made prompt_chars the size of what arrived rather than
    // the size of what this profile could parse, with structured_chars carrying
    // the latter. Rows at version 3 and below measured a plain-text request to
    // a gate as zero, and their likely_probe follows from that number.
    event_version: 8,
    timestamp: new Date().toISOString(),
    source: "cloudflare_worker",
    method: request.method,
    path: url.pathname,
    host: url.hostname,
    jsonrpc_method: details.jsonrpc_method || null,
    request_kind: usageRequestKind(url.pathname, details.jsonrpc_method),
    jsonrpc_id_present: Boolean(details.jsonrpc_id_present),
    agent_profile: details.agent_profile || agentProfile(request),
    prompt_chars: promptChars,
    structured_chars: structuredChars,
    modules_used: normalizeModules(details.modules_used),
    live_retrieval:
      details.live_retrieval || { status: null, upstream: null, reason_code: null, billable: false, cost_eur: 0 },
    client: classifyClient(request),
    user_agent: userAgentSummary(request),
    caller_kind: callerKind(request),
    traffic_class: trafficClass(request, likelyProbe),
    caller_zone: callerZone(request),
    referrer_host: headerHost(request, "referer"),
    cf: {
      colo: cf.colo || null,
      country: cf.country || null,
      as_org: cf.asOrganization || null
    },
    outcome: details.outcome || { decision: null, status: null, score: null },
    likely_probe: likelyProbe,
    probe_reason: details.probe_reason || null,
    trace_id: details.trace_id || null,
    caller_hash: details.caller_hash || null,
    payment: details.payment || { header_present: false }
  };
}

async function logUsageEvent(request, details = {}, env = {}) {
  const event = buildUsageEvent(request, {
    ...details,
    trace_id: details.trace_id ?? traceIdFromRequest(request, details),
    caller_hash: details.caller_hash ?? (await callerHash(request, env)),
    payment: details.payment ?? { header_present: Boolean(request.headers.get("x-payment-tx")) }
  });
  console.log(event);
  return event;
}

// The KV usage log only records message/send, so the steps before a call —
// someone opening the card, the landing page, the docs — are invisible, and
// with a handful of visitors a week that is exactly where the drop-off is.
// These go to Workers Logs via console.log rather than KV: the free KV tier
// allows 1,000 writes a day and discovery GETs already run 250-480, on a
// namespace shared with the rate limiter and the sanctions-snapshot cache.
// Workers Logs takes 200,000 events a day at no cost.
const FUNNEL_SILENT_PATHS = new Set([
  "/health",
  "/status",
  "/robots.txt",
  "/stats",
  "/decisions",
  "/.well-known/jwks.json",
  ...AGENSTRY_VERIFICATION_PATHS
]);

function funnelStepForPath(pathname) {
  if (FUNNEL_SILENT_PATHS.has(pathname)) return null;
  if (pathname === "/") return "landing";
  if (pathname === "/.well-known/agent-card.json" || pathname === "/.well-known/agent.json") return "card";
  if (pathname.startsWith("/okf") || pathname.startsWith("/profiles/")) return "docs";
  if (pathname.startsWith("/.well-known/") || pathname === "/entitymap.json" || pathname === "/api/openapi.json") {
    return "discovery";
  }
  if (Object.hasOwn(directRoutes(), pathname) || pathname === "/message/send") {
    return "discovery";
  }
  return null;
}

async function logFunnelEvent(request, step, env = {}) {
  if (!step) return null;
  const url = new URL(request.url);
  const cf = request.cf || {};
  const event = {
    event: "agenda_intelligence_a2a_funnel",
    // 4: adds trace_id and caller_hash, aligning funnel rows with usage rows
    // so a card-to-invoke journey can be followed per caller.
    event_version: 4,
    timestamp: new Date().toISOString(),
    step,
    request_kind: funnelRequestKind(step),
    method: request.method,
    path: url.pathname,
    host: url.hostname,
    client: classifyClient(request),
    user_agent: userAgentSummary(request),
    caller_kind: callerKind(request),
    traffic_class: trafficClass(request),
    caller_zone: callerZone(request),
    referrer_host: headerHost(request, "referer"),
    country: cf.country || null,
    as_org: cf.asOrganization || null,
    colo: cf.colo || null,
    trace_id: traceIdFromRequest(request),
    caller_hash: await callerHash(request, env)
  };
  console.log(event);
  return event;
}

// Uniform per-call outcome, so /stats can answer "of the real calls, how many
// ended with nothing usable". Every vertical profile carries a
// readiness_contract; the base signal-screen profile does not.
function inputRequiredTelemetry(result) {
  const metadata = result?.metadata || {};
  const errors = Array.isArray(metadata.errors) ? metadata.errors.filter((item) => typeof item === "string") : [];
  let reasonCode = "missing_required_input";
  if (errors.some((error) => /no question/i.test(error))) reasonCode = "missing_question";
  else if (errors.some((error) => /(?:missing|no) structured/i.test(error))) {
    reasonCode = "missing_structured_request";
  }

  // The public guide strings contain descriptions after an em dash. Persist
  // only the stable field path before it, never the description, example, or
  // caller payload. Entries explicitly described as optional are not missing.
  const requiredFields = [];
  for (const item of Array.isArray(metadata.required_fields) ? metadata.required_fields : []) {
    if (typeof item !== "string" || /\boptional\b/i.test(item)) continue;
    const field = item.split(/\s+[—–]\s+/, 1)[0].replace(/^or\s+/i, "").trim();
    if (!/^[A-Za-z0-9_.\[\]-]{1,80}$/.test(field) || requiredFields.includes(field)) continue;
    requiredFields.push(field);
    if (requiredFields.length === 16) break;
  }
  return { reason_code: reasonCode, required_fields: requiredFields };
}

function callOutcome(result) {
  if (result?.status?.state === "TASK_STATE_FAILED") {
    return { decision: "invalid_request", status: "invalid_request", score: null };
  }
  // Separate from invalid_request on purpose: a caller who sent nothing
  // structured and a caller who sent a broken request are two different
  // problems, and only the second one is a defect in the request. Merging them
  // is what made `invalid_request` unreadable — on 2026-08-27 it counted 271
  // calls, of which 211 were one local test script and 14 were the marketplace
  // probe asking, in effect, what the gate needs.
  if (result?.status?.state === "TASK_STATE_INPUT_REQUIRED") {
    return {
      decision: "input_required",
      status: "input_required",
      score: null,
      ...inputRequiredTelemetry(result)
    };
  }
  const contract = result?.metadata?.response?.readiness_contract;
  if (contract && typeof contract === "object") {
    return {
      decision: contract.routing?.value || contract.status || "unknown",
      status: contract.status || "unknown",
      score: Number.isInteger(contract.score) ? contract.score : null
    };
  }
  return { decision: "completed", status: "completed", score: null };
}

function dateKeyFromTimestamp(timestamp) {
  if (typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
    return new Date().toISOString().slice(0, 10);
  }
  return timestamp.slice(0, 10);
}

function dateKeyFromRequest(request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function statsTokenFromRequest(request) {
  const url = new URL(request.url);
  return request.headers.get("x-stats-token") || url.searchParams.get("token") || "";
}

function isStatsAuthorized(request, env) {
  if (!env?.STATS_TOKEN) return false;
  return statsTokenFromRequest(request) === env.STATS_TOKEN;
}

// One record per decision, so two runs of the same file can be compared.
//
// The usage counters answer how many and from where. They cannot answer what
// this gate decided about this input last week, because they keep no input and
// no verdict — by design; they are described in their own response as coarse
// and not an audit ledger. The funnel events that do carry detail live in
// Workers Logs, which retains 72 hours on the free plan, so "did this file get
// a different answer than last time" was a question with nowhere to look.
//
// What is kept is a hash of the input and the verdict about it. Not the input:
// these payloads carry counterparty names, routes and cargo, and a store that
// held them would be a different product with a different privacy posture. The
// hash is enough for the question actually asked — the same file hashes the
// same way, so a changed verdict on an unchanged hash is exactly the diff a
// reviewer wants, and an unchanged verdict is silence rather than a story.
// One write per SendMessage and none on discovery GETs. The free plan allows
// 1,000 KV writes a day on this namespace, shared with the rate limiter, the
// snapshot cache and the usage counters; at the observed volume -- 32 non-probe
// calls on 2026-08-28 -- the journal is a few percent of that budget. It stays
// worth watching if calls ever outgrow discovery traffic.
const DECISION_JOURNAL_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const DECISION_JOURNAL_PREFIX = "decision:";

async function recordDecision(env, { params, profile, result, timestamp }) {
  const kv = env?.AGENDA_USAGE;
  if (!kv || typeof kv.put !== "function") return null;

  const at = timestamp || new Date().toISOString();
  const day = dateKeyFromTimestamp(at);
  const outcome = callOutcome(result);
  const response = result?.metadata?.response;
  const record = {
    timestamp: at,
    agent_profile: profile,
    // The contract the verdict was produced under. A verdict that changed
    // across a version bump is a different fact from one that changed on the
    // same contract, and without this the two are indistinguishable.
    contract_version: VERSION,
    input_hash: await sha256Jcs(canonicalDecisionInput(params)),
    decision: outcome.decision,
    status: outcome.status,
    score: outcome.score,
    human_review_required: Boolean(response?.human_review_required),
    task_state: result?.status?.state || "unknown"
  };
  await kv.put(`${DECISION_JOURNAL_PREFIX}${day}:${at}:${crypto.randomUUID()}`, JSON.stringify(record), {
    expirationTtl: DECISION_JOURNAL_RETENTION_SECONDS
  });
  return record;
}

// What the caller actually sent, reduced to the parts that decide the answer.
// Message ids and task ids are new on every call and would make each run a
// fresh hash, which is the one thing this must not do.
function canonicalDecisionInput(params) {
  const message = params?.message;
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  return {
    request: params?.request ?? null,
    capability: params?.capability ?? null,
    parts: parts.map((part) => ({
      text: typeof part?.text === "string" ? part.text : null,
      data: part?.data ?? null
    }))
  };
}

// Runs grouped by input: the same file, answered more than once. A repeated
// hash whose verdicts differ is the diff; one whose verdicts agree is reported
// as stable rather than omitted, because "asked again and got the same answer"
// is also an answer.
function decisionRuns(records) {
  const byInput = new Map();
  for (const record of records) {
    const list = byInput.get(record.input_hash) || [];
    list.push(record);
    byInput.set(record.input_hash, list);
  }
  const repeated = [];
  for (const [inputHash, runs] of byInput) {
    if (runs.length < 2) continue;
    const ordered = [...runs].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const verdicts = ordered.map((run) => `${run.decision}/${run.status}/${run.score}/${run.contract_version}`);
    repeated.push({
      input_hash: inputHash,
      runs: ordered.length,
      changed: new Set(verdicts).size > 1,
      first: ordered[0].timestamp,
      last: ordered[ordered.length - 1].timestamp,
      verdicts: ordered.map((run) => ({
        timestamp: run.timestamp,
        decision: run.decision,
        status: run.status,
        score: run.score,
        contract_version: run.contract_version
      }))
    });
  }
  return repeated.sort((left, right) => Number(right.changed) - Number(left.changed));
}

async function handleDecisionJournal(request, env) {
  if (!isStatsAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const kv = env?.AGENDA_USAGE;
  if (!kv || typeof kv.list !== "function") {
    return jsonResponse({ error: "Decision journal storage is unavailable" }, 503);
  }
  const day = dateKeyFromRequest(request);
  if (!day) return jsonResponse({ error: "date must use YYYY-MM-DD" }, 400);

  const listed = await kv.list({ prefix: `${DECISION_JOURNAL_PREFIX}${day}:`, limit: 1000 });
  const records = (
    await Promise.all(
      listed.keys.map(async ({ name }) => {
        const value = await kv.get(name);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch (_error) {
          return null;
        }
      })
    )
  )
    .filter(Boolean)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return jsonResponse({
    date: day,
    retention_days: DECISION_JOURNAL_RETENTION_SECONDS / 86400,
    count: records.length,
    truncated: Boolean(listed.list_complete === false),
    note: "Input hashes only; no caller payload is stored. Runs pairs a repeated input with the verdicts it received.",
    runs: decisionRuns(records),
    records
  });
}

async function recordUsageStats(env, event) {
  const kv = env?.AGENDA_USAGE;
  if (!kv || !event || event.event !== "agenda_intelligence_a2a_usage") return;

  const day = dateKeyFromTimestamp(event.timestamp);
  const key = `usage-event:${day}:${event.timestamp}:${crypto.randomUUID()}`;
  await kv.put(
    key,
    JSON.stringify({
      timestamp: event.timestamp,
      agent_profile: event.agent_profile || "unknown",
      host: event.host || "unknown",
      jsonrpc_method: event.jsonrpc_method || "unknown",
      request_kind: event.request_kind || "unknown",
      prompt_chars: event.prompt_chars || 0,
      structured_chars: Number.isFinite(event.structured_chars) ? event.structured_chars : null,
      likely_probe: Boolean(event.likely_probe),
      probe_reason: event.probe_reason || null,
      client: event.client || "unknown",
      user_agent: event.user_agent || "unknown",
      caller_kind: event.caller_kind || "external",
      traffic_class: event.traffic_class || "unknown",
      caller_zone: event.caller_zone || "none",
      referrer_host: event.referrer_host || "none",
      country: event.cf?.country || "unknown",
      colo: event.cf?.colo || "unknown",
      as_org: event.cf?.as_org || "unknown",
      outcome: event.outcome?.decision || "unknown",
      outcome_score: Number.isInteger(event.outcome?.score) ? event.outcome.score : null,
      trace_id: event.trace_id || null,
      caller_hash: event.caller_hash || null,
      payment_header_present: Boolean(event.payment?.header_present),
      input_required_reason: event.outcome?.reason_code || null,
      input_required_fields: Array.isArray(event.outcome?.required_fields) ? event.outcome.required_fields : [],
      modules_used: Array.isArray(event.modules_used) ? event.modules_used : [],
      live_retrieval:
        event.live_retrieval || { status: null, upstream: null, reason_code: null, billable: false, cost_eur: 0 }
    })
  );
}

function incrementMap(map, key) {
  const safeKey = key || "unknown";
  map.set(safeKey, (map.get(safeKey) || 0) + 1);
}

function sortedMap(map, limit = 0) {
  const rows = [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  return limit > 0 ? rows.slice(0, limit) : rows;
}

// Repair old rows at read time as well as classifying new rows correctly.
// Event v5 already stored caller_kind and traffic_class, so the 31 long-prompt
// scanners observed in 2026-09-01..07 can be removed from non-probe usage
// without rewriting or deleting immutable historical KV records.
function usageEventIsProbe(event) {
  return Boolean(
    event.likely_probe ||
      event.caller_kind === "service_probe" ||
      event.caller_kind === "owner_synthetic" ||
      event.caller_kind === "benchmark_probe" ||
      event.traffic_class === "machine_probe" ||
      event.traffic_class === "owner_synthetic" ||
      event.traffic_class === "benchmark_probe" ||
      isServiceProbeUserAgent(event.user_agent)
  );
}

function usageEventProbeReason(event) {
  if (event.probe_reason) return event.probe_reason;
  if (event.caller_kind === "owner_synthetic" || event.traffic_class === "owner_synthetic") return "owner_synthetic";
  if (event.caller_kind === "benchmark_probe" || event.traffic_class === "benchmark_probe") return "known_benchmark";
  if (event.caller_kind === "service_probe" || isServiceProbeUserAgent(event.user_agent)) {
    return "self_identified_service";
  }
  if (event.client === "agenstry") return "agenstry_client";
  if (event.likely_probe && event.prompt_chars < PROBE_PROMPT_CHAR_THRESHOLD) return "short_prompt";
  return event.likely_probe ? "legacy_or_unknown" : null;
}

function listOrNone(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none detected";
}

async function listUsageEvents(kv, date) {
  const events = [];
  let cursor;

  do {
    const result = await kv.list({ prefix: `usage-event:${date}:`, cursor });
    const rows = await Promise.all(
      result.keys.map(async (item) => {
        const raw = await kv.get(item.name);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (_error) {
          return null;
        }
      })
    );
    events.push(...rows.filter(Boolean));
    cursor = result.cursor;
    if (result.list_complete !== false) break;
  } while (cursor);

  return events;
}

async function usageStats(env, date) {
  const kv = env?.AGENDA_USAGE;
  if (!kv) {
    return {
      configured: false,
      error: "AGENDA_USAGE KV binding is not configured"
    };
  }

  const events = await listUsageEvents(kv, date);
  const clients = new Map();
  const countries = new Map();
  const methods = new Map();
  const modules = new Map();
  const agentProfiles = new Map();
  const hosts = new Map();
  const upstreams = new Map();
  const referrers = new Map();
  const networks = new Map();
  const userAgents = new Map();
  const callerKinds = new Map();
  const trafficClasses = new Map();
  const requestKinds = new Map();
  const callerZones = new Map();
  const outcomes = new Map();
  const liveRetrievalStatuses = new Map();
  const liveRetrievalReasonCodes = new Map();
  const probeReasons = new Map();
  const inputRequiredReasons = new Map();
  const externalInputRequiredReasons = new Map();
  const externalInputRequiredFields = new Map();
  let emptyHanded = 0;
  let externalEmptyHanded = 0;
  let externalInputRequired = 0;
  let externalInputRequiredUnparsed = 0;
  let externalNonProbe = 0;
  let likelyProbe = 0;
  let promptChars = 0;
  let billableCalls = 0;
  let estimatedCostEur = 0;
  // The demand chain, per qualified caller hash: unique caller -> usable
  // completion -> repeat -> paid. Qualified means external and not a probe,
  // self-test, benchmark or owner-synthetic run.
  const qualifiedCallers = new Map();

  for (const event of events) {
    const eventIsProbe = usageEventIsProbe(event);
    const eventIsExternalNonProbe =
      !eventIsProbe && (event.caller_kind === "external" || event.caller_kind === "unsigned_external");
    if (eventIsProbe) {
      likelyProbe += 1;
      incrementMap(probeReasons, usageEventProbeReason(event));
    }
    if (eventIsExternalNonProbe) externalNonProbe += 1;
    promptChars += Number.isFinite(event.prompt_chars) ? event.prompt_chars : 0;
    const lr = event.live_retrieval;
    if (lr?.status) incrementMap(liveRetrievalStatuses, lr.status);
    if (lr?.reason_code) incrementMap(liveRetrievalReasonCodes, lr.reason_code);
    if (lr && lr.billable) {
      billableCalls += 1;
      estimatedCostEur += Number.isFinite(lr.cost_eur) ? lr.cost_eur : 0;
      incrementMap(upstreams, lr.upstream || "unknown");
    }
    incrementMap(agentProfiles, event.agent_profile);
    incrementMap(hosts, event.host);
    incrementMap(clients, event.client);
    incrementMap(countries, event.country);
    incrementMap(methods, event.jsonrpc_method);
    incrementMap(referrers, event.referrer_host);
    incrementMap(networks, event.as_org);
    incrementMap(userAgents, event.user_agent);
    incrementMap(callerKinds, eventIsProbe && isServiceProbeUserAgent(event.user_agent) ? "service_probe" : event.caller_kind);
    incrementMap(trafficClasses, eventIsProbe ? "machine_probe" : event.traffic_class);
    incrementMap(requestKinds, event.request_kind);
    // Only zones that actually sent one: "none" is every ordinary caller and
    // would bury the handful of rows this map exists to show.
    if (event.caller_zone && event.caller_zone !== "none") incrementMap(callerZones, event.caller_zone);
    incrementMap(outcomes, event.outcome);
    if (event.outcome === "input_required") {
      incrementMap(inputRequiredReasons, event.input_required_reason || "legacy_or_unknown");
      if (eventIsExternalNonProbe) {
        externalInputRequired += 1;
        incrementMap(externalInputRequiredReasons, event.input_required_reason || "legacy_or_unknown");
        if (event.structured_chars === 0) externalInputRequiredUnparsed += 1;
        for (const field of Array.isArray(event.input_required_fields) ? event.input_required_fields : []) {
          incrementMap(externalInputRequiredFields, field);
        }
      }
    }
    // A caller who supplied nothing usable: the gate could not act on the
    // request. Counted among non-probe calls only — monitors send deliberately
    // empty payloads, so including them made the ratio read "5 of 1".
    if (
      !eventIsProbe &&
      (event.outcome === "insufficient_information" ||
        event.outcome === "invalid_request" ||
        event.outcome === "input_required")
    ) {
      emptyHanded += 1;
      if (eventIsExternalNonProbe) externalEmptyHanded += 1;
    }
    for (const moduleName of Array.isArray(event.modules_used) ? event.modules_used : []) {
      incrementMap(modules, moduleName);
    }
    if (eventIsExternalNonProbe && typeof event.caller_hash === "string" && event.caller_hash) {
      const entry = qualifiedCallers.get(event.caller_hash) || { calls: 0, completions: 0, paid: 0 };
      entry.calls += 1;
      if (
        event.outcome !== "insufficient_information" &&
        event.outcome !== "invalid_request" &&
        event.outcome !== "input_required"
      ) {
        entry.completions += 1;
      }
      if (event.payment_header_present) entry.paid += 1;
      qualifiedCallers.set(event.caller_hash, entry);
    }
  }

  const qualifiedCallerRows = [...qualifiedCallers.values()];
  const qualifiedChain = {
    unique_callers: qualifiedCallerRows.length,
    usable_completions: qualifiedCallerRows.reduce((total, row) => total + row.completions, 0),
    callers_with_completion: qualifiedCallerRows.filter((row) => row.completions > 0).length,
    repeat_callers: qualifiedCallerRows.filter((row) => row.calls > 1).length,
    paid_calls: qualifiedCallerRows.reduce((total, row) => total + row.paid, 0),
    note: "Qualified = external caller, not a probe, self-test, benchmark or owner-synthetic run. " +
      "Repeats are counted within this day; cross-day repeat and paid attribution join caller_hash across daily files. " +
      "paid_calls counts calls carrying an X-Payment-Tx header, not settled revenue."
  };

  const total = events.length;
  const nonProbe = total - likelyProbe;

  return {
    configured: true,
    date,
    generated_at: new Date().toISOString(),
    approximate: true,
    counters: {
      total,
      non_probe: nonProbe,
      likely_probe: likelyProbe,
      external_non_probe: externalNonProbe,
      prompt_chars_total: promptChars,
      prompt_chars_avg: total > 0 ? Math.round(promptChars / total) : 0,
      billable_calls: billableCalls,
      empty_handed: emptyHanded,
      external_empty_handed: externalEmptyHanded,
      external_input_required: externalInputRequired,
      external_input_required_unparsed: externalInputRequiredUnparsed,
      qualified_chain: qualifiedChain,
      human_requests: trafficClasses.get("human_browser") || 0,
      machine_requests:
        (trafficClasses.get("machine_client") || 0) + (trafficClasses.get("machine_probe") || 0),
      self_test_requests: trafficClasses.get("self_test") || 0,
      unclassified_requests: trafficClasses.get("unknown") || 0
    },
    cost: {
      estimated_cost_eur: round2(estimatedCostEur),
      billable_upstreams: sortedMap(upstreams),
      budget: budgetStatus(env, estimatedCostEur)
    },
    clients: sortedMap(clients),
    // Who called, in the only split that separates real traffic from noise.
    // `unsigned_external` is the one worth reading: a caller that identified
    // itself with nothing at all. `external` means "not ours and not a
    // self-declared probe", which includes an ad-hoc curl from this desk.
    caller_kinds: sortedMap(callerKinds),
    traffic_classes: sortedMap(trafficClasses),
    request_kinds: sortedMap(requestKinds),
    probe_reasons: sortedMap(probeReasons),
    // Calling Cloudflare Worker zones, from the `cf-worker` header. Empty on
    // most days by design — see callerZone() for what this is for.
    caller_zones: sortedMap(callerZones),
    outcomes: sortedMap(outcomes),
    input_required_reasons: sortedMap(inputRequiredReasons),
    external_input_required_reasons: sortedMap(externalInputRequiredReasons),
    external_input_required_fields: sortedMap(externalInputRequiredFields),
    live_retrieval_statuses: sortedMap(liveRetrievalStatuses),
    live_retrieval_reason_codes: sortedMap(liveRetrievalReasonCodes),
    agent_profiles: sortedMap(agentProfiles),
    hosts: sortedMap(hosts),
    countries: sortedMap(countries),
    networks: sortedMap(networks),
    referrers: sortedMap(referrers),
    // High-cardinality by nature (every crawler ships its own string), so this
    // one is capped — it exists to name unrecognised callers, not to be complete.
    user_agents: sortedMap(userAgents, USER_AGENT_STAT_ROWS),
    methods: sortedMap(methods),
    modules: sortedMap(modules)
  };
}

// Daily spend vs an optional configurable cap (USAGE_BUDGET_EUR_PER_DAY).
// Emits a 50/75/90 alert level so the /stats surface and operators can see
// budget pressure. When no cap is configured, reports configured:false and
// no alert — the Worker never blocks on budget, it only reports.
function budgetStatus(env, estimatedCostEur) {
  const cap = Number(env?.USAGE_BUDGET_EUR_PER_DAY);
  if (!Number.isFinite(cap) || cap <= 0) {
    return { configured: false, alert_level: "none" };
  }
  const pct = Math.round((estimatedCostEur / cap) * 100);
  let alert_level = "none";
  if (pct >= 90) alert_level = "90";
  else if (pct >= 75) alert_level = "75";
  else if (pct >= 50) alert_level = "50";
  return {
    configured: true,
    cap_eur_per_day: cap,
    spent_eur: round2(estimatedCostEur),
    pct_of_budget: pct,
    alert_level
  };
}


return {
  actionProbeReason,
  liveRetrievalReasonCode,
  billableUpstreamCost,
  buildUsageEvent,
  traceIdFromRequest,
  callerHash,
  logUsageEvent,
  funnelStepForPath,
  logFunnelEvent,
  callOutcome,
  dateKeyFromRequest,
  isStatsAuthorized,
  recordDecision,
  canonicalDecisionInput,
  decisionRuns,
  handleDecisionJournal,
  recordUsageStats,
  listOrNone,
  usageStats
};
}
