import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DECISION_RECEIPT_TTL_SECONDS,
  decisionPolicyCatalog,
  decisionRequestHashes,
  signDecisionReceipt,
  verifyDecisionReceipt
} from "../src/decision-receipt.js";
import { publicJwkFromPrivate } from "../src/jws.js";
import { PRE_ACTION_CHECK_GUIDE } from "../src/index.js";

async function generateTestKey() {
  const { privateKey } = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", privateKey);
  jwk.kid = "decision-test-kid";
  jwk.alg = "ES256";
  jwk.use = "sig";
  return jwk;
}

function actionRequest() {
  return {
    run_id: "run-receipt-1",
    actor: { id: "procurement-agent", type: "ai_agent", operator: "Example buyer" },
    requested_action: "send supplier recommendation",
    target: { id: "supplier-456", type: "counterparty" },
    risk_tier: "low",
    claims: [
      {
        claim_id: "c1",
        claim: "The supplier file contains the required registration record.",
        support_level: "direct",
        evidence_ids: ["e1"],
        supporting_quotes: [{ evidence_id: "e1", quote: "registration record" }]
      }
    ],
    evidence: [{ evidence_id: "e1", source_type: "official_document" }]
  };
}

function decision(decisionName = "continue") {
  return {
    decision_id: "decision-1",
    run_id: "run-receipt-1",
    policy_version: "pre-action-check.v1",
    decision: decisionName,
    reason_code: decisionName === "continue" ? "evidence_ready" : "unsafe_claims"
  };
}

test("decision policy catalog starts with one bounded pre-action policy", () => {
  const catalog = decisionPolicyCatalog();
  assert.equal(catalog.policies.length, 1);
  assert.equal(catalog.policies[0].policy_id, "pre-action-check.v1");
  assert.equal(catalog.policies[0].decision_tool, "decision_check");
  assert.equal(catalog.policies[0].verify_tool, "decision_verify");
  assert.equal(catalog.policies[0].receipt_ttl_seconds, DECISION_RECEIPT_TTL_SECONDS);
  assert.equal(catalog.binding.request_hash.canonicalization, "RFC8785-JCS");
  assert.deepEqual(catalog.binding.action_hash.fields, ["actor", "requested_action", "target", "risk_tier"]);
  assert.match(catalog.not_authorization_notice, /not authorization/i);
});

