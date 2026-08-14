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

import { spawn } from "node:child_process";

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

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
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

  if (!(await checkReceipt())) {
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
