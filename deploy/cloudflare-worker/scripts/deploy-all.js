// Deploys every published Worker, with the one exception the README requires.
//
// `agent-output-verification` may only ship through the Vizier gate. On
// 2026-08-14 a hand-rolled "deploy all eight" loop overwrote two gated
// deployments with ungated ones inside ninety seconds of each — same code, but
// the live version lost its ALLOW receipt, which is the entire point of the
// gate. This script exists so the safe path is also the convenient one.
//
//   npm run deploy:all          deploy every env correctly
//   npm run deploy:all -- --check   verify only, deploy nothing
//
// The final check reads the live deployment list and fails if the gated
// worker's newest deployment carries no receipt. That is detection, not
// prevention: anyone can still call wrangler directly. It means the next run
// says so out loud instead of the drift going unnoticed for a week.
//
// It also fails if any environment is live on a deployment older than the last
// commit that touched the bundled source. On 2026-08-26 a `--check` run printed
// "receipt ok" while agent-output-verification had been sitting on the previous
// code for eighty-five minutes: the receipt was valid, it was just a receipt for
// an older version. A per-environment check would have caught it at once, and a
// receipt on stale code is the more dangerous shape of the two, because it looks
// exactly like a healthy fleet.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Everything that ships with a plain `wrangler deploy`.
const UNGATED_ENVS = [
  "", // top-level worker
  "middle-corridor-deal-risk-gate",
  "cis-secondary-sanctions",
  "agentic-interaction-trust",
  "gulf-maritime-exposure",
  "kazakhstan-market-entry-readiness",
  "corridor-sanctions-assistant"
];

const GATED_ENV = "agent-output-verification";
const RECEIPT_MARKER = "Vizier ALLOW receipt";

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("close", (code) => resolve({ code, output }));
  });
}

function versionFrom(output) {
  return /Current Version ID:\s*(\S+)/.exec(output)?.[1] ?? null;
}

async function deployUngated(env) {
  const args = env ? ["--yes", "wrangler", "deploy", "--env", env] : ["--yes", "wrangler", "deploy"];
  const { code, output } = await run("npx", args);
  const label = env || "(top-level)";
  if (code !== 0) {
    console.error(`FAIL  ${label}`);
    console.error(output.split("\n").slice(-12).join("\n"));
    return false;
  }
  console.log(`ok    ${label.padEnd(36)} ${versionFrom(output) ?? "deployed"}`);
  return true;
}

async function deployGated() {
  // Delegates to the gate itself: it requires a clean commit, reads the Vizier
  // credential, and runs wrangler only after a validated ALLOW receipt.
  const { code, output } = await run("npm", ["run", "deploy:agent-output-verification:gated"]);
  if (code !== 0) {
    console.error(`FAIL  ${GATED_ENV} — the gate refused or could not run.`);
    console.error(output.split("\n").slice(-15).join("\n"));
    console.error(
      "\nDo not fall back to `wrangler deploy --env agent-output-verification`.\n" +
        "Either fix the cause above, or dispatch the protected workflow:\n" +
        "  gh workflow run deploy-agent-output-verification.yml --ref main"
    );
    return false;
  }
  console.log(`ok    ${GATED_ENV.padEnd(36)} through the Vizier gate`);
  return true;
}

// `wrangler deployments list` prints oldest-first, so only the final block
// describes what is live. A receipt anywhere earlier means the gate ran and was
// then overwritten — exactly the 2026-08-14 failure — so scanning the whole
// output would report success on a drifted worker.
export function newestReceipt(output) {
  const blocks = String(output).split(/\nCreated:\s+/).slice(1);
  const newest = blocks[blocks.length - 1] ?? "";
  if (!newest.includes(RECEIPT_MARKER)) return null;
  return new RegExp(`${RECEIPT_MARKER}\\s+(\\S+)`).exec(newest)?.[1] ?? "(unnamed)";
}

// The files that end up in the bundle. A README or a test change moves HEAD
// without changing what is deployed, so measuring staleness against every
// commit would cry wolf until the warning stopped being read.
const BUNDLED_PATHS = ["src", "wrangler.toml", "package.json"];

// Same block-splitting rule as newestReceipt: only the final block is live, and
// each block opens with its own creation timestamp.
export function newestDeployedAt(output) {
  const blocks = String(output).split(/\nCreated:\s+/).slice(1);
  const newest = blocks[blocks.length - 1] ?? "";
  const stamp = /^(\S+)/.exec(newest)?.[1];
  const at = stamp ? Date.parse(stamp) : NaN;
  return Number.isNaN(at) ? null : at;
}

