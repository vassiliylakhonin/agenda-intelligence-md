// Entirely local. Synthetic packets and an ephemeral key; no live payment.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { handleRequest } from "../../deploy/cloudflare-worker/src/index.js";
import { verifyOutputReceipt } from "../../deploy/cloudflare-worker/src/output-receipt.js";

export async function replayOutputCases({ iterations = 30 } = {}) {
  const cases = JSON.parse(
    await readFile(new URL("./replay-cases.json", import.meta.url), "utf8"),
  );
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const env = {
    AGENT_PROFILE: "agent_output_verification",
    VIZIER_DISABLED: "1",
    OUTPUT_EVALUATION_RECEIPTS: "1",
    AGENT_CARD_SIGNING_KEY: JSON.stringify(privateJwk),
  };
  const evaluate = async (input) => {
    const response = await handleRequest(
      new Request("https://replay.test/v1/agent-output/verification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Client-Id": "agenda-owner-output-replay",
        },
        body: JSON.stringify(input),
      }),
      env,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const results = [];
  for (const item of cases) {
    const response = await evaluate(item.input);
    assert.equal(response.next_action, item.expected_next_action, item.id);
    assert.ok(response.reason_codes.includes(item.expected_reason), item.id);
    const verification = await verifyOutputReceipt({
      request: item.input,
      response,
      publicJwk: privateJwk,
      expectedIssuer: "https://replay.test",
    });
    assert.equal(verification.valid, true, item.id);
    assert.equal(verification.evaluation.human_review_required, true);
    const changed = structuredClone(response);
    changed.reason_codes = [];
    assert.equal(
      (
        await verifyOutputReceipt({
          request: item.input,
          response: changed,
          publicJwk: privateJwk,
          expectedIssuer: "https://replay.test",
        })
      ).valid,
      false,
    );
    results.push({
      id: item.id,
      next_action: response.next_action,
      expected_reason: item.expected_reason,
      receipt_valid: true,
      tamper_refused: true,
    });
  }
  const samples = [];
  for (let i = 0; i < iterations + 5; i++) {
    const start = performance.now();
    await evaluate(cases[i % cases.length].input);
    if (i >= 5) samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const percentile = (p) =>
    Number(samples[Math.ceil(samples.length * p) - 1].toFixed(3));
  return {
    synthetic: true,
    live_payments: 0,
    cases: results,
    latency: {
      scope:
        "warm local actual HTTP handler plus ES256 signing; no network, paid settlement or production SLA",
      samples: samples.length,
      p50_ms: percentile(0.5),
      p95_ms: percentile(0.95),
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await replayOutputCases();
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (process.argv[2]) await writeFile(process.argv[2], serialized);
  console.log(serialized);
}
