import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const VIZIER_BASE_URL = "https://vizier.vassiliy-lakhonin.workers.dev";
const KEYCHAIN_ACCOUNT = "VIZIER_API_KEY";
const KEYCHAIN_SERVICE = "com.vizier.gated-deploy";
const WORKER_TARGET = "worker:agent-output-verification-a2a";
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

export function createDeployRequest(metadata) {
  return {
    agent: { id: "agent-output-verification-deployer", owner: "vassiliy-lakhonin" },
    principal: { id: "vassiliy-lakhonin" },
    action: {
      type: "deploy_worker",
      target: WORKER_TARGET,
      parameters: { git_commit: metadata.commit, dirty_worktree: metadata.dirty }
    },
    authority: {
      allowed_actions: ["deploy_worker"],
      constraints: {
        allowed_targets: [WORKER_TARGET],
        allowed_sensitive_actions: ["deploy_worker"]
      }
    },
    context: { request_id: null, timestamp: null, source: "rest" }
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

export async function runGatedDeploy({ metadata, apiKey, fetchImpl = fetch, execute }) {
  assertCleanWorktree(metadata);
  const request = createDeployRequest(metadata);
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

async function readKeychainSecret() {
  const secret = await readCommand("/usr/bin/security", [
    "find-generic-password",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    KEYCHAIN_SERVICE,
    "-w"
  ]);
  if (secret.length === 0) {
    throw new Error("Vizier credential is empty in macOS Keychain.");
  }
  return secret;
}

function executeWranglerDeploy(receiptId) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "npx",
      [
        "wrangler",
        "deploy",
        "--env",
        "agent-output-verification",
        "--strict",
        "--message",
        `Vizier ALLOW receipt ${receiptId}`
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

async function main() {
  if (process.argv.length > 2) {
    throw new Error("vizier-gated-deploy does not accept command arguments.");
  }
  const [metadata, apiKey] = await Promise.all([collectDeployMetadata(), readKeychainSecret()]);
  const result = await runGatedDeploy({ metadata, apiKey, execute: executeWranglerDeploy });
  console.log(
    JSON.stringify({
      event: "vizier.gated_deploy.completed",
      target: WORKER_TARGET,
      status: result.status,
      decision: result.decision,
      receipt_id: result.receiptId,
      reason_codes: result.reasonCodes,
      ...(result.status === "stopped" ? {} : { exit_code: result.exitCode })
    })
  );
  return result.status === "stopped" ? 2 : result.exitCode;
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
          target: WORKER_TARGET,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      );
      process.exitCode = 1;
    });
}
