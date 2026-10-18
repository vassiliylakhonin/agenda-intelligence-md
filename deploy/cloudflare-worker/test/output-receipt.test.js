import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.js";
import { createPublicKey, verify as verifyNode } from "node:crypto";
import {
  verifyOutputReceipt,
  signOutputReceipt,
} from "../src/output-receipt.js";
import { memoryD1 } from "./helpers/d1.js";
import { replayOutputCases } from "../../../examples/output-verification/replay.mjs";
import {
  outputPaymentPolicy,
  reviewSignedOutput,
} from "../../../examples/output-verification/agent-loop.mjs";

const input = {
  claims: [
    {
      claim_id: "c1",
      claim: "Active record",
      support_level: "direct",
      evidence_ids: ["e1"],
      supporting_quotes: [
        { evidence_id: "e1", quote: "Revenue rose 90 percent" },
      ],
    },
  ],
  evidence: [{ evidence_id: "e1", content: "Active record" }],
};

test("actual output HTTP evaluation returns stable quote diagnostics and a request/result-bound receipt", async () => {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const key = await crypto.subtle.exportKey("jwk", keys.privateKey);
  const response = await handleRequest(
    new Request("https://example.test/v1/agent-output/verification", {
      method: "POST",
      body: JSON.stringify(input),
    }),
    {
      AGENT_PROFILE: "agent_output_verification",
      VIZIER_DISABLED: "1",
      OUTPUT_EVALUATION_RECEIPTS: "1",
      AGENT_CARD_SIGNING_KEY: JSON.stringify(key),
    },
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.reason_codes.includes("QUOTE_MISMATCH"));
  assert.equal(data.evaluation_receipt.format, "agenda-output-evaluation+jws");
  assert.match(data.evaluation_receipt.request_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(data.evaluation_receipt.response_hash, /^sha256:[a-f0-9]{64}$/);
  const verification = await verifyOutputReceipt({
    request: input,
    response: data,
    publicJwk: key,
    expectedIssuer: "https://example.test",
  });
  assert.equal(verification.valid, true);
  assert.equal(verification.evaluation.next_action, "block");
  assert.equal(verification.authorization_granted, false);
  assert.equal(
    verification.evaluation.vizier_status,
    undefined,
    "unsigned transport metadata is not a verified evaluation",
  );
  const [header, payload, signature] = data.evaluation_receipt.token.split(".");
  const publicKey = createPublicKey({
    key: await crypto.subtle.exportKey("jwk", keys.publicKey),
    format: "jwk",
  });
  assert.equal(
    verifyNode(
      "sha256",
      Buffer.from(header + "." + payload),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
  const encoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(encoded.claims, undefined);
  assert.equal(encoded.evidence, undefined);
  assert.equal(encoded.not_authorization, true);
  for (const mutation of [
    (v) => {
      v.verdict = "allow_relay";
    },
    (v) => {
      v.reason_codes = [];
    },
    (v) => {
      v.unsafe_claims = [];
    },
    (v) => {
      v.authorization_granted = true;
    },
    (v) => {
      v.checks[0].result = "pass";
    },
  ]) {
    const changed = structuredClone(data);
    mutation(changed);
    assert.equal(
      (
        await verifyOutputReceipt({
          request: input,
          response: changed,
          publicJwk: key,
          expectedIssuer: "https://example.test",
        })
      ).valid,
      false,
    );
  }
  assert.equal(
    (
      await verifyOutputReceipt({
        request: { ...input, topic: "changed" },
        response: data,
        publicJwk: key,
        expectedIssuer: "https://example.test",
      })
    ).reason_code,
    "BINDING_MISMATCH",
  );
  assert.equal(
    (
      await verifyOutputReceipt({
        request: input,
        response: data,
        publicJwk: key,
        expectedIssuer: "https://other.test",
      })
    ).valid,
    false,
  );
  assert.equal(
    (
      await verifyOutputReceipt({
        request: input,
        response: data,
        publicJwk: key,
        expectedIssuer: "https://example.test",
        nowSeconds: encoded.exp,
      })
    ).reason_code,
    "RECEIPT_EXPIRED",
  );
  const future = await signOutputReceipt({
    request: input,
    response: data,
    privateJwk: key,
    issuer: "https://example.test",
    nowSeconds: encoded.iat + 100,
  });
  assert.equal(
    (
      await verifyOutputReceipt({
        request: input,
        response: { ...data, evaluation_receipt: future },
        publicJwk: key,
        expectedIssuer: "https://example.test",
        nowSeconds: encoded.iat,
      })
    ).reason_code,
    "RECEIPT_NOT_YET_VALID",
  );
  const wrongKeys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  assert.equal(
    (
      await verifyOutputReceipt({
        request: input,
        response: data,
        publicJwk: await crypto.subtle.exportKey("jwk", wrongKeys.publicKey),
        expectedIssuer: "https://example.test",
      })
    ).reason_code,
    "INVALID_SIGNATURE",
  );
});

test("native MCP and A2A trials return the same signed evaluation contract", async () => {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const key = await crypto.subtle.exportKey("jwk", keys.privateKey);
  const env = {
    AGENT_PROFILE: "agent_output_verification",
    VIZIER_DISABLED: "1",
    OUTPUT_EVALUATION_RECEIPTS: "1",
    AGENT_CARD_SIGNING_KEY: JSON.stringify(key),
    WORKER_FREE_TRIAL: "1",
    PAYMENT_LEDGER: memoryD1(),
  };
  const call = async (path, body, headers = {}) =>
    (
      await handleRequest(
        new Request("https://example.test" + path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "CF-Connecting-IP": "198.51.100.89",
            ...headers,
          },
          body: JSON.stringify(body),
        }),
        env,
      )
    ).json();
  const mcp = await call("/mcp/agent", {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "free_trial", arguments: input },
  });
  assert.equal(mcp.result.isError, false);
  const a2a = await call(
    "/message/send",
    {
      jsonrpc: "2.0",
      id: 2,
      method: "SendMessage",
      params: {
        message: {
          messageId: "trial-2",
          role: "ROLE_USER",
          metadata: { "com.agenda/free-trial": { operation: "evaluate" } },
          parts: [{ data: input, mediaType: "application/json" }],
        },
      },
    },
    { "A2A-Version": "1.0" },
  );
  const data = a2a.result.task.artifacts
    .flatMap((a) => a.parts)
    .find((part) => part.data).data;
  for (const response of [mcp.result.structuredContent.evaluation, data]) {
    assert.equal(
      (
        await verifyOutputReceipt({
          request: input,
          response,
          publicJwk: key,
          expectedIssuer: "https://example.test",
        })
      ).valid,
      true,
    );
    assert.equal(response.next_action, "block");
    assert.ok(response.reason_codes.includes("QUOTE_MISMATCH"));
  }
});

