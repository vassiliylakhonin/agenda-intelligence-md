#!/usr/bin/env node
// The enforcing caller's side of the signed Decision Gate, run against production.
//
//   npm run verify:decision-gate
//
// ADR 0025 says a caller must compute the expected hashes from its own copy of
// the request rather than echoing what decision_check returned. Every existing
// test signs and verifies with the same JavaScript, so none of them can see a
// disagreement between the two parties — which is the only failure this binding
// has. This script plays the other party: it computes the hashes with the
// Python implementation in agenda_intelligence.canonical, which shares no code
// with the Worker, and completes decision_check -> decision_verify against the
// live Gate.
//
// It also checks the three things a caller meets before any of that: whether
// the published input_schema can be fetched as JSON, whether the advertised
// example_request validates against it, and whether that example can reach the
// one decision the feature exists to produce. The first run answered no to all
// three.
//
// Read-only against production, apart from decision_check, which is
// non-destructive and stateless — it mints a receipt that expires in five
// minutes and stores nothing. No key required.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BASE = "https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev";
const H = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "mcp-protocol-version": "2025-06-18"
};

const rows = [];
const note = (check, ok, detail = "") => rows.push({ check, ok, detail });

const call = async (name, args, id = 1) => {
  const response = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(30000)
  });
  const body = await response.json().catch(() => null);
  return body?.result ?? {};
};

// The independence the whole script rests on: hashes from a different language,
// a different canonicalizer, and a different process.
const pythonHashes = (request) =>
  JSON.parse(
    execFileSync("python3", ["-m", "agenda_intelligence.cli", "decision-hashes", "-", "--format", "json"], {
      cwd: REPO,
      env: { ...process.env, PYTHONPATH: join(REPO, "src") },
      input: JSON.stringify(request),
      encoding: "utf8"
    })
  );

const validateAgainstSchema = (request) => {
  const script = [
    "import json,sys",
    "from jsonschema import Draft202012Validator",
    "schema=json.load(open(sys.argv[1]))",
    "errors=[e.message for e in Draft202012Validator(schema).iter_errors(json.load(sys.stdin))]",
    "print(json.dumps(errors))"
  ].join("\n");
  return JSON.parse(
    execFileSync("python3", ["-c", script, join(REPO, "schemas", "v1", "pre-action-check-request.schema.json")], {
      cwd: REPO,
      input: JSON.stringify(request),
      encoding: "utf8"
    })
  );
};

