import assert from "node:assert/strict";
import test from "node:test";

import {
  agentCard,
  buildUsageEvent,
  handleJsonRpc,
  handleRequest,
  healthInfo,
  isStatsAuthorized,
  landingHtml,
  PROBE_PROMPT_CHAR_THRESHOLD,
  recordUsageStats,
  routeModules,
  signalScreenForText,
  statusInfo,
  triageForText,
  usageStats
} from "../src/index.js";
import { validateAgentCard } from "../scripts/verify-agent-card.js";

const request = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

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

test("agent card uses request origin for live endpoints", () => {
  const card = agentCard(request);

  assert.equal(card.protocolVersion, "1.0");
  assert.equal(card.version, "1.0.1");
  assert.equal(card.url, "https://agenda-intelligence-a2a.example.workers.dev");
  assert.deepEqual(card.supportedInterfaces, [
    {
      url: "https://agenda-intelligence-a2a.example.workers.dev/message/send",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0"
    }
  ]);
  assert.equal(
    card.x_agenda_intelligence.jsonrpc_endpoint,
    "https://agenda-intelligence-a2a.example.workers.dev/message/send"
  );
  assert.equal(card.x_agenda_intelligence.hosted_wrapper, true);
  assert.equal(card.x_agenda_intelligence.mcp.server_command, "agenda-intelligence-mcp");
  assert.equal(card.capabilities.extendedAgentCard, false);
  assert.equal(card.provider.legalEntity.type, "individual");
  assert.equal(card.securitySchemes.optionalClientId.apiKeySecurityScheme.name, "X-Client-Id");
  assert.deepEqual(card.securityRequirements, []);
  assert.deepEqual(
    card.skills.map((skill) => skill.id),
    [
      "agenda-signal-screen",
      "agenda-analyze",
      "agenda-validate-memo",
      "agenda-audit-claims",
      "agenda-source-coverage",
      "agenda-quote-verification",
      "agenda-signals"
    ]
  );
  assert.equal(card.skills[0].name, "Sanctions and policy risk signal screen");
  assert.ok(card.skills[0].tags.includes("policy-risk"));
  assert.equal(
    card.x_agenda_intelligence.wrapper_scope,
    "A2A/JSON-RPC discovery, lightweight triage, and routing response only"
  );
});

test("agent card verifier accepts local Agenda and Middle Corridor cards", () => {
  const agendaCard = agentCard(request);
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const kazakhstanCard = agentCard(kazakhstanRequest, { AGENT_PROFILE: "kazakhstan" });
  const agenticRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/message/send");
  const agenticCard = agentCard(agenticRequest, { AGENT_PROFILE: "agentic_interaction_trust" });

  assert.deepEqual(
    validateAgentCard(agendaCard, "https://agenda-intelligence-a2a.example.workers.dev/.well-known/agent-card.json"),
    []
  );
  assert.deepEqual(
    validateAgentCard(
      kazakhstanCard,
      "https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/.well-known/agent-card.json"
    ),
    []
  );
  assert.deepEqual(
    validateAgentCard(
      agenticCard,
      "https://agentic-interaction-trust-a2a.example.workers.dev/.well-known/agent-card.json"
    ),
    []
  );
});

test("kazakhstan profile exposes focused corridor-risk agent card", () => {
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const card = agentCard(kazakhstanRequest, { AGENT_PROFILE: "kazakhstan" });

  assert.equal(card.name, "Kazakhstan / Middle Corridor Deal Risk Gate");
  assert.equal(card.url, "https://middle-corridor-deal-risk-gate-a2a.example.workers.dev");
  assert.equal(
    card.documentationUrl,
    "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/use-cases/kazakhstan-middle-corridor.md"
  );
  assert.equal(
    card.x_agenda_intelligence.wrapper_scope,
    "A2A/JSON-RPC discovery, Kazakhstan and Middle Corridor deal-risk triage, evidence gating, source coverage, and routing response only"
  );
  assert.equal(card.x_agenda_intelligence.product_profile, "middle_corridor_deal_risk");
  assert.equal(card.x_agenda_intelligence.canonical_product_name, "Kazakhstan / Middle Corridor Deal Risk Gate");
  assert.equal(
    card.x_agenda_intelligence.product_contract.request_schema,
    "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/schemas/v1/middle-corridor-deal-risk-request.schema.json"
  );
  assert.equal(
    card.x_agenda_intelligence.product_contract.source_taxonomy,
    "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/source-requirements/middle-corridor-deal-risk.json"
  );
  assert.equal(card.x_agenda_intelligence.product_contract.canonical_input_mode, "structured_json");
  assert.deepEqual(card.x_agenda_intelligence.supported_contracts, [
    "middle_corridor_deal_risk_contract",
    "lightweight_text_triage"
  ]);
  assert.ok(card.x_agenda_intelligence.required_before_go.includes("beneficial_ownership_source"));
  assert.ok(card.x_agenda_intelligence.buyer_use_cases.includes("pre-signature logistics deal review"));
  assert.match(card.x_agenda_intelligence.not_advice_notice, /Not legal/);
  assert.ok(card.x_agenda_intelligence.boundaries.includes("No approval, clearance, authorization, or final decision."));
  assert.deepEqual(
    card.skills.map((skill) => skill.id),
    [
      "middle-corridor-deal-desk-triage",
      "middle-corridor-source-coverage-auditor",
      "sanctions-adjacency-evidence-gate",
      "risk-memo-quality-gate",
      "a2a-evidence-pack-linter"
    ]
  );
  assert.equal(card.skills[0].name, "Kazakhstan / Middle Corridor deal-risk gate");
  assert.match(card.x_agenda_intelligence.commercial_positioning, /dated sources/);
});

