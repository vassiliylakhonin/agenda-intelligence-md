#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const DEFAULT_AGENT_CARD_URLS = [
  "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://vassiliylakhonin.github.io/.well-known/agent-card.json"
];

function agentCardUrl(value) {
  const url = new URL(value);
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/.well-known/agent-card.json";
  }
  return url.toString();
}

function hasBoundary(card, expected) {
  const boundaries = card?.x_agenda_intelligence?.boundaries;
  return Array.isArray(boundaries) && boundaries.includes(expected);
}

const PROFILE_EXPECTATIONS = [
  {
    host: "cis-secondary-sanctions-a2a",
    name: "CIS Secondary-Sanctions Exposure",
    profile: "cis_secondary_sanctions",
    skill: "cis-secondary-sanctions-exposure"
  },
  {
    host: "gulf-maritime-exposure-a2a",
    name: "Gulf Maritime Exposure Gate",
    profile: "gulf_maritime_exposure",
    skill: "gulf-maritime-exposure"
  },
  {
    host: "kazakhstan-market-entry-readiness-a2a",
    name: "Kazakhstan Market-Entry Readiness Gate",
    profile: "kazakhstan_market_entry_readiness",
    skill: "kazakhstan-market-entry-readiness"
  },
  {
    host: "agent-output-verification-a2a",
    name: "Agent Output Verification",
    profile: "agent_output_verification",
    skill: "agent-output-verification"
  },
  {
    host: "corridor-sanctions-assistant-a2a",
    name: "Corridor & Sanctions Risk Assistant",
    profile: "corridor_sanctions_assistant",
    skill: "corridor-sanctions-orientation"
  }
];

function validateProfileExpectation(card, sourceUrl) {
  const expectation = PROFILE_EXPECTATIONS.find(
    (entry) => sourceUrl.includes(entry.host) || card.name === entry.name
  );
  if (!expectation) return [];
  const errors = [];
  if (card.name !== expectation.name) errors.push(`expected name=${expectation.name}`);
  if (card?.x_agenda_intelligence?.product_profile !== expectation.profile) {
    errors.push(`expected x_agenda_intelligence.product_profile=${expectation.profile}`);
  }
  if (!card.skills.some((skill) => skill.id === expectation.skill)) {
    errors.push(`expected ${expectation.skill} skill`);
  }
  if (expectation.profile === "agent_output_verification") {
    for (const skillId of ["pre-action-check", "evidence-gap-analysis"]) {
      if (!card.skills.some((skill) => skill.id === skillId)) {
        errors.push(`expected ${skillId} skill`);
      }
    }
  }
  return errors;
}

function validateAgendaCard(card) {
  const errors = [];
  if (card.name !== "Agenda Intelligence MD") {
    errors.push(`expected Agenda Intelligence MD name, got ${JSON.stringify(card.name)}`);
  }
  if (card?.x_agenda_intelligence?.hosted_wrapper !== true) {
    errors.push("expected x_agenda_intelligence.hosted_wrapper=true");
  }
  if (card?.x_agenda_intelligence?.mcp?.server_command !== "agenda-intelligence-mcp") {
    errors.push("expected MCP server command agenda-intelligence-mcp");
  }
  if (!Array.isArray(card.skills) || !card.skills.some((skill) => skill.id === "agenda-audit-claims")) {
    errors.push("expected agenda-audit-claims skill");
  }
  return errors;
}

