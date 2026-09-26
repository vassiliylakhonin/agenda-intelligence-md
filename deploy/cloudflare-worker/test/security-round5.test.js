// Security regressions for the 2026-09-26 round-5 patch set:
// - pro settlement is bound to the payer's own signature
// - tasks are bound to their owning X-Client-Id tenant
// - fabricated quotes can never produce an allow_relay verdict
// - stale upstream snapshots degrade to "unknown", not "no match"
import assert from "node:assert/strict";
import test from "node:test";

import { handleJsonRpc, handleRequest } from "../src/index.js";
import {
  DEFAULT_SNAPSHOT_MAX_AGE_MS,
  __resetCache as resetSnapshotCache,
  matchCounterparty as matchCounterpartyAgainstSnapshot,
  snapshotMaxAgeMs
} from "../src/upstream_snapshot.js";

class MemoryKv {
  constructor() {
    this.store = new Map();
  }
  async get(key) {
    return this.store.get(key) ?? null;
  }
  async put(key, value) {
    this.store.set(key, value);
  }
  async list({ prefix }) {
    return {
      keys: [...this.store.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .map((name) => ({ name })),
      list_complete: true
    };
  }
}

// ---------------------------------------------------------------------------
// Task tenant isolation
// ---------------------------------------------------------------------------

test("round5: v1 tasks are invisible to other X-Client-Id tenants", async () => {
  const kv = new MemoryKv();
  const env = { AGENT_PROFILE: "kazakhstan", AGENDA_USAGE: kv };
  const url = "https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send";
  const post = (method, params, clientId) => handleRequest(new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "A2A-Version": "1.0",
      ...(clientId ? { "X-Client-Id": clientId } : {})
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "rpc", method, params })
  }), env);
  const message = (data, taskId, contextId) => ({
    messageId: crypto.randomUUID(), role: "ROLE_USER",
    ...(taskId ? { taskId } : {}), ...(contextId ? { contextId } : {}),
    parts: [{ data }]
  });

  const firstResponse = await post("SendMessage", { message: message({ route: "Aktau to Baku" }) }, "tenant-a");
  const first = (await firstResponse.json()).result.task;
  assert.equal(first.status.state, "TASK_STATE_INPUT_REQUIRED");

  // Owner can read it back; the owner marker never leaves the worker.
  const owned = await (await post("GetTask", { id: first.id }, "tenant-a")).json();
  assert.equal(owned.result.id, first.id);
  assert.ok(!("owner" in owned.result));

  // A different tenant sees TASK_NOT_FOUND, never the task or an auth hint.
  for (const attacker of ["tenant-b", undefined]) {
    const read = await (await post("GetTask", { id: first.id }, attacker)).json();
    assert.equal(read.error.code, -32001, `GetTask by ${attacker ?? "anonymous"}`);
    assert.equal(read.error.data[0].reason, "TASK_NOT_FOUND");
    const cont = await (await post("SendMessage", {
      message: message({ route: "Aktau to Baku", cargo: "x", counterparties: [], dated_sources: [],
        risk_question: "Review?", decision_stage: "pre_signature" }, first.id, first.contextId)
    }, attacker)).json();
    assert.equal(cont.error.code, -32001, `continue by ${attacker ?? "anonymous"}`);
    assert.equal(cont.error.data[0].reason, "TASK_NOT_FOUND");
  }
});