test("message/send returns JSON-RPC result with routing metadata", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "probe-1",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "text",
                text: "Route a sanctions question about Kazakhstan and the Middle Corridor."
              }
            ]
          }
        }
      },
      request
    );

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.id, "probe-1");
    assert.equal(response.result.status.state, "completed");
    assert.equal(response.result.artifacts[0].parts[0].kind, "text");
    assert.match(response.result.artifacts[0].parts[0].text, /Signal screen:/);
    assert.match(response.result.artifacts[0].parts[0].text, /Risk signal:/);
    assert.match(response.result.artifacts[0].parts[0].text, /Evidence\/source plan:/);
    assert.match(response.result.artifacts[0].parts[0].text, /Quality gates:/);
    assert.match(response.result.artifacts[0].parts[0].text, /Next actions:/);
    assert.deepEqual(response.result.metadata.modules_used, [
      { module: "global-think-tank-analyst", role: "reasoning_method" },
      { module: "central-asia-caspian", role: "regional_specialist" },
      { module: "sanctions-sector", role: "sector_specialist" }
    ]);
    assert.equal(response.result.metadata.triage.intent, "sanctions_policy_signal_screen");
    assert.equal(response.result.metadata.signal_screen.recommended_mcp_tool, "analyze");
    assert.ok(response.result.metadata.signal_screen.affected_regions.includes("Central Asia/Caspian"));
    assert.ok(
      response.result.metadata.triage.source_plan.includes(
        "sanctions authority pages and list entries, such as OFAC, EU, UK OFSI, UN, or relevant national regulators"
      )
    );
  } finally {
    console.log = originalLog;
  }
});

test("kazakhstan profile defaults routing to Central Asia and sanctions modules", async () => {
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "kazakhstan-1",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "text",
                text: "Screen a corridor disruption for a logistics team."
              }
            ]
          }
        }
      },
      kazakhstanRequest,
      { AGENT_PROFILE: "kazakhstan" }
    );

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.result.metadata.product_profile, "kazakhstan");
    assert.deepEqual(
      response.result.metadata.modules_used.map((item) => item.module),
      ["global-think-tank-analyst", "central-asia-caspian", "sanctions-sector"]
    );
    assert.match(response.result.artifacts[0].parts[0].text, /Middle Corridor Deal Risk Gate/);
  } finally {
    console.log = originalLog;
  }
});

test("kazakhstan deal risk gate returns decision-ready escalation block", async () => {
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "deal-gate-1",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "text",
                text:
                  "Deal risk gate test. Route: Altynkol -> Aktau/Kuryk -> Baku -> Poti. Cargo: industrial equipment. Value: USD 2.4m. Counterparties: Kazakhstan forwarder, Azerbaijan port agent, Georgian consignee. Dated sources supplied: port operator notice dated 2026-05-20; sanctions list extract dated 2026-05-21 with no exact match; carrier note dated 2026-05-22. No beneficial ownership extract, no insurance clause, no customs source, no vessel history. Question: should this be escalated before contract signature?"
              }
            ]
          }
        }
      },
      kazakhstanRequest,
      { AGENT_PROFILE: "kazakhstan" }
    );

    const gate = response.result.metadata.triage.deal_risk_gate;
    assert.equal(response.result.metadata.triage.intent, "deal_risk_gate");
    assert.equal(gate.triage_recommendation, "escalate_before_signature");
    assert.equal(gate.route, "Altynkol -> Aktau/Kuryk -> Baku -> Poti");
    assert.equal(gate.cargo, "industrial equipment");
    assert.equal(gate.value, "USD 2.4m");
    assert.ok(gate.supplied_sources.includes("port_operator_notice"));
    assert.ok(gate.supplied_sources.includes("sanctions_list_extract"));
    assert.equal(gate.supplied_sources.includes("beneficial_ownership_source"), false);
    assert.ok(gate.minimum_sources_before_go.includes("beneficial_ownership_source"));
    assert.ok(gate.minimum_sources_before_go.includes("insurance_clause_or_underwriter_note"));
    assert.match(response.result.artifacts[0].parts[0].text, /Recommendation: escalate_before_signature/);
  } finally {
    console.log = originalLog;
  }
});

test("kazakhstan deal risk gate extracts free-form route cargo and value", async () => {
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "deal-gate-freeform",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "text",
                text:
                  "We are evaluating a USD 2.4m shipment of industrial equipment on route Altynkol -> Aktau/Kuryk -> Baku -> Poti. Counterparties: shipper, forwarder, consignee. Sources supplied: port operator notice dated 2026-05-20, OFAC/EU/UK sanctions list extract dated 2026-05-21 with no exact matches, carrier note dated 2026-05-22. Should this be escalated before contract signature?"
              }
            ]
          }
        }
      },
      kazakhstanRequest,
      { AGENT_PROFILE: "kazakhstan" }
    );

    const gate = response.result.metadata.triage.deal_risk_gate;
    const screen = response.result.metadata.signal_screen;
    assert.equal(gate.route, "Altynkol -> Aktau/Kuryk -> Baku -> Poti");
    assert.equal(gate.cargo, "industrial equipment");
    assert.equal(gate.value, "USD 2.4m");
    assert.equal(gate.counterparties, "shipper, forwarder, consignee");
    assert.equal(gate.supplied_sources.includes("vessel_or_carrier_history"), false);
    assert.ok(gate.minimum_sources_before_go.includes("vessel_or_carrier_history"));
    assert.equal(screen.evidence_gaps.some((gap) => gap.includes("sanctions authority")), false);
    assert.equal(screen.evidence_gaps.some((gap) => gap.includes("corridor operator")), false);
  } finally {
    console.log = originalLog;
  }
});