test("signed readiness receipt verifies only against its exact request and action hashes", async () => {
  const privateJwk = await generateTestKey();
  const request = actionRequest();
  const nowSeconds = 1_800_000_000;
  const signed = await signDecisionReceipt({
    request,
    decision: decision(),
    privateJwk,
    issuer: "https://agent-output-verification-a2a.example.workers.dev",
    nowSeconds
  });

  assert.equal(signed.format, "agenda-readiness-receipt+jws");
  assert.equal(signed.token.split(".").length, 3);
  assert.match(signed.request_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(signed.action_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Date.parse(signed.expires_at) - Date.parse(signed.issued_at), DECISION_RECEIPT_TTL_SECONDS * 1000);

  const verified = await verifyDecisionReceipt({
    token: signed.token,
    publicJwk: publicJwkFromPrivate(privateJwk),
    expectedRequestHash: signed.request_hash,
    expectedActionHash: signed.action_hash,
    nowSeconds: nowSeconds + 10
  });
  assert.equal(verified.signature_valid, true);
  assert.equal(verified.binding_matches, true);
  assert.equal(verified.expired, false);
  assert.equal(verified.gate_passed, true);
  assert.equal(verified.reason_code, "valid_continue_receipt");
  assert.equal(verified.receipt.not_authorization, true);
});

test("receipt verification fails closed for tampering, wrong binding, expiry, and non-continue decisions", async () => {
  const privateJwk = await generateTestKey();
  const publicJwk = publicJwkFromPrivate(privateJwk);
  const request = actionRequest();
  const hashes = await decisionRequestHashes(request);
  const nowSeconds = 1_800_000_000;
  const signed = await signDecisionReceipt({
    request,
    decision: decision(),
    privateJwk,
    issuer: "https://agent-output-verification-a2a.example.workers.dev",
    nowSeconds
  });

  const [protectedB64, payloadB64, signatureB64] = signed.token.split(".");
  const tamperedSignature = (signatureB64[0] === "A" ? "B" : "A") + signatureB64.slice(1);
  const tamperedToken = `${protectedB64}.${payloadB64}.${tamperedSignature}`;
  const tampered = await verifyDecisionReceipt({
    token: tamperedToken,
    publicJwk,
    expectedRequestHash: hashes.request_hash,
    expectedActionHash: hashes.action_hash,
    nowSeconds: nowSeconds + 1
  });
  assert.equal(tampered.gate_passed, false);
  assert.equal(tampered.reason_code, "invalid_signature");

  const wrongBinding = await verifyDecisionReceipt({
    token: signed.token,
    publicJwk,
    expectedRequestHash: "sha256:" + "0".repeat(64),
    expectedActionHash: hashes.action_hash,
    nowSeconds: nowSeconds + 1
  });
  assert.equal(wrongBinding.signature_valid, true);
  assert.equal(wrongBinding.binding_matches, false);
  assert.equal(wrongBinding.gate_passed, false);
  assert.equal(wrongBinding.reason_code, "binding_mismatch");

  const wrongIssuer = await verifyDecisionReceipt({
    token: signed.token,
    publicJwk,
    expectedRequestHash: hashes.request_hash,
    expectedActionHash: hashes.action_hash,
    expectedIssuer: "https://another-worker.example",
    nowSeconds: nowSeconds + 1
  });
  assert.equal(wrongIssuer.signature_valid, true);
  assert.equal(wrongIssuer.binding_matches, false);
  assert.equal(wrongIssuer.gate_passed, false);
  assert.equal(wrongIssuer.reason_code, "binding_mismatch");

  const expired = await verifyDecisionReceipt({
    token: signed.token,
    publicJwk,
    expectedRequestHash: hashes.request_hash,
    expectedActionHash: hashes.action_hash,
    nowSeconds: nowSeconds + DECISION_RECEIPT_TTL_SECONDS + 1
  });
  assert.equal(expired.expired, true);
  assert.equal(expired.gate_passed, false);
  assert.equal(expired.reason_code, "receipt_expired");

  const stopped = await signDecisionReceipt({
    request,
    decision: decision("stop"),
    privateJwk,
    issuer: "https://agent-output-verification-a2a.example.workers.dev",
    nowSeconds
  });
  const notContinue = await verifyDecisionReceipt({
    token: stopped.token,
    publicJwk,
    expectedRequestHash: stopped.request_hash,
    expectedActionHash: stopped.action_hash,
    nowSeconds: nowSeconds + 1
  });
  assert.equal(notContinue.signature_valid, true);
  assert.equal(notContinue.gate_passed, false);
  assert.equal(notContinue.reason_code, "decision_not_continue");
});

// The guide a caller reads before it sends anything. Until 2026-09-02 all three
// of these were wrong at once and nothing caught it: the published example was
// invalid against the published schema, it could not reach the only decision
// that yields gate_passed, and the schema it pointed at served an HTML page.
// verify:decision-gate found them against production; these keep them from
// coming back before a deploy.

test("the published input schema is machine-readable, not a blob page", () => {
  const { input_schema: url } = decisionPolicyCatalog().policies[0];
  assert.ok(!url.includes("/blob/"), `input_schema serves HTML from a blob URL: ${url}`);
  assert.match(url, /^https:\/\/raw\.githubusercontent\.com\//u);
});

test("the advertised pre-action example validates against the published schema", () => {
  const schema = JSON.parse(
    readFileSync(new URL("../../../schemas/v1/pre-action-check-request.schema.json", import.meta.url), "utf8")
  );
  const example = PRE_ACTION_CHECK_GUIDE.example;

  for (const field of schema.required) {
    assert.ok(field in example, `example is missing required field ${field}`);
  }
  const evidenceSchema = schema.$defs.evidence_item;
  for (const item of example.evidence) {
    for (const field of evidenceSchema.required) {
      assert.ok(field in item, `example evidence is missing required field ${field}`);
    }
    for (const key of Object.keys(item)) {
      assert.ok(key in evidenceSchema.properties, `example evidence carries ${key}, which the schema forbids`);
    }
  }
  assert.ok(schema.properties.risk_tier.enum.includes(example.risk_tier));
});

test("the advertised example can reach continue, not only request_evidence", () => {
  // A claim is grounded only if it carries supporting_quotes, and the decision
  // is continue only if every claim is grounded. An example without them
  // publishes the negative path as the whole feature.
  for (const claim of PRE_ACTION_CHECK_GUIDE.example.claims) {
    assert.ok(
      Array.isArray(claim.supporting_quotes) && claim.supporting_quotes.length > 0,
      `claim ${claim.claim_id} has no supporting_quotes, so the example can never reach continue`
    );
    for (const quote of claim.supporting_quotes) {
      assert.ok(claim.evidence_ids.includes(quote.evidence_id), "a supporting quote cites undeclared evidence");
      assert.ok(
        PRE_ACTION_CHECK_GUIDE.example.evidence.some((e) => e.evidence_id === quote.evidence_id),
        "a supporting quote cites evidence the example does not supply"
      );
    }
  }
});

test("the guide names every risk tier the gate accepts", () => {
  const schema = JSON.parse(
    readFileSync(new URL("../../../schemas/v1/pre-action-check-request.schema.json", import.meta.url), "utf8")
  );
  const line = PRE_ACTION_CHECK_GUIDE.required.find((entry) => entry.startsWith("risk_tier"));
  for (const tier of schema.properties.risk_tier.enum) {
    assert.ok(line.includes(tier), `the guide omits risk_tier ${tier}, which the gate accepts`);
  }
});