// A caller that trusts nothing but the published JWKS. The Worker verifies with
// the key it signed with, so only this direction proves the receipt is checkable
// from outside.
async function verifySignatureAgainstPublishedJwks(token) {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  const decode = (value) => Buffer.from(value.replace(/-/gu, "+").replace(/_/gu, "/"), "base64");
  const header = JSON.parse(decode(headerB64).toString("utf8"));
  const jwks = await fetch(header.jku, { signal: AbortSignal.timeout(20000) }).then((r) => r.json());
  const jwk = (jwks.keys || []).find((key) => !header.kid || key.kid === header.kid);
  if (!jwk) return { ok: false, detail: `no key for kid=${header.kid}` };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    decode(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  return { ok, detail: `jku=${new URL(header.jku).pathname} kid=${header.kid ?? "none"}` };
}

// --- what the caller meets first -------------------------------------------

const catalog = (await call("decision_policies_list", {}, 1)).structuredContent || {};
const policy = (catalog.policies || [])[0] || {};
note("policy catalog answers", Boolean(policy.policy_id), policy.policy_id || "no policy");
note(
  "binding declares JCS",
  catalog.binding?.request_hash?.canonicalization === "RFC8785-JCS" &&
    catalog.binding?.action_hash?.canonicalization === "RFC8785-JCS",
  `${catalog.binding?.request_hash?.canonicalization}`
);
note(
  "action_hash fields match the caller's",
  JSON.stringify(catalog.binding?.action_hash?.fields) ===
    JSON.stringify(["actor", "requested_action", "target", "risk_tier"]),
  (catalog.binding?.action_hash?.fields || []).join(",")
);

note(
  "binding states the Unicode normal form",
  typeof catalog.binding?.unicode_normalization === "string",
  `${catalog.binding?.unicode_normalization ?? "unstated"} — two RFC 8785 implementations still disagree on NFD text`
);

const schemaUrl = policy.input_schema;
const schemaResponse = schemaUrl ? await fetch(schemaUrl, { signal: AbortSignal.timeout(20000) }) : null;
const schemaBody = schemaResponse ? await schemaResponse.text() : "";
let publishedSchemaIsJson = false;
try {
  JSON.parse(schemaBody);
  publishedSchemaIsJson = true;
} catch {
  publishedSchemaIsJson = false;
}
note(
  "input_schema is fetchable JSON",
  publishedSchemaIsJson,
  `${schemaResponse?.headers.get("content-type") ?? "no response"} — a caller told this is its schema cannot parse it`
);

const refusal = (await call("decision_check", {}, 2)).structuredContent || {};
const advertised = refusal.example_request;
note("refusal carries an example", Boolean(advertised), advertised ? "present" : "none");

if (advertised) {
  const errors = validateAgainstSchema(advertised);
  note("advertised example is schema-valid", errors.length === 0, errors.join("; ") || "valid");

  const checkedAdvertised = (await call("decision_check", advertised, 3)).structuredContent || {};
  note(
    "advertised example can reach continue",
    checkedAdvertised.decision === "continue",
    `${checkedAdvertised.decision} / ${checkedAdvertised.reason_code} — the only decision that yields gate_passed`
  );
}

// --- the binding itself ------------------------------------------------------

// Non-ASCII text is the one divergence class this endpoint can actually carry.
// The pre-action schema has no numeric field and no free-form object, so the
// number rendering and key-ordering rules cannot be exercised through a
// schema-valid request; those stay pinned in tests/test_jcs_canonicalization.py
// against fixtures taken from the Worker. Claiming to cover them here would be
// claiming coverage the request shape does not permit.
const request = {
  run_id: `run-verify-${Date.now()}`,
  actor: { id: "procurement-agent", type: "ai_agent", operator: "Айдын Жумабай" },
  requested_action: "send supplier recommendation to the buyer",
  target: { id: "supplier-456", type: "counterparty" },
  risk_tier: "low",
  claims: [
    {
      claim_id: "c1",
      claim: "The counterparty is not on the OFAC SDN list as of 2026-08-01.",
      support_level: "direct",
      evidence_ids: ["e1"],
      supporting_quotes: [{ evidence_id: "e1", quote: "No matching entry for supplier-456 in the SDN list." }]
    }
  ],
  evidence: [{ evidence_id: "e1", name: "OFAC SDN extract", source_type: "primary", freshness: "2026-08-01" }],
  policy_context: { profile: "default" }
};

note("probe request is schema-valid", validateAgainstSchema(request).length === 0, "");

const checked = (await call("decision_check", request, 4)).structuredContent || {};
const receipt = checked.receipt || {};
note("decision_check reaches continue", checked.decision === "continue", `${checked.decision} / ${checked.reason_code}`);
note("receipt is issued", Boolean(receipt.token), receipt.receipt_id || "no receipt");

const mine = pythonHashes(request);
note(
  "independent request_hash agrees",
  receipt.request_hash === mine.request_hash,
  receipt.request_hash === mine.request_hash ? "" : `worker=${receipt.request_hash} caller=${mine.request_hash}`
);
note(
  "independent action_hash agrees",
  receipt.action_hash === mine.action_hash,
  receipt.action_hash === mine.action_hash ? "" : `worker=${receipt.action_hash} caller=${mine.action_hash}`
);

const signature = receipt.token ? await verifySignatureAgainstPublishedJwks(receipt.token) : { ok: false, detail: "" };
note("receipt verifies against published JWKS", signature.ok, signature.detail);

const verified =
  (await call(
    "decision_verify",
    { receipt: receipt.token, expected_request_hash: mine.request_hash, expected_action_hash: mine.action_hash },
    5
  )).structuredContent || {};
note("gate_passed on caller-computed hashes", verified.gate_passed === true, verified.reason_code || "");

// --- the refusals, which are the half that has to hold ----------------------

const tampered = { ...request, requested_action: "release payment to the buyer" };
const tamperedHashes = pythonHashes(tampered);
const mismatch =
  (await call(
    "decision_verify",
    {
      receipt: receipt.token,
      expected_request_hash: tamperedHashes.request_hash,
      expected_action_hash: tamperedHashes.action_hash
    },
    6
  )).structuredContent || {};
note(
  "a changed action is refused",
  mismatch.gate_passed === false && mismatch.reason_code === "binding_mismatch",
  `${mismatch.reason_code}`
);

const weak = JSON.parse(JSON.stringify(request));
weak.run_id = `run-verify-weak-${Date.now()}`;
delete weak.claims[0].supporting_quotes;
const weakChecked = (await call("decision_check", weak, 7)).structuredContent || {};
const weakHashes = pythonHashes(weak);
const weakVerified =
  (await call(
    "decision_verify",
    {
      receipt: weakChecked.receipt?.token,
      expected_request_hash: weakHashes.request_hash,
      expected_action_hash: weakHashes.action_hash
    },
    8
  )).structuredContent || {};
note(
  "a non-continue receipt does not pass",
  weakVerified.gate_passed === false && weakVerified.reason_code === "decision_not_continue",
  `${weakChecked.decision} -> ${weakVerified.reason_code}`
);

const garbage =
  (await call(
    "decision_verify",
    { receipt: "not.a.receipt", expected_request_hash: mine.request_hash, expected_action_hash: mine.action_hash },
    9
  )).structuredContent || {};
note(
  "a malformed receipt is refused",
  garbage.gate_passed === false && garbage.signature_valid === false,
  `${garbage.reason_code}`
);

// --- report ------------------------------------------------------------------

const failed = rows.filter((row) => row.ok === false);
console.log("проверка                                     ok");
for (const row of rows) console.log(`  ${row.check.padEnd(42)} ${row.ok ? "pass" : "FAIL"}`);
console.log(`\nвсего ${rows.length} проверок, провалов ${failed.length}\n`);
for (const row of failed) console.log(`  FAIL  ${row.check.padEnd(42)} ${row.detail}`);

process.exitCode = failed.length === 0 ? 0 : 1;