test("kazakhstan deal risk gate returns structured contract response from data part", async () => {
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "deal-risk-contract-1",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "data",
                data: {
                  route: "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
                  cargo: "industrial equipment",
                  shipment_value: {
                    amount: 2400000,
                    currency: "USD"
                  },
                  counterparties: [
                    {
                      role: "forwarder",
                      name: "Kazakhstan forwarder",
                      jurisdiction: "Kazakhstan"
                    },
                    {
                      role: "port_agent",
                      name: "Azerbaijan port agent",
                      jurisdiction: "Azerbaijan"
                    },
                    {
                      role: "consignee",
                      name: "Georgian consignee",
                      jurisdiction: "Georgia"
                    }
                  ],
                  dated_sources: [
                    {
                      id: "e1",
                      source_type: "port_operator_notice",
                      title: "Port operator notice",
                      date: "2026-05-20",
                      url: "https://example.com/port-notice"
                    },
                    {
                      id: "e2",
                      source_type: "sanctions_list_extract",
                      title: "Sanctions list extract",
                      date: "2026-05-21",
                      url: "https://example.com/sanctions-list-extract"
                    },
                    {
                      id: "e3",
                      source_type: "carrier_note",
                      title: "Carrier note",
                      date: "2026-05-22",
                      url: "https://example.com/carrier-note"
                    }
                  ],
                  risk_question: "Should this be escalated before contract signature?",
                  decision_stage: "pre_signature"
                }
              }
            ]
          }
        }
      },
      kazakhstanRequest,
      { AGENT_PROFILE: "kazakhstan" }
    );

    const contract = response.result.metadata.triage.deal_risk_contract;
    assert.equal(response.result.metadata.triage.intent, "middle_corridor_deal_risk_contract");
    assert.equal(contract.triage_recommendation, "escalate_before_signature");
    assert.equal(contract.risk_signal, "medium_high");
    assert.equal(contract.decision_readiness_score, 42);
    assert.equal(contract.decision_readiness_label, "not_decision_ready");
    assert.equal(contract.route, "Altynkol -> Aktau/Kuryk -> Baku -> Poti");
    assert.equal(contract.cargo, "industrial equipment");
    assert.equal(contract.shipment_value.amount, 2400000);
    assert.deepEqual(contract.supplied_sources, [
      "port_operator_notice",
      "sanctions_list_extract",
      "carrier_note"
    ]);
    assert.deepEqual(contract.minimum_sources_before_go, [
      "counterparty_registry_extract",
      "beneficial_ownership_source",
      "customs_or_regulatory_source",
      "insurance_clause_or_underwriter_note",
      "vessel_or_carrier_history"
    ]);
    assert.equal(contract.minimum_sources_before_go.includes("sanctions_list_extract"), false);
    assert.equal(contract.minimum_sources_before_go.includes("port_operator_notice"), false);
    assert.match(contract.not_advice_notice, /Not legal/);
    assert.match(response.result.artifacts[0].parts[0].text, /Decision readiness: 42\/100/);
    assert.match(response.result.artifacts[0].parts[0].text, /Middle Corridor deal-risk contract response/);
  } finally {
    console.log = originalLog;
  }
});

test("triage classifies source coverage requests and returns quality gates", () => {
  const triage = triageForText(
    "Check source coverage for EU sanctions evidence around Red Sea shipping.",
    routeModules("EU sanctions around Red Sea shipping")
  );

  assert.equal(triage.intent, "source_coverage");
  assert.ok(triage.source_plan.some((item) => item.includes("EU institution")));
  assert.ok(triage.source_plan.some((item) => item.includes("Gulf/Middle East")));
  assert.ok(triage.quality_gates[0].includes("source-category coverage"));
  assert.equal(triage.install.mcp_server_command, "agenda-intelligence-mcp");
});

test("signal screen productizes sanctions and policy risk prompts", () => {
  const text = "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure.";
  const modules = routeModules(text);
  const triage = triageForText(text, modules);
  const screen = signalScreenForText(text, modules, triage.intent);

  assert.equal(triage.intent, "sanctions_policy_signal_screen");
  assert.equal(screen.recommended_mcp_tool, "analyze");
  assert.ok(screen.risk_signal.includes("transit"));
  assert.deepEqual(screen.affected_regions, ["Central Asia/Caspian", "Gulf/Middle East"]);
  assert.ok(screen.source_categories_required.includes("sanctions authority"));
  assert.ok(screen.source_categories_required.includes("corridor operator"));
  assert.ok(screen.watch_next.some((item) => item.includes("OFAC")));
  assert.equal(screen.confidence, "triage_only_no_live_retrieval");
});

test("unknown method returns method-not-found error", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "unknown/method"
    },
    request
  );

  assert.equal(response.error.code, -32601);
  assert.deepEqual(response.error.data.supported_methods, ["message/send", "tasks/send", "agent/card"]);
});

