// Protocol-level fixture runner used by Python's full JSON Schema validator.
import { handleMcpJsonRpc, handleRequest } from "../src/index.js";
import { MCP_TOOL_CONTRACTS } from "../src/mcp-tool-contracts.js";
const log = console.log;
console.log = () => {};
const responses = [];
for (const profile of Object.keys(MCP_TOOL_CONTRACTS)) {
  const request = new Request("https://contract-test.example/mcp");
  const env = {
    AGENT_PROFILE: profile,
    VIZIER: {
      fetch: async (url) =>
        Response.json(
          url.includes("/dlp/")
            ? {
                clean: true,
                findings: [],
                receipt: "unverified-dlp-test-token",
              }
            : {
                violation: false,
                clean: true,
                aggregate_blocked_percentage: 0,
                threshold_percentage: 50,
                blocked_shareholders: [],
                reason_codes: [],
                explanation: "No disclosed blocked ownership",
              },
        ),
    },
  };
  const listing = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: "list", method: "tools/list" },
    request,
    env,
  );
  for (const tool of listing.result.tools.filter((tool) => tool.outputSchema)) {
    const args = tool._meta["com.agenda/readiness"].example_arguments;
    const result = await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: "call",
        method: "tools/call",
        params: { name: tool.name, arguments: args },
      },
      request,
      env,
    );
    responses.push({
      profile,
      tool: tool.name,
      schema: tool.outputSchema,
      payload: result.result?.structuredContent,
      isError: result.result?.isError,
    });
    // Every declared success contract must also reject malformed input without
    // presenting the refusal as a successful result.
    if (["agent_financial_pre_sign_check", "m2m_escrow_arbitration_ruling", "strategic_risk_triage", "corridor_sanctions_assistant"].includes(tool.name)) {
      const refused = await handleMcpJsonRpc({ jsonrpc: "2.0", id: "refusal", method: "tools/call",
        params: { name: tool.name, arguments: tool.name.includes("financial") || tool.name.includes("escrow") ? { request: {} } : {} }
      }, request, env);
      responses.push({ profile, tool: tool.name, scenario: "missing_input", schema: tool.outputSchema,
        payload: refused.result?.structuredContent, isError: refused.result?.isError });
    }
    const endpoint = {
      cis_secondary_sanctions_exposure: "/v1/cis-secondary-sanctions/exposure",
      dual_use_technology_export: "/v1/dual-use/technology-export",
    }[tool.name];
    if (endpoint) {
      const http = await handleRequest(
        new Request(`https://contract-test.example${endpoint}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(args),
        }),
        env,
      );
      responses.push({
        profile,
        tool: `REST ${endpoint}`,
        schema: tool.outputSchema,
        payload: await http.json(),
        isError: http.status !== 200,
      });
    }
  }
}
log(JSON.stringify(responses));
