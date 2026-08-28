// Rotates STATS_TOKEN across every deployed environment, then puts the fleet
// back into a stamped, receipt-carrying state.
//
// This started life outside the repo as a personal helper that ran a single
// `wrangler secret put STATS_TOKEN` with no --env. Only the top-level Worker
// ever got the token; the other nine answered /stats with 401 and nothing said
// so, because /stats is the one endpoint no monitor calls. Found on 2026-08-28
// by asking all ten: six answered 200, four answered 401. The environment list
// is read from wrangler.toml here so a new profile is covered the day it ships
// rather than the day someone remembers to edit a list.
//
// A secret write is not a config change: it publishes a new version, and that
// version carries neither the content stamp `deploy:all --check` reads nor the
// gated environment's Vizier ALLOW receipt. So a rotation is only half done
// when the secrets are in. It ends by re-publishing through `deploy:all`, which
// stamps the ungated environments and sends agent-output-verification back
// through the gate.
//
//   node scripts/rotate-stats-token.js          rotate, redeploy, verify
//   node scripts/rotate-stats-token.js --check  ask every environment for
//                                               /stats and write nothing
//
// --check is the cheap half: it needs only the current .env and answers the
// question that went unasked for a month — does every environment accept the
// token this machine holds?

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const workerDir = fileURLToPath(new URL("..", import.meta.url));
const envPath = new URL("../.env", import.meta.url);
const wranglerPath = new URL("../wrangler.toml", import.meta.url);
const workerSubdomain = process.env.WORKERS_SUBDOMAIN || "vassiliy-lakhonin";

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], ...options });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("close", (code) => resolve({ code, output }));
    if (options.stdin !== undefined) child.stdin.end(options.stdin);
    else child.stdin.end();
  });
}

// The deployed environments and the Worker name each one publishes under. Both
// come from wrangler.toml, which is the only file that cannot disagree with
// what is live.
export function deployedEnvironments(toml) {
  const environments = [{ env: "", workerName: null }];
  // The top-level `name` sits above every section header, so the top-level
  // environment is what an unheaded line belongs to.
  let current = environments[0];
  for (const rawLine of String(toml).split(/\r?\n/)) {
    const line = rawLine.trim();
    const section = /^\[+env\.([a-z0-9-]+)/.exec(line);
    if (section) {
      // [env.x], [env.x.vars] and [[env.x.kv_namespaces]] all name the same
      // environment; only the first occurrence introduces it.
      const [, env] = section;
      current = environments.find((item) => item.env === env) ?? null;
      if (!current) {
        current = { env, workerName: null };
        environments.push(current);
      }
      continue;
    }
    if (/^\[/.test(line)) {
      current = environments[0];
      continue;
    }
    const named = /^name\s*=\s*"([^"]+)"/.exec(line);
    if (named && current && !current.workerName) current.workerName = named[1];
  }
  return environments;
}

// Rewrites one key and leaves the rest of the file alone. The helper this
// replaced wrote `echo "STATS_TOKEN=..." > .env`, which also erased
// AGENDA_OBSERVABILITY_TOKEN — the credential `npm run funnel` reads.
export function withStatsToken(existing, token) {
  const lines = String(existing || "").split(/\r?\n/);
  let replaced = false;
  const next = lines.map((line) => {
    if (!/^STATS_TOKEN=/.test(line.trim())) return line;
    replaced = true;
    return `STATS_TOKEN=${token}`;
  });
  if (!replaced) {
    while (next.length && next[next.length - 1].trim() === "") next.pop();
    next.push(`STATS_TOKEN=${token}`);
  }
  return `${next.filter((line, index) => line.trim() !== "" || index < next.length - 1).join("\n")}\n`;
}

function readDotEnvToken() {
  if (!existsSync(envPath)) return null;
  const match = /^STATS_TOKEN=(.*)$/m.exec(readFileSync(envPath, "utf8"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
}

function statsUrl(workerName) {
  return `https://${workerName}.${workerSubdomain}.workers.dev/stats`;
}

async function checkOnly(environments) {
  const token = readDotEnvToken();
  if (!token) {
    console.error("No STATS_TOKEN in .env — nothing to check with. Run without --check to rotate.");
    return false;
  }

  let unauthorized = 0;
  for (const { env, workerName } of environments) {
    const label = env || "(top-level)";
    if (!workerName) {
      console.log(`unknown  ${label.padEnd(36)} wrangler.toml declares no Worker name`);
      continue;
    }
    let status;
    try {
      const response = await fetch(statsUrl(workerName), { headers: { "x-stats-token": token } });
      status = response.status;
    } catch (error) {
      console.log(`unreachable ${label.padEnd(33)} ${error.message}`);
      unauthorized += 1;
      continue;
    }
    // 401 here means this environment never received the current token, which
    // is the failure this script exists to prevent. It is not a health signal:
    // the Worker is serving, it just cannot be asked about its own usage.
    if (status === 200) console.log(`ok       ${label.padEnd(36)} /stats 200`);
    else {
      console.log(`STALE    ${label.padEnd(36)} /stats ${status}`);
      unauthorized += 1;
    }
  }

  if (unauthorized) {
    console.error(`\n${unauthorized} environment(s) do not accept the token in .env. Re-run without --check.`);
    return false;
  }
  console.log("\nEvery environment accepts the token in .env.");
  return true;
}

async function rotate(environments) {
  const token = randomBytes(32).toString("hex");

  console.log(`Writing STATS_TOKEN to ${environments.length} environment(s).`);
  for (const { env } of environments) {
    const label = env || "(top-level)";
    const args = env
      ? ["--yes", "wrangler", "secret", "put", "STATS_TOKEN", "--env", env]
      : ["--yes", "wrangler", "secret", "put", "STATS_TOKEN"];
    const { code, output } = await run("npx", args, { cwd: workerDir, stdin: `${token}\n` });
    if (code !== 0) {
      console.error(`FAIL  ${label}`);
      console.error(output.split("\n").slice(-10).join("\n"));
      console.error("\nSecrets are half-written. Fix the cause and re-run; the rotation is idempotent.");
      return false;
    }
    console.log(`ok    ${label.padEnd(36)} secret written`);
  }

  // Written only once every environment took it. A .env holding a token the
  // fleet never received is worse than the old one: every later --check would
  // report the whole fleet stale and the operator would chase the wrong fault.
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  writeFileSync(envPath, withStatsToken(existing, token), { mode: 0o600 });
  console.log("ok    .env                                 updated (0600)");

  console.log("\nRe-publishing so the stamp and the gate receipt come back.");
  const deployed = await run("npm", ["run", "deploy:all"], { cwd: workerDir });
  console.log(deployed.output.trimEnd());
  if (deployed.code !== 0) {
    console.error(
      "\nSecrets are in, but the fleet is unstamped and agent-output-verification\n" +
        "may be live without its ALLOW receipt. Fix the cause above and run:\n" +
        "  npm run deploy:all && npm run deploy:all -- --check"
    );
    return false;
  }

  const checked = await run("npm", ["run", "deploy:all", "--", "--check"], { cwd: workerDir });
  console.log(checked.output.trimEnd());
  if (checked.code !== 0) return false;

  return checkOnly(environments);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environments = deployedEnvironments(readFileSync(wranglerPath, "utf8"));
  const ok = process.argv.includes("--check")
    ? await checkOnly(environments)
    : await rotate(environments);
  if (!ok) process.exitCode = 1;
}
