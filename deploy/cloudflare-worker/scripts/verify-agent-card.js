#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const DEFAULT_AGENT_CARD_URLS = [
  "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json",
  "https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json"
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
  if (card.protocolVersion !== "1.0") errors.push("expected protocolVersion=1.0");
  if (!card.url) errors.push("expected card.url");
  if (!Array.isArray(card.supportedInterfaces) || card.supportedInterfaces.length === 0) {
    errors.push("expected supportedInterfaces");
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
  } else {
    errors.push(...validateAgendaCard(card));
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
