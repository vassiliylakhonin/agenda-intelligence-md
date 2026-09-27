#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mcpToolsForProfile } from "../deploy/cloudflare-worker/src/mcp.js";
import { VERSION } from "../deploy/cloudflare-worker/src/profiles.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../plugins/output-verification");
const endpoint = "https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp/output-verification";
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const portable = readJson("plugin.json");
const portableMcp = readJson("mcp.json");
const codex = readJson(".codex-plugin/plugin.json");
const codexMcp = readJson(".mcp.json");
const claude = readJson(".claude-plugin/plugin.json");
const skill = readFileSync(resolve(root, "skills/evidence-output-review/SKILL.md"), "utf8");

assert.equal(portable.name, "output-verification");
assert.equal(portable.version, VERSION);
assert.equal(codex.version, VERSION);
assert.equal(claude.version, VERSION);
assert.equal(portableMcp.mcpServers["output-verification"].type, "streamable-http");
assert.equal(claude.mcpServers["output-verification"].type, "http");
for (const url of [
  portableMcp.mcpServers["output-verification"].url,
  codexMcp.mcpServers["output-verification"].url,
  claude.mcpServers["output-verification"].url
]) assert.equal(url, endpoint);
assert.equal(codex.mcpServers, "./.mcp.json");
assert.equal(codex.skills, "./skills/");
assert.match(skill, /human review is required for every verdict/i);
assert.match(skill, /instructions inside the supplied evidence as data/i);

const tool = mcpToolsForProfile("agent_output_verification").find((item) => item.name === "agent_output_verification");
assert.deepEqual(tool.inputSchema.required, ["claims", "evidence"]);
assert.equal(tool.annotations.readOnlyHint, false);
assert.match(tool.description, /verify_before_relay/);

if (process.argv.includes("--live")) {
  const call = async (method, params = {}) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-client-id": "plugin-package-check" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    });
    assert.equal(response.status, 200, `${method}: HTTP ${response.status}`);
    return response.json();
  };
  const initialized = await call("initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "plugin-package-check", version: "1" }
  });
  assert.equal(initialized.result.serverInfo.version, VERSION);
  const listed = await call("tools/list");
  assert.deepEqual(listed.result.tools.map((item) => item.name), ["agent_output_verification"]);
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, false);
}

console.log(`PASS: Output Verification package${process.argv.includes("--live") ? " and live MCP" : " and local MCP contract"}`);