test("enabled signed output path refuses a missing signing key instead of returning an unsigned evaluation", async () => {
  const response = await handleRequest(
    new Request("https://example.test/v1/agent-output/verification", {
      method: "POST",
      body: JSON.stringify(input),
    }),
    {
      AGENT_PROFILE: "agent_output_verification",
      VIZIER_DISABLED: "1",
      OUTPUT_EVALUATION_RECEIPTS: "1",
    },
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "evaluation_receipt_unavailable");
  assert.equal(body.verdict, undefined);
});

test("public replay examples use the actual handler and verify refusals and a structural positive control", async () => {
  const report = await replayOutputCases({ iterations: 3 });
  assert.equal(report.cases.length, 3);
  assert.ok(
    report.cases.every((item) => item.receipt_valid && item.tamper_refused),
  );
});

test("example budget rejects wrong asset, recipient, origin, amount and duplicate approval", () => {
  const terms = {
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x" + "ab".repeat(20),
    amount: "50000",
  };
  const make = () => ({
    accepts: [{ ...terms }],
    resource: { url: "https://example.test/mcp/agent" },
  });
  const approve = outputPaymentPolicy({
    payTo: terms.payTo,
    expectedIssuer: "https://example.test",
  });
  for (const change of [
    (p) => {
      p.accepts[0].amount = "50001";
    },
    (p) => {
      p.accepts[0].asset = "0x" + "cd".repeat(20);
    },
    (p) => {
      p.accepts[0].payTo = "0x" + "cd".repeat(20);
    },
    (p) => {
      p.accepts[0].network = "eip155:1";
    },
    (p) => {
      p.resource.url = "https://evil.test/mcp/agent";
    },
  ]) {
    const paymentRequired = make();
    change(paymentRequired);
    assert.equal(approve({ paymentRequired }), false);
  }
  assert.equal(approve({ paymentRequired: make() }), true);
  assert.equal(approve({ paymentRequired: make() }), false);
});

test("trial refusal never calls a paid client or discovers another issuer key", async () => {
  let paid = 0,
    fetches = 0;
  await assert.rejects(
    reviewSignedOutput(input, {
      paidClient: {
        callTool: () => {
          paid++;
        },
      },
      expectedIssuer: "https://example.test",
      fetchImpl: async () => {
        fetches++;
        return Response.json(
          {
            jsonrpc: "2.0",
            id: "signed-output-trial",
            result: { isError: true },
          },
          { status: 200 },
        );
      },
    }),
    /Evaluation refused/,
  );
  assert.equal(paid, 0);
  assert.equal(fetches, 1);
});
