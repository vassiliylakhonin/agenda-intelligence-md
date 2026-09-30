import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputPath = resolve(scriptDirectory, "../src/mcp-tool-contracts.js");

const contractSources = [
  {"profile": "agenda", "tool": "strategic_risk_triage", "output": "schemas/v1/strategic-risk-triage-response.schema.json"},
  {"profile": "agenda", "tool": "fleet_directory", "output": "schemas/v1/fleet-directory-response.schema.json"},
  {"profile": "corridor_sanctions_assistant", "tool": "corridor_sanctions_assistant", "output": "schemas/v1/corridor-orientation-response.schema.json"},
  {"profile": "agent_financial_guard", "tool": "agent_financial_pre_sign_check", "output": "schemas/v1/agent-financial-guard-response.schema.json", "legacyEnvelope": true},
  {"profile": "m2m_escrow_arbiter", "tool": "m2m_escrow_arbitration_ruling", "output": "schemas/v1/m2m-escrow-arbiter-response.schema.json", "legacyEnvelope": true},
  {
    profile: "kazakhstan",
    tool: "middle_corridor_deal_risk",
    input: "schemas/v1/middle-corridor-deal-risk-request.schema.json",
    output: "schemas/v1/middle-corridor-deal-risk-response.schema.json"
  },
  {
    profile: "cis_secondary_sanctions",
    tool: "cis_secondary_sanctions_exposure",
    input: "schemas/v1/cis-secondary-sanctions-request.schema.json",
    output: "schemas/v1/cis-secondary-sanctions-response.schema.json"
  },
  {
    profile: "cis_secondary_sanctions",
    tool: "cis_secondary_sanctions_batch",
    input: "schemas/v1/cis-secondary-sanctions-batch-request.schema.json",
    output: "schemas/v1/cis-secondary-sanctions-batch-response.schema.json"
  },
  {
    profile: "agentic_interaction_trust",
    tool: "agentic_interaction_trust",
    input: "schemas/v1/agentic-interaction-trust-request.schema.json",
    output: "schemas/v1/agentic-interaction-trust-response.schema.json"
  },
  {
    profile: "agent_output_verification",
    tool: "agent_output_verification",
    input: "schemas/v1/evidence-audit.schema.json",
    output: "schemas/v1/agent-output-verification-response.schema.json"
  },
  {
    profile: "agent_output_verification",
    tool: "pre_action_check",
    input: "schemas/v1/pre-action-check-request.schema.json",
    output: "schemas/v1/pre-action-check-response.schema.json"
  },
  {
    profile: "agent_output_verification",
    tool: "decision_policies_list",
    input: "schemas/v1/decision-policies-list-request.schema.json",
    output: "schemas/v1/decision-policies-list-response.schema.json"
  },
  {
    profile: "agent_output_verification",
    tool: "decision_check",
    input: "schemas/v1/pre-action-check-request.schema.json",
    output: "schemas/v1/pre-action-check-response.schema.json"
  },
  {
    profile: "agent_output_verification",
    tool: "decision_verify",
    input: "schemas/v1/decision-receipt-verify-request.schema.json",
    output: "schemas/v1/decision-receipt-verify-response.schema.json"
  },
  {
    profile: "gulf_maritime_exposure",
    tool: "gulf_maritime_exposure",
    input: "schemas/v1/gulf-maritime-exposure-request.schema.json",
    output: "schemas/v1/gulf-maritime-exposure-response.schema.json"
  },
  {
    profile: "market_entry_readiness",
    tool: "kazakhstan_market_entry_readiness",
    input: "schemas/v1/market-entry-readiness-request.schema.json",
    output: "schemas/v1/market-entry-readiness-response.schema.json"
  },
  {
    profile: "critical_minerals_due_diligence",
    tool: "critical_minerals_due_diligence",
    input: "schemas/v1/critical-minerals-due-diligence-request.schema.json",
    output: "schemas/v1/critical-minerals-due-diligence-response.schema.json"
  },
  {
    profile: "dual_use_technology_export",
    tool: "dual_use_technology_export",
    input: "schemas/v1/dual-use-technology-export-request.schema.json",
    output: "schemas/v1/dual-use-technology-export-response.schema.json"
  },
  {
    profile: "corridor_sanctions_assistant",
    tool: "screen_dual_use_hs_code",
    input: "schemas/v1/screen-dual-use-hs-code-request.schema.json",
    output: "schemas/v1/screen-dual-use-hs-code-response.schema.json"
  }
];

function schema(relativePath) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

// Legacy request wrappers return the existing A2A task envelope. Describe both
// response forms without changing the input contract or dispatcher behavior.
function legacyOutputSchema(response) {
  const embedded = structuredClone(response);
  delete embedded.$id;
  return {
    $schema: response.$schema,
    title: `${response.title}McpCompatibility`,
    type: "object",
    anyOf: [embedded, {
      type: "object",
      required: ["id", "status", "artifacts", "metadata"],
      properties: {
        id: { type: "string" },
        status: { type: "object", required: ["state"], properties: { state: { type: "string" } } },
        artifacts: { type: "array", items: { type: "object" } },
        metadata: { type: "object", required: ["response", "human_review_required"], properties: {
          response: embedded,
          human_review_required: { const: true }
        } }
      }
    }]
  };
}

function generatedContracts() {
  const contracts = {};
  for (const source of contractSources) {
    contracts[source.profile] ||= {};
    contracts[source.profile][source.tool] = {
      ...(source.input ? { inputSchema: schema(source.input) } : {}),
      outputSchema: source.legacyEnvelope ? legacyOutputSchema(schema(source.output)) : schema(source.output)
    };
  }
  return contracts;
}

function render() {
  return [
    "// Generated by scripts/generate-mcp-tool-contracts.js from schemas/v1.",
    "// Do not edit this file by hand; run `npm run generate:mcp-contracts`.",
    "",
    `export const MCP_TOOL_CONTRACTS = Object.freeze(${JSON.stringify(generatedContracts(), null, 2)});`,
    ""
  ].join("\n");
}

const expected = render();
if (process.argv.includes("--check")) {
  let actual = "";
  try {
    actual = readFileSync(outputPath, "utf8");
  } catch (_error) {
    // A missing generated file is ordinary drift and is reported below.
  }
  if (actual !== expected) {
    console.error("src/mcp-tool-contracts.js is stale; run `npm run generate:mcp-contracts`.");
    process.exitCode = 1;
  }
} else {
  writeFileSync(outputPath, expected);
}
