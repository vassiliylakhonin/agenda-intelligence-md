import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_URL =
  process.env.WORKER_URL || "https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev";

function loadDotEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || trimmed.startsWith("#")) continue;
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadDotEnv();
  const token = process.env.STATS_TOKEN;
  if (!token) throw new Error("STATS_TOKEN is missing. Add it to .env or export it in the shell.");
  const response = await fetch(`${WORKER_URL}/intake/cis-review`, {
    headers: { "x-stats-token": token }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Intake request failed: ${response.status} ${JSON.stringify(body)}`);
  if (!body.records.length) {
    console.log("No retained CIS review requests.");
    return;
  }
  for (const record of body.records) console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