function validateMiddleCorridorCard(card) {
  const errors = [];
  if (card.name !== "Kazakhstan / Middle Corridor Deal Risk Gate") {
    errors.push(`expected Kazakhstan / Middle Corridor Deal Risk Gate name, got ${JSON.stringify(card.name)}`);
  }
  if (card?.x_agenda_intelligence?.product_profile !== "middle_corridor_deal_risk") {
    errors.push("expected x_agenda_intelligence.product_profile=middle_corridor_deal_risk");
  }
  if (card?.x_agenda_intelligence?.canonical_product_name !== "Kazakhstan / Middle Corridor Deal Risk Gate") {
    errors.push("expected canonical product name");
  }
  const contract = card?.x_agenda_intelligence?.product_contract;
  if (contract?.canonical_input_mode !== "structured_json") {
    errors.push("expected product_contract.canonical_input_mode=structured_json");
  }
  if (!String(contract?.request_schema || "").includes("middle-corridor-deal-risk-request.schema.json")) {
    errors.push("expected Middle Corridor request schema URL");
  }
  if (!String(contract?.response_schema || "").includes("middle-corridor-deal-risk-response.schema.json")) {
    errors.push("expected Middle Corridor response schema URL");
  }
  if (!String(contract?.source_taxonomy || "").includes("middle-corridor-deal-risk.json")) {
    errors.push("expected Middle Corridor source taxonomy URL");
  }
  const requiredBeforeGo = card?.x_agenda_intelligence?.required_before_go;
  if (!Array.isArray(requiredBeforeGo) || !requiredBeforeGo.includes("beneficial_ownership_source")) {
    errors.push("expected beneficial_ownership_source in required_before_go");
  }
  if (!String(card?.x_agenda_intelligence?.not_advice_notice || "").includes("Not legal")) {
    errors.push("expected non-advice notice");
  }
  if (!hasBoundary(card, "No approval, clearance, authorization, or final decision.")) {
    errors.push("expected no-approval boundary");
  }
  if (!Array.isArray(card.skills) || !card.skills.some((skill) => skill.id === "middle-corridor-deal-desk-triage")) {
    errors.push("expected middle-corridor-deal-desk-triage skill");
  }
  const agentContract = card?.x_agent_contract;
  if (agentContract?.canonical_input_mode !== "structured_json") {
    errors.push("expected x_agent_contract.canonical_input_mode=structured_json");
  }
  if (agentContract?.primary_intent !== "middle_corridor_deal_risk_contract") {
    errors.push("expected x_agent_contract.primary_intent=middle_corridor_deal_risk_contract");
  }
  if (
    !Array.isArray(agentContract?.supported_intents) ||
    !agentContract.supported_intents.includes("middle_corridor_deal_risk_contract")
  ) {
    errors.push("expected middle_corridor_deal_risk_contract in x_agent_contract.supported_intents");
  }
  return errors;
}

function validateAgenticInteractionTrustCard(card) {
  const errors = [];
  if (card.name !== "Agentic Interaction Trust Gate") {
    errors.push(`expected Agentic Interaction Trust Gate name, got ${JSON.stringify(card.name)}`);
  }
  if (card?.x_agenda_intelligence?.product_profile !== "agentic_interaction_trust") {
    errors.push("expected x_agenda_intelligence.product_profile=agentic_interaction_trust");
  }
  if (card?.x_agenda_intelligence?.canonical_product_name !== "Agentic Interaction Trust Gate") {
    errors.push("expected canonical product name");
  }
  const contract = card?.x_agenda_intelligence?.product_contract;
  if (contract?.canonical_input_mode !== "structured_json") {
    errors.push("expected product_contract.canonical_input_mode=structured_json");
  }
  if (!String(contract?.request_schema || "").includes("agentic-interaction-trust-request.schema.json")) {
    errors.push("expected Agentic Interaction Trust request schema URL");
  }
  if (!String(contract?.response_schema || "").includes("agentic-interaction-trust-response.schema.json")) {
    errors.push("expected Agentic Interaction Trust response schema URL");
  }
  if (!String(contract?.source_taxonomy || "").includes("agentic-interaction-trust.json")) {
    errors.push("expected Agentic Interaction Trust source taxonomy URL");
  }
  const requiredBeforeAction = card?.x_agenda_intelligence?.required_before_action;
  if (
    !Array.isArray(requiredBeforeAction) ||
    !requiredBeforeAction.includes("operator_or_principal_authorization")
  ) {
    errors.push("expected operator_or_principal_authorization in required_before_action");
  }
  if (!String(card?.x_agenda_intelligence?.not_advice_notice || "").includes("Not cybersecurity monitoring")) {
    errors.push("expected non-advice notice");
  }
  if (!hasBoundary(card, "No approval, clearance, authorization, denial, blocking, or final decision.")) {
    errors.push("expected no-authorization boundary");
  }
  if (!Array.isArray(card.skills) || !card.skills.some((skill) => skill.id === "agentic-interaction-trust-gate")) {
    errors.push("expected agentic-interaction-trust-gate skill");
  }
  return errors;
}