test("routeModules detects Gulf and EU terms", () => {
  assert.deepEqual(routeModules("EU sanctions around Red Sea shipping and Iran"), [
    { module: "global-think-tank-analyst", role: "reasoning_method" },
    { module: "gulf-middle-east", role: "regional_specialist" },
    { module: "eu", role: "regional_specialist" },
    { module: "sanctions-sector", role: "sector_specialist" }
  ]);
});

test("usage analytics event keeps only privacy-safe request metadata", () => {
  const analyticsRequest = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: {
      "user-agent": "Agenstry probe",
      referer: "https://agenstry.com/agents/agenda-intelligence-a2a.example.workers.dev",
      cookie: "session=secret"
    }
  });

  const event = buildUsageEvent(analyticsRequest, {
    jsonrpc_method: "message/send",
    jsonrpc_id_present: true,
    prompt_chars: 68,
    modules_used: routeModules("Kazakhstan sanctions risk"),
    likely_probe: true
  });

  assert.equal(event.event, "agenda_intelligence_a2a_usage");
  assert.equal(event.path, "/message/send");
  assert.equal(event.jsonrpc_method, "message/send");
  assert.equal(event.agent_profile, "agenda");
  assert.equal(event.prompt_chars, 68);
  assert.deepEqual(event.modules_used, [
    "global-think-tank-analyst",
    "central-asia-caspian",
    "sanctions-sector"
  ]);
  assert.equal(event.client, "agenstry");
  assert.equal(event.referrer_host, "agenstry.com");
  assert.equal(event.likely_probe, true);
  assert.equal(event.prompt_text, undefined);
  assert.equal(event.cookie, undefined);
  assert.equal(event.authorization, undefined);
  assert.equal(event.ip, undefined);
});

test("usage analytics accepts a privacy-safe optional client id header", () => {
  const analyticsRequest = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: {
      "x-client-id": "Partner Console / Demo #1"
    }
  });

  const event = buildUsageEvent(analyticsRequest, {
    jsonrpc_method: "message/send",
    jsonrpc_id_present: true,
    prompt_chars: 21
  });

  assert.equal(event.client, "partner-console---demo--1");
  assert.equal(event.agent_profile, "agenda");
  assert.equal(event.authorization, undefined);
});

test("usage analytics labels the kazakhstan agent profile", () => {
  const event = buildUsageEvent(
    new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send"),
    {
      jsonrpc_method: "message/send",
      jsonrpc_id_present: true,
      prompt_chars: 42
    }
  );

  assert.equal(event.agent_profile, "kazakhstan");
});

test("usage stats aggregates daily counters from KV", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };
  const event = {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-05-22T16:23:44.481Z",
    jsonrpc_method: "message/send",
    agent_profile: "agenda",
    likely_probe: false,
    client: "curl",
    cf: {
      country: "KZ"
    },
    modules_used: ["global-think-tank-analyst", "eu", "sanctions-sector"]
  };

  await recordUsageStats(env, event);
  await recordUsageStats(env, { ...event, agent_profile: "kazakhstan", likely_probe: true, client: "agenstry" });

  const stats = await usageStats(env, "2026-05-22");

  assert.equal(stats.configured, true);
  assert.equal(stats.counters.total, 2);
  assert.equal(stats.counters.non_probe, 1);
  assert.equal(stats.counters.likely_probe, 1);
  assert.deepEqual(stats.clients, [
    { name: "agenstry", count: 1 },
    { name: "curl", count: 1 }
  ]);
  assert.deepEqual(stats.agent_profiles, [
    { name: "agenda", count: 1 },
    { name: "kazakhstan", count: 1 }
  ]);
  assert.deepEqual(stats.countries, [{ name: "KZ", count: 2 }]);
  assert.deepEqual(stats.methods, [{ name: "message/send", count: 2 }]);
  assert.deepEqual(stats.modules, [
    { name: "eu", count: 2 },
    { name: "global-think-tank-analyst", count: 2 },
    { name: "sanctions-sector", count: 2 }
  ]);
});

test("usage event records the worker host and stats break down per host", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };

  const agendaEvent = buildUsageEvent(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send"),
    { jsonrpc_method: "message/send", jsonrpc_id_present: true, prompt_chars: 200, likely_probe: false }
  );
  const canonicalEvent = buildUsageEvent(
    new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send"),
    { jsonrpc_method: "message/send", jsonrpc_id_present: true, prompt_chars: 200, likely_probe: false }
  );

  assert.equal(agendaEvent.host, "agenda-intelligence-a2a.example.workers.dev");

  await recordUsageStats(env, agendaEvent);
  await recordUsageStats(env, canonicalEvent);
  await recordUsageStats(env, canonicalEvent);

  const stats = await usageStats(env, agendaEvent.timestamp.slice(0, 10));

  assert.deepEqual(stats.hosts, [
    { name: "middle-corridor-deal-risk-gate-a2a.example.workers.dev", count: 2 },
    { name: "agenda-intelligence-a2a.example.workers.dev", count: 1 }
  ]);
});

