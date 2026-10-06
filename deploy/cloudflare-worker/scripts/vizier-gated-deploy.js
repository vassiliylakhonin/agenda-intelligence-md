import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { open } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { DIGEST_PREFIX, bundleDigest, fleetEnvironments } from "./deploy-all.js";
import { assertBootstrapTarget, initializeCardSigning, verifyLiveCardSigning } from "./card-signing-bootstrap.js";

const VIZIER_BASE_URL = "https://vizier.vassiliy-lakhonin.workers.dev";
const KEYCHAIN_ACCOUNT = "VIZIER_API_KEY";
const KEYCHAIN_SERVICE = "com.vizier.gated-deploy";
// The environment this script gates when invoked with no argument. Kept so the
// protected workflow and `npm run deploy:agent-output-verification:gated` mean
// what they have always meant; deploy-all.js now passes an environment for
// every deployment instead.
const DEFAULT_ENV = "agent-output-verification";

// `worker:<name>` from wrangler.toml, not a constant per environment: the
// target names what is actually being shipped, and a target invented here
// could name something the deploy does not touch.
export function workerTargetFor(env = DEFAULT_ENV) {
  const found = fleetEnvironments().find((item) => item.env === env);
  if (!found?.workerName) {
    throw new Error(`wrangler.toml declares no Worker for environment "${env || "(top-level)"}".`);
  }
  return `worker:${found.workerName}`;
}
const WRANGLER_VERSION = "4.122.0";
const VERIFY_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError("Request is not canonicalizable JSON.");
}

export function requestHash(request) {
  return createHash("sha256").update(canonicalize(request)).digest("hex");
}

export function createDeployRequest(metadata, env = DEFAULT_ENV, grant = undefined, initializeSigning = false) {
  if (initializeSigning) assertBootstrapTarget(env);
  const target = workerTargetFor(env);
  return {
    agent: { id: `${env || "top-level"}-deployer`, owner: "vassiliy-lakhonin" },
    principal: { id: "vassiliy-lakhonin" },
    action: {
      type: "deploy_worker",
      target,
      parameters: { git_commit: metadata.commit, dirty_worktree: metadata.dirty,
        ...(initializeSigning ? { initialize_agent_card_signing: true } : {}) }
    },
    // This exact authority must match the owner-signed grant. The signer is a
    // separate operator-controlled step, not part of the protected deploy process.
    authority: {
      allowed_actions: ["deploy_worker"],
      constraints: {
        allowed_targets: [target],
        allowed_sensitive_actions: ["deploy_worker"]
      }
    },
    context: { request_id: null, timestamp: null, source: "rest" },
    ...(grant === undefined ? {} : { grant })
  };
}

function assertCleanWorktree(metadata) {
  if (metadata.dirty) {
    throw new Error("Commit or stash local changes before deployment.");
  }
  if (!/^[a-f0-9]{40}$/u.test(metadata.commit)) {
    throw new Error("A full Git commit SHA is required for deployment.");
  }
}

function validatePolicyResult(value) {
  return (
    isRecord(value) &&
    typeof value.rule_id === "string" &&
    ["PASS", "REVIEW", "FAIL"].includes(value.result) &&
    (value.reason_code === null || typeof value.reason_code === "string") &&
    isRecord(value.details)
  );
}

export function validateVizierResponse(value, request) {
  if (
    !isRecord(value) ||
    !["ALLOW", "REVIEW", "BLOCK"].includes(value.decision) ||
    typeof value.risk_score !== "number" ||
    value.risk_score < 0 ||
    value.risk_score > 1 ||
    !Array.isArray(value.reason_codes) ||
    !value.reason_codes.every((item) => typeof item === "string") ||
    typeof value.explanation !== "string" ||
    !Array.isArray(value.policy_results) ||
    value.policy_results.length === 0 ||
    !value.policy_results.every(validatePolicyResult) ||
    !isRecord(value.receipt)
  ) {
    throw new Error("Vizier returned an invalid response contract.");
  }

  const receipt = value.receipt;
  const policyRuleIds = value.policy_results.map((item) => item.rule_id);
  const policyReasonCodes = value.policy_results.flatMap((item) =>
    item.reason_code === null ? [] : [item.reason_code]
  );
  if (
    typeof receipt.id !== "string" ||
    receipt.id.length === 0 ||
    typeof receipt.created_at !== "string" ||
    !Number.isFinite(Date.parse(receipt.created_at)) ||
    typeof receipt.request_hash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(receipt.request_hash) ||
    receipt.request_hash !== requestHash(request) ||
    receipt.decision !== value.decision ||
    receipt.risk_score !== value.risk_score ||
    !Array.isArray(receipt.policy_rule_ids) ||
    !receipt.policy_rule_ids.every((item) => typeof item === "string") ||
    !Array.isArray(receipt.reason_codes) ||
    !receipt.reason_codes.every((item) => typeof item === "string") ||
    !equalArrays(receipt.policy_rule_ids, policyRuleIds) ||
    !equalArrays(receipt.reason_codes, value.reason_codes) ||
    !equalArrays(value.reason_codes, policyReasonCodes)
  ) {
    throw new Error("Vizier returned an invalid response contract.");
  }
  if (value.decision === "ALLOW") {
    const grant = receipt.grant;
    if (receipt.authority_provenance !== "principal_signed" || !isRecord(grant) ||
        grant.issuer !== request.principal.id || grant.subject !== request.agent.id ||
        typeof grant.expires_at !== "string" || !Number.isFinite(Date.parse(grant.expires_at)) ||
        Date.parse(grant.expires_at) <= Date.now()) {
      throw new Error("Vizier ALLOW is missing valid owner-signed delegation proof.");
    }
  }
  return value;
}

