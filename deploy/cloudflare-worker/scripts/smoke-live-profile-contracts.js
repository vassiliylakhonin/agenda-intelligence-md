import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cardExtensionParams } from "../src/card-extension.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const workerSubdomain = process.env.WORKERS_SUBDOMAIN || "vassiliy-lakhonin";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function origin(workerName) {
  return `https://${workerName}.${workerSubdomain}.workers.dev`;
}

function rpcBody(id, capability, requestPath) {
  return {
    jsonrpc: "2.0",
    id,
    method: "message/send",
    params: {
      capability,
      request: readJson(requestPath)
    }
  };
}

const cases = [
  {
    name: "middle-corridor",
    baseUrl: origin("middle-corridor-deal-risk-gate-a2a"),
    expectedCardProfile: "middle_corridor_deal_risk",
    expectedContractProfile: "middle_corridor_deal_risk",
    body: readJson("examples/a2a/middle-corridor-deal-risk.request.json"),
    extractResponse: (json) => json.result?.metadata?.triage?.deal_risk_contract
  },
  {
    name: "cis-secondary-sanctions",
    baseUrl: origin("cis-secondary-sanctions-a2a"),
    expectedCardProfile: "cis_secondary_sanctions",
    expectedContractProfile: "cis_secondary_sanctions",
    body: rpcBody(
      "smoke-cis",
      "cis_secondary_sanctions",
      "examples/cis-secondary-sanctions/contract/escalate_before_onboarding.request.json"
    ),
    extractResponse: (json) => json.result?.metadata?.response
  },
  {
    name: "agentic-interaction-trust",
    baseUrl: origin("agentic-interaction-trust-a2a"),
    expectedCardProfile: "agentic_interaction_trust",
    expectedContractProfile: "agentic_interaction_trust",
    body: rpcBody(
      "smoke-agentic",
      "agentic_interaction_trust",
      "examples/agentic-interaction-trust/contract/checkout_step_up.request.json"
    ),
    extractResponse: (json) => json.result?.metadata?.response
  },
  {
    name: "gulf-maritime-exposure",
    baseUrl: origin("gulf-maritime-exposure-a2a"),
    expectedCardProfile: "gulf_maritime_exposure",
    expectedContractProfile: "gulf_maritime_exposure",
    body: rpcBody(
      "smoke-gulf",
      "gulf_maritime_exposure",
      "examples/gulf-maritime-exposure/contract/escalate_before_fixture.request.json"
    ),
    extractResponse: (json) => json.result?.metadata?.response
  },
  {
    name: "market-entry-readiness",
    baseUrl: origin("kazakhstan-market-entry-readiness-a2a"),
    expectedCardProfile: "kazakhstan_market_entry_readiness",
    expectedContractProfile: "kazakhstan_market_entry_readiness",
    body: rpcBody(
      "smoke-market",
      "market_entry_readiness",
      "examples/kazakhstan-market-entry-readiness/contract/pre_signature_validation.request.json"
    ),
    extractResponse: (json) => json.result?.metadata?.response
  },
  {
    name: "critical-minerals-due-diligence",
    baseUrl: origin("critical-minerals-due-diligence-a2a"),
    expectedCardProfile: "critical_minerals_due_diligence",
    expectedContractProfile: "critical_minerals_due_diligence",
    body: rpcBody(
      "smoke-minerals",
      "critical_minerals_due_diligence",
      "examples/critical-minerals-due-diligence/contract/pre_signature_escalate.request.json"
    ),
    extractResponse: (json) => json.result?.metadata?.response
  }
];

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

for (const testCase of cases) {
  const card = await fetchJson(`${testCase.baseUrl}/.well-known/agent-card.json`, {
    headers: { "user-agent": "agenda-intelligence-live-smoke" }
  });
  assertEqual(
    cardExtensionParams(card)?.x_agenda_intelligence?.product_profile,
    testCase.expectedCardProfile,
    `${testCase.name} agent-card profile`
  );

  const rpc = await fetchJson(`${testCase.baseUrl}/message/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "agenda-intelligence-live-smoke"
    },
    body: JSON.stringify(testCase.body)
  });
  if (rpc.error) {
    throw new Error(`${testCase.name} JSON-RPC error: ${JSON.stringify(rpc.error)}`);
  }

  const response = testCase.extractResponse(rpc);
  const contract = response?.readiness_contract;
  if (!contract) {
    throw new Error(`${testCase.name}: missing readiness_contract`);
  }
  assertEqual(contract.profile, testCase.expectedContractProfile, `${testCase.name} readiness_contract.profile`);
  if (!contract.status) {
    throw new Error(`${testCase.name}: readiness_contract.status is empty`);
  }

  console.log(`${testCase.name}: ok profile=${contract.profile} status=${contract.status} score=${contract.score}`);
}