test("small message/send payloads are classified as probes regardless of client", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };

  // 9-char payload from an untagged client (matches the observed monitor noise).
  await recordUsageStats(env, {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-05-27T10:00:00.000Z",
    jsonrpc_method: "message/send",
    agent_profile: "agenda",
    prompt_chars: 9,
    likely_probe: 9 < PROBE_PROMPT_CHAR_THRESHOLD,
    client: "unknown",
    cf: { country: "BE" }
  });
  // A real triage request stays non-probe.
  await recordUsageStats(env, {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-05-27T11:00:00.000Z",
    jsonrpc_method: "message/send",
    agent_profile: "kazakhstan",
    prompt_chars: 529,
    likely_probe: 529 < PROBE_PROMPT_CHAR_THRESHOLD,
    client: "curl",
    cf: { country: "KZ" }
  });

  const stats = await usageStats(env, "2026-05-27");
  assert.equal(stats.counters.total, 2);
  assert.equal(stats.counters.likely_probe, 1);
  assert.equal(stats.counters.non_probe, 1);
});

test("stats endpoint returns JSON for requested date", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv, STATS_TOKEN: "test-token" };
  await recordUsageStats(
    env,
    {
      event: "agenda_intelligence_a2a_usage",
      timestamp: "2026-05-22T12:00:00.000Z",
      jsonrpc_method: "message/send",
      agent_profile: "kazakhstan",
      likely_probe: false,
      client: "browser",
      cf: { country: "US" },
      modules_used: ["global-think-tank-analyst"]
    }
  );

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?date=2026-05-22&token=test-token"),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.date, "2026-05-22");
  assert.equal(body.counters.total, 1);
  assert.deepEqual(body.clients, [{ name: "browser", count: 1 }]);
  assert.deepEqual(body.agent_profiles, [{ name: "kazakhstan", count: 1 }]);
});

test("stats endpoint requires token", async () => {
  const env = { AGENDA_USAGE: new MemoryKv(), STATS_TOKEN: "test-token" };

  assert.equal(
    isStatsAuthorized(new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?token=test-token"), env),
    true
  );
  assert.equal(
    isStatsAuthorized(
      new Request("https://agenda-intelligence-a2a.example.workers.dev/stats", {
        headers: { "x-stats-token": "test-token" }
      }),
      env
    ),
    true
  );
  assert.equal(
    isStatsAuthorized(new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?token=wrong"), env),
    false
  );
  assert.equal(
    isStatsAuthorized(new Request("https://agenda-intelligence-a2a.example.workers.dev/stats?token=test-token"), {
      AGENDA_USAGE: new MemoryKv()
    }),
    false
  );

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/stats"),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Unauthorized");
});

test("GET / returns HTML landing when Accept includes text/html", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/", {
      method: "GET",
      headers: { accept: "text/html,application/xhtml+xml" }
    }),
    {}
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  const body = await response.text();
  assert.match(body, /<!doctype html>/i);
  assert.match(body, /Agenda Intelligence/);
  assert.match(body, /badge-live/);
  assert.match(body, /\/.well-known\/agent-card.json/);
  assert.match(body, /\/message\/send/);
  assert.match(body, /Not.*advice/i);
});

test("GET / returns JSON health for non-HTML clients", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/", {
      method: "GET"
    }),
    {}
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(body.agent_card);
  assert.ok(body.status);
  assert.equal(body.profile, "agenda");
});

test("GET /health always returns JSON regardless of Accept header", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/health", {
      method: "GET",
      headers: { accept: "text/html" }
    }),
    {}
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = await response.json();
  assert.equal(body.ok, true);
});

test("GET /status returns JSON status with boundaries and links", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/status"),
    {}
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.profile, "agenda");
  assert.ok(body.version);
  assert.ok(body.agent_card_url);
  assert.ok(body.message_send_url);
  assert.equal(body.boundaries.not_advice, true);
  assert.equal(body.boundaries.live_retrieval, false);
  assert.equal(body.boundaries.factual_verification, false);
  assert.equal(body.boundaries.human_review_required, false);
});

test("/status flips human_review_required to true for kazakhstan profile", () => {
  const kazakhstanRequest = new Request(
    "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/status"
  );
  const info = statusInfo(kazakhstanRequest, {});
  assert.equal(info.profile, "kazakhstan");
  assert.equal(info.boundaries.human_review_required, true);
});

test("landingHtml is profile-aware for kazakhstan worker", () => {
  const kazakhstanRequest = new Request(
    "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/"
  );
  const html = landingHtml(kazakhstanRequest, {});
  assert.match(html, /Kazakhstan/);
  assert.match(html, /Middle Corridor/);
  assert.match(html, /Profile: kazakhstan/);
});

test("healthInfo exposes status URL alongside agent_card and message_send", () => {
  const info = healthInfo(request, {});
  assert.ok(info.agent_card.endsWith("/.well-known/agent-card.json"));
  assert.ok(info.message_send.endsWith("/message/send"));
  assert.ok(info.status.endsWith("/status"));
});

// ---------------------------------------------------------------------------
// cis_secondary_sanctions profile (per ADR 0014)
// ---------------------------------------------------------------------------

const cisRequest = new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

const cisSampleStructuredRequest = {
  counterparty: {
    name: "Example KZ Trading LLP",
    jurisdiction: "Kazakhstan",
    sector: "trading_house"
  },
  exposure_facets: ["ownership_or_control", "transit_or_re_export"],
  dated_sources: [
    { id: "s1", source_type: "ofac_sdn_extract", title: "OFAC SDN", date: "2026-05-20" },
    { id: "s2", source_type: "ownership_chain_evidence", title: "Ownership chain", date: "2026-05-21" }
  ],
  risk_question: "Does the disclosed ownership chain create indirect exposure under OFAC EO 14114?",
  decision_stage: "onboarding"
};

