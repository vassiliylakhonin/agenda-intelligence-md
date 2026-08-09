// Reads the funnel events the Worker writes to Workers Logs — the steps before
// a call, which the KV usage log does not record. At single-digit weekly
// visitors the useful output is not a conversion rate but a readable list of
// who showed up, so crawlers are separated from everything else rather than
// silently dropped.
//
// Usage: npm run funnel            (last 72h, the free-plan retention)
//        npm run funnel -- 12      (last 12h)
//
// Needs AGENDA_OBSERVABILITY_TOKEN in .env with Account Analytics Read +
// Workers Observability Read. Deliberately NOT named CF_API_TOKEN: wrangler
// auto-loads .env and would authenticate deploys with it, and a read-only
// token fails every `wrangler deploy` with an opaque 'Authentication error'.
// Without the token, `wrangler tail` shows the same events live.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "c77c0bb599b8e90c7faadf4306141680";
const FUNNEL_EVENT = "agenda_intelligence_a2a_funnel";
const MAX_RETENTION_HOURS = 72;
const STEP_ORDER = ["landing", "card", "discovery", "docs"];

// Self-identified automation. Kept as a display split, not a filter: a crawler
// visit is still a fact about who found the endpoint.
const CRAWLER_HINTS = [
  "bot",
  "crawler",
  "spider",
  "headless",
  "semrush",
  "ahrefs",
  "bingpreview",
  "scanner",
  "registry",
  "python-httpx",
  "python-requests",
  "go-http-client",
  "node-fetch",
  "axios"
];

function loadDotEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || line.trim().startsWith("#")) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function hoursArg() {
  const arg = process.argv.slice(2).find((item) => !item.startsWith("-"));
  const hours = arg ? Number.parseInt(arg, 10) : MAX_RETENTION_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Hours must be a positive integer.");
  return Math.min(hours, MAX_RETENTION_HOURS);
}

function isCrawler(userAgent) {
  const value = (userAgent || "").toLowerCase();
  // A user-agent that advertises a homepage in parentheses is the long-standing
  // crawler convention, and it catches the ones that never say "bot" — the two
  // agent directories found on 2026-08-08 identified themselves only as
  // "agent-tools.cloud-a2a/0.1 (+https://agent-tools.cloud)" and
  // "Waggle/1.0 (+https://waggle.zone)", and landed in the human list without it.
  if (value.includes("(+http")) return true;
  return CRAWLER_HINTS.some((hint) => value.includes(hint));
}

function tally(rows, pick) {
  const counts = new Map();
  for (const row of rows) {
    const key = pick(row) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function printTally(label, rows, pick, limit = 12) {
  const entries = tally(rows, pick);
  console.log(`\n${label}`);
  if (!entries.length) {
    console.log("  none");
    return;
  }
  for (const [name, count] of entries.slice(0, limit)) {
    console.log(`  ${String(count).padStart(4)}  ${name}`);
  }
}

async function querySlice(token, from, to) {
  const body = {
    queryId: "worker-funnel",
    timeframe: { from, to },
    limit: 1000,
    parameters: {
      datasets: ["cloudflare-workers"],
      filters: [{ key: "event", operation: "eq", value: FUNNEL_EVENT, type: "string" }]
    },
    view: "events"
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/observability/telemetry/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const detail = (payload.errors || []).map((error) => error.message).join("; ") || response.status;
    throw new Error(
      `Observability query failed: ${detail}. The token needs Account Analytics Read and ` +
        "Workers Observability Read, both at Account scope."
    );
  }

  const events = payload.result?.events;
  const rows = Array.isArray(events) ? events : events?.events || [];
  return {
    rows: rows.map((row) => row.source).filter((source) => source && typeof source === "object"),
    abrLevel: payload.result?.statistics?.abr_level ?? 1
  };
}

// Cloudflare samples this dataset on wider timeframes: measured 2026-08-07, a
// 6h query ran at abr_level 1 (every row) and a 24h query at abr_level 10, which
// turned five real events into one. At single-digit weekly traffic a 1-in-10
// sample is worse than useless, so the window is walked in slices that stay
// unsampled and merged here. The level is still reported in case it moves.
const SLICE_HOURS = 6;

async function fetchFunnelEvents(token, hours) {
  const now = Date.now();
  const sliceMs = SLICE_HOURS * 3600 * 1000;
  const slices = [];
  for (let end = now; end > now - hours * 3600 * 1000; end -= sliceMs) {
    slices.push([Math.max(end - sliceMs, now - hours * 3600 * 1000), end]);
  }

  const results = await Promise.all(slices.map(([from, to]) => querySlice(token, from, to)));
  const seen = new Set();
  const rows = [];
  for (const result of results) {
    for (const row of result.rows) {
      // Slice edges are inclusive on both sides; drop the duplicate.
      const key = `${row.timestamp}|${row.path}|${row.host}|${row.user_agent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  rows.sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
  return { rows, maxAbrLevel: Math.max(...results.map((result) => result.abrLevel), 1) };
}

async function main() {
  loadDotEnv();
  const token = process.env.AGENDA_OBSERVABILITY_TOKEN;
  if (!token) {
    throw new Error("AGENDA_OBSERVABILITY_TOKEN is missing. Add it to .env or export it in the shell.");
  }

  const hours = hoursArg();
  const { rows: events, maxAbrLevel } = await fetchFunnelEvents(token, hours);

  console.log(`Funnel events, last ${hours}h — ${events.length} total`);
  if (maxAbrLevel > 1) {
    console.log(
      `WARNING: Cloudflare sampled this query at 1 in ${maxAbrLevel}. Counts below are a sample, not a census.`
    );
  }
  if (!events.length) {
    console.log("\nNo one opened a card, page or doc in this window.");
    return;
  }

  const steps = new Map(tally(events, (event) => event.step));
  console.log("\nSteps");
  for (const step of STEP_ORDER) {
    if (steps.has(step)) console.log(`  ${String(steps.get(step)).padStart(4)}  ${step}`);
  }

  const crawlers = events.filter((event) => isCrawler(event.user_agent));
  const rest = events.filter((event) => !isCrawler(event.user_agent));

  console.log(`\nSelf-identified automation: ${crawlers.length} of ${events.length}`);
  printTally("Networks (everything else)", rest, (event) => event.as_org);
  printTally("User agents (everything else)", rest, (event) => (event.user_agent || "none").slice(0, 60));
  printTally("Referrers", events, (event) => event.referrer_host || "none");

  console.log("\nVisits that are not self-identified automation");
  if (!rest.length) {
    console.log("  none");
    return;
  }
  for (const event of rest.slice(0, 40)) {
    const when = String(event.timestamp || "").slice(5, 19).replace("T", " ");
    const host = String(event.host || "").split(".")[0];
    console.log(
      `  ${when}  ${String(event.step).padEnd(9)} ${host.padEnd(38)} ` +
        `${String(event.country || "--").padEnd(3)} ${(event.as_org || "-").slice(0, 30)}`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
