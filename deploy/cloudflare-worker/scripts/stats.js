import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_URL =
  process.env.WORKER_URL || "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev";

function loadDotEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

function formatRows(rows) {
  if (!rows?.length) return "none";
  return rows.map((row) => `${row.name}: ${row.count}`).join(", ");
}

async function main() {
  loadDotEnv();

  const token = process.env.STATS_TOKEN;
  if (!token) {
    throw new Error("STATS_TOKEN is missing. Add it to .env or export it in the shell.");
  }

  const date = dateArg();
  const url = new URL("/stats", WORKER_URL);
  if (date) url.searchParams.set("date", date);

  const response = await fetch(url, {
    headers: {
      "x-stats-token": token
    }
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Stats request failed: ${response.status} ${JSON.stringify(body)}`);
  }

  console.log(`Agenda Intelligence A2A stats for ${body.date}`);
  console.log(`Total: ${body.counters.total}`);
  console.log(`Non-probe: ${body.counters.non_probe}`);
  console.log(`Likely probe: ${body.counters.likely_probe}`);
  console.log(`Prompt chars: ${body.counters.prompt_chars_total} total, ${body.counters.prompt_chars_avg} avg`);
  console.log(`Agent profiles: ${formatRows(body.agent_profiles)}`);
  console.log(`Clients: ${formatRows(body.clients)}`);
  console.log(`Countries: ${formatRows(body.countries)}`);
  console.log(`Methods: ${formatRows(body.methods)}`);
  console.log(`Modules: ${formatRows(body.modules)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
