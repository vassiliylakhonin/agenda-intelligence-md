import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.js";
import { PROFILE_REGISTRY } from "../src/profiles.js";
import { sha256Jcs } from "../src/decision-receipt.js";

const origin = "https://fleet.example.workers.dev";
async function rpc(profile, method, params = {}, extra = {}, path = "/mcp", headers = {}) {
  const response = await handleRequest(new Request(`${origin}${path}`, {
    method: "POST", headers: { "content-type": "application/json", "user-agent": "readiness-contract-test", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  }), { AGENT_PROFILE: profile, ...extra }, { waitUntil() {} });
  return { status: response.status, body: await response.json() };
}
const canonicalProfiles = [...new Set(Object.values(PROFILE_REGISTRY).filter((p) => p.profile_key !== "confidential_project_room").map((p) => p.profile_key))];
const readiness = (tool) => tool._meta["com.agenda/readiness"];

async function signer() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  jwk.kid = "readiness-test";
  return { AGENT_CARD_SIGNING_KEY: JSON.stringify(jwk), AGENT_CARD_SIGNING_KID: jwk.kid };
}

test("published first-call examples work through the HTTP MCP route for every canonical profile", async () => {
  const signing = await signer();
  for (const profile of canonicalProfiles) {
    const listing = await rpc(profile, "tools/list");
    for (const tool of listing.body.result.tools) {
      const guide = readiness(tool);
      assert.deepEqual(guide.required_arguments, tool.inputSchema.required || []);
      assert.equal(guide.example_is_synthetic, true);
      assert.equal(guide.access.pricing_url, `${origin}/.well-known/x402`);
      assert.ok(tool.description.includes("Base call: free."));
      if (tool.name === "decision_verify") {
        assert.equal(guide.example_arguments, null);
        assert.equal(guide.example_from_tool, "decision_check");
        continue;
      }
      assert.notEqual(guide.example_arguments, null, tool.name);
      const called = await rpc(profile, "tools/call", { name: tool.name, arguments: guide.example_arguments }, signing);
      assert.equal(called.status, 200, tool.name);
      assert.ok(called.body.result, `${tool.name}: ${JSON.stringify(called.body)}`);
      assert.notEqual(called.body.result.isError, true, `${tool.name}: ${JSON.stringify(called.body.result)}`);
    }
  }
});

test("discovery auth matches the actual HTTP 401 gate without leaking the configured key", async () => {
  for (const [profile, keyName] of [["kazakhstan", "MIDDLE_CORRIDOR_API_KEY"],
    ["agentic_interaction_trust", "AGENTIC_INTERACTION_TRUST_API_KEY"],
    ["cis_secondary_sanctions", "CIS_SECONDARY_SANCTIONS_API_KEY"]]) {
    const env = { [keyName]: "test-only-key" };
    const listed = await rpc(profile, "tools/list", {}, env);
    const tool = listed.body.result.tools[0];
    assert.equal(readiness(tool).access.authentication, "bearer_required");
    assert.match(tool.description, /Bearer access key is required/);
    assert.ok(!JSON.stringify(listed).includes(env[keyName]));
    const init = await rpc(profile, "initialize", {}, env);
    assert.match(init.body.result.instructions, /Bearer access key is required/);
    const params = { name: tool.name, arguments: readiness(tool).example_arguments };
    assert.equal((await rpc(profile, "tools/call", params, env)).status, 401);
    assert.equal((await rpc(profile, "tools/call", params, env, "/mcp", { authorization: "Bearer wrong-key" })).status, 401);
    const allowed = await rpc(profile, "tools/call", params, env, "/mcp", { authorization: `Bearer ${env[keyName]}` });
    assert.equal(allowed.status, 200);
    assert.notEqual(allowed.body.result.isError, true);
  }
});

test("advertised quota matches enforcement and is absent without a quota store", async () => {
  const values = new Map();
  const kv = { get: async (key) => values.get(key) ?? null, put: async (key, value) => values.set(key, value) };
  const env = { RATE_LIMIT_PER_HOUR: "1", AGENDA_USAGE: kv };
  const listed = await rpc("agenda", "tools/list", {}, env);
  const tool = listed.body.result.tools.find((t) => t.name === "fleet_directory");
  assert.equal(readiness(tool).access.quota_per_hour, 1);
  assert.match(tool.description, /HTTP 429/);
  const params = { name: tool.name, arguments: {} };
  assert.equal((await rpc("agenda", "tools/call", params, env)).status, 200);
  const rejected = await rpc("agenda", "tools/call", params, env);
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.error.data.limit_per_hour, 1);
  const noStore = await rpc("agenda", "tools/list", {}, { RATE_LIMIT_PER_HOUR: "1" });
  assert.equal(readiness(noStore.body.result.tools[0]).access.quota_per_hour, null);
  assert.equal(readiness(noStore.body.result.tools[0]).access.quota_enforcement, "not_configured");
});