test("cis_secondary_sanctions profile is detected from host and env", () => {
  const card = agentCard(cisRequest, {});
  assert.equal(card.x_agenda_intelligence.product_profile, "cis_secondary_sanctions");
  assert.equal(card.name, "CIS Secondary-Sanctions Exposure");
  assert.ok(Array.isArray(card.skills) && card.skills.length === 1);
  assert.equal(card.skills[0].id, "cis-secondary-sanctions-exposure");
  assert.equal(card.x_agenda_intelligence.live_retrieval.capability_declared, true);
  // Without either WATCHMAN_URL or OPENSANCTIONS_API_KEY in env, activation is
  // deferred per ADR 0014 2026-05-27 update.
  assert.equal(card.x_agenda_intelligence.live_retrieval.active, false);
  assert.equal(card.x_agenda_intelligence.live_retrieval.active_upstream, null);
  const options = card.x_agenda_intelligence.live_retrieval.upstream_options;
  assert.ok(Array.isArray(options) && options.length === 2);
  // Watchman (free self-host) is listed first, OpenSanctions (paid) second.
  assert.equal(options[0].name, "Watchman");
  assert.equal(options[0].license, "Apache-2.0");
  assert.equal(options[1].name, "OpenSanctions");
  assert.equal(options[1].license, "CC-BY-4.0");
});

test("agent card live_retrieval flips active=true with Watchman when WATCHMAN_URL is set", () => {
  const card = agentCard(cisRequest, { WATCHMAN_URL: "https://watchman.example.com" });
  assert.equal(card.x_agenda_intelligence.live_retrieval.active, true);
  assert.equal(card.x_agenda_intelligence.live_retrieval.active_upstream, "Watchman");
});

test("agent card live_retrieval flips active=true with OpenSanctions when OPENSANCTIONS_API_KEY is set", () => {
  const card = agentCard(cisRequest, { OPENSANCTIONS_API_KEY: "test-key" });
  assert.equal(card.x_agenda_intelligence.live_retrieval.active, true);
  assert.equal(card.x_agenda_intelligence.live_retrieval.active_upstream, "OpenSanctions");
});

test("agent card live_retrieval prefers Watchman over OpenSanctions when both are set", () => {
  const card = agentCard(cisRequest, {
    WATCHMAN_URL: "https://watchman.example.com",
    OPENSANCTIONS_API_KEY: "test-key"
  });
  assert.equal(card.x_agenda_intelligence.live_retrieval.active_upstream, "Watchman");
});

test("agent card live_retrieval stays active=false when OPENSANCTIONS_DISABLED is set", () => {
  const card = agentCard(cisRequest, { OPENSANCTIONS_API_KEY: "test-key", OPENSANCTIONS_DISABLED: "1" });
  assert.equal(card.x_agenda_intelligence.live_retrieval.active, false);
});

test("statusInfo exposes per-profile live_retrieval capability for cis_secondary_sanctions (deferred)", () => {
  const status = statusInfo(cisRequest, {});
  assert.equal(status.profile, "cis_secondary_sanctions");
  // Capability is declared but activation is deferred until an upstream env var is set.
  assert.equal(status.boundaries.live_retrieval, false);
  assert.equal(status.boundaries.factual_verification, false);
  assert.equal(status.boundaries.human_review_required, true);
  assert.equal(status.live_retrieval.capability_declared, true);
  assert.equal(status.live_retrieval.active, false);
  assert.equal(status.live_retrieval.active_upstream, null);
  assert.equal(status.live_retrieval.upstream_options[0].name, "Watchman");
  assert.equal(status.live_retrieval.upstream_options[0].active, false);
  assert.equal(status.live_retrieval.upstream_options[1].name, "OpenSanctions");
  assert.ok(typeof status.live_retrieval.deferral_note === "string");
});

test("statusInfo flips live_retrieval boundary to true when OPENSANCTIONS_API_KEY is set", () => {
  const status = statusInfo(cisRequest, { OPENSANCTIONS_API_KEY: "test-key" });
  assert.equal(status.boundaries.live_retrieval, true);
  assert.equal(status.live_retrieval.active, true);
  assert.equal(status.live_retrieval.active_upstream, "OpenSanctions");
  assert.equal(status.live_retrieval.deferral_note, undefined);
});

test("statusInfo flips live_retrieval boundary to true with Watchman when WATCHMAN_URL is set", () => {
  const status = statusInfo(cisRequest, { WATCHMAN_URL: "https://watchman.example.com" });
  assert.equal(status.boundaries.live_retrieval, true);
  assert.equal(status.live_retrieval.active, true);
  assert.equal(status.live_retrieval.active_upstream, "Watchman");
});

test("statusInfo keeps live_retrieval false for default agenda profile", () => {
  const status = statusInfo(request, {});
  assert.equal(status.boundaries.live_retrieval, false);
  assert.equal(status.live_retrieval, undefined);
});

test("statusInfo keeps live_retrieval false for kazakhstan profile", () => {
  const kazRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/status");
  const status = statusInfo(kazRequest, {});
  assert.equal(status.profile, "kazakhstan");
  assert.equal(status.boundaries.live_retrieval, false);
});

// ---------------------------------------------------------------------------
// Agentic Interaction Trust Gate profile
// ---------------------------------------------------------------------------

const agenticRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/message/send", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