test("round5: the anonymous scope is shared, but identified tenants are kept out of it", async () => {
  const kv = new MemoryKv();
  const env = { AGENT_PROFILE: "kazakhstan", AGENDA_USAGE: kv };
  const url = "https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send";
  const post = (method, params, clientId) => handleRequest(new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "A2A-Version": "1.0",
      ...(clientId ? { "X-Client-Id": clientId } : {})
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "rpc", method, params })
  }), env);
  const message = (data, taskId, contextId) => ({
    messageId: crypto.randomUUID(), role: "ROLE_USER",
    ...(taskId ? { taskId } : {}), ...(contextId ? { contextId } : {}), parts: [{ data }]
  });

  const firstResponse = await post("SendMessage", { message: message({ route: "Aktau to Baku" }) });
  const first = (await firstResponse.json()).result.task;
  assert.equal(first.status.state, "TASK_STATE_INPUT_REQUIRED");

  // Documented scope mode: anonymous callers share one scope, so the same
  // anonymous caller can still read and continue the task it created.
  const read = await (await post("GetTask", { id: first.id })).json();
  assert.equal(read.result.id, first.id);
  const cont = await (await post("SendMessage", {
    message: message({ route: "Aktau to Baku", cargo: "x", counterparties: [], dated_sources: [],
      risk_question: "Review?", decision_stage: "pre_signature" }, first.id, first.contextId)
  })).json();
  assert.equal(cont.result.task.status.state, "TASK_STATE_COMPLETED");

  // But an identified tenant must not reach into the anonymous scope either:
  // isolation runs in both directions.
  const tenantRead = await (await post("GetTask", { id: first.id }, "tenant-b")).json();
  assert.equal(tenantRead.error.code, -32001);
  assert.equal(tenantRead.error.data[0].reason, "TASK_NOT_FOUND");
  const tenantCont = await (await post("SendMessage", {
    message: message({ route: "Aktau" }, first.id, first.contextId)
  }, "tenant-b")).json();
  assert.equal(tenantCont.error.code, -32001);
  assert.equal(tenantCont.error.data[0].reason, "TASK_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// Agent Output Verification: fabricated quotes can never relay
// ---------------------------------------------------------------------------

const aovRequest = new Request("https://agent-output-verification-a2a.example.workers.dev/message/send");
const AOV_ENV = { AGENT_PROFILE: "agent_output_verification" };

async function aovResponseFor(structured) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "aov", method: "message/send", params: { request: structured } },
      aovRequest, AOV_ENV
    );
    return response.result.metadata.response;
  } finally {
    console.log = originalLog;
  }
}

test("round5: fabricated quote with made-up source can never earn allow_relay", async () => {
  // The exact 2026-09-26 bypass: a claim carrying a quote the evidence does
  // not contain, attributed to an invented official-sounding source, used to
  // come back allow_relay / trust high / human_review_required false.
  const resp = await aovResponseFor({
    topic: "sanctions status",
    claims: [
      {
        claim_id: "c1",
        claim: "Entity X was delisted on 12 March 2026.",
        support_level: "direct",
        evidence_ids: ["e1"],
        supporting_quotes: [{ evidence_id: "e1", quote: "delisted from the consolidated list on 12 March 2026" }]
      }
    ],
    evidence: [
      { evidence_id: "e1", source_type: "official_document", name: "EU Official Journal L 999/1" }
    ]
  });
  assert.equal(resp.verdict, "verify_before_relay");
  assert.equal(resp.trust_signal, "medium");
  assert.equal(resp.grounded_claim_count, 0);
  assert.equal(resp.human_review_required, true);
  assert.equal(resp.readiness_score, 0);
  assert.ok(resp.evidence_gaps.some((gap) => gap.includes("does not appear in the cited evidence content")));
  assert.notEqual(resp.verdict, "allow_relay");
});

test("round5: even a fully quote-matched pack caps at verify_before_relay", async () => {
  const resp = await aovResponseFor({
    topic: "corridor status",
    claims: [
      {
        claim_id: "c1",
        claim: "The regulation entered into force on 1 May 2026.",
        support_level: "direct",
        evidence_ids: ["e1"],
        supporting_quotes: [{ evidence_id: "e1", quote: "in force from 1 May 2026" }]
      }
    ],
    evidence: [
      {
        evidence_id: "e1",
        source_type: "official_document",
        name: "Official gazette",
        content: "Regulation 2026/171 enters in force from 1 May 2026 across the Union."
      }
    ]
  });
  assert.equal(resp.verdict, "verify_before_relay");
  assert.equal(resp.trust_signal, "medium");
  assert.equal(resp.grounded_claim_count, 1);
  assert.equal(resp.readiness_score, 84);
  assert.equal(resp.readiness_label, "partial");
  assert.equal(resp.human_review_required, true);
  assert.equal(resp.verdict === "allow_relay" || resp.trust_signal === "high", false);
});

