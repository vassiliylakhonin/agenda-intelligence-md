import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest, canonicalDecisionInput, decisionRuns, checkRateLimit, buildUsageEvent } from "../src/index.js";
import { readBoundedJson } from "../src/request-body.js";
import { claimPayment, consumeProQuota, tokenHash } from "../src/payment-ledger.js";
import { provisionProBearerToken, claimTransactionSettlement } from "../src/settlement.js";
import { __resetCache as resetSnapshotCache } from "../src/upstream_snapshot.js";
import { memoryD1 } from "./helpers/d1.js";

test("REST execution aliases share deployment authorization before work", async () => {
  const env = { AGENT_PROFILE: "cis_secondary_sanctions", CIS_SECONDARY_SANCTIONS_API_KEY: "test-only-key",
    AGENDA_USAGE: { get() { throw new Error("unauthorized request reached storage"); } } };
  for (const path of ["/v1/cis-secondary-sanctions/exposure", "/v1/cis-secondary-sanctions/batch", "/v1/dual-use/screen",
    "/v1/evidence-packet/check", "/v1/corridor-bankability/screen", "/v1/settle"]) {
    for (const authorization of [undefined, "Bearer wrong"]) {
      const response = await handleRequest(new Request(`https://example.test${path}`, {
        method: "POST", headers: authorization ? { authorization } : {}, body: "{}"
      }), env);
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get("www-authenticate"), "Bearer");
    }
  }
  const control = await handleRequest(new Request("https://example.test/v1/cis-secondary-sanctions/exposure", {
    method: "POST", headers: { authorization: "Bearer test-only-key" }, body: "{}"
  }), { ...env, AGENDA_USAGE: undefined });
  assert.equal(control.status, 400, "authorized request reaches normal field validation");
});

test("chunked body is cancelled at limit without buffering remaining stream", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
  await assert.rejects(readBoundedJson(new Request("https://example.test", { method: "POST", body: stream, duplex: "half" }), 10), { status: 413 });
  assert.equal(cancelled, true);
  assert.deepEqual(await readBoundedJson(new Request("https://example.test", { method: "POST", body: '{"text":"привет"}' })), { text: "привет" });
});

test("journal distinguishes free text, profiles and execution versions", () => {
  assert.notDeepEqual(canonicalDecisionInput({ text: "first" }), canonicalDecisionInput({ text: "second" }));
  assert.notDeepEqual(canonicalDecisionInput({ prompt: "first" }), canonicalDecisionInput({ prompt: "second" }));
  const base = { journal_version: 2, agent_profile: "agenda", input_hash: "same", contract_version: "1", timestamp: "2026-10-01T00:00:00Z", status: "completed", decision: "completed" };
  assert.equal(decisionRuns([base, { ...base, agent_profile: "specialist", decision: "input_required" }]).length, 0);
  assert.equal(decisionRuns([base, { ...base, engine_version: "new" }]).length, 0);
  assert.equal(decisionRuns([base, { ...base, source_snapshot: "new" }]).length, 0);
  assert.equal(decisionRuns([base, { ...base, decision: "changed" }])[0].changed, true);
});

test("explicit verification and owner synthetic UAs are excluded signals, not identity", () => {
  for (const ua of ["Agenda-Ecosystem-Verification/1.0", "InstinctOwnerVerifySynthetic/1.0", "InstinctOwnerFeedbackSynthetic/1.0"]) {
    const event = buildUsageEvent(new Request("https://example.test/mcp", { headers: { "user-agent": ua } }), { prompt_chars: 1000 });
    assert.notEqual(event.caller_kind, "external");
    assert.equal(event.origin_verification, "unverified");
  }
});

test("empty Assistant MCP call returns its promised directory", async () => {
  const response = await handleRequest(new Request("https://example.test/mcp", {
    method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "corridor_sanctions_assistant", arguments: {} } })
  }), { AGENT_PROFILE: "corridor_sanctions_assistant", VIZIER_DISABLED: "1" });
  const body = await response.json();
  assert.equal(body.result.isError, false);
});

test("one payment has one winner and Pro quota cannot overspend", async () => {
  const env = { PAYMENT_LEDGER: memoryD1() };
  const claims = await Promise.all(Array.from({ length: 20 }, () => claimPayment(env, "0xtx", { tier: "tier_2_pro" })));
  assert.equal(claims.filter(Boolean).length, 1);
  const { token } = await provisionProBearerToken("test-payer", "0xtx", env);
  await env.PAYMENT_LEDGER.prepare("UPDATE pro_tokens SET quota = 3 WHERE token_hash = ?1").bind(await tokenHash(token)).run();
  const uses = await Promise.all(Array.from({ length: 20 }, () => consumeProQuota(token, env)));
  assert.equal(uses.filter(Boolean).length, 3);
  assert.deepEqual(uses.filter(Boolean).map(r => r.used), [1, 2, 3]);
});