test("Output Verification directs missing evidence to source collection and keeps its plugin single-tool", async () => {
  for (const path of ["/mcp", "/mcp/output-verification"]) {
    const listed = await rpc("agent_output_verification", "tools/list", {}, {}, path);
    const tool = listed.body.result.tools.find((t) => t.name === "agent_output_verification");
    assert.match(readiness(tool).next_step, /actual source text/);
    assert.ok(!tool.description.includes("corridor_sanctions_assistant"));
    const init = await rpc("agent_output_verification", "initialize", {}, {}, path);
    assert.match(init.body.result.instructions, /human review/);
    assert.match(init.body.result.instructions, /Base call: free/);
    if (path.endsWith("output-verification")) {
      assert.equal(listed.body.result.tools.length, 1);
      assert.ok(!init.body.result.instructions.includes("decision_verify"));
    }
    const refused = await rpc("agent_output_verification", "tools/call", {
      name: tool.name, arguments: { claims: [{ claim_id: "c1", claim: "Unsupported assertion", evidence_ids: ["absent"] }], evidence: [] }
    }, {}, path);
    assert.equal(refused.body.result.isError, true);
  }
});

test("pricing manifests derive identity from the registry for every profile and alias", async () => {
  for (const [alias, entry] of Object.entries(PROFILE_REGISTRY)) {
    // Project-room is a workflow page, not a standalone hosted MCP deployment.
    if (entry.profile_key === "confidential_project_room") continue;
    for (const path of ["/.well-known/x402", "/.well-known/x402.json"]) {
      const response = await handleRequest(new Request(`${origin}${path}`), { AGENT_PROFILE: entry.profile_key });
      const manifest = await response.json();
      assert.equal(manifest.title, entry.canonical_product_name, alias);
      assert.equal(manifest.x_agenda_access.pricing_url, `${origin}/.well-known/x402`);
      assert.match(manifest.pricing_scope, /availability varies by tool/);
    }
  }
});

test("receipt onboarding verifies a real signed receipt and rejects a mismatched binding", async () => {
  const env = await signer();
  const tools = (await rpc("agent_output_verification", "tools/list")).body.result.tools;
  const request = readiness(tools.find((t) => t.name === "decision_check")).example_arguments;
  const check = await rpc("agent_output_verification", "tools/call", { name: "decision_check", arguments: request }, env);
  const receipt = check.body.result.structuredContent.receipt;
  assert.ok(receipt?.token);
  // Bind to the caller's request/action, independently of the returned receipt's claims.
  const requestHash = await sha256Jcs(request);
  const actionHash = await sha256Jcs({ actor: request.actor, requested_action: request.requested_action,
    target: request.target, risk_tier: request.risk_tier });
  const args = { receipt: receipt.token, expected_request_hash: requestHash, expected_action_hash: actionHash };
  const verified = await rpc("agent_output_verification", "tools/call", { name: "decision_verify", arguments: args }, env);
  assert.equal(verified.body.result.structuredContent.signature_valid, true);
  assert.equal(verified.body.result.structuredContent.binding_matches, true);
  // The illustrative packet is not original evidence: a valid signature must not turn it into permission.
  assert.equal(verified.body.result.structuredContent.gate_passed, false);
  const wrong = await rpc("agent_output_verification", "tools/call", {
    name: "decision_verify", arguments: { ...args, expected_action_hash: `sha256:${"0".repeat(64)}` }
  }, env);
  assert.equal(wrong.body.result.structuredContent.gate_passed, false);
});

test("every hosted tool publishes a structured output contract", async () => {
  for (const profile of canonicalProfiles) {
    const listing = await rpc(profile, "tools/list");
    for (const tool of listing.body.result.tools) {
      assert.equal(tool.outputSchema?.type, "object", `${profile}/${tool.name}`);
      assert.equal(tool.outputSchema?.$schema, "https://json-schema.org/draft/2020-12/schema");
    }
  }
});
