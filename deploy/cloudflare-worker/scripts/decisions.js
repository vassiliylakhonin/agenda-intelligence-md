// Reads the decision journal: what this fleet decided, and where it changed
// its mind about the same file.
//
// `npm run stats` answers how many calls and from where. It cannot answer what
// a gate decided about one file, because the counters keep neither the input
// nor the verdict, and the detailed funnel events live in Workers Logs, which
// retains 72 hours on the free plan. This reads the journal instead, which
// keeps a hash of the input and the verdict for 30 days.
//
//   npm run decisions              today
//   npm run decisions -- 2026-08-27
//
// The changed pairs are printed first and are the reason this exists: a
// repeated input whose verdict moved is the one thing worth a person's time.
// Everything else is printed as a count.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_URL =
  process.env.WORKER_URL || "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev";

function loadDotEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

function dateArg() {
  const arg = process.argv.slice(2).find((item) => !item.startsWith("-"));
  if (!arg) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }
  return arg;
}

// Short enough to scan a column of them, long enough to tell two files apart.
function shortHash(hash) {
  return String(hash).replace(/^sha256:/, "").slice(0, 10);
}

function clock(timestamp) {
  return String(timestamp).slice(11, 19);
}

function countBy(records, key) {
  const counts = new Map();
  for (const record of records) {
    const value = record[key] ?? "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => `${name}: ${count}`)
    .join(", ");
}

async function main() {
  loadDotEnv();

  const token = process.env.STATS_TOKEN;
  if (!token) {
    throw new Error("STATS_TOKEN is missing. Add it to .env or export it in the shell.");
  }

  const date = dateArg();
  const url = new URL("/decisions", WORKER_URL);
  if (date) url.searchParams.set("date", date);

  const response = await fetch(url, { headers: { "x-stats-token": token } });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Decision journal request failed: ${response.status} ${JSON.stringify(body)}`);
  }

  console.log(`Decision journal for ${body.date}`);
  console.log(`Records: ${body.count}${body.truncated ? " (truncated)" : ""}, kept ${body.retention_days} days`);
  if (body.count === 0) {
    console.log("No decisions recorded for this date.");
    return;
  }

  console.log(`Profiles: ${countBy(body.records, "agent_profile")}`);
  console.log(`Decisions: ${countBy(body.records, "decision")}`);
  console.log(`Contract versions: ${countBy(body.records, "contract_version")}`);
  const humanReview = body.records.filter((record) => record.human_review_required).length;
  console.log(`Human review required: ${humanReview} of ${body.count}`);

  const changed = body.runs.filter((run) => run.changed);
  const stable = body.runs.length - changed.length;
  console.log(`\nRepeated inputs: ${body.runs.length} (${changed.length} changed, ${stable} stable)`);

  for (const run of changed) {
    console.log(`\nCHANGED  input ${shortHash(run.input_hash)}  ${run.runs} runs`);
    for (const verdict of run.verdicts) {
      const score = verdict.score === null ? "—" : verdict.score;
      console.log(
        `  ${clock(verdict.timestamp)}  ${verdict.decision}  status=${verdict.status}  ` +
          `score=${score}  contract=${verdict.contract_version}`
      );
    }
  }

  if (!changed.length) {
    console.log("No input received a different verdict on this date.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
