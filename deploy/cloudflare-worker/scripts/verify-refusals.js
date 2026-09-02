#!/usr/bin/env node
// The refusal side of the public matrix.
//
//   npm run verify:refusals
//
// `verify:public-agents` proves a gate answers a request it accepts. This
// proves what it does with the requests it does not: an empty call, an object
// of the wrong shape, a tool that does not exist. That is the path almost every
// caller actually takes first — measured over the 72h to 2026-09-02, the fleet
// took 18,048 tools/list calls and one genuine tools/call — and until it was
// swept end to end it drifted per gate. Two of ten answered an empty A2A
// message with TASK_STATE_FAILED against ADR 0026, and the front door declared
// a required argument it answered happily without.
//
// The round-trip check is the one worth keeping honest: it takes the
// example_request out of a gate's own refusal and sends it straight back. If
// that does not succeed, the guidance is sending callers round a loop.
//
// Read-only against production. No key required.

const SUB = "vassiliy-lakhonin";
const GATES = [
  ["agenda-intelligence-a2a", "strategic_risk_triage"],
  ["corridor-sanctions-assistant-a2a", "corridor_sanctions_assistant"],
  ["cis-secondary-sanctions-a2a", "cis_secondary_sanctions_exposure"],
  ["agentic-interaction-trust-a2a", "agentic_interaction_trust"],
  ["gulf-maritime-exposure-a2a", "gulf_maritime_exposure"],
  ["critical-minerals-due-diligence-a2a", "critical_minerals_due_diligence"],
  ["dual-use-technology-export-a2a", "dual_use_technology_export"],
  ["kazakhstan-market-entry-readiness-a2a", "kazakhstan_market_entry_readiness"],
  ["middle-corridor-deal-risk-gate-a2a", "middle_corridor_deal_risk"],
  ["agent-output-verification-a2a", "agent_output_verification"]
];
const FREE_TEXT = new Set(["strategic_risk_triage", "corridor_sanctions_assistant"]);
const H = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" };
const post = async (url, body, headers = H) => {
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const rows = [];
const note = (gate, check, ok, detail = "") => rows.push({ gate, check, ok, detail });

for (const [w, tool] of GATES) {
  const base = `https://${w}.${SUB}.workers.dev`;
  const mcp = `${base}/mcp`;

  const init = await post(mcp, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "audit", version: "1" } } });
  note(w, "initialize", init.json?.result?.protocolVersion === "2025-06-18", `status=${init.status}`);

  const list = await post(mcp, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const tools = list.json?.result?.tools || [];
  note(w, "tools/list", tools.length > 0, `${tools.length} tools`);
  note(w, "schemas present", tools.every((t) => t.inputSchema && t.description), "");
  // The free-text tools publish no output contract: their answer is a routing
  // note, and committing to a schema for it is a product decision nobody has
  // taken. Recorded, not failed.
  const noOutput = tools.filter((t) => !t.outputSchema).map((t) => t.name);
  note(w, "outputSchema", FREE_TEXT.has(tool) ? null : noOutput.length === 0, noOutput.join(",") || "all tools");

  const empty = await post(mcp, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: tool, arguments: {} } });
  const er = empty.json?.result;
  const sc = er?.structuredContent || {};
  const isFrontDoor = tool === "corridor_sanctions_assistant";
  note(w, "empty call refused", isFrontDoor ? er?.isError === false : er?.isError === true, isFrontDoor ? "front door answers by design" : `isError=${er?.isError} ${sc.error || ""}`);
  const guide = Array.isArray(sc.required_fields) && sc.required_fields.length > 0;
  note(w, "refusal names fields", isFrontDoor ? true : guide, guide ? `${sc.required_fields.length} fields` : "none");

  if (sc.example_request) {
    const rt = await post(mcp, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: tool, arguments: sc.example_request } });
    note(w, "round-trip example", rt.json?.result?.isError === false, `isError=${rt.json?.result?.isError}`);
  } else note(w, "round-trip example", null, isFrontDoor ? "n/a" : "no example in refusal");

  const bogus = await post(mcp, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "no_such_tool_xyz", arguments: {} } });
  note(w, "unknown tool", Boolean(bogus.json?.error) || bogus.json?.result?.isError === true, bogus.json?.error ? `jsonrpc error ${bogus.json.error.code}` : `isError=${bogus.json?.result?.isError}`);

  const wrongType = await post(mcp, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: tool, arguments: { text: 12345, request: "not-an-object" } } });
  // The front door declares additionalProperties and no required argument on
  // purpose: it is where every other gate's refusal sends an empty-handed
  // caller, so it must answer whatever arrives.
  const rejectedBad = wrongType.json?.result?.isError === true || Boolean(wrongType.json?.error);
  note(w, "wrong-typed args", isFrontDoor ? rejectedBad === false : rejectedBad, `isError=${wrongType.json?.result?.isError}`);

  const card = await get(`${base}/.well-known/agent-card.json`);
  note(w, "agent card", card.status === 200 && Array.isArray(card.json?.signatures) && card.json.signatures.length > 0, `status=${card.status} sig=${card.json?.signatures?.length ?? 0}`);
  const jwks = await get(`${base}/.well-known/jwks.json`);
  note(w, "jwks", jwks.status === 200 && (jwks.json?.keys?.length ?? 0) > 0, `keys=${jwks.json?.keys?.length ?? 0}`);
  const health = await get(`${base}/health`);
  note(w, "health", health.status === 200, `status=${health.status}`);

  const a2aEmpty = await post(`${base}/message/send`, { jsonrpc: "2.0", id: 7, method: "message/send", params: { message: { role: "user", messageId: "a1", parts: [] } } }, { "content-type": "application/json" });
  const st = a2aEmpty.json?.result?.status?.state;
  note(w, "A2A empty -> INPUT_REQUIRED", st === "TASK_STATE_INPUT_REQUIRED" || (isFrontDoor && st === "TASK_STATE_COMPLETED"), `${st}`);
}
const bad = rows.filter((r) => r.ok === false);
const skipped = rows.filter((r) => r.ok === null);
const byCheck = new Map();
for (const r of rows) { const m = byCheck.get(r.check) || { pass: 0, fail: 0 }; r.ok === true ? m.pass++ : r.ok === false ? m.fail++ : 0; byCheck.set(r.check, m); }
console.log("проверка                         pass fail");
for (const [k, v] of byCheck) console.log(`  ${k.padEnd(30)} ${String(v.pass).padStart(4)} ${String(v.fail).padStart(4)}`);
console.log(`\nвсего ${rows.length} проверок, провалов ${bad.length}, пропущено ${skipped.length}\n`);
for (const r of bad) console.log(`  FAIL  ${r.gate.replace("-a2a", "").padEnd(36)} ${r.check.padEnd(28)} ${r.detail}`);
for (const r of skipped) console.log(`  SKIP  ${r.gate.replace("-a2a", "").padEnd(36)} ${r.check.padEnd(28)} ${r.detail}`);

process.exitCode = bad.length === 0 ? 0 : 1;