test("missing atomic store cannot claim payments or issue credentials", async () => {
  assert.equal((await claimTransactionSettlement("0xtx", {}, {})).claimed, false);
  await assert.rejects(provisionProBearerToken("payer", "0xtx", {}));
});

test("Pro quota is enforced when the free limiter is disabled", async () => {
  const env = { PAYMENT_LEDGER: memoryD1() };
  await claimPayment(env, "quota-no-free-limit", {});
  const { token } = await provisionProBearerToken("payer", "quota-no-free-limit", env);
  await env.PAYMENT_LEDGER.prepare("UPDATE pro_tokens SET quota = 1 WHERE token_hash = ?1").bind(await tokenHash(token)).run();
  const req = new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await checkRateLimit(req, env, "agenda")).limited, false);
  assert.equal((await checkRateLimit(req, env, "agenda")).limited, true);
});

test("deployed task scope requires a server-issued capability, not a caller label", async () => {
  const store = new Map();
  const env = { AGENT_PROFILE: "kazakhstan", TASK_SCOPE_AUTH_REQUIRED: "1", VIZIER_DISABLED: "1", AGENDA_USAGE: {
    async get(k) { return store.get(k) || null; }, async put(k, v) { store.set(k, v); }
  } };
  const call = async (method, params, token) => (await handleRequest(new Request("https://example.test/message/send", {
    method: "POST", headers: { "content-type": "application/json", "a2a-version": "1.0", "x-client-id": "same-public-label", ...(token ? { "x-task-token": token } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  }), env)).json();
  const first = await call("SendMessage", { message: { role: "ROLE_USER", messageId: "m1", parts: [{ text: "route" }] } });
  const task = first.result.task;
  const token = task.metadata.continuation.token;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.ok(![...store.values()].join(" ").includes(token), "raw capability must not persist");
  assert.ok((await call("GetTask", { id: task.id })).error);
  assert.ok((await call("GetTask", { id: task.id }, "a".repeat(64))).error);
  assert.equal((await call("GetTask", { id: task.id }, token)).result.id, task.id);
});


test("bankability REST helper consumes Pro quota before unlocking", async () => {
  const env = { AGENT_PROFILE: "agenda", PAYMENT_LEDGER: memoryD1() };
  await claimPayment(env, "bankability-quota", {});
  const { token } = await provisionProBearerToken("payer", "bankability-quota", env);
  await env.PAYMENT_LEDGER.prepare("UPDATE pro_tokens SET quota = 1 WHERE token_hash = ?1").bind(await tokenHash(token)).run();
  const call = async () => (await handleRequest(new Request("https://example.test/v1/corridor-bankability/screen", {
    method: "POST", headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ project_name: "Synthetic", corridor_leg: "Aktau-Baku", capex_usd_m: 10, ifi_debt_usd_m: 5, dscr_min: 1.5 })
  }), env)).json();
  assert.equal((await call()).unlocked_full_dossier, true);
  assert.equal((await call()).unlocked_full_dossier, false);
});


test("dependency health distinguishes current, stale and future snapshots", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const env = { SNAPSHOT_INDEX_URL: "https://example.test/index.json", SNAPSHOT_MAX_AGE_HOURS: "72" };
    for (const hours of [1, 73, -1]) {
      resetSnapshotCache();
      globalThis.fetch = async () => Response.json({ schema_version: "sanctions-name-index-compact.v1",
        generated_at_utc: new Date(Date.now() - hours * 3600000).toISOString(),
        summary: { source_count: 1, name_count: 1 }, src: [["US OFAC", "SDN"]], entries: [["SYNTHETIC TEST ENTITY", 0]] });
      const response = await handleRequest(new Request("https://example.test/health/dependencies"), env);
      assert.equal(response.status, hours === 1 ? 200 : 503);
      const data = await response.json();
      assert.equal(data.snapshot.status, hours === 1 ? "success" : "stale");
      assert.match(data.snapshot.digest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(data.snapshot.max_age_ms, 72 * 3600000);
    }
  } finally { globalThis.fetch = originalFetch; resetSnapshotCache(); }
});


test("REST escrow pricing follows the operation while auth follows the host", async () => {
  const env = { AGENT_PROFILE: "cis_secondary_sanctions", CIS_SECONDARY_SANCTIONS_API_KEY: "synthetic-host-key",
    RATE_LIMIT_PER_HOUR: "1", AGENDA_USAGE: { async get() { return "1"; }, async put() {} } };
  const response = await handleRequest(new Request("https://example.test/v1/m2m-escrow/evaluate-dispute", {
    method: "POST", headers: { authorization: "Bearer synthetic-host-key" }, body: "{}"
  }), env);
  assert.equal(response.status, 402);
  const body = await response.json();
  assert.equal(body.x402.profile, "m2m_escrow_arbiter");
  assert.equal(body.x402.amount_usdc, 0.5);
});