async function readJsonResponse(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Vizier response exceeds the size limit.");
  }
  if (response.body === null) {
    throw new Error("Vizier returned an empty response.");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Vizier response exceeds the size limit.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Vizier returned a non-JSON response.");
  }
}

async function verifyWithVizier(request, apiKey, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${VIZIER_BASE_URL}/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const body = await readJsonResponse(response);
    if (!response.ok) {
      const code = isRecord(body) && isRecord(body.error) && typeof body.error.code === "string"
        ? body.error.code
        : "REQUEST_FAILED";
      throw new Error(`Vizier rejected the deployment: ${code}.`);
    }
    return validateVizierResponse(body, request);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runGatedDeploy({ metadata, apiKey, grant, fetchImpl = fetch, execute, env = DEFAULT_ENV, initializeSigning = false }) {
  assertCleanWorktree(metadata);
  if (typeof grant !== "string" || grant.length === 0 || grant.length > 32_768) {
    throw new Error("An owner-signed deployment grant is required before verification.");
  }
  const request = createDeployRequest(metadata, env, grant, initializeSigning);
  const response = await verifyWithVizier(request, apiKey, fetchImpl);
  if (response.decision !== "ALLOW") {
    return {
      status: "stopped",
      decision: response.decision,
      reasonCodes: response.reason_codes,
      receiptId: response.receipt.id
    };
  }

  const exitCode = await execute(response.receipt.id);
  return {
    status: exitCode === 0 ? "deployed" : "failed",
    decision: "ALLOW",
    reasonCodes: response.reason_codes,
    receiptId: response.receipt.id,
    exitCode
  };
}

function readCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error === null) {
        resolvePromise(stdout.trim());
        return;
      }
      rejectPromise(error);
    });
  });
}

async function collectDeployMetadata() {
  const [commit, worktree] = await Promise.all([
    readCommand("/usr/bin/git", ["rev-parse", "--verify", "HEAD"]),
    readCommand("/usr/bin/git", ["status", "--porcelain"])
  ]);
  return { commit, dirty: worktree.length > 0 };
}

export async function readVizierCredential({ environment = process.env, readKeychain = null } = {}) {
  const environmentSecret = environment.VIZIER_API_KEY;
  if (environmentSecret !== undefined) {
    if (environmentSecret.trim().length === 0) {
      throw new Error("VIZIER_API_KEY is empty.");
    }
    return environmentSecret;
  }
  const loadKeychain =
    readKeychain ??
    (() =>
      readCommand("/usr/bin/security", [
        "find-generic-password",
        "-a",
        KEYCHAIN_ACCOUNT,
        "-s",
        KEYCHAIN_SERVICE,
        "-w"
      ]));
  const secret = await loadKeychain();
  if (secret.length === 0) {
    throw new Error("Vizier credential is empty in macOS Keychain.");
  }
  return secret;
}

export async function readDeploymentGrant(environment = process.env) {
  const filename = environment.VIZIER_DEPLOY_GRANT_FILE;
  if (!filename) throw new Error("VIZIER_DEPLOY_GRANT_FILE is required; unsigned deployment is disabled.");
  const file = await open(filename, "r");
  try {
    if (!(await file.stat()).isFile()) throw new Error("Deployment grant must be a regular file.");
    const buffer = Buffer.alloc(32_769);
    let size = 0;
    while (size < buffer.length) {
      const part = await file.read(buffer, size, buffer.length-size, null);
      if (part.bytesRead === 0) break;
      size += part.bytesRead;
    }
    if (size > 32_768) throw new Error("Deployment grant exceeds size limit.");
    const grant = buffer.subarray(0, size).toString("utf8").trim();
    if (!grant) throw new Error("Deployment grant is empty.");
    return grant;
  } finally {
    await file.close();
  }
}

