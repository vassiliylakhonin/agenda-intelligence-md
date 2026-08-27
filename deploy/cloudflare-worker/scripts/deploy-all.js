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
// It also fails if any environment is live on something other than the current
// bundled source. On 2026-08-26 a `--check` run printed "receipt ok" while
// agent-output-verification had been sitting on the previous code for
// eighty-five minutes: the receipt was valid, it was just a receipt for an older
// version. A receipt on stale code is the more dangerous of the two shapes,
// because it looks exactly like a healthy fleet.
//
// The comparison is by content, not by clock. The first version of this check
// compared the deployment date against the last commit touching the bundle, and
// the first squash merge after it shipped reported all eight environments stale
// while the tree was byte-identical: a squash writes a new commit with a new
// date and the same content. So each deploy now stamps the digest of the
// bundled files into the deployment message, and the check compares digests.
// Rebases, squashes and cherry-picks move dates and leave the digest alone,
// which is the property wanted.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Everything that ships with a plain `wrangler deploy`.
const UNGATED_ENVS = [
  "", // top-level worker
  "middle-corridor-deal-risk-gate",
  "cis-secondary-sanctions",
  "agentic-interaction-trust",
  "gulf-maritime-exposure",
  "kazakhstan-market-entry-readiness",
  "critical-minerals-due-diligence",
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

async function deployUngated(env, digest) {
  const args = env ? ["--yes", "wrangler", "deploy", "--env", env] : ["--yes", "wrangler", "deploy"];
  // What the check reads back. Skipped on a dirty tree, where there is no
  // honest digest to claim — an unstamped deployment reports as unknown, which
  // is true, rather than as matching a digest it does not have.
  if (digest) args.push("--message", `${DIGEST_PREFIX} ${digest}`);
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

// The files that end up in the bundle. A README or a test change must not read
// as a stale deployment, so the digest covers these and nothing else.
const BUNDLED_PATHS = ["src", "wrangler.toml", "package.json"];

// Marks the deployed content in the deployment message, e.g. `src 4f2a91c0d3e8`.
export const DIGEST_PREFIX = "src";
const DIGEST_PATTERN = new RegExp(`\\b${DIGEST_PREFIX}\\s+([0-9a-f]{12})\\b`);

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
// or a worktree with no history for these paths. An unknown baseline must not
// fail the fleet; it means this check abstains.
//
// A dirty tree has no digest at all. The bytes being deployed are then in no
// commit, so any digest computed from HEAD would describe something else, and a
// confident answer built on the wrong baseline is worse than no answer.
export async function bundleDigest() {
  const repoDir = fileURLToPath(new URL("..", import.meta.url));
  const dirty = await run("git", ["status", "--porcelain", "--", ...BUNDLED_PATHS], { cwd: repoDir });
  if (dirty.code !== 0) return { digest: null, reason: "git could not read the working tree" };
  if (dirty.output.trim()) return { digest: null, reason: "the working tree is dirty" };

  // ls-tree prints mode, type, object id and path per entry, so its output is a
  // faithful description of the bundled content and of nothing else.
  const listed = await run("git", ["ls-tree", "-r", "HEAD", "--", ...BUNDLED_PATHS], { cwd: repoDir });
  if (listed.code !== 0 || !listed.output.trim()) {
    return { digest: null, reason: "git could not list the bundled files" };
  }
  return { digest: createHash("sha256").update(listed.output).digest("hex").slice(0, 12), reason: null };
}

const shortTime = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

// The digest a deployment message claims, or null when it predates the stamp.
export function newestDeployedDigest(output) {
  const blocks = String(output).split(/\nCreated:\s+/).slice(1);
  const newest = blocks[blocks.length - 1] ?? "";
  return DIGEST_PATTERN.exec(newest)?.[1] ?? null;
}

async function checkFreshness() {
  const { digest, reason } = await bundleDigest();
  if (!digest) {
    console.log(`\nfreshness  skipped — ${reason}.`);
    return true;
  }
  console.log(`\nbundled source  ${DIGEST_PREFIX} ${digest}`);

  let allCurrent = true;
  let unstamped = 0;
  for (const env of [...UNGATED_ENVS, GATED_ENV]) {
    const args = env
      ? ["--yes", "wrangler", "deployments", "list", "--env", env]
      : ["--yes", "wrangler", "deployments", "list"];
    const { code, output } = await run("npx", args);
    const label = env || "(top-level)";
    if (code !== 0) {
      console.error(`unknown  ${label.padEnd(36)} could not read the deployment list`);
      allCurrent = false;
      continue;
    }
    const live = newestDeployedDigest(output);
    const at = newestDeployedAt(output);
    const when = at === null ? "" : `  ${shortTime(at)}`;

    // A deployment made before this stamp existed carries no digest. That is
    // unknown, not stale: reporting it as drift would condemn every environment
    // until the next deploy, and a check that always fails is a check nobody
    // reads. It is still said out loud once, because an unstamped fleet is not
    // being checked.
    if (live === null) {
      console.log(`unstamped ${label.padEnd(35)}${when}`);
      unstamped += 1;
      continue;
    }
    if (live === digest) {
      console.log(`current  ${label.padEnd(36)}${when}`);
      continue;
    }
    console.error(`STALE    ${label.padEnd(36)}${when}  live ${DIGEST_PREFIX} ${live}`);
    allCurrent = false;
  }

  if (unstamped) {
    console.log(
      `\n${unstamped} environment(s) were deployed before the content stamp existed, ` +
        "so their code was not checked.\nThe next `npm run deploy:all` stamps them."
    );
  }
  if (!allCurrent) {
    console.error(
      "\nAn environment is live on different code from the current bundle.\n" +
        "Run `npm run deploy:all` to bring the fleet up, or deploy the named env alone.\n" +
        `For ${GATED_ENV} use the gate, never wrangler directly.`
    );
  }
  return allCurrent;
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
    const { digest, reason } = await bundleDigest();
    if (!digest) console.warn(`Deploying without a content stamp: ${reason}.`);
    for (const env of UNGATED_ENVS) {
      if (!(await deployUngated(env, digest))) {
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