// Returns null rather than throwing when git cannot answer — outside a checkout,
// or a shallow clone with no history for these paths. An unknown baseline must
// not fail the fleet; it just means this particular check abstains.
async function lastSourceChange() {
  const repoDir = fileURLToPath(new URL("..", import.meta.url));
  const log = await run("git", ["log", "-1", "--format=%h %cI", "--", ...BUNDLED_PATHS], { cwd: repoDir });
  if (log.code !== 0) return null;
  const [commit, iso] = log.output.trim().split(/\s+/);
  const at = Date.parse(iso ?? "");
  if (!commit || Number.isNaN(at)) return null;

  // A deploy from a dirty tree ships code that is in no commit at all, so the
  // commit time understates how new the live version really is. Say so instead
  // of reporting a confident answer built on the wrong baseline.
  const dirty = await run("git", ["status", "--porcelain", "--", ...BUNDLED_PATHS], { cwd: repoDir });
  return { commit, at, iso, dirty: dirty.code === 0 && dirty.output.trim().length > 0 };
}

const shortTime = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

function ageLabel(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

async function checkFreshness() {
  const source = await lastSourceChange();
  if (!source) {
    console.log("\nfreshness  skipped — git could not date the bundled source.");
    return true;
  }
  console.log(`\nlast source commit  ${source.commit}  ${shortTime(source.at)}`);
  if (source.dirty) {
    console.log("            (working tree is dirty; a deploy from it carries code that is in no commit)");
  }

  let allFresh = true;
  for (const env of [...UNGATED_ENVS, GATED_ENV]) {
    const args = env
      ? ["--yes", "wrangler", "deployments", "list", "--env", env]
      : ["--yes", "wrangler", "deployments", "list"];
    const { code, output } = await run("npx", args);
    const label = env || "(top-level)";
    const deployedAt = code === 0 ? newestDeployedAt(output) : null;
    if (deployedAt === null) {
      console.error(`unknown  ${label.padEnd(36)} could not read the deployment list`);
      allFresh = false;
      continue;
    }
    if (deployedAt >= source.at) {
      console.log(`fresh    ${label.padEnd(36)} ${shortTime(deployedAt)}`);
      continue;
    }
    console.error(
      `STALE    ${label.padEnd(36)} ${shortTime(deployedAt)}  ` +
        `${ageLabel(source.at - deployedAt)} behind ${source.commit}`
    );
    allFresh = false;
  }
  if (!allFresh) {
    console.error(
      "\nAn environment is live on code older than the last source commit.\n" +
        "Run `npm run deploy:all` to bring the fleet up, or deploy the named env alone.\n" +
        `For ${GATED_ENV} use the gate, never wrangler directly.`
    );
  }
  return allFresh;
}

async function checkReceipt() {
  const { code, output } = await run("npx", ["--yes", "wrangler", "deployments", "list", "--env", GATED_ENV]);
  if (code !== 0) {
    console.error(`\nCould not read deployments for ${GATED_ENV}; receipt not verified.`);
    return false;
  }
  const receipt = newestReceipt(output);
  if (receipt) {
    console.log(`\nreceipt  ${GATED_ENV} live version carries ${receipt}`);
    return true;
  }
  console.error(
    `\nDRIFT  the live ${GATED_ENV} deployment carries no ${RECEIPT_MARKER}.\n` +
      "Something shipped it outside the gate. Re-run the gate to restore the trail:\n" +
      "  gh workflow run deploy-agent-output-verification.yml --ref main"
  );
  return false;
}

async function main() {
  const checkOnly = process.argv.slice(2).includes("--check");

  if (!checkOnly) {
    for (const env of UNGATED_ENVS) {
      if (!(await deployUngated(env))) {
        process.exitCode = 1;
        return;
      }
    }
    if (!(await deployGated())) {
      process.exitCode = 1;
      return;
    }
  }

  // Both checks always run, and the failure of one does not skip the other:
  // a fleet can be stale and ungated at the same time, and a run that reported
  // only the first problem would need a second run to reveal the second.
  const receiptOk = await checkReceipt();
  const freshOk = await checkFreshness();
  if (!receiptOk || !freshOk) {
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("deploy-all.js");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