function executeWranglerDeploy(receiptId, digest, env = DEFAULT_ENV) {
  // The receipt says the gate allowed this deploy; the digest says what was
  // deployed. deploy-all.js --check reads both from the same message, and
  // without the second a gated environment reports as unstamped forever
  // because the gate is now the only path that may ship any of them.
  const message = digest
    ? `Vizier ALLOW receipt ${receiptId} ${DIGEST_PREFIX} ${digest}`
    : `Vizier ALLOW receipt ${receiptId}`;
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "npx",
      [
        "--yes",
        `wrangler@${WRANGLER_VERSION}`,
        "deploy",
        ...(env ? ["--env", env] : []),
        "--strict",
        "--message",
        message
      ],
      { stdio: "inherit", shell: false }
    );
    child.once("error", rejectPromise);
    child.once("close", (code, signal) => {
      if (signal !== null) {
        rejectPromise(new Error(`Wrangler terminated by signal ${signal}.`));
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

// One optional environment, and only one this script can name: an argument
// that is not a declared environment is a typo, and a typo that fell through
// to the default would ship the wrong worker under a valid receipt.
export function envFromArgv(argv) {
  if (argv.length === 0) return DEFAULT_ENV;
  if (argv.length === 1 && argv[0] === "--top-level") return "";
  if (argv.length === 2 && argv[0] === "--env") {
    const declared = fleetEnvironments().map((item) => item.env);
    if (!declared.includes(argv[1])) {
      throw new Error(`wrangler.toml declares no environment "${argv[1]}".`);
    }
    return argv[1];
  }
  throw new Error("vizier-gated-deploy accepts --env <name> or --top-level, and nothing else.");
}

async function main() {
  if (process.argv.length > 4) {
    throw new Error("vizier-gated-deploy accepts --env <name> or --top-level, and nothing else.");
  }
  const env = envFromArgv(process.argv.slice(2));
  const initializeSigning = process.env.INITIALIZE_AGENT_CARD_SIGNING === "true";
  if (initializeSigning) assertBootstrapTarget(env);
  const [metadata, apiKey, grant] = await Promise.all([
    collectDeployMetadata(), readVizierCredential(), readDeploymentGrant()
  ]);
  // The gate already refused a dirty worktree above, so a digest is always
  // available here; the fallback exists so a change to that rule cannot turn a
  // missing digest into a crash mid-deploy.
  const { digest } = await bundleDigest();
  const result = await runGatedDeploy({
    metadata,
    apiKey,
    grant,
    env,
    initializeSigning,
    execute: async (receiptId) => {
      if (initializeSigning) console.log(JSON.stringify(await initializeCardSigning(env)));
      const exitCode = await executeWranglerDeploy(receiptId, digest, env);
      if (exitCode === 0 && initializeSigning) {
        // Wait briefly for deployment propagation; every successful run must
        // verify the actual served signature against the actual served JWKS.
        for (let attempt = 0; ; attempt += 1) {
          try {
            console.log(JSON.stringify(await verifyLiveCardSigning(env)));
            break;
          } catch (error) {
            if (attempt === 5) throw error;
            await new Promise(resolve => setTimeout(resolve, 5_000));
          }
        }
      }
      return exitCode;
    }
  });
  console.log(
    JSON.stringify({
      event: "vizier.gated_deploy.completed",
      target: workerTargetFor(env),
      status: result.status,
      decision: result.decision,
      receipt_id: result.receiptId,
      reason_codes: result.reasonCodes,
      ...(result.status === "stopped" ? {} : { exit_code: result.exitCode, authority_provenance: "principal_signed" })
    })
  );
  return result.status === "stopped" ? 2 : result.exitCode;
}

// The failure log must never throw while reporting a failure: the environment
// may be the very thing that was wrong.
function safeTarget() {
  try {
    return workerTargetFor(envFromArgv(process.argv.slice(2)));
  } catch {
    return null;
  }
}

const entryUrl = process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (entryUrl === import.meta.url) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "vizier.gated_deploy.failed",
          target: safeTarget(),
          error: error instanceof Error ? error.message : "Unknown error"
        })
      );
      process.exitCode = 1;
    });
}