export function validateAgentCard(card, sourceUrl = "") {
  if (!card || typeof card !== "object") return ["agent card is not a JSON object"];
  const errors = [];
  for (const field of ["name", "description", "version"]) {
    if (typeof card[field] !== "string" || !card[field].trim()) {
      errors.push(`expected non-empty ${field}`);
    }
  }
  if (!card.provider || typeof card.provider !== "object") {
    errors.push("expected provider");
  } else {
    if (typeof card.provider.organization !== "string" || !card.provider.organization.trim()) {
      errors.push("expected provider.organization");
    }
    if (!String(card.provider.url || "").startsWith("https://")) {
      errors.push("expected HTTPS provider.url");
    }
  }
  if (!card.capabilities || typeof card.capabilities !== "object") {
    errors.push("expected capabilities");
  }
  if (!Array.isArray(card.supportedInterfaces) || card.supportedInterfaces.length === 0) {
    errors.push("expected supportedInterfaces");
  } else {
    for (const [index, entry] of card.supportedInterfaces.entries()) {
      if (!String(entry?.url || "").startsWith("https://")) {
        errors.push(`supportedInterfaces[${index}].url must be HTTPS`);
      }
      if (entry?.protocolBinding !== "JSONRPC") {
        errors.push(`supportedInterfaces[${index}].protocolBinding must be JSONRPC`);
      }
      if (entry?.protocolVersion !== "1.0") {
        errors.push(`supportedInterfaces[${index}].protocolVersion must be 1.0`);
      }
    }
  }
  for (const field of ["defaultInputModes", "defaultOutputModes", "skills"]) {
    if (!Array.isArray(card[field]) || card[field].length === 0) {
      errors.push(`expected non-empty ${field}`);
    }
  }
  for (const [index, skill] of (card.skills || []).entries()) {
    for (const field of ["id", "name", "description"]) {
      if (typeof skill?.[field] !== "string" || !skill[field].trim()) {
        errors.push(`skills[${index}].${field} must be non-empty`);
      }
    }
    if (!Array.isArray(skill?.tags) || skill.tags.length === 0) {
      errors.push(`skills[${index}].tags must be non-empty`);
    }
  }
  for (const obsoleteField of [
    "protocolVersion",
    "protocolVersions",
    "url",
    "preferredTransport",
    "additionalInterfaces",
    "security"
  ]) {
    if (Object.prototype.hasOwnProperty.call(card, obsoleteField)) {
      errors.push(`obsolete A2A 1.0 field present: ${obsoleteField}`);
    }
  }
  if (card.securitySchemes && Object.keys(card.securitySchemes).length > 0) {
    if (!Array.isArray(card.securityRequirements) || card.securityRequirements.length === 0) {
      errors.push("securitySchemes are declared but securityRequirements are empty");
    }
  }

  const isMiddleCorridor =
    card.name === "Kazakhstan / Middle Corridor Deal Risk Gate" ||
    sourceUrl.includes("middle-corridor-deal-risk-gate-a2a");
  const isAgenticInteractionTrust =
    card.name === "Agentic Interaction Trust Gate" || sourceUrl.includes("agentic-interaction-trust-a2a");
  if (isMiddleCorridor) {
    errors.push(...validateMiddleCorridorCard(card));
  } else if (isAgenticInteractionTrust) {
    errors.push(...validateAgenticInteractionTrustCard(card));
  } else if (
    card.name === "Agenda Intelligence MD" ||
    sourceUrl.includes("agenda-intelligence-a2a")
  ) {
    errors.push(...validateAgendaCard(card));
  } else {
    errors.push(...validateProfileExpectation(card, sourceUrl));
  }
  return errors;
}

async function verify(url) {
  const response = await fetch(agentCardUrl(url), {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    return { url, ok: false, errors: [`HTTP ${response.status}`] };
  }
  const card = await response.json();
  const errors = validateAgentCard(card, url);
  return { url, ok: errors.length === 0, errors };
}

async function main() {
  const urls = process.argv.slice(2);
  const targets = urls.length > 0 ? urls : DEFAULT_AGENT_CARD_URLS;
  const results = await Promise.all(targets.map((url) => verify(url)));
  let failed = false;
  for (const result of results) {
    if (result.ok) {
      console.log(`OK ${agentCardUrl(result.url)}`);
      continue;
    }
    failed = true;
    console.error(`FAIL ${agentCardUrl(result.url)}`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