const agenticSampleStructuredRequest = {
  actor: {
    declared_type: "ai_agent",
    declared_name: "Example Shopping Agent",
    operator: "Example Consumer",
    declared_user_agent: "ExampleShoppingAgent/1.0",
    authentication_context: "session_cookie"
  },
  target_surface: "checkout",
  requested_action: "complete purchase of two restricted-delivery items",
  asset_or_resource: "order-123",
  decision_stage: "pre_execution",
  dated_sources: [
    { id: "ait-1", source_type: "agent_identity_claim", title: "Declared agent identity header", date: "2026-05-28" },
    { id: "ait-2", source_type: "session_authentication_evidence", title: "Authenticated checkout session", date: "2026-05-28" },
    { id: "ait-3", source_type: "transaction_or_target_action_evidence", title: "Order summary", date: "2026-05-28" }
  ],
  risk_question: "Is this agent-mediated checkout ready to allow, step up, or route to human review?"
};

test("agentic_interaction_trust profile is detected from host and env", () => {
  const card = agentCard(agenticRequest, {});
  assert.equal(card.x_agenda_intelligence.product_profile, "agentic_interaction_trust");
  assert.equal(card.name, "Agentic Interaction Trust Gate");
  assert.equal(card.skills.length, 1);
  assert.equal(card.skills[0].id, "agentic-interaction-trust-gate");
  assert.equal(card.x_agenda_intelligence.product_contract.canonical_input_mode, "structured_json");
  assert.equal(
    card.x_agenda_intelligence.product_contract.request_schema,
    "https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/schemas/v1/agentic-interaction-trust-request.schema.json"
  );
  assert.ok(card.x_agenda_intelligence.required_before_action.includes("agent_card_or_manifest"));
  assert.ok(card.x_agenda_intelligence.boundaries.includes("No autonomous live source retrieval."));
  assert.match(card.x_agenda_intelligence.not_advice_notice, /Not cybersecurity monitoring/);
});

test("statusInfo exposes agentic_interaction_trust boundaries", () => {
  const status = statusInfo(agenticRequest, {});
  assert.equal(status.profile, "agentic_interaction_trust");
  assert.equal(status.boundaries.live_retrieval, false);
  assert.equal(status.boundaries.factual_verification, false);
  assert.equal(status.boundaries.human_review_required, true);
  assert.equal(status.live_retrieval, undefined);
});

test("agentic_interaction_trust message/send dispatches to structured triage", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "agentic-1",
        method: "message/send",
        params: { request: agenticSampleStructuredRequest }
      },
      agenticRequest,
      {}
    );

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.id, "agentic-1");
    const result = response.result;
    assert.equal(result.status.state, "completed");
    assert.equal(result.metadata.product_profile, "agentic_interaction_trust");
    assert.equal(result.metadata.canonical_http_endpoint, "/v1/agentic-interaction/trust");
    assert.equal(result.metadata.human_review_required, true);
    const resp = result.metadata.response;
    assert.equal(resp.triage_recommendation, "require_step_up");
    assert.equal(resp.trust_signal, "medium");
    assert.equal(resp.decision_readiness_score, 40);
    assert.deepEqual(resp.minimum_sources_before_action, [
      "operator_or_principal_authorization",
      "agent_card_or_manifest",
      "tool_scope_or_permission_evidence",
      "action_intent_evidence"
    ]);
    assert.match(result.artifacts[0].parts[0].text, /Agentic interaction trust gate response/);
  } finally {
    console.log = originalLog;
  }
});

test("agentic_interaction_trust message/send fails on missing structured request", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "agentic-bad",
        method: "message/send",
        params: { message: { parts: [{ kind: "text", text: "hello" }] } }
      },
      agenticRequest,
      {}
    );
    assert.equal(response.result.status.state, "failed");
    assert.equal(response.result.metadata.valid, false);
    assert.equal(response.result.metadata.product_profile, "agentic_interaction_trust");
  } finally {
    console.log = originalLog;
  }
});

test("cis_secondary_sanctions message/send dispatches to structured triage", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "cis-1",
        method: "message/send",
        params: {
          message: { data: cisSampleStructuredRequest }
        }
      },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.id, "cis-1");
    const result = response.result;
    assert.equal(result.status.state, "completed");
    assert.equal(result.metadata.product_profile, "cis_secondary_sanctions");
    assert.equal(result.metadata.live_retrieval_status, "disabled");
    assert.equal(result.metadata.human_review_required, true);
    const resp = result.metadata.response;
    assert.equal(resp.triage_recommendation, "escalate_before_onboarding");
    assert.ok(Array.isArray(resp.minimum_sources_before_review));
    assert.ok(resp.limitations.some((line) => line.includes("OpenSanctions")));
  } finally {
    console.log = originalLog;
  }
});

test("cis_secondary_sanctions message/send fails on missing structured request", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "cis-bad",
        method: "message/send",
        params: { message: { parts: [{ kind: "text", text: "hello" }] } }
      },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    assert.equal(response.result.status.state, "failed");
    assert.equal(response.result.metadata.valid, false);
  } finally {
    console.log = originalLog;
  }
});

// ---------------------------------------------------------------------------
// JWS signing (Agenstry conformance criterion: jws_signature)
// ---------------------------------------------------------------------------

import { webcrypto } from "node:crypto";
import {
  base64urlEncode,
  buildJwks,
  jcs,
  maybeSignCard,
  publicJwkFromPrivate,
  signCardDetached
} from "../src/jws.js";