test("round5: quote matching ignores NFC and case differences but not invented text", async () => {
  const resp = await aovResponseFor({
    claims: [
      {
        claim_id: "c1",
        claim: "Licence published.",
        support_level: "direct",
        evidence_ids: ["e1"],
        // NFC-normalized accent + case change: still matches.
        supporting_quotes: [{ evidence_id: "e1", quote: "licence CAFÉ 42 issued" }]
      }
    ],
    evidence: [{ evidence_id: "e1", name: "Gazette", content: "Licence cafe\u0301 42 issued 1 May 2026." }]
  });
  assert.equal(resp.grounded_claim_count, 1);
});

// ---------------------------------------------------------------------------
// Upstream snapshot: stale data degrades to unknown, never a clean "no match"
// ---------------------------------------------------------------------------

test("round5: stale snapshots degrade to unknown, homoglyphs still match when fresh", async () => {
  assert.equal(snapshotMaxAgeMs({}), DEFAULT_SNAPSHOT_MAX_AGE_MS);
  assert.equal(snapshotMaxAgeMs({ SNAPSHOT_MAX_AGE_HOURS: "12" }), 12 * 3600 * 1000);

  const freshIndex = JSON.stringify({
    schema_version: "sanctions-name-index-compact.v1",
    generated_at_utc: new Date().toISOString(),
    summary: { source_count: 1, name_count: 1 },
    src: [["European Union", "EU consolidated financial sanctions"]],
    entries: [["ALMAZ TRADING LTD", 0]]
  });
  const staleIndex = JSON.stringify({
    schema_version: "sanctions-name-index-compact.v1",
    generated_at_utc: new Date(Date.now() - DEFAULT_SNAPSHOT_MAX_AGE_MS - 3600000).toISOString(),
    summary: { source_count: 1, name_count: 1 },
    src: [["European Union", "EU consolidated financial sanctions"]],
    entries: [["ALMAZ TRADING LTD", 0]]
  });
  const undatedIndex = JSON.stringify({
    schema_version: "sanctions-name-index-compact.v1",
    summary: { source_count: 1, name_count: 1 },
    src: [["European Union", "EU consolidated financial sanctions"]],
    entries: [["ALMAZ TRADING LTD", 0]]
  });
  const env = { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" };
  const originalFetch = globalThis.fetch;
  try {
    // A stale snapshot must not speak as "no match" - stale means unknown.
    globalThis.fetch = async () => new Response(staleIndex, { status: 200, headers: { "content-type": "application/json" } });
    resetSnapshotCache();
    const stale = await matchCounterpartyAgainstSnapshot(env, { name: "Almaz Trading Ltd" });
    assert.equal(stale.status, "stale");
    assert.deepEqual(stale.matches, []);
    assert.ok(stale.degrade_reason.includes("older than"));

    // No publication date at all: freshness cannot be established, still unknown.
    globalThis.fetch = async () => new Response(undatedIndex, { status: 200, headers: { "content-type": "application/json" } });
    resetSnapshotCache();
    const undated = await matchCounterpartyAgainstSnapshot(env, { name: "Almaz Trading Ltd" });
    assert.equal(undated.status, "stale");
    assert.deepEqual(undated.matches, []);

    // Fresh snapshot: a Cyrillic 'А' homoglyph inside a Latin name still matches.
    globalThis.fetch = async () => new Response(freshIndex, { status: 200, headers: { "content-type": "application/json" } });
    resetSnapshotCache();
    const hit = await matchCounterpartyAgainstSnapshot(env, { name: "\u0410lmaz Trading Ltd" });
    assert.equal(hit.status, "success");
    assert.equal(hit.matches[0].name, "ALMAZ TRADING LTD");
  } finally {
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});