async function generateTestKey() {
  const { privateKey } = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", privateKey);
  jwk.kid = "test-kid";
  jwk.alg = "ES256";
  jwk.use = "sig";
  return jwk;
}

test("jcs sorts object keys deterministically and omits whitespace", () => {
  assert.equal(jcs({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(jcs([1, 2, 3]), "[1,2,3]");
  assert.equal(jcs({ x: null, y: true, z: false }), '{"x":null,"y":true,"z":false}');
  // Nested
  assert.equal(jcs({ outer: { c: [1, 2], a: "x" } }), '{"outer":{"a":"x","c":[1,2]}}');
});

test("publicJwkFromPrivate strips d / key_ops / ext", async () => {
  const privJwk = await generateTestKey();
  const pub = publicJwkFromPrivate(privJwk);
  assert.equal(pub.d, undefined);
  assert.equal(pub.key_ops, undefined);
  assert.equal(pub.ext, undefined);
  assert.equal(pub.kty, "EC");
  assert.equal(pub.crv, "P-256");
  assert.equal(pub.alg, "ES256");
  assert.equal(pub.use, "sig");
});

test("buildJwks returns the public key wrapped in {keys:[...]}", async () => {
  const privJwk = await generateTestKey();
  const jwks = buildJwks(JSON.stringify(privJwk));
  assert.ok(Array.isArray(jwks.keys));
  assert.equal(jwks.keys.length, 1);
  assert.equal(jwks.keys[0].d, undefined);
  assert.equal(jwks.keys[0].kid, "test-kid");
});

test("buildJwks returns empty when no key is provided", () => {
  assert.deepEqual(buildJwks(null), { keys: [] });
  assert.deepEqual(buildJwks(undefined), { keys: [] });
  assert.deepEqual(buildJwks(""), { keys: [] });
});

test("signCardDetached produces a compact detached JWS that verifies against JWKS", async () => {
  const privJwk = await generateTestKey();
  const card = {
    name: "Test agent",
    version: "1.0.0",
    skills: [{ id: "a", name: "A" }],
    nested: { z: 1, a: [3, 2, 1] }
  };
  const signature = await signCardDetached(card, privJwk);

  // Format: <headerB64>..<signatureB64>
  assert.match(signature, /^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$/);

  // Verify roundtrip against the public JWK
  const [headerB64, , sigB64] = signature.split(".");
  const payloadBytes = new TextEncoder().encode(jcs(card));
  const headerBytes = new TextEncoder().encode(headerB64);
  const dotBytes = new TextEncoder().encode(".");
  const signingInput = new Uint8Array(headerBytes.length + 1 + payloadBytes.length);
  signingInput.set(headerBytes, 0);
  signingInput.set(dotBytes, headerBytes.length);
  signingInput.set(payloadBytes, headerBytes.length + 1);

  const pubJwk = publicJwkFromPrivate(privJwk);
  const verifyKey = await webcrypto.subtle.importKey(
    "jwk",
    pubJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  const sigBytes = Uint8Array.from(Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  const ok = await webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    verifyKey,
    sigBytes,
    signingInput
  );
  assert.equal(ok, true);

  // Header must declare alg=ES256 and the detached payload convention (b64=false, crit=["b64"]).
  const headerJson = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(Buffer.from(headerB64.replace(/-/g, "+").replace(/_/g, "/"), "base64")))
  );
  assert.equal(headerJson.alg, "ES256");
  assert.equal(headerJson.b64, false);
  assert.deepEqual(headerJson.crit, ["b64"]);
  assert.equal(headerJson.kid, "test-kid");
});

test("signCardDetached strips an existing signature field before signing", async () => {
  const privJwk = await generateTestKey();
  const card = { name: "Test", skills: [] };
  const sig1 = await signCardDetached(card, privJwk);
  const sig2 = await signCardDetached({ ...card, signature: "previous" }, privJwk);
  // ECDSA signatures are non-deterministic, so the signature segment may differ
  // even when the payload is identical. What MUST be identical is the header.
  assert.equal(sig1.split(".")[0], sig2.split(".")[0]);
});

test("maybeSignCard is a no-op when no signing key is configured", async () => {
  const card = { name: "Test", skills: [] };
  const result = await maybeSignCard(card, {});
  assert.equal(result.signature, undefined);
  assert.equal(result.name, "Test");
});

test("maybeSignCard adds a signature when AGENT_CARD_SIGNING_KEY is set", async () => {
  const privJwk = await generateTestKey();
  const card = { name: "Test", skills: [] };
  const result = await maybeSignCard(card, { AGENT_CARD_SIGNING_KEY: JSON.stringify(privJwk) });
  assert.match(result.signature, /^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$/);
  // Original card content preserved
  assert.equal(result.name, "Test");
});

test("agent card includes support block with hours/contact", () => {
  const card = agentCard(request, {});
  assert.ok(card.support, "card.support should be present");
  assert.equal(card.support.email, "vassiliy.lakhonin@gmail.com");
  assert.match(card.support.hours_local, /Asia\/Almaty/);
  assert.equal(card.support.timezone, "Asia/Almaty");
});

test("base64urlEncode handles empty and short inputs", () => {
  assert.equal(base64urlEncode(new Uint8Array()), "");
  assert.equal(base64urlEncode(new TextEncoder().encode("hi")), "aGk");
});
