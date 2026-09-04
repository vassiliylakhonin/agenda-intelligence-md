import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  aiCatalog,
  DIRECT_V1_ROUTES,
  apiCatalog,
  agentCard,
  GATE_REQUEST_GUIDES,
  buildUsageEvent,
  callOutcome,
  checkRateLimit,
  dealRiskContractResponseForRequest,
  didDocument,
  entityMap,
  funnelStepForPath,
  handleCisReviewIntake,
  handleCisReviewIntakeList,
  handleJsonRpc,
  canonicalDecisionInput,
  decisionRuns,
  verificationStatus,
  handleMcpJsonRpc,
  handleRequest,
  healthInfo,
  isProductionAuthorized,
  isStatsAuthorized,
  landingHtml,
  logFunnelEvent,
  mcpServerCard,
  okfMarkdown,
  openApiDocument,
  PRE_ACTION_CHECK_GUIDE,
  profileContent,
  productionAuthKey,
  rateLimitPerHour,
  recordUsageStats,
  robotsTxt,
  routeModules,
  sendCisReviewEmailNotification,
  signalScreenForText,
  statusInfo,
  toSpecWireCard,
  triageForText,
  usageStats
} from "../src/index.js";
import { PROBE_PROMPT_CHAR_THRESHOLD } from "../src/usage_constants.js";
import { PROFILE_REGISTRY, VERSION, profileDiscovery } from "../src/profiles.js";
import { mcpToolsForProfile } from "../src/mcp.js";
import { cardExtensionParams } from "../src/card-extension.js";
import { validateAgentCard } from "../scripts/verify-agent-card.js";
import { OKF_CONTENT, OKF_PATHS, PROFILE_CONTENT, PROFILE_PATHS } from "../src/okf_content.js";
import { matchCounterparty as matchCounterpartyAgainstWatchman } from "../src/upstream_watchman.js";
import { fetchOwnership as fetchOwnershipFromGleif } from "../src/upstream_gleif.js";
import {
  matchCounterparty as matchCounterpartyAgainstSnapshot,
  __resetCache as resetSnapshotCache
} from "../src/upstream_snapshot.js";

const request = new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

const expectedDiscoveryLinkHeader = [
  '<https://agenda-intelligence-a2a.example.workers.dev/.well-known/ai-catalog.json>; rel="ai-catalog"',
  '<https://agenda-intelligence-a2a.example.workers.dev/.well-known/api-catalog>; rel="api-catalog"',
  '<https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '<https://agenda-intelligence-a2a.example.workers.dev/.well-known/mcp/server-card.json>; rel="mcp-server-card"',
  '<https://agenda-intelligence-a2a.example.workers.dev/.well-known/did.json>; rel="identity"'
].join(", ");

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

function cisIntakeRequest(payload, origin = "http://localhost:8788") {
  return new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/intake/cis-review", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(payload)
  });
}

const validCisIntake = {
  email: "finance@example.com",
  role_deal_type: "CFO, equipment export",
  blocked: "Payment release",
  evidence_held: "Invoice and a dated OFAC extract",
  reviewer_request: "Evidence for ownership and end use",
  deadline: "Friday",
  locale: "en",
  consent: true,
  website: ""
};

test("CIS review intake stores a validated redacted request with a 30-day retention date", async () => {
  const kv = new MemoryKv();
  const response = await handleCisReviewIntake(cisIntakeRequest(validCisIntake), {
    AGENT_PROFILE: "cis_secondary_sanctions",
    AGENDA_USAGE: kv
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.received, true);
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  const intakeEntries = [...kv.store.entries()].filter(([key]) => key.startsWith("intake:cis-review:"));
  assert.equal(intakeEntries.length, 1);
  const [[key, raw]] = intakeEntries;
  const stored = JSON.parse(raw);
  assert.match(key, /^intake:cis-review:\d{8}:/);
  assert.equal(stored.email, "finance@example.com");
  assert.equal(stored.locale, "en");
  assert.equal(stored.source, "cis-secondary-sanctions-service-page");
  assert.ok(Date.parse(stored.retention_until) > Date.parse(stored.submitted_at));
});

test("CIS review email relay receives a signed redacted payload", async () => {
  const record = {
    request_id: "request-123",
    submitted_at: "2026-08-12T08:00:00.000Z",
    retention_until: "2026-09-11T08:00:00.000Z",
    locale: "en",
    email: "finance@example.com",
    role_deal_type: "CFO, equipment export",
    blocked: "Payment release",
    evidence_held: "Invoice",
    reviewer_request: "Evidence for ownership and end use",
    deadline: "Friday",
    source: "cis-secondary-sanctions-service-page"
  };
  const secret = "test-webhook-secret";
  let receivedEnvelope;
  const result = await sendCisReviewEmailNotification(
    record,
    {
      CIS_REVIEW_EMAIL_WEBHOOK_URL: "https://script.google.com/macros/s/test-deployment/exec",
      CIS_REVIEW_EMAIL_WEBHOOK_SECRET: secret
    },
    async (_url, options) => {
      receivedEnvelope = JSON.parse(options.body);
      return new Response("OK", { status: 200 });
    }
  );

  assert.equal(result.sent, true);
  assert.equal(JSON.parse(receivedEnvelope.payload).request.email, "finance@example.com");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = Uint8Array.from(receivedEnvelope.signature.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
  assert.equal(
    await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(`${receivedEnvelope.timestamp}.${receivedEnvelope.payload}`)
    ),
    true
  );
});

test("CIS review intake succeeds when the email relay rejects the notification", async () => {
  const kv = new MemoryKv();
  let backgroundNotification;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await handleCisReviewIntake(
      cisIntakeRequest(validCisIntake),
      {
        AGENT_PROFILE: "cis_secondary_sanctions",
        AGENDA_USAGE: kv,
        CIS_REVIEW_EMAIL_WEBHOOK_URL: "https://script.google.com/macros/s/test-deployment/exec",
        CIS_REVIEW_EMAIL_WEBHOOK_SECRET: "test-webhook-secret"
      },
      { waitUntil(promise) { backgroundNotification = promise; } },
      async () => new Response("ERROR", { status: 200 })
    );

    assert.equal(response.status, 201);
    assert.equal((await backgroundNotification).sent, false);
    assert.equal([...kv.store.keys()].filter((key) => key.startsWith("intake:cis-review:")).length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

test("CIS review intake rejects untrusted origins and missing required fields", async () => {
  const kv = new MemoryKv();
  const badOrigin = await handleCisReviewIntake(cisIntakeRequest(validCisIntake, "https://example.net"), {
    AGENT_PROFILE: "cis_secondary_sanctions",
    AGENDA_USAGE: kv
  });
  const missingField = await handleCisReviewIntake(
    cisIntakeRequest({ ...validCisIntake, reviewer_request: "" }),
    { AGENT_PROFILE: "cis_secondary_sanctions", AGENDA_USAGE: kv }
  );

  assert.equal(badOrigin.status, 403);
  assert.equal(missingField.status, 422);
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith("intake:cis-review:")).length, 0);
});

test("CIS review intake honeypot returns success without storing spam", async () => {
  const kv = new MemoryKv();
  const response = await handleCisReviewIntake(cisIntakeRequest({ ...validCisIntake, website: "spam" }), {
    AGENT_PROFILE: "cis_secondary_sanctions",
    AGENDA_USAGE: kv
  });

  assert.equal(response.status, 202);
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith("intake:cis-review:")).length, 0);
});

test("CIS review intake rate-limits the sixth request from one address", async () => {
  const kv = new MemoryKv();
  const env = { AGENT_PROFILE: "cis_secondary_sanctions", AGENDA_USAGE: kv };
  let response;
  for (let index = 0; index < 6; index += 1) {
    response = await handleCisReviewIntake(cisIntakeRequest({ ...validCisIntake, email: `cfo${index}@example.com` }), env);
  }
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "3600");
});

test("CIS review intake list requires the existing stats token", async () => {
  const kv = new MemoryKv();
  await handleCisReviewIntake(cisIntakeRequest(validCisIntake), {
    AGENT_PROFILE: "cis_secondary_sanctions",
    AGENDA_USAGE: kv
  });
  const unauthorized = await handleCisReviewIntakeList(
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/intake/cis-review"),
    { AGENT_PROFILE: "cis_secondary_sanctions", AGENDA_USAGE: kv, STATS_TOKEN: "secret" }
  );
  const authorized = await handleCisReviewIntakeList(
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/intake/cis-review", {
      headers: { "x-stats-token": "secret" }
    }),
    { AGENT_PROFILE: "cis_secondary_sanctions", AGENDA_USAGE: kv, STATS_TOKEN: "secret" }
  );
  const wrongProfile = await handleCisReviewIntakeList(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/intake/cis-review", {
      headers: { "x-stats-token": "secret" }
    }),
    { AGENT_PROFILE: "agenda_intelligence", AGENDA_USAGE: kv, STATS_TOKEN: "secret" }
  );

  assert.equal(unauthorized.status, 401);
  assert.equal(authorized.status, 200);
  assert.equal(wrongProfile.status, 404);
  const body = await authorized.json();
  assert.equal(body.count, 1);
  assert.equal(body.records[0].email, "finance@example.com");
});

test("profile registry is the single discovery contract source for deployed profiles", () => {
  const deployedProfiles = [
    "kazakhstan",
    "cis_secondary_sanctions",
    "agentic_interaction_trust",
    "gulf_maritime_exposure",
    "market_entry_readiness"
  ];

  for (const profile of deployedProfiles) {
    const discovery = profileDiscovery(profile);
    assert.equal(PROFILE_REGISTRY[profile].documentation_url, discovery.documentation_url);
    assert.match(discovery.documentation_url, /^https:\/\/github\.com\/vassiliylakhonin\/agenda-intelligence-md\/blob\/main\//);
    assert.match(discovery.product_contract.request_schema, /\/schemas\/v1\/.+-request\.schema\.json$/);
    assert.match(discovery.product_contract.response_schema, /\/schemas\/v1\/.+-response\.schema\.json$/);
    assert.match(discovery.product_contract.source_taxonomy, /\/source-requirements\/.+\.json$/);
    assert.match(discovery.product_contract.runnable_examples, /\/tree\/main\/examples\//);
    assert.equal(discovery.product_contract.canonical_input_mode, "structured_json");
    assert.ok(discovery.product_contract.demo_input_modes.includes("structured_json"));
    assert.ok(discovery.provider_same_as.includes("https://github.com/vassiliylakhonin"));
    assert.ok(discovery.wrapper_scope.includes("A2A/JSON-RPC discovery"));
    assert.ok(discovery.supported_contracts.length > 0);
    assert.ok(discovery.buyer_use_cases.length > 0);
    assert.match(discovery.commercial_positioning, /evidence|triage|readiness/i);
  }

  assert.equal(profileDiscovery("middle_corridor_deal_risk").documentation_url, profileDiscovery("kazakhstan").documentation_url);
  assert.equal(
    profileDiscovery("kazakhstan_market_entry_readiness").product_profile,
    "kazakhstan_market_entry_readiness"
  );
  assert.match(
    profileDiscovery("confidential_project_room").profile_schema,
    /\/schemas\/v1\/confidential-project-room-profile\.schema\.json$/
  );
});

test("Watchman adapter queries real /search path and normalizes grouped results", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(new URL(url));
    return new Response(
      JSON.stringify({
        SDNs: [
          {
            entityID: "18733",
            sdnName: "VTB FACTORING LTD",
            sdnType: "Entity",
            program: ["RUSSIA-EO14024"],
            match: 0.88
          }
        ],
        euConsolidatedSanctionsList: [
          {
            EntityLogicalID: 135346,
            NameAliasWholeNames: ["VEB.RF"],
            EntitySubjectType: "enterprise",
            match: 0.8
          }
        ],
        ukConsolidatedSanctionsList: [
          {
            GroupID: 14195,
            GroupType: "Entity",
            Names: ["VTB", "VTB BANK (PJSC)"],
            match: 1
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  try {
    const result = await matchCounterpartyAgainstWatchman(
      { WATCHMAN_URL: "https://watchman.example.com", AGENDA_USAGE: new MemoryKv() },
      { name: "VTB", jurisdiction: "Russia", maxMatches: 5 }
    );
    assert.equal(result.status, "success");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].pathname, "/search");
    assert.equal(calls[0].searchParams.get("name"), "VTB");
    assert.deepEqual(
      result.matches.map((match) => match.source_type),
      ["ofac_sdn_extract", "eu_consolidated_extract", "uk_ofsi_extract"]
    );
    assert.deepEqual(
      result.matches.map((match) => match.name),
      ["VTB FACTORING LTD", "VEB.RF", "VTB"]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GLEIF adapter resolves LEI, direct parent, and maps ownership source types", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    if (u.pathname.endsWith("/direct-parent")) {
      return new Response(
        JSON.stringify({
          data: {
            id: "PARENT0000000000LEI0",
            attributes: { entity: { legalName: { name: "Meridian Holding LLP" }, legalAddress: { country: "KZ" } } }
          }
        }),
        { status: 200, headers: { "content-type": "application/vnd.api+json" } }
      );
    }
    if (u.pathname.endsWith("/ultimate-parent")) {
      // Normal "no ultimate parent on file" case: GLEIF returns 404 + errors.
      return new Response(JSON.stringify({ errors: [{ status: "404" }] }), {
        status: 404,
        headers: { "content-type": "application/vnd.api+json" }
      });
    }
    // Name search.
    return new Response(
      JSON.stringify({
        data: [
          {
            id: "MERIDIAN00000000LEI0",
            attributes: { entity: { legalName: { name: "Meridian Freight Solutions LLP" }, legalAddress: { country: "KZ" } } }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/vnd.api+json" } }
    );
  };
  try {
    const result = await fetchOwnershipFromGleif(
      { GLEIF_ENABLED: "1", AGENDA_USAGE: new MemoryKv() },
      { name: "Meridian Freight Solutions LLP", jurisdiction: "Kazakhstan" }
    );
    assert.equal(result.status, "success");
    assert.deepEqual(
      result.matches.map((m) => m.source_type),
      ["ownership_chain_evidence", "ownership_chain_evidence"]
    );
    assert.deepEqual(
      result.matches.map((m) => m.relationship_role),
      ["resolved_entity", "direct_parent"]
    );
    assert.equal(result.matches[0].lei, "MERIDIAN00000000LEI0");
    assert.equal(result.matches[1].name, "Meridian Holding LLP");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GLEIF adapter is disabled unless GLEIF_ENABLED is set", async () => {
  const result = await fetchOwnershipFromGleif(
    { AGENDA_USAGE: new MemoryKv() },
    { name: "Some Entity", jurisdiction: "KZ" }
  );
  assert.equal(result.status, "disabled");
  assert.deepEqual(result.matches, []);
});

const SNAPSHOT_FIXTURE = JSON.stringify({
  schema_version: "sanctions-name-index-compact.v1",
  generated_at_utc: "2026-06-26T05:36:01+00:00",
  summary: { source_count: 2, name_count: 3 },
  src: [
    ["US OFAC", "SDN"],
    ["European Union", "EU consolidated financial sanctions"]
  ],
  entries: [
    ["GAZPROM NEFT PJSC", 0],
    ["GAZPROM EXPORT", 0],
    ["SOME UNRELATED COMPANY", 1]
  ]
});

test("Snapshot adapter matches exact + token overlap against the compact index", async () => {
  resetSnapshotCache();
  const originalFetch = globalThis.fetch;
  const calls = [];
  const inits = [];
  globalThis.fetch = async (url, init) => {
    calls.push(new URL(url));
    inits.push(init);
    return new Response(SNAPSHOT_FIXTURE, { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const env = { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" };

    const exact = await matchCounterpartyAgainstSnapshot(env, { name: "Gazprom Export" });
    assert.equal(exact.status, "success");
    assert.equal(calls.length, 1);
    assert.equal(exact.matches[0].name, "GAZPROM EXPORT");
    assert.equal(exact.matches[0].score, 1);
    assert.equal(exact.matches[0].source_type, "ofac_sdn_extract");

    // No `cf` cache override: an edge cache would pin a stale index body
    // independently of this adapter's own TTL and survive isolate restarts,
    // leaving a republished index unreachable.
    assert.equal(inits[0].cf, undefined);

    // Second call reuses the module-global cache (no new fetch).
    const token = await matchCounterpartyAgainstSnapshot(env, { name: "Gazprom Neft" });
    assert.equal(token.status, "success");
    assert.equal(calls.length, 1);
    assert.equal(token.matches[0].name, "GAZPROM NEFT PJSC");

    // An unrelated name finds no match (no false positive).
    const none = await matchCounterpartyAgainstSnapshot(env, { name: "Totally Different Holding" });
    assert.equal(none.status, "success");
    assert.deepEqual(none.matches, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Compact index v2: each row carries a type index into `types`. OFAC SDN really
// does list a Russian supply vessel named after a former head of state, which is
// why a bare name and source list is not enough to act on.
const SNAPSHOT_FIXTURE_V2 = JSON.stringify({
  schema_version: "sanctions-name-index-compact.v2",
  generated_at_utc: "2026-08-24T12:36:26+00:00",
  entry_format: ["name", "source_index", "type_index"],
  summary: { source_count: 2, name_count: 3 },
  src: [
    ["US OFAC", "SDN"],
    ["European Union", "EU consolidated financial sanctions"]
  ],
  types: ["entity", "vessel", "individual"],
  entries: [
    ["GAZPROM NEFT PJSC", 0, 0],
    ["EXAMPLE KZ TRADING LLP", 0, 1],
    ["SOME LISTED PERSON", 1, 2]
  ]
});

test("Snapshot adapter reports the entity type the authority published, not Company for everything", async () => {
  resetSnapshotCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(SNAPSHOT_FIXTURE_V2, { status: 200, headers: { "content-type": "application/json" } });
  try {
    const env = { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" };

    const vessel = await matchCounterpartyAgainstSnapshot(env, { name: "Example KZ Trading LLP" });
    assert.equal(vessel.matches[0].entity_type, "vessel");
    assert.equal(vessel.matches[0].schema, "Vessel");

    resetSnapshotCache();
    const company = await matchCounterpartyAgainstSnapshot(env, { name: "Gazprom Neft PJSC" });
    assert.equal(company.matches[0].entity_type, "entity");
    assert.equal(company.matches[0].schema, "Company");

    resetSnapshotCache();
    const person = await matchCounterpartyAgainstSnapshot(env, { name: "Some Listed Person" });
    assert.equal(person.matches[0].entity_type, "individual");
    assert.equal(person.matches[0].schema, "Person");
  } finally {
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});

test("Snapshot adapter says unknown rather than guessing when the index has no types (v1)", async () => {
  resetSnapshotCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(SNAPSHOT_FIXTURE, { status: 200, headers: { "content-type": "application/json" } });
  try {
    const result = await matchCounterpartyAgainstSnapshot(
      { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" },
      { name: "Gazprom Export" }
    );
    assert.equal(result.matches[0].entity_type, "unknown");
    // Not "Company": an unknown type must not be dressed up as a known one.
    assert.equal(result.matches[0].schema, "LegalEntity");
  } finally {
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});

test("Snapshot adapter degrades to disabled when SNAPSHOT_INDEX_URL is unset", async () => {
  resetSnapshotCache();
  const result = await matchCounterpartyAgainstSnapshot({}, { name: "Gazprom" });
  assert.equal(result.status, "disabled");
  assert.deepEqual(result.matches, []);
});

test("agent card uses request origin for live endpoints", () => {
  const card = agentCard(request);

  assert.equal(card.version, VERSION);
  assert.equal(card.protocolVersion, undefined);
  assert.equal(card.url, undefined);
  assert.equal(card.protocolVersions, undefined);
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
  assert.equal(card.capabilities.stateTransitionHistory, undefined);
  assert.equal(card.provider.legalEntity.type, "individual");
  assert.equal(card.securitySchemes, undefined);
  assert.deepEqual(card.securityRequirements, []);
  assert.equal(card.x_agenda_intelligence.optional_client_identifier_header, "X-Client-Id");
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
  assert.equal(card.skills[0].name, "Sanctions and policy risk signal triage");
  assert.ok(card.skills[0].tags.includes("policy-risk"));
  assert.equal(
    card.x_agenda_intelligence.wrapper_scope,
    "A2A/JSON-RPC discovery, lightweight triage, and routing response only"
  );
});

test("AI catalog advertises real agentic resources without traction claims", () => {
  const catalog = aiCatalog(request);

  assert.equal(catalog.specVersion, "1.0");
  assert.equal(catalog.url, "https://agenda-intelligence-a2a.example.workers.dev/.well-known/ai-catalog.json");
  assert.equal(catalog.host.identifier, "did:web:agenda-intelligence-a2a.example.workers.dev");
  assert.equal(catalog.version, VERSION);
  assert.deepEqual(
    catalog.entries.map((entry) => entry.identifier),
    [
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:agent:agenda-intelligence-md-a2a",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:server:agenda-intelligence-md-mcp",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:endpoint:message-send",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:api:worker-openapi",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:knowledge:okf-bundle",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:entitymap:agenda-intelligence-md",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:artifact:confidential-project-room-profile",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:schema:agenda-intelligence-v1",
      "urn:ai:agenda-intelligence-a2a.example.workers.dev:policy:source-policy"
    ]
  );
  assert.equal(
    catalog.entries.find((entry) => entry.type === "application/a2a-agent-card+json").url,
    "https://agenda-intelligence-a2a.example.workers.dev/.well-known/agent-card.json"
  );
  assert.equal(
    catalog.entries.find((entry) => entry.type === "application/mcp-server-card+json").url,
    "https://agenda-intelligence-a2a.example.workers.dev/.well-known/mcp/server-card.json"
  );
  assert.equal(
    catalog.entries.find((entry) => entry.type === "application/entitymap+json").url,
    "https://agenda-intelligence-a2a.example.workers.dev/entitymap.json"
  );
  assert.equal(
    catalog.entries.find((entry) => entry.type === "application/vnd.oai.openapi+json").url,
    "https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json"
  );
  assert.equal(
    catalog.entries.find((entry) => entry.identifier.endsWith(":knowledge:okf-bundle")).url,
    "https://agenda-intelligence-a2a.example.workers.dev/okf/index.md"
  );
  assert.equal(
    catalog.entries.find((entry) => entry.identifier.endsWith(":artifact:confidential-project-room-profile")).url,
    "https://agenda-intelligence-a2a.example.workers.dev/profiles/confidential-project-room"
  );
  assert.ok(
    catalog.entries
      .find((entry) => entry.identifier.endsWith(":artifact:confidential-project-room-profile"))
      .representativeQueries.includes("confidential project-room evidence-readiness profile")
  );
  assert.ok(catalog.boundaries.includes("This catalog advertises resources, not customer traction."));
});

test("AI catalog route returns catalog JSON and discovery Link header", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/.well-known/ai-catalog.json")
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("link"), expectedDiscoveryLinkHeader);
  assert.equal(body.url, "https://agenda-intelligence-a2a.example.workers.dev/.well-known/ai-catalog.json");
  assert.ok(body.entries.some((entry) => entry.type === "application/mcp-server-card+json"));
});

test("Agenstry ownership proof route serves only a valid configured token", async () => {
  const url = "https://agenda-intelligence-a2a.example.workers.dev/.well-known/agenstry-verify";
  const configured = await handleRequest(new Request(url), {
    AGENSTRY_VERIFY_TOKEN: "  af-verify-test_token-123  "
  });
  assert.equal(configured.status, 200);
  assert.equal(configured.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(configured.headers.get("cache-control"), "no-store");
  assert.equal(await configured.text(), "af-verify-test_token-123");

  for (const env of [{}, { AGENSTRY_VERIFY_TOKEN: "not-an-agenstry-token" }]) {
    const missing = await handleRequest(new Request(url), env);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "Not found");
  }

  const wrongMethod = await handleRequest(new Request(url, { method: "POST" }), {
    AGENSTRY_VERIFY_TOKEN: "af-verify-test_token-123"
  });
  assert.equal(wrongMethod.status, 404);
});

test("API catalog and OpenAPI routes advertise the public worker HTTP contract", async () => {
  const catalog = apiCatalog(request);
  const openapi = openApiDocument(request);

  assert.equal(
    catalog.linkset[0]["service-desc"][0].href,
    "https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json"
  );
  assert.equal(openapi.openapi, "3.0.3");
  assert.equal(openapi.info.version, VERSION);
  assert.ok(openapi.paths["/message/send"].post);
  assert.ok(openapi.paths["/.well-known/ai-catalog.json"].get);
  assert.ok(openapi.paths["/.well-known/agenstry-verify"].get);
  assert.ok(openapi.paths["/okf/index.md"].get);
  assert.ok(openapi.paths["/profiles/confidential-project-room"].get);
  assert.ok(openapi.paths["/profiles/confidential-project-room/redacted-example.json"].get);

  const catalogResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/.well-known/api-catalog")
  );
  const catalogBody = await catalogResponse.json();
  assert.equal(catalogResponse.status, 200);
  assert.equal(catalogResponse.headers.get("content-type"), "application/linkset+json; charset=utf-8");
  assert.equal(catalogResponse.headers.get("link"), expectedDiscoveryLinkHeader);
  assert.equal(catalogBody.linkset[0]["service-desc"][0].title, "Agenda Intelligence MD Worker API (OpenAPI 3.0)");

  const openapiResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json")
  );
  const openapiBody = await openapiResponse.json();
  assert.equal(openapiResponse.status, 200);
  assert.equal(openapiResponse.headers.get("content-type"), "application/vnd.oai.openapi+json; charset=utf-8");
  assert.equal(openapiResponse.headers.get("link"), expectedDiscoveryLinkHeader);
  assert.equal(openapiBody.servers[0].url, "https://agenda-intelligence-a2a.example.workers.dev");
});

test("MCP server card and DID routes advertise installable MCP identity", async () => {
  const card = mcpServerCard(request);
  const did = didDocument(request);

  assert.equal(card.serverInfo.name, "Agenda Intelligence MD MCP Server");
  assert.equal(card.transport.type, "stdio");
  assert.equal(card.transport.command, "agenda-intelligence-mcp");
  assert.ok(card.tools.some((tool) => tool.name === "audit_claims"));
  assert.equal(did.id, "did:web:agenda-intelligence-a2a.example.workers.dev");
  assert.ok(did.service.some((service) => service.type === "MCPServer"));
  assert.ok(did.service.some((service) => service.type === "OpenAPI"));
  assert.ok(did.service.some((service) => service.type === "EvidenceReadinessProfile"));
  assert.equal(card.related.openapi, "https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json");
  assert.equal(
    card.related.confidential_project_room_profile,
    "https://agenda-intelligence-a2a.example.workers.dev/profiles/confidential-project-room"
  );

  const cardResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/.well-known/mcp/server-card.json")
  );
  const cardBody = await cardResponse.json();
  assert.equal(cardResponse.status, 200);
  assert.equal(cardBody.transport.command, "agenda-intelligence-mcp");

  const legacyResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/.well-known/mcp-server.json")
  );
  assert.equal(legacyResponse.status, 200);

  const didResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/.well-known/did.json")
  );
  const didBody = await didResponse.json();
  assert.equal(didResponse.status, 200);
  assert.equal(
    didBody.service.find((service) => service.type === "AICatalog").serviceEndpoint,
    did.service[0].serviceEndpoint
  );
});

test("entity map and OKF routes expose live domain knowledge artifacts", async () => {
  const map = entityMap(request);
  assert.equal(map.url, "https://agenda-intelligence-a2a.example.workers.dev/entitymap.json");
  assert.ok(map.entities.some((entity) => entity.slug === "machine-enforcement-audit"));
  assert.equal(
    map.entities.find((entity) => entity.slug === "confidential-project-room").url,
    "https://agenda-intelligence-a2a.example.workers.dev/profiles/confidential-project-room"
  );
  assert.ok(map.boundaries.includes("Not proof of buyer demand or product-market fit."));

  assert.match(okfMarkdown("/okf/index.md"), /Agenda Intelligence MD Knowledge Bundle/);
  assert.match(okfMarkdown("/okf/confidential-project-room.md"), /Confidential Project-Room Workflow/);
  assert.match(okfMarkdown("/okf/"), /Agenda Intelligence MD Knowledge Bundle/);
  assert.equal(okfMarkdown("/okf/missing.md"), null);
  assert.match(profileContent("/profiles/confidential-project-room"), /Confidential Project-Room Evidence-Readiness Profile/);
  assert.match(
    profileContent("/profiles/confidential-project-room/redacted-example.json"),
    /confidential_project_room/
  );

  const entityResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/entitymap.json")
  );
  const entityBody = await entityResponse.json();
  assert.equal(entityResponse.status, 200);
  assert.equal(entityResponse.headers.get("content-type"), "application/json; charset=utf-8");
  assert.ok(entityBody.entities.some((entity) => entity.slug === "machine-enforcement-audit"));

  const okfResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/okf/index.md")
  );
  const okfBody = await okfResponse.text();
  assert.equal(okfResponse.status, 200);
  assert.equal(okfResponse.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.match(okfBody, /# Agenda Intelligence MD Knowledge Bundle/);

  const okfAliasResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/okf/")
  );
  assert.equal(okfAliasResponse.status, 200);

  const profileResponse = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/profiles/confidential-project-room")
  );
  const profileBody = await profileResponse.text();
  assert.equal(profileResponse.status, 200);
  assert.equal(profileResponse.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.match(profileBody, /# Confidential Project-Room Evidence-Readiness Profile/);

  const profileExampleResponse = await handleRequest(
    new Request(
      "https://agenda-intelligence-a2a.example.workers.dev/profiles/confidential-project-room/redacted-example.json"
    )
  );
  const profileExampleBody = await profileExampleResponse.json();
  assert.equal(profileExampleResponse.status, 200);
  assert.equal(profileExampleResponse.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(profileExampleBody.profile_type, "confidential_project_room");
  assert.equal(profileExampleBody.readiness_contract.profile, "confidential_project_room");
  assert.equal(profileExampleBody.readiness_contract.status, profileExampleBody.readiness.route);
  assert.deepEqual(profileExampleBody.readiness_contract.routing, {
    field: "readiness.route",
    value: profileExampleBody.readiness.route
  });
  assert.equal(profileExampleBody.readiness_contract.human_review_required, true);
  assert.equal(profileExampleBody.readiness_contract.owner_actions.length, profileExampleBody.owner_actions.length);
  assert.match(profileExampleBody.readiness_contract.boundary_notice, /Not a secure data room/);
});

test("generated OKF content matches repository OKF files", () => {
  for (const path of OKF_PATHS) {
    const fileName = path.replace("/okf/", "");
    assert.equal(
      OKF_CONTENT[path],
      readFileSync(new URL(`../../../okf/${fileName}`, import.meta.url), "utf8")
    );
  }
  for (const path of PROFILE_PATHS) {
    const fileName = path.replace("/profiles/", "");
    assert.equal(
      PROFILE_CONTENT[path],
      readFileSync(new URL(`../../../profiles/${fileName}`, import.meta.url), "utf8")
    );
  }
});

test("landing HTML advertises AI catalog endpoint and Link header", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/", {
      headers: { accept: "text/html" }
    })
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("link"), expectedDiscoveryLinkHeader);
  assert.match(body, /AI catalog:/);
  assert.match(body, /MCP card:/);
  assert.match(body, /DID:/);
  assert.match(body, /API catalog:/);
  assert.match(body, /OpenAPI:/);
  assert.match(body, /Entity map:/);
  assert.match(body, /OKF bundle:/);
  assert.match(body, /Project room:/);
  assert.match(body, /<link rel="ai-catalog" href="https:\/\/agenda-intelligence-a2a\.example\.workers\.dev\/\.well-known\/ai-catalog\.json">/);
  assert.ok(body.includes("/.well-known/ai-catalog.json"));
  assert.ok(body.includes("/profiles/confidential-project-room"));
});

test("robots.txt advertises Agentmap for the AI catalog", async () => {
  const body = robotsTxt(request);
  assert.match(body, /User-agent: \*/);
  assert.match(body, /Content-Signal: ai-train=no, search=yes, ai-input=yes/);
  assert.match(body, /User-agent: GPTBot/);
  assert.match(body, /Agentmap: https:\/\/agenda-intelligence-a2a\.example\.workers\.dev\/\.well-known\/ai-catalog\.json/);

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/robots.txt")
  );
  const responseBody = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(responseBody, /Agentmap:/);
});

// The verifier reads a card off the wire, so it must be handed the wire shape.
// Passing `agentCard()` directly hid a real defect: after vendor blocks moved
// into capabilities.extensions[], the verifier still read `x_agent_contract`
// from the card root, and every local test passed while the live check failed
// against the deployed Middle Corridor card on 2026-08-23.
test("agent card verifier accepts the cards as they are actually served", () => {
  const agendaCard = toSpecWireCard(agentCard(request));
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const kazakhstanCard = toSpecWireCard(agentCard(kazakhstanRequest, { AGENT_PROFILE: "kazakhstan" }));
  const agenticRequest = new Request("https://agentic-interaction-trust-a2a.example.workers.dev/message/send");
  const agenticCard = toSpecWireCard(agentCard(agenticRequest, { AGENT_PROFILE: "agentic_interaction_trust" }));

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
  assert.equal(
    card.supportedInterfaces[0].url,
    "https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send"
  );
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
    assert.equal(response.result.status.state, "TASK_STATE_COMPLETED");
    assert.equal(response.result.artifacts[0].parts[0].mediaType, "text/markdown");
    assert.ok("text" in response.result.artifacts[0].parts[0]);
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

test("A2A 1.0 SendMessage returns the required task result wrapper for every active profile", async () => {
  const profiles = [
    ["agenda-intelligence-a2a", "agenda"],
    ["middle-corridor-deal-risk-gate-a2a", "kazakhstan"],
    ["cis-secondary-sanctions-a2a", "cis_secondary_sanctions"],
    ["agentic-interaction-trust-a2a", "agentic_interaction_trust"],
    ["gulf-maritime-exposure-a2a", "gulf_maritime_exposure"],
    ["kazakhstan-market-entry-readiness-a2a", "market_entry_readiness"],
    ["agent-output-verification-a2a", "agent_output_verification"],
    ["corridor-sanctions-assistant-a2a", "corridor_sanctions_assistant"],
    ["dual-use-technology-export-a2a", "dual_use_technology_export"]
  ];
  const originalLog = console.log;
  console.log = () => {};
  try {
    for (const [host, profile] of profiles) {
      const rpcRequest = new Request(`https://${host}.example.workers.dev/message/send`, {
        method: "POST",
        headers: { "a2a-version": "1.0", "content-type": "application/json" }
      });
      const response = await handleJsonRpc(
        {
          jsonrpc: "2.0",
          id: `v1-${profile}`,
          method: "SendMessage",
          params: {
            message: {
              messageId: `heartbeat-${profile}`,
              role: "ROLE_USER",
              parts: [{ text: "A2A conformance heartbeat" }]
            }
          }
        },
        rpcRequest,
        { AGENT_PROFILE: profile }
      );
      assert.equal(response.jsonrpc, "2.0");
      assert.equal(response.id, `v1-${profile}`);
      assert.equal(response.result.status, undefined);
      assert.ok(response.result.task.id);
      assert.ok(response.result.task.contextId);
      assert.ok(response.result.task.status.state.startsWith("TASK_STATE_"));
      assert.ok(Array.isArray(response.result.task.artifacts));
    }
  } finally {
    console.log = originalLog;
  }
});

test("the published Middle Corridor live fixture is a valid A2A 1.0 SendMessage request", async () => {
  const payload = JSON.parse(
    readFileSync(new URL("../../../examples/kazakhstan-middle-corridor/live-agent-request.json", import.meta.url), "utf8")
  );
  const response = await handleJsonRpc(
    payload,
    new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send", {
      method: "POST",
      headers: { "A2A-Version": "1.0" }
    }),
    { AGENT_PROFILE: "kazakhstan" }
  );

  assert.equal(payload.method, "SendMessage");
  assert.ok(payload.params.message.messageId);
  assert.equal(response.result.task.status.state, "TASK_STATE_COMPLETED");
  assert.equal(response.result.task.metadata.product_profile, "kazakhstan");
});

test("A2A 1.0 SendMessage rejects malformed params and unsupported versions", async () => {
  const v1Request = new Request(request.url, {
    method: "POST",
    headers: { "a2a-version": "1.0", "content-type": "application/json" }
  });
  const invalid = await handleJsonRpc(
    { jsonrpc: "2.0", id: "invalid", method: "SendMessage", params: {} },
    v1Request
  );
  assert.equal(invalid.error.code, -32602);
  assert.equal(invalid.error.data[0]["@type"], "type.googleapis.com/google.rpc.BadRequest");

  const unsupportedRequest = new Request(request.url, {
    method: "POST",
    headers: { "a2a-version": "9.9", "content-type": "application/json" }
  });
  const unsupported = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "unsupported",
      method: "SendMessage",
      params: {
        message: {
          messageId: "m-unsupported",
          role: "ROLE_USER",
          parts: [{ text: "ping" }]
        }
      }
    },
    unsupportedRequest
  );
  assert.equal(unsupported.error.code, -32009);
});

// A2A allows either spelling of the role: ROLE_USER from the protobuf
// definition, "user" from the JSON-RPC representation. Until 2026-08-26 the v1
// path accepted only the first, so a client speaking the JSON-RPC form was
// refused over a field that is never read after validation.
//
// This was first attributed to AgenstryBot's daily failures. That attribution
// was wrong — those are the gates refusing a four-character plain-text probe,
// and both spellings fail there identically — so this test asserts the
// conformance property on its own terms and claims no caller behind it.
test("A2A 1.0 SendMessage accepts both spellings of the message role", async () => {
  const v1Request = new Request(request.url, {
    method: "POST",
    headers: { "a2a-version": "1.0", "content-type": "application/json" }
  });

  for (const role of ["ROLE_USER", "user", "ROLE_AGENT", "agent"]) {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: `role-${role}`,
        method: "SendMessage",
        params: {
          message: {
            messageId: `m-role-${role}`,
            role,
            parts: [{ text: "Assess exposure on a Kazakhstan corridor deal." }]
          }
        }
      },
      v1Request
    );
    assert.equal(response.error, undefined, `role ${role} must be accepted`);
    assert.equal(response.result.task.status.state, "TASK_STATE_COMPLETED");
  }

  const bogus = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "role-bogus",
      method: "SendMessage",
      params: {
        message: { messageId: "m-role-bogus", role: "operator", parts: [{ text: "ping" }] }
      }
    },
    v1Request
  );
  assert.equal(bogus.error.code, -32602);
  assert.ok(
    bogus.error.data[0].fieldViolations.some((v) => v.field === "message.role"),
    "an unknown role must still be refused"
  );
});

test("A2A POST returns structured protocol errors for invalid JSON, media type, and oversized bodies", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const invalidJson = await handleRequest(
      new Request(request.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      })
    );
    assert.equal(invalidJson.status, 200);
    assert.equal((await invalidJson.json()).error.code, -32700);

    const wrongMedia = await handleRequest(
      new Request(request.url, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}"
      })
    );
    assert.equal(wrongMedia.status, 415);
    assert.equal((await wrongMedia.json()).error.code, -32005);

    const oversized = await handleRequest(
      new Request(request.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: "x".repeat(1024 * 1024) })
      })
    );
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, -32602);
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

function baseDealRiskRequest(overrides = {}) {
  return {
    route: "Altynkol -> Aktau/Kuryk -> Baku -> Poti -> EU",
    cargo: "dual-use machine tools",
    counterparties: [{ role: "forwarder", name: "KZ Forwarder", jurisdiction: "Kazakhstan" }],
    dated_sources: [{ id: "e1", source_type: "port_operator_notice", title: "x", date: "2026-05-20" }],
    risk_question: "escalate before signature?",
    decision_stage: "pre_signature",
    ...overrides
  };
}

test("worker deal-risk contract flags high-risk jurisdiction (ADR 0015 parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      counterparties: [
        { role: "forwarder", name: "KZ Forwarder", jurisdiction: "Kazakhstan" },
        { role: "consignee", name: "RU Buyer", jurisdiction: "Russia" }
      ]
    })
  );
  assert.ok(resp.top_risks.includes("counterparty in a sanctions-relevant / high-risk jurisdiction"));
  assert.ok(resp.limitations.some((l) => l.includes("not a sanctions determination")));
});

test("worker deal-risk contract flags dual-use cargo (ADR 0015 parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({ cargo: "microcontrollers and RF modules" })
  );
  assert.ok(resp.top_risks.includes("cargo includes a potential dual-use / export-controlled item"));
  assert.ok(resp.limitations.some((l) => l.includes("Common High Priority List")));
  assert.ok(resp.limitations.some((l) => l.includes("not a classification or licensing determination")));
  assert.ok(Array.isArray(resp.reexport_control_indicators));
});

test("worker deal-risk contract: dual-use cargo does not move the structural score (ADR 0015 parity)", () => {
  const benign = dealRiskContractResponseForRequest(baseDealRiskRequest({ cargo: "industrial equipment" }));
  const dualUse = dealRiskContractResponseForRequest(baseDealRiskRequest({ cargo: "microcontrollers and RF modules" }));
  assert.equal(benign.top_risks.includes("cargo includes a potential dual-use / export-controlled item"), false);
  assert.equal(benign.decision_readiness_score, dualUse.decision_readiness_score);
  assert.equal(benign.risk_signal, dualUse.risk_signal);
});

test("worker deal-risk contract: link_integrity is observe-only (Python parity)", () => {
  // No url on any source -> no link_integrity block (field omitted).
  const base = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.equal(base.link_integrity, undefined);

  // Documented example.com placeholder -> illustrative, still no block.
  const illustrative = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [
        { id: "e1", source_type: "port_operator_notice", title: "x", date: "2026-05-20", url: "https://example.com/x" }
      ]
    })
  );
  assert.equal(illustrative.link_integrity, undefined);

  // A malformed url surfaces a flag but must change nothing else.
  const flagged = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "port_operator_notice", title: "x", date: "2026-05-20", url: "ftp://tbd" }]
    })
  );
  assert.ok(flagged.link_integrity);
  assert.ok(flagged.link_integrity.checked >= 1);
  assert.ok(flagged.link_integrity.flagged.some((f) => f.url === "ftp://tbd"));

  // Observe-only: verdict-bearing fields match the no-url base run.
  assert.equal(flagged.triage_recommendation, base.triage_recommendation);
  assert.equal(flagged.risk_signal, base.risk_signal);
  assert.equal(flagged.decision_readiness_score, base.decision_readiness_score);
  assert.deepEqual(flagged.minimum_sources_before_go, base.minimum_sources_before_go);
});

test("worker deal-risk contract: dual-use without end-user evidence flags the gap (Python parity)", () => {
  const phrase = "no end-user / re-export evidence is on hand";
  const without = dealRiskContractResponseForRequest(baseDealRiskRequest({ cargo: "microcontrollers and RF modules" }));
  assert.ok(without.limitations.some((l) => l.includes(phrase)));
  const withEus = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      cargo: "microcontrollers and RF modules",
      dated_sources: [
        { id: "e1", source_type: "port_operator_notice", title: "x", date: "2026-05-20" },
        { id: "e2", source_type: "end_user_or_reexport_evidence", title: "EUS", date: "2026-05-22" }
      ]
    })
  );
  assert.equal((withEus.limitations || []).some((l) => l.includes(phrase)), false);
  assert.equal(withEus.decision_readiness_score, without.decision_readiness_score);
});

test("worker deal-risk contract flags re-export / circumvention-watch (Armenia), not as sanctioned", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      counterparties: [
        { role: "forwarder", name: "KZ Forwarder", jurisdiction: "Kazakhstan" },
        { role: "consignee", name: "Intermediary", jurisdiction: "Armenia" }
      ]
    })
  );
  assert.ok(resp.top_risks.includes("counterparty in a re-export / circumvention-watch jurisdiction"));
  assert.equal(resp.top_risks.includes("counterparty in a sanctions-relevant / high-risk jurisdiction"), false);
  assert.ok(resp.limitations.some((l) => l.includes("diversion watch item")));
});

test("worker deal-risk contract emits an operational_decision booking verb (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(["proceed", "proceed_with_conditions", "hold", "escalate"].includes(resp.operational_decision.decision));
  // base request: pre_signature, required-before-go evidence missing -> escalate
  assert.equal(resp.operational_decision.decision, "escalate");
  assert.ok(resp.operational_decision.applies_to.length > 0);
  assert.ok(resp.operational_decision.rationale.length > 0);
  // the gate never issues a hard reject - that is a compliance/legal call
  assert.equal(/\breject\b/i.test(resp.operational_decision.rationale), false);
});

test("worker deal-risk contract flags counterparty.specified_sectors[] under OFAC EO 14024 (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      counterparties: [
        {
          role: "consignee",
          name: "KZ Industries",
          jurisdiction: "Kazakhstan",
          specified_sectors: ["manufacturing", "technology"]
        }
      ]
    })
  );
  assert.ok(resp.top_risks.includes("counterparty operates in an OFAC-named sector under EO 14024"));
  assert.ok(resp.limitations.some((l) => l.includes("OFAC-named sector")));
  assert.ok(resp.limitations.some((l) => l.includes("not a sanctions determination")));
  const foreign = resp.exposure_layers.foreign_sanctions_exposure_layer.join(" ");
  assert.ok(foreign.includes("OFAC-named sector"));
});

test("worker deal-risk contract: counterparty.specified_sectors=['other'] only is NOT flagged (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      counterparties: [
        {
          role: "forwarder",
          name: "KZ Forwarder",
          jurisdiction: "Kazakhstan",
          specified_sectors: ["other"]
        }
      ]
    })
  );
  assert.equal(resp.top_risks.includes("counterparty operates in an OFAC-named sector under EO 14024"), false);
});

test("worker deal-risk contract flags counterparty.date_of_formation post-2022-02-24 in transshipment hub (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      counterparties: [
        {
          role: "consignee",
          name: "KZ NewCo",
          jurisdiction: "Kazakhstan",
          date_of_formation: "2022-03-15"
        }
      ]
    })
  );
  assert.ok(resp.top_risks.includes("counterparty newly formed in a transshipment-risk jurisdiction"));
  assert.ok(resp.limitations.some((l) => l.includes("newly formed")));
  assert.ok(resp.limitations.some((l) => l.includes("not a sanctions determination")));
});

test("worker deal-risk contract: counterparty.date_of_formation pre-2022-02-24 is NOT flagged (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      counterparties: [
        {
          role: "forwarder",
          name: "KZ Old Co",
          jurisdiction: "Kazakhstan",
          date_of_formation: "2018-06-01"
        }
      ]
    })
  );
  assert.equal(resp.top_risks.includes("counterparty newly formed in a transshipment-risk jurisdiction"), false);
});

test("worker deal-risk contract surfaces Caspian capacity / draft language in top_risks and watch_next (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.top_risks.includes("Caspian crossing capacity and draft exposure"));
  assert.equal(resp.top_risks.includes("Caspian chokepoint dependency"), false);
  assert.ok(resp.watch_next.includes("Caspian ferry-slot, tonnage, or draft notice"));
});

test("worker deal-risk contract exposes two-layer exposure + vessel DSP checklist", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.exposure_layers.domestic_legal_layer.length > 0);
  assert.ok(resp.exposure_layers.foreign_sanctions_exposure_layer.length > 0);
  // vessel history is not supplied -> DSP checklist surfaced
  assert.ok(resp.vessel_due_diligence_indicators.some((i) => i.toLowerCase().includes("ais")));
  // boundary: never asserts clearance
  const blob = JSON.stringify(resp).toLowerCase();
  for (const word of ["cleared", "approved", "sanctions safe"]) assert.equal(blob.includes(word), false);
});

test("worker deal-risk contract omits vessel checklist when vessel history supplied", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "vessel_or_carrier_history", title: "x", date: "2026-05-20" }]
    })
  );
  assert.equal("vessel_due_diligence_indicators" in resp, false);
});

test("worker deal-risk contract emits outward counterparty_readiness (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "sanctions_list_extract", title: "x", date: "2026-05-21" }]
    })
  );
  const readiness = resp.counterparty_readiness;
  assert.equal(readiness.status, "partial");
  assert.equal(readiness.required_total, 6);
  assert.equal(readiness.supplied_count + readiness.missing_count, readiness.required_total);
  assert.equal(readiness.supplied_count, 1);
  // outstanding documents must equal the required-before-go gaps surfaced in the response
  assert.deepEqual([...readiness.outstanding_documents].sort(), [...resp.minimum_sources_before_go].sort());
  // boundary: completeness note must not imply clearance
  const note = readiness.presentable_note.toLowerCase();
  for (const word of ["cleared", "approved", "compliant", "sanctions safe"]) assert.equal(note.includes(word), false);
});

test("worker deal-risk contract counterparty_readiness completes when all required supplied", () => {
  const required = [
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "sanctions_list_extract",
    "customs_or_regulatory_source",
    "insurance_clause_or_underwriter_note",
    "vessel_or_carrier_history"
  ];
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: required.map((src, i) => ({ id: `e${i}`, source_type: src, title: "x", date: "2026-05-20" }))
    })
  );
  assert.equal(resp.counterparty_readiness.status, "complete_for_review");
  assert.equal(resp.counterparty_readiness.missing_count, 0);
  assert.deepEqual(resp.counterparty_readiness.outstanding_documents, []);
});

test("worker deal-risk contract counterparty_readiness document_ledger tracks status + date (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "sanctions_list_extract", title: "x", date: "2026-05-21" }]
    })
  );
  const ledger = resp.counterparty_readiness.document_ledger;
  assert.equal(ledger.length, 6);
  const byType = Object.fromEntries(ledger.map((e) => [e.source_type, e]));
  assert.equal(byType.sanctions_list_extract.status, "received");
  assert.equal(byType.sanctions_list_extract.date_received, "2026-05-21");
  assert.equal(byType.beneficial_ownership_source.status, "missing");
  assert.equal("date_received" in byType.beneficial_ownership_source, false);
  const received = ledger.filter((e) => e.status === "received");
  assert.equal(received.length, resp.counterparty_readiness.supplied_count);
});

test("worker deal-risk contract surfaces reexport_control_indicators when end-user evidence missing (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.reexport_control_indicators.length > 0);
  const blob = resp.reexport_control_indicators.join(" ").toLowerCase();
  assert.ok(blob.includes("no-re-export"));
  assert.ok(blob.includes("end-user"));
  for (const word of ["cleared", "approved", "sanctions safe"]) assert.equal(blob.includes(word), false);
});

test("worker deal-risk contract omits reexport_control_indicators when end-user evidence supplied", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      // benign cargo so the dual-use presence flag does not independently surface the checklist
      cargo: "industrial equipment",
      dated_sources: [{ id: "e1", source_type: "end_user_or_reexport_evidence", title: "EUS", date: "2026-05-22" }]
    })
  );
  assert.equal("reexport_control_indicators" in resp, false);
});

test("worker deal-risk contract surfaces source_of_funds_indicators when SOF/SOW evidence missing (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.source_of_funds_indicators.length > 0);
  const blob = resp.source_of_funds_indicators.join(" ").toLowerCase();
  assert.ok(blob.includes("source of funds"));
  assert.ok(blob.includes("source of wealth"));
  for (const word of ["cleared", "approved", "sanctions safe"]) assert.equal(blob.includes(word), false);
});

test("worker deal-risk contract omits source_of_funds_indicators when SOF/SOW evidence supplied", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "source_of_funds_or_wealth_evidence", title: "SOF", date: "2026-05-22" }]
    })
  );
  assert.equal("source_of_funds_indicators" in resp, false);
});

test("worker deal-risk contract surfaces pep_screening_indicators when PEP evidence missing (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.pep_screening_indicators.length > 0);
  const blob = resp.pep_screening_indicators.join(" ").toLowerCase();
  assert.ok(blob.includes("pep"));
  assert.ok(blob.includes("close associates"));
  for (const word of ["cleared", "approved", "sanctions safe"]) assert.equal(blob.includes(word), false);
});

test("worker deal-risk contract omits pep_screening_indicators when PEP evidence supplied", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "pep_screening_evidence", title: "PEP", date: "2026-05-22" }]
    })
  );
  assert.equal("pep_screening_indicators" in resp, false);
});

test("worker deal-risk contract surfaces front_company_indicators when business-substance evidence missing (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.front_company_indicators.length > 0);
  const blob = resp.front_company_indicators.join(" ").toLowerCase();
  assert.ok(blob.includes("business substance"));
  assert.ok(blob.includes("power of attorney"));
  for (const word of ["cleared", "approved", "sanctions safe", "is a shell"]) assert.equal(blob.includes(word), false);
});

test("worker deal-risk contract omits front_company_indicators when business-substance evidence supplied", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({
      dated_sources: [{ id: "e1", source_type: "business_substance_evidence", title: "Substance", date: "2026-05-22" }]
    })
  );
  assert.equal("front_company_indicators" in resp, false);
});

test("worker deal-risk contract ships route-sanctions and customs-harmonization layers (Python parity)", () => {
  const resp = dealRiskContractResponseForRequest(baseDealRiskRequest());
  assert.ok(resp.route_sanctions_exposure_indicators.length > 0);
  assert.ok(resp.customs_harmonization_indicators.length > 0);
  const blob = `${resp.route_sanctions_exposure_indicators.join(" ")} ${resp.customs_harmonization_indicators.join(
    " "
  )}`.toLowerCase();
  assert.ok(blob.includes("ofac"));
  assert.ok(blob.includes("etir"));
  for (const word of ["cleared", "approved", "compliant", "sanctions safe"]) assert.equal(blob.includes(word), false);
  // Clean base route: no sanctions-exposed segment matched.
  assert.equal("route_sanctions_matched_segments" in resp, false);
});

test("worker deal-risk contract presence-flags a sanctions-exposed route segment (ADR 0015)", () => {
  const resp = dealRiskContractResponseForRequest(
    baseDealRiskRequest({ route: "Bandar Abbas -> Rasht-Astara -> Baku -> Poti" })
  );
  assert.ok(resp.route_sanctions_matched_segments.length > 0);
  assert.ok(resp.route_sanctions_matched_segments.some((s) => s.includes("Iran")));
  assert.ok(resp.limitations.some((l) => l.includes("route-screening escalation flag for human review")));
  // Boundary: presence-flag, not a determination.
  assert.ok(resp.limitations.some((l) => l.includes("not a sanctions determination")));
});

test("message/send accepts the newer EDD source types and suppresses their checklists (enum parity)", async () => {
  // Regression: the worker MC_SOURCE_TYPES enum was narrower than the Python
  // schema, so a structured request *supplying* these four EDD source types was
  // rejected by middleCorridorEnumErrors before reaching the contract builder.
  // The omit-when-supplied unit tests above bypass that path by calling the
  // builder directly; this exercises the full message/send enum-validation path.
  const kazakhstanRequest = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const structured = {
      route: "Altynkol -> Aktau -> Baku -> Poti",
      cargo: "industrial equipment",
      counterparties: [{ role: "forwarder", name: "KZ forwarder", jurisdiction: "Kazakhstan" }],
      dated_sources: [
        { id: "e1", source_type: "end_user_or_reexport_evidence", title: "EUS", date: "2026-05-22" },
        { id: "e2", source_type: "source_of_funds_or_wealth_evidence", title: "SOF", date: "2026-05-22" },
        { id: "e3", source_type: "pep_screening_evidence", title: "PEP", date: "2026-05-22" },
        { id: "e4", source_type: "business_substance_evidence", title: "Substance", date: "2026-05-22" }
      ],
      risk_question: "Escalate before signature?",
      decision_stage: "pre_signature"
    };
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "edd-enum", method: "message/send", params: { request: structured } },
      kazakhstanRequest,
      { AGENT_PROFILE: "kazakhstan" }
    );

    // Accepted, not rejected as an invalid request.
    assert.equal(response.result.status.state, "TASK_STATE_COMPLETED");
    assert.notEqual(response.result.metadata.valid, false);

    const jsonPart = response.result.artifacts[0].parts.find((p) => p.mediaType === "application/json");
    const contract = jsonPart.data;
    assert.equal(typeof contract.decision_readiness_score, "number");
    // Each checklist is suppressed because its evidence was supplied.
    assert.equal("reexport_control_indicators" in contract, false);
    assert.equal("source_of_funds_indicators" in contract, false);
    assert.equal("pep_screening_indicators" in contract, false);
    assert.equal("front_company_indicators" in contract, false);
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
    assert.equal(contract.readiness_contract.profile, "middle_corridor_deal_risk");
    assert.equal(contract.readiness_contract.status, contract.decision_readiness_label);
    assert.equal(contract.readiness_contract.score, contract.decision_readiness_score);
    assert.deepEqual(contract.readiness_contract.signal, { field: "risk_signal", value: contract.risk_signal });
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

    // The DataPart surfaces the deal-risk contract itself, not the full routing triage.
    const dataPart = response.result.artifacts[0].parts.find((part) => "data" in part);
    assert.ok(dataPart, "expected a data part in the artifact");
    assert.equal(dataPart.mediaType, "application/json");
    assert.equal(dataPart.data.triage_recommendation, "escalate_before_signature");
    assert.equal(dataPart.data.decision_readiness_score, 42);
    assert.deepEqual(dataPart.data.readiness_contract, contract.readiness_contract);
    assert.equal(dataPart.data.signal_screen, undefined);
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
  assert.equal(event.event_version, 5);
  assert.equal(event.path, "/message/send");
  assert.equal(event.jsonrpc_method, "message/send");
  assert.equal(event.request_kind, "a2a_action");
  assert.equal(event.agent_profile, "agenda");
  assert.equal(event.prompt_chars, 68);
  assert.deepEqual(event.modules_used, [
    "global-think-tank-analyst",
    "central-asia-caspian",
    "sanctions-sector"
  ]);
  assert.equal(event.client, "agenstry");
  assert.equal(event.traffic_class, "machine_probe");
  assert.equal(event.referrer_host, "agenstry.com");
  assert.equal(event.likely_probe, true);
  assert.equal(event.prompt_text, undefined);
  assert.equal(event.cookie, undefined);
  assert.equal(event.authorization, undefined);
  assert.equal(event.ip, undefined);
});

// A gate needs a structured payload, so a question written in prose measures
// zero against its schema — and until 2026-08-27 that zero was what
// prompt_chars reported and what likely_probe was derived from. The archive
// keeps whole rows only for non-probes, so the one caller worth reading about
// would have been the one it threw away.
test("a prose question to a gate is measured by what arrived, not by what parsed", async () => {
  const question =
    "We are moving transformer components from Aktau to Baku for a substation upgrade " +
    "and the buyer's compliance team asked whether the freight forwarder's ownership " +
    "chain needs to be evidenced before the shipment moves. What do you need from us?";
  assert.ok(question.length > 100, "the fixture must be longer than a probe");

  const logged = [];
  const originalLog = console.log;
  console.log = (event) => {
    if (event && event.event === "agenda_intelligence_a2a_usage") logged.push(event);
  };
  try {
    await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "prose-to-gate",
        method: "SendMessage",
        params: { message: { messageId: "m-prose", role: "ROLE_USER", parts: [{ text: question }] } }
      },
      new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", {
        method: "POST",
        headers: { "a2a-version": "1.0", "content-type": "application/json" }
      }),
      {},
      {}
    );
  } finally {
    console.log = originalLog;
  }

  assert.equal(logged.length, 1, "the call must produce exactly one usage event");
  const [event] = logged;
  assert.equal(event.prompt_chars, question.length, "prompt_chars is the size of what the caller sent");
  assert.equal(event.structured_chars, 0, "structured_chars still reports what the gate could parse");
  assert.equal(event.likely_probe, false, "a request this size is not a probe because a schema rejected it");
  assert.equal(event.event_version, 5);
});

test("usage analytics records modules for single-profile worker branches", () => {
  // The vertical worker branches pass plain strings rather than the
  // [{ module, role }] shape the routed analyze path emits. Both must survive
  // into the event — reading .module off a string used to yield [undefined],
  // so every profile except the routed one reported no modules at all.
  const event = buildUsageEvent(
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", { method: "POST" }),
    {
      jsonrpc_method: "message/send",
      jsonrpc_id_present: true,
      prompt_chars: 640,
      modules_used: ["cis_secondary_sanctions"]
    }
  );

  assert.deepEqual(event.modules_used, ["cis_secondary_sanctions"]);
});

test("usage analytics keeps the caller network and user agent for unrecognised clients", () => {
  const event = buildUsageEvent(
    {
      url: "https://cis-secondary-sanctions-a2a.example.workers.dev/message/send",
      method: "POST",
      headers: new Headers({ "user-agent": "acme-agent-runtime/0.4 (+https://example.org/agent)" }),
      cf: { country: "SG", colo: "SIN", asOrganization: "Example Cloud Ltd" }
    },
    {
      jsonrpc_method: "message/send",
      jsonrpc_id_present: true,
      prompt_chars: 512
    }
  );

  assert.equal(event.client, "unknown");
  assert.equal(event.user_agent, "acme-agent-runtime/0.4 (+https://example.org/agent)");
  assert.equal(event.cf.as_org, "Example Cloud Ltd");
  assert.equal(event.cf.colo, "SIN");
  assert.equal(event.ip, undefined);
});

test("the origin root carries the descriptive fields a directory copies", () => {
  // Directories that register the root as the card URL never follow the
  // agent_card link, and their public entry ends up as a bare name. Observed
  // 2026-08-14 on agent-tools.cloud for two of the listed workers.
  for (const profile of ["agenda", "corridor_sanctions_assistant", "cis_secondary_sanctions"]) {
    const info = healthInfo(new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/"), {
      AGENT_PROFILE: profile
    });

    assert.ok(info.description && info.description.length > 80, `${profile}: root has no usable description`);
    assert.ok(info.provider?.organization, `${profile}: root names no provider`);
    assert.ok(Array.isArray(info.skills) && info.skills.length > 0, `${profile}: root declares no skills`);
    for (const skill of info.skills) {
      assert.ok(skill.id && skill.name, `${profile}: skill entry missing id or name`);
    }
    // The links stay: a crawler that does follow them must still find them.
    assert.match(info.agent_card, /\/\.well-known\/agent-card\.json$/);
  }
});

test("every landing page offers a human a way to make contact", () => {
  // The agent card always carried `support.email`, so machines could reach a
  // person. The HTML page could not — measured 2026-08-14 across all eight
  // profiles, which made every human visit a dead end.
  for (const host of [
    "agenda-intelligence-a2a",
    "cis-secondary-sanctions-a2a",
    "middle-corridor-deal-risk-gate-a2a",
    "agent-output-verification-a2a"
  ]) {
    const html = landingHtml(new Request(`https://${host}.example.workers.dev/`), {});
    assert.ok(html.includes("Talk to a person"), `${host}: no contact section`);
    assert.ok(html.includes("mailto:vassiliy.lakhonin@gmail.com"), `${host}: no email`);
    assert.ok(html.includes("https://github.com/vassiliylakhonin"), `${host}: no provider link`);
  }
});

test("the contact link names the profile so replies can be attributed", () => {
  const html = landingHtml(new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/"), {
    AGENT_PROFILE: "cis_secondary_sanctions"
  });

  assert.ok(html.includes("subject=CIS%20Secondary-Sanctions%20Exposure"));
});

test("funnel events cover the steps before a call and skip operational noise", () => {
  const step = (path) =>
    funnelStepForPath(new URL(`https://cis-secondary-sanctions-a2a.example.workers.dev${path}`).pathname);

  assert.equal(step("/"), "landing");
  assert.equal(step("/.well-known/agent-card.json"), "card");
  assert.equal(step("/.well-known/ai-catalog.json"), "discovery");
  assert.equal(step("/entitymap.json"), "discovery");
  assert.equal(step("/okf/index.md"), "docs");
  // Health checks and the private stats read are not funnel steps: they would
  // bury the handful of real visits under monitoring traffic.
  assert.equal(step("/health"), null);
  assert.equal(step("/stats"), null);
  assert.equal(step("/robots.txt"), null);
  assert.equal(step("/.well-known/agenstry-verify"), null);
});

test("funnel event names the visitor without storing an address", () => {
  const event = logFunnelEvent(
    {
      url: "https://cis-secondary-sanctions-a2a.example.workers.dev/.well-known/agent-card.json",
      method: "GET",
      headers: new Headers({ "user-agent": "acme-agent-runtime/0.4", referer: "https://agenstry.com/agents/x" }),
      cf: { country: "SG", colo: "SIN", asOrganization: "Example Cloud Ltd" }
    },
    "card"
  );

  assert.equal(event.event, "agenda_intelligence_a2a_funnel");
  assert.equal(event.event_version, 3);
  assert.equal(event.step, "card");
  assert.equal(event.request_kind, "discovery");
  assert.equal(event.traffic_class, "machine_client");
  assert.equal(event.as_org, "Example Cloud Ltd");
  assert.equal(event.referrer_host, "agenstry.com");
  assert.equal(event.user_agent, "acme-agent-runtime/0.4");
  assert.equal(event.ip, undefined);
});

// The four caller kinds and the calling-zone header. What makes these worth a
// contract test rather than a comment: the classification decides which number
// gets reported as usage, and the previous version of that number was wrong in
// exactly this way — service probes counted as real callers for weeks.
// The gap this closes: measured 2026-08-22 against the live endpoint, a
// successful message/send to the base profile returned agent_card, repository,
// package, mcp_transport, modules_used and triage, and no contact anywhere in
// the payload. The only external non-probe caller on record took exactly that
// path, from another Worker, with no user agent, referer or origin —
// unidentifiable from the logs and never going to render an HTML page.
test("a successful response hands the caller a way to reach a person", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: { message: { role: "user", parts: [{ kind: "text", text: "Kazakhstan corridor sanctions exposure" }] } }
    },
    new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  const engagement = response.result.metadata.engagement;
  assert.equal(engagement.contact_email, "vassiliy.lakhonin@gmail.com");
  assert.equal(engagement.human_page, "https://agenda-intelligence-a2a.example.workers.dev");
  assert.ok(engagement.offer.length > 0);
  assert.ok(engagement.next_step.includes("before work starts"));
  // No price, and no claim about who already uses this. Both are the failure
  // mode this repository's honesty rules name, and both are easy to add later
  // without noticing, so the build fails on them rather than a reviewer.
  const text = JSON.stringify(engagement);
  assert.ok(!/[$\u20ac\u00a3]\s?\d|\bUSD\b|\bEUR\b/.test(text), `engagement block must not quote a price: ${text}`);
  assert.ok(!/trusted by|customers|clients use|join \d/i.test(text), "engagement block must not claim traction");
});

// The gap the metadata block still left open: a caller that reads only the
// text part never sees `metadata.engagement`. Measured 2026-08-25, the one
// external caller that came back on a second day posts plain HTTP and takes
// the markdown part, so the contact has to be in the prose too — and has to
// stay the same string as the metadata, which is why both are asserted here
// against one source.
test("the response text part carries the same contact as the metadata", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: { message: { role: "user", parts: [{ kind: "text", text: "Gulf sanctions exposure on a cargo" }] } }
    },
    new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  const engagement = response.result.metadata.engagement;
  const markdown = response.result.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;

  assert.ok(markdown.includes(engagement.contact_email), "text part must carry the contact email");
  assert.ok(markdown.includes(engagement.offer), "text part must carry the same offer wording as the metadata");
  assert.ok(markdown.includes(engagement.next_step), "text part must carry the same next step as the metadata");
  assert.ok(markdown.includes(engagement.human_page), "text part must point at a page a person can read");
  // Same honesty rules as the metadata block: no price, no claimed traction.
  assert.ok(!/[$\u20ac\u00a3]\s?\d|\bUSD\b|\bEUR\b/.test(markdown), "response text must not quote a price");
  assert.ok(
    !/trusted by|customers|clients use|join \d/i.test(markdown),
    "response text must not claim traction"
  );
});

// Measured 2026-08-25 against the live endpoint by calling it the way a
// machine does: `params: {}` and `parts: []` both came back
// TASK_STATE_COMPLETED with a full routing note. Every structured gate refuses
// that input and says what it needs; the base profile told the caller its
// malformed request had worked, and logged it as a completed call.
test("a request with nothing in it is refused, not completed", async () => {
  for (const params of [{}, { message: { role: "user", parts: [] } }, { message: { role: "user", parts: [{ kind: "text", text: "   " }] } }]) {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "1", method: "message/send", params },
      new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" })
    );

    const task = response.result;
    // ADR 0026 case 1: the caller sent nothing structured, an empty message
    // included. Not completed — the point of this test — but not failed either;
    // nothing failed, the gate is saying what it needs.
    assert.notEqual(task.status.state, "TASK_STATE_COMPLETED", `empty params must not complete: ${JSON.stringify(params)}`);
    assert.equal(task.status.state, "TASK_STATE_INPUT_REQUIRED", `empty params ask for input: ${JSON.stringify(params)}`);
    const data = task.artifacts[0].parts.find((part) => part.mediaType === "application/json").data;
    assert.equal(data.valid, false);
    assert.ok(data.errors.length > 0, "a refusal must say why it stopped");
    assert.ok(data.required_fields.length > 0, "a refusal must say what it needs");
    // The example it hands back has to be a request this endpoint accepts,
    // otherwise the guidance sends the caller round the same loop.
    const retry = await handleJsonRpc(
      { ...data.example_request },
      new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" })
    );
    assert.equal(retry.result.status.state, "TASK_STATE_COMPLETED", "the example request must work");
  }
});

// ADR 0026 draws its line at a caller who sent *nothing*. A caller who named the
// counterparty and its jurisdiction sent the subject of the review, and the gate
// can answer that without inventing anything: no dated sources scores 0/100 with
// signal `unknown` and recommendation `insufficient_information`. Refusing it
// sent a would-be client away with a schema lecture instead of their gap list.
test("a counterparty with no evidence pack yet gets a first pass, not a refusal", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [{ kind: "data", data: { counterparty: { name: "Alatau Trading LLP", jurisdiction: "Kazakhstan" } } }]
        }
      }
    },
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  const task = response.result;
  assert.equal(task.status.state, "TASK_STATE_COMPLETED");

  const data = task.artifacts[0].parts.find((part) => part.mediaType === "application/json").data;
  // Nothing was screened, and the response has to keep saying so. A defaulted
  // facet must never surface as an exposure finding about a named company.
  assert.equal(data.secondary_exposure_signal, "unknown");
  assert.equal(data.triage_recommendation, "insufficient_information");
  assert.equal(data.decision_readiness_score, 0);
  assert.deepEqual(data.supplied_sources, []);
  assert.equal(data.human_review_required, true);
  assert.ok(data.minimum_sources_before_review.length > 0, "a first pass must say what to bring back");

  // The defaults are disclosed in the same artifact as the score, so the caller
  // cannot read `ownership_or_control` as something the gate concluded.
  const markdown = task.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;
  assert.match(markdown, /First pass from counterparty only\./);
  for (const field of ["exposure_facets", "dated_sources", "risk_question", "decision_stage"]) {
    assert.ok(markdown.includes(field), `the defaulted field ${field} must be named in the artifact`);
  }

  // The completion marker is a Symbol so it cannot leak into the wire response.
  assert.ok(!JSON.stringify(data).includes("defaultedRequestFields"));
});

// The same second pass, across every gate that takes it. The assertion that
// matters is not that the call completes — it is that a gate handed no evidence
// still reports it has none. A confident verdict here would be invented.
const MINIMAL_FIRST_PASS_GATES = [
  {
    host: "agentic-interaction-trust-a2a",
    subject: { actor: { declared_type: "ai_agent", declared_name: "PartnerBot" }, target_surface: "api", requested_action: "issue a refund" },
    expect: { trust_signal: "unknown", triage_recommendation: "insufficient_information" },
    defaulted: ["dated_sources", "risk_question", "decision_stage"]
  },
  {
    host: "gulf-maritime-exposure-a2a",
    subject: { voyage: { chokepoint: "strait_of_hormuz" } },
    expect: { exposure_signal: "unknown", triage_recommendation: "insufficient_information" },
    defaulted: ["exposure_facets", "dated_sources", "risk_question", "decision_stage"]
  },
  {
    host: "kazakhstan-market-entry-readiness-a2a",
    subject: { project_name: "Alatau showroom", partner_or_company: "Alatau Trading LLP", market: "Kazakhstan" },
    expect: { readiness_label: "insufficient_information" },
    defaulted: ["supplied_sources", "decision_question", "decision_stage"]
  },
  {
    host: "critical-minerals-due-diligence-a2a",
    subject: { project_name: "Balkhash offtake", commodity: "copper", origin_jurisdiction: "Kazakhstan" },
    expect: { risk_signal: "unknown", triage_recommendation: "insufficient_information" },
    defaulted: ["supplied_sources", "decision_question", "decision_stage"]
  }
];

test("every gate that takes a first pass reports it has no evidence, and says what it defaulted", async () => {
  for (const gate of MINIMAL_FIRST_PASS_GATES) {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "1", method: "message/send", params: { message: { role: "user", parts: [{ kind: "data", data: gate.subject }] } } },
      new Request(`https://${gate.host}.example.workers.dev/message/send`, { method: "POST" })
    );

    const task = response.result;
    assert.equal(task.status.state, "TASK_STATE_COMPLETED", `${gate.host} should answer a named subject`);

    const data = task.artifacts[0].parts.find((part) => part.mediaType === "application/json").data;
    for (const [field, value] of Object.entries(gate.expect)) {
      assert.equal(data[field], value, `${gate.host}: ${field} must stay ${value} with no evidence supplied`);
    }

    const markdown = task.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;
    assert.match(markdown, /First pass from /, `${gate.host} must disclose the first pass`);
    for (const field of gate.defaulted) {
      assert.ok(markdown.includes(field), `${gate.host} must name the defaulted field ${field}`);
    }

    const empty = await handleJsonRpc(
      { jsonrpc: "2.0", id: "2", method: "message/send", params: {} },
      new Request(`https://${gate.host}.example.workers.dev/message/send`, { method: "POST" })
    );
    assert.equal(empty.result.status.state, "TASK_STATE_INPUT_REQUIRED", `${gate.host} must still refuse an empty request`);
  }
});

// Dual-use has no signal field; its verdict lives on the triage block, and it
// has to name the absence rather than score around it.
test("the dual-use gate says outright that no sources were supplied", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [
            {
              kind: "data",
              data: { shipment: { hs_code: "8542.31", description: "microcontrollers", origin: "Germany", destination: "Kazakhstan" } }
            }
          ]
        }
      }
    },
    new Request("https://dual-use-technology-export-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  assert.equal(response.result.status.state, "TASK_STATE_COMPLETED");
  const data = response.result.artifacts[0].parts.find((part) => part.mediaType === "application/json").data;
  assert.equal(data.export_risk_triage.status, "not_decision_ready");
  assert.ok(
    data.export_risk_triage.primary_risk_vectors.some((vector) => vector.includes("No dated supporting sources")),
    "the absence of sources has to be stated, not scored around"
  );
});

// `pre_action_check` is the one gate still held out, and the reason is
// measurable rather than stylistic: it requires a risk_tier, which cannot be
// defaulted without inventing a risk classification. Its subject check needs a
// non-empty claim set, so a request carrying neither claims nor a tier is not
// completed by the verification gate's pass either.
test("the gate that cannot default its risk tier still refuses a partial request", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [
            {
              kind: "data",
              data: { run_id: "r1", actor: { declared_type: "ai_agent" }, requested_action: "refund", target: {}, claims: [] }
            }
          ]
        }
      }
    },
    new Request("https://agent-output-verification-a2a.example.workers.dev/message/send", { method: "POST" })
  );
  assert.notEqual(response.result.status.state, "TASK_STATE_COMPLETED", "a partial pre-action request must not complete");
});

// `agent_output_verification` was the second held-out gate, on the measurement
// that a defaulted empty evidence array returned readiness 100 / review_ready.
// It takes the pass now that a declared support_level no longer scores as a
// verified one — and this asserts the measurement, not just the state.
test("the verification gate's first pass answers a claim set with no evidence pack honestly", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [
            {
              kind: "data",
              data: { claims: [{ claim_id: "c1", claim: "A claim with no evidence behind it.", support_level: "direct" }] }
            }
          ]
        }
      }
    },
    new Request("https://agent-output-verification-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  assert.equal(response.result.status.state, "TASK_STATE_COMPLETED");
  const body = response.result.metadata.response;
  assert.equal(body.verdict, "insufficient_information");
  assert.equal(body.readiness_score, 0);
  assert.equal(body.readiness_label, "insufficient_information");
  assert.equal(body.trust_signal, "unknown");
  assert.ok(body.evidence_gaps.some((gap) => gap.includes("cites no evidence present in the supplied pack")));
  const text = response.result.artifacts[0].parts[0].text;
  assert.match(text, /Defaulted, not supplied by you: evidence\./u);
});

// The strict path is the contract; completing a minimal request must not relax
// it. A request that names the counterparty and carries a bad enum is case 2 of
// ADR 0026 — something was sent and it is wrong — and still fails.
test("a named counterparty with an invalid enum still fails validation", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [
            {
              kind: "data",
              data: {
                counterparty: { name: "Alatau Trading LLP", jurisdiction: "Kazakhstan" },
                exposure_facets: ["not_a_real_facet"],
                dated_sources: [],
                risk_question: "Ready for onboarding review?",
                decision_stage: "onboarding"
              }
            }
          ]
        }
      }
    },
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  assert.equal(response.result.status.state, "TASK_STATE_FAILED");
});

// An agent that cannot serve the request should hand back the ones that can.
test("the routing note names the sibling gates and never itself", async () => {
  const call = async (host) =>
    handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "1",
        method: "message/send",
        params: { message: { role: "user", parts: [{ kind: "text", text: "Aktau to Jebel Ali, sanctions exposure" }] } }
      },
      new Request(`https://${host}.example.workers.dev/message/send`, { method: "POST" })
    );

  const base = await call("agenda-intelligence-a2a");
  const related = base.result.metadata.related_agents;
  assert.ok(related.length >= 3, "the base profile must point at the structured gates");
  const markdown = base.result.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;
  for (const gate of related) {
    assert.ok(markdown.includes(gate.a2a), `text part must carry the address of ${gate.name}`);
  }

  // The Middle Corridor gate runs under product profile "kazakhstan", so a
  // filter on the profile string would have left it advertising itself.
  const corridor = await call("middle-corridor-deal-risk-gate-a2a");
  const own = "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev";
  assert.ok(
    !corridor.result.metadata.related_agents.some((gate) => gate.a2a === own),
    "a gate must not list itself as a related agent"
  );
});

// Measured 2026-08-25 against the live endpoint: the note recommended
// audit_claims while the hosted /mcp endpoint on the same host served only
// strategic_risk_triage, so a caller that followed the recommendation got
// "Unknown tool". The two lists are read from one source here.
test("a recommended MCP tool the host does not serve says where it runs", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: { message: { role: "user", parts: [{ kind: "text", text: "audit this evidence pack for gaps" }] } }
    },
    new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  const markdown = response.result.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;
  const hosted = response.result.metadata.hosted_mcp_tools;
  const recommended = response.result.metadata.signal_screen.recommended_mcp_tool;
  assert.ok(hosted.length > 0, "the response must say which tools this host serves");
  if (!hosted.includes(recommended)) {
    assert.ok(
      markdown.includes("installable stdio server"),
      "a tool this host does not serve must say where it does run"
    );
    for (const tool of hosted) {
      assert.ok(markdown.includes(tool), `the note must name the hosted tool ${tool}`);
    }
  }
});

// The text part is what a caller prints. Empty blocks used to leave runs of
// three and four newlines mid-note, which reads as a rendering fault.
test("the routing note has no stray blank-line runs", async () => {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "1",
      method: "message/send",
      params: { message: { role: "user", parts: [{ kind: "text", text: "Gulf sanctions exposure" }] } }
    },
    new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" })
  );

  const markdown = response.result.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;
  const runs = markdown.match(/\n{3,}/g) || [];
  assert.equal(runs.length, 0, `text part must not contain blank-line runs: found ${runs.length}`);
});

test("caller classification separates our own runs, probes, and callers who sign nothing", () => {
  const kindFor = (headers) =>
    buildUsageEvent(
      new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST", headers }),
      { jsonrpc_method: "message/send" }
    ).caller_kind;

  assert.equal(kindFor({ "user-agent": "agenda-intelligence-live-smoke" }), "self_test");
  assert.equal(kindFor({ "user-agent": "agenda-intelligence-a2a-conformance/1.0" }), "self_test");
  // Read by prefix, not by a list of names. This third tool appeared on
  // 2026-08-24 following the same convention and was counted as `external`
  // for a day because the rule enumerated the two above. A tool named by the
  // convention is ours whether or not anyone remembered to add it here.
  assert.equal(kindFor({ "user-agent": "agenda-intelligence-post-deploy-verifier" }), "self_test");
  assert.equal(kindFor({ "user-agent": "agenda-intelligence-anything-we-name-later/2" }), "self_test");
  // The prefix is ours, not a substring anyone can carry mid-string.
  assert.equal(kindFor({ "user-agent": "curl/8.7.1 agenda-intelligence-live-smoke" }), "external");
  assert.equal(kindFor({ "user-agent": "AgenstryBot/0.3.0 (+https://agenstry.com/bot)" }), "service_probe");
  assert.equal(kindFor({ "user-agent": "ProofBench/0.1 (+https://proofbench.dev/about/probe)" }), "service_probe");
  assert.equal(kindFor({ "user-agent": "mcpqueen-grader/0.3 (+https://mcpqueen.com)" }), "service_probe");
  // Self-identification by convention, not vocabulary. These two are the
  // highest-volume crawlers against these endpoints and neither says "bot",
  // "crawler" or anything else the keyword list looks for: measured
  // 2026-08-20..22, 411 requests reached `external` this way, 224 of them from
  // the first one alone.
  assert.equal(kindFor({ "user-agent": "agent-tools.cloud-a2a/0.1 (+https://agent-tools.cloud)" }), "service_probe");
  assert.equal(kindFor({ "user-agent": "Waggle/1.0 (+https://waggle.zone)" }), "service_probe");
  assert.equal(kindFor({ "user-agent": "MCPWatch/0.1.0 (+mcpwatch@iyre.com) MCP security research" }), "service_probe");
  assert.equal(kindFor({ "user-agent": "Java-http-client/25.0.2" }), "external");
  // A generic HTTP library says nothing about itself and must stay external:
  // `external` means unidentified, and collapsing it into "probe" would hide
  // the callers this classification exists to find.
  assert.equal(kindFor({ "user-agent": "python-httpx/0.28.1" }), "external");
  assert.equal(kindFor({ "user-agent": "node" }), "external");
  // The bucket the whole classification exists for: no user agent at all. The
  // one external non-probe call observed 2026-08-19 arrived exactly like this.
  assert.equal(kindFor({}), "unsigned_external");
});

test("traffic class and request kind separate people, machines, probes, and self-tests", () => {
  const eventFor = (path, headers = {}, details = {}) =>
    buildUsageEvent(
      new Request(`https://agenda-intelligence-a2a.example.workers.dev${path}`, {
        method: "POST",
        headers
      }),
      details
    );

  assert.equal(
    eventFor("/message/send", { "user-agent": "Mozilla/5.0" }, { jsonrpc_method: "message/send" })
      .traffic_class,
    "human_browser"
  );
  assert.equal(
    eventFor("/message/send", { "user-agent": "node" }, { jsonrpc_method: "message/send" }).traffic_class,
    "machine_client"
  );
  assert.equal(
    eventFor("/message/send", { "user-agent": "AgenstryBot/1.0" }, { jsonrpc_method: "message/send" })
      .traffic_class,
    "machine_probe"
  );
  assert.equal(
    eventFor(
      "/message/send",
      { "user-agent": "agenda-intelligence-live-smoke" },
      { jsonrpc_method: "message/send" }
    ).traffic_class,
    "self_test"
  );
  assert.equal(
    eventFor("/message/send", { "user-agent": "Mozilla/5.0" }, { jsonrpc_method: "message/send", likely_probe: true })
      .traffic_class,
    "machine_probe",
    "a near-empty action is a probe even when its user agent looks like a browser"
  );
  assert.equal(eventFor("/mcp", {}, { jsonrpc_method: "tools/call" }).request_kind, "mcp_action");
  assert.equal(eventFor("/message/send", {}, { jsonrpc_method: "message/send" }).request_kind, "a2a_action");
});

test("calling Worker zone is recorded from cf-worker and nothing else is", () => {
  const eventFor = (headers) =>
    buildUsageEvent(
      new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST", headers }),
      { jsonrpc_method: "message/send" }
    );

  const fromWorker = eventFor({ "cf-worker": "app-builder.example" });
  assert.equal(fromWorker.caller_zone, "app-builder.example");
  assert.equal(fromWorker.caller_kind, "unsigned_external");

  assert.equal(eventFor({ "cf-worker": "APP-BUILDER.EXAMPLE" }).caller_zone, "app-builder.example");
  assert.equal(eventFor({}).caller_zone, null);
  // Recorded rather than dropped, so a caller putting something else in the
  // header stays visible instead of looking like an ordinary request.
  assert.equal(eventFor({ "cf-worker": "not a hostname" }).caller_zone, "malformed");

  const funnel = logFunnelEvent(
    {
      url: "https://agenda-intelligence-a2a.example.workers.dev/.well-known/agent-card.json",
      method: "GET",
      headers: new Headers({ "cf-worker": "app-builder.example" }),
      cf: { country: "SE", colo: "AMS", asOrganization: "Cloudflare, Inc." }
    },
    "card"
  );
  assert.equal(funnel.caller_zone, "app-builder.example");
  assert.equal(funnel.caller_kind, "unsigned_external");
  assert.equal(funnel.ip, undefined);
});

test("call outcome reports the routing decision the caller received", () => {
  const gated = callOutcome({
    status: { state: "TASK_STATE_COMPLETED" },
    metadata: {
      response: {
        readiness_contract: {
          status: "insufficient_information",
          score: 0,
          routing: { field: "triage_recommendation", value: "insufficient_information" }
        }
      }
    }
  });
  assert.deepEqual(gated, { decision: "insufficient_information", status: "insufficient_information", score: 0 });

  const rejected = callOutcome({ status: { state: "TASK_STATE_FAILED" }, metadata: {} });
  assert.equal(rejected.decision, "invalid_request");

  // The base signal-screen profile carries no readiness contract.
  const plain = callOutcome({ status: { state: "TASK_STATE_COMPLETED" }, metadata: { response: {} } });
  assert.equal(plain.decision, "completed");
});

test("usage stats counts callers who got nothing usable", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };
  const base = {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-08-07T09:00:00.000Z",
    jsonrpc_method: "message/send",
    agent_profile: "cis_secondary_sanctions",
    likely_probe: false,
    client: "browser",
    modules_used: ["cis_secondary_sanctions"]
  };

  await recordUsageStats(env, { ...base, outcome: { decision: "insufficient_information", score: 0 } });
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-07T09:01:00.000Z",
    outcome: { decision: "insufficient_information", score: 0 }
  });
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-07T09:02:00.000Z",
    outcome: { decision: "ready_for_human_review", score: 80 }
  });
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-07T09:03:00.000Z",
    outcome: { decision: "invalid_request", score: null }
  });
  // A monitor sending a deliberately empty payload is not a caller who left
  // empty-handed. Counting it made the ratio read "5 of 1 non-probe calls".
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-07T09:04:00.000Z",
    likely_probe: true,
    client: "agenstry",
    outcome: { decision: "invalid_request", score: null }
  });

  const stats = await usageStats(env, "2026-08-07");

  assert.equal(stats.counters.total, 5);
  assert.equal(stats.counters.non_probe, 4);
  assert.equal(stats.counters.empty_handed, 3);
  assert.ok(stats.counters.empty_handed <= stats.counters.non_probe);
  // outcomes covers every call; only empty_handed is restricted to non-probes.
  assert.deepEqual(stats.outcomes, [
    { name: "insufficient_information", count: 2 },
    { name: "invalid_request", count: 2 },
    { name: "ready_for_human_review", count: 1 }
  ]);
});

test("usage stats reports caller kinds and calling Worker zones", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };
  const base = {
    event: "agenda_intelligence_a2a_usage",
    agent_profile: "agenda",
    host: "agenda-intelligence-a2a.example.workers.dev",
    jsonrpc_method: "message/send",
    prompt_chars: 40,
    outcome: { decision: "ready_for_human_review", score: 70 }
  };

  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-19T13:14:50.000Z",
    caller_kind: "unsigned_external",
    caller_zone: "app-builder.example"
  });
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-19T13:20:00.000Z",
    caller_kind: "service_probe",
    caller_zone: "shadetreerocketsurgeon84.workers.dev"
  });
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-08-19T13:25:00.000Z",
    caller_kind: "self_test",
    caller_zone: null
  });

  const stats = await usageStats(env, "2026-08-19");

  assert.deepEqual(stats.caller_kinds, [
    { name: "self_test", count: 1 },
    { name: "service_probe", count: 1 },
    { name: "unsigned_external", count: 1 }
  ]);
  // Only callers that actually sent the header appear. Without this the map is
  // one "none" row the size of the whole day and the few real zones vanish.
  assert.deepEqual(stats.caller_zones, [
    { name: "app-builder.example", count: 1 },
    { name: "shadetreerocketsurgeon84.workers.dev", count: 1 }
  ]);
});

test("usage stats aggregates caller network, referrer and user agent", async () => {
  const kv = new MemoryKv();
  const env = { AGENDA_USAGE: kv };
  const base = {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-07-24T09:00:00.000Z",
    jsonrpc_method: "message/send",
    agent_profile: "cis_secondary_sanctions",
    likely_probe: false,
    client: "unknown",
    user_agent: "SomeResearchBot/2.1",
    referrer_host: "agenstry.com",
    cf: { country: "SG", colo: "SIN", as_org: "Example Cloud Ltd" },
    modules_used: ["cis_secondary_sanctions"]
  };

  await recordUsageStats(env, base);
  await recordUsageStats(env, { ...base, timestamp: "2026-07-24T09:01:00.000Z" });
  await recordUsageStats(env, {
    ...base,
    timestamp: "2026-07-24T09:02:00.000Z",
    user_agent: null,
    referrer_host: null,
    cf: { country: "KZ", colo: "ALA", as_org: null }
  });

  const stats = await usageStats(env, "2026-07-24");

  assert.deepEqual(stats.networks, [
    { name: "Example Cloud Ltd", count: 2 },
    { name: "unknown", count: 1 }
  ]);
  assert.deepEqual(stats.referrers, [
    { name: "agenstry.com", count: 2 },
    { name: "none", count: 1 }
  ]);
  assert.deepEqual(stats.user_agents, [
    { name: "SomeResearchBot/2.1", count: 2 },
    { name: "unknown", count: 1 }
  ]);
  assert.deepEqual(stats.modules, [{ name: "cis_secondary_sanctions", count: 3 }]);
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
    traffic_class: "human_browser",
    request_kind: "a2a_action",
    client: "curl",
    cf: {
      country: "KZ"
    },
    modules_used: ["global-think-tank-analyst", "eu", "sanctions-sector"]
  };

  await recordUsageStats(env, event);
  await recordUsageStats(env, {
    ...event,
    agent_profile: "kazakhstan",
    likely_probe: true,
    traffic_class: "machine_probe",
    request_kind: "mcp_action",
    client: "agenstry"
  });

  const stats = await usageStats(env, "2026-05-22");

  assert.equal(stats.configured, true);
  assert.equal(stats.counters.total, 2);
  assert.equal(stats.counters.non_probe, 1);
  assert.equal(stats.counters.likely_probe, 1);
  assert.equal(stats.counters.human_requests, 1);
  assert.equal(stats.counters.machine_requests, 1);
  assert.equal(stats.counters.self_test_requests, 0);
  assert.equal(stats.counters.unclassified_requests, 0);
  assert.deepEqual(stats.traffic_classes, [
    { name: "human_browser", count: 1 },
    { name: "machine_probe", count: 1 }
  ]);
  assert.deepEqual(stats.request_kinds, [
    { name: "a2a_action", count: 1 },
    { name: "mcp_action", count: 1 }
  ]);
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

test("usage stats accounts billable upstream cost and budget thresholds", async () => {
  const kv = new MemoryKv();
  const base = {
    event: "agenda_intelligence_a2a_usage",
    timestamp: "2026-05-30T10:00:00.000Z",
    jsonrpc_method: "message/send",
    agent_profile: "cis_secondary_sanctions",
    likely_probe: false,
    client: "curl",
    cf: { country: "KZ" },
    modules_used: ["cis_secondary_sanctions"]
  };

  // 6 billable OpenSanctions calls (success) + 1 degraded (failed, not billed)
  // + 1 disabled (no key, no call). Only the 6 successes cost money.
  const billable = {
    status: "success",
    upstream: "OpenSanctions",
    reason_code: null,
    billable: true,
    cost_eur: 0.1
  };
  for (let i = 0; i < 6; i += 1) {
    await recordUsageStats({ AGENDA_USAGE: kv }, { ...base, timestamp: `2026-05-30T10:0${i}:00.000Z`, live_retrieval: billable });
  }
  await recordUsageStats(
    { AGENDA_USAGE: kv },
    {
      ...base,
      timestamp: "2026-05-30T10:07:00.000Z",
      live_retrieval: {
        status: "degraded",
        upstream: "OpenSanctions",
        reason_code: "upstream_http_503",
        billable: false,
        cost_eur: 0
      }
    }
  );
  await recordUsageStats(
    { AGENDA_USAGE: kv },
    {
      ...base,
      timestamp: "2026-05-30T10:08:00.000Z",
      live_retrieval: { status: "disabled", upstream: null, reason_code: "disabled", billable: false, cost_eur: 0 }
    }
  );

  // No budget cap configured: cost reported, no alert.
  const noCap = await usageStats({ AGENDA_USAGE: kv }, "2026-05-30");
  assert.equal(noCap.counters.billable_calls, 6);
  assert.equal(noCap.cost.estimated_cost_eur, 0.6);
  assert.deepEqual(noCap.cost.billable_upstreams, [{ name: "OpenSanctions", count: 6 }]);
  assert.deepEqual(noCap.live_retrieval_statuses, [
    { name: "success", count: 6 },
    { name: "degraded", count: 1 },
    { name: "disabled", count: 1 }
  ]);
  assert.deepEqual(noCap.live_retrieval_reason_codes, [
    { name: "disabled", count: 1 },
    { name: "upstream_http_503", count: 1 }
  ]);
  assert.equal(noCap.cost.budget.configured, false);
  assert.equal(noCap.cost.budget.alert_level, "none");

  // €1.00/day cap → €0.60 spent = 60% → "50" alert tier.
  const capped = await usageStats({ AGENDA_USAGE: kv, USAGE_BUDGET_EUR_PER_DAY: "1.00" }, "2026-05-30");
  assert.equal(capped.cost.budget.configured, true);
  assert.equal(capped.cost.budget.pct_of_budget, 60);
  assert.equal(capped.cost.budget.alert_level, "50");

  // €0.65/day cap → ~92% → "90" alert tier.
  const tight = await usageStats({ AGENDA_USAGE: kv, USAGE_BUDGET_EUR_PER_DAY: "0.65" }, "2026-05-30");
  assert.equal(tight.cost.budget.alert_level, "90");
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
  assert.ok(body.confidential_project_room_profile_url.endsWith("/profiles/confidential-project-room"));
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
  assert.ok(info.mcp_server_card.endsWith("/.well-known/mcp/server-card.json"));
  assert.ok(info.did.endsWith("/.well-known/did.json"));
  assert.ok(info.api_catalog.endsWith("/.well-known/api-catalog"));
  assert.ok(info.openapi.endsWith("/api/openapi.json"));
  assert.ok(info.entitymap.endsWith("/entitymap.json"));
  assert.ok(info.okf_bundle.endsWith("/okf/index.md"));
  assert.ok(info.confidential_project_room_profile.endsWith("/profiles/confidential-project-room"));
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

test("cis worker flags an undisclosed UBO in the ownership chain (parity with Python service)", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const req = {
      ...cisSampleStructuredRequest,
      counterparty: {
        ...cisSampleStructuredRequest.counterparty,
        ownership_layers: ["Operating co (KZ)", "Holding (UAE free zone)", "undisclosed ultimate beneficial owner"]
      }
    };
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-ubo", method: "message/send", params: { message: { data: req } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    const resp = response.result.metadata.response;
    assert.ok(
      resp.top_exposure_dimensions.includes("undisclosed or unverified ultimate beneficial owner"),
      "expected undisclosed-UBO exposure dimension"
    );
    assert.ok(
      resp.limitations.some((line) => line.includes("cannot be fully screened until the UBO is resolved")),
      "expected undisclosed-UBO limitation line"
    );
  } finally {
    console.log = originalLog;
  }
});

test("cis worker does not flag a UBO when the ownership chain is fully disclosed (negative control)", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const req = {
      ...cisSampleStructuredRequest,
      counterparty: {
        ...cisSampleStructuredRequest.counterparty,
        ownership_layers: ["Operating co (KZ)", "Holding (UAE free zone)", "Named individual owner"]
      }
    };
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-ubo-neg", method: "message/send", params: { message: { data: req } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    const resp = response.result.metadata.response;
    assert.ok(!resp.top_exposure_dimensions.includes("undisclosed or unverified ultimate beneficial owner"));
    assert.ok(!resp.limitations.some((line) => line.includes("UBO is resolved")));
  } finally {
    console.log = originalLog;
  }
});

test("cis worker flags EU country-level anti-circumvention for Kyrgyzstan (Python parity)", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const kgReq = {
      ...cisSampleStructuredRequest,
      counterparty: { ...cisSampleStructuredRequest.counterparty, jurisdiction: "Kyrgyzstan" }
    };
    const kg = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-acm", method: "message/send", params: { message: { data: kgReq } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    assert.ok(
      kg.result.metadata.response.limitations.some((line) => line.includes("country-level anti-circumvention")),
      "expected country-level anti-circumvention limitation for Kyrgyzstan"
    );
    const kz = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-acm-neg", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    assert.ok(
      !kz.result.metadata.response.limitations.some((line) => line.includes("country-level anti-circumvention")),
      "Kazakhstan sample must not raise the country-level flag"
    );
  } finally {
    console.log = originalLog;
  }
});

test("cis worker surfaces the snapshot provenance date in A2A metadata", async () => {
  resetSnapshotCache();
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  console.log = () => {};
  globalThis.fetch = async () =>
    new Response(SNAPSHOT_FIXTURE, { status: 200, headers: { "content-type": "application/json" } });
  try {
    const withSnapshot = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-snap", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" }
    );
    assert.equal(withSnapshot.result.metadata.live_retrieval_upstream, "Snapshot");
    assert.equal(withSnapshot.result.metadata.live_retrieval_snapshot_generated_at, "2026-06-26T05:36:01+00:00");

    // Upstream off: the field is present but null, never a stale leftover.
    const withoutSnapshot = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-snap-neg", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    assert.equal(withoutSnapshot.result.metadata.live_retrieval_snapshot_generated_at, null);
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});

test("cis worker logs a bounded reason code when live retrieval degrades", async () => {
  resetSnapshotCache();
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  const logged = [];
  console.log = (event) => logged.push(event);
  globalThis.fetch = async () => new Response("temporarily unavailable", { status: 503 });
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-degraded", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" }
    );
    assert.equal(response.result.metadata.live_retrieval_status, "degraded");
    assert.equal(response.result.metadata.live_retrieval_reason_code, "upstream_http_503");
    const usageEvent = logged.find((event) => event?.event === "agenda_intelligence_a2a_usage");
    assert.equal(usageEvent.live_retrieval.reason_code, "upstream_http_503");
    assert.ok(!JSON.stringify(usageEvent).includes("temporarily unavailable"));
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});

test("cis worker treats unconfigured live retrieval as disabled without fetching", async () => {
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  const logged = [];
  console.log = (event) => logged.push(event);
  globalThis.fetch = async () => {
    throw new Error("unconfigured retrieval must not fetch");
  };
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-unconfigured", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      {}
    );
    assert.equal(response.result.metadata.live_retrieval_status, "disabled");
    assert.equal(response.result.metadata.live_retrieval_upstream, null);
    assert.equal(response.result.metadata.live_retrieval_reason_code, "not_configured");
    assert.equal(response.result.metadata.upstream_attribution, null);
    const usageEvent = logged.find((event) => event?.event === "agenda_intelligence_a2a_usage");
    assert.equal(usageEvent.live_retrieval.status, "disabled");
    assert.equal(usageEvent.live_retrieval.reason_code, "not_configured");
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
  }
});

test("cis worker does not call a listed ship a match on the counterparty", async () => {
  resetSnapshotCache();
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  console.log = () => {};
  globalThis.fetch = async () =>
    new Response(SNAPSHOT_FIXTURE_V2, { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-vessel", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" }
    );
    const body = response.result.metadata.response;
    const dims = body.top_exposure_dimensions;

    // The only listing bearing this name is a vessel. Reporting that as a
    // direct match states something the record does not support.
    assert.ok(
      !dims.some((d) => d.startsWith("direct or near-direct match")),
      `expected no direct-match dimension, got ${JSON.stringify(dims)}`
    );
    // It is still surfaced, named for what it is.
    assert.ok(
      dims.some((d) => d.includes("listed vessel or aircraft") && d.includes("not a match on the counterparty itself")),
      `expected the vessel dimension, got ${JSON.stringify(dims)}`
    );
    // Provenance names the list that answered, not OpenSanctions by default.
    assert.ok(
      dims.some((d) => d.includes("US OFAC / SDN")),
      `expected the real dataset in the dimension, got ${JSON.stringify(dims)}`
    );
    assert.ok(!dims.some((d) => d.includes("OpenSanctions")), "Snapshot matches must not be attributed to OpenSanctions");

    // The type travels with the auto-fetched source so a reader can see it.
    assert.equal(response.result.metadata.auto_fetched_sources[0].entity_type, "vessel");
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});

test("cis worker still reports a real company match as a direct match", async () => {
  resetSnapshotCache();
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  console.log = () => {};
  globalThis.fetch = async () =>
    new Response(SNAPSHOT_FIXTURE_V2, { status: 200, headers: { "content-type": "application/json" } });
  try {
    const request = {
      ...cisSampleStructuredRequest,
      counterparty: { ...cisSampleStructuredRequest.counterparty, name: "Gazprom Neft PJSC" }
    };
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-company", method: "message/send", params: { message: { data: request } } },
      cisRequest,
      { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" }
    );
    const dims = response.result.metadata.response.top_exposure_dimensions;
    assert.ok(
      dims.some((d) => d.startsWith("direct or near-direct match") && d.includes("US OFAC / SDN")),
      `expected a direct match on a listed company, got ${JSON.stringify(dims)}`
    );
    assert.ok(!dims.some((d) => d.includes("listed vessel or aircraft")), "no vessel line when nothing vessel matched");
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    resetSnapshotCache();
  }
});

test("cis worker rejects an off-enum field like the canonical schema (validation parity)", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const req = {
      ...cisSampleStructuredRequest,
      counterparty: { ...cisSampleStructuredRequest.counterparty, sector: "metals_trading" } // not in enum
    };
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-bad-enum", method: "message/send", params: { message: { data: req } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    assert.equal(response.result.status.state, "TASK_STATE_FAILED");
    assert.equal(response.result.metadata.valid, false);
    assert.ok(response.result.metadata.errors.some((e) => e.includes("counterparty.sector")));
  } finally {
    console.log = originalLog;
  }
});

test("cis worker degrade note is user-safe and does not leak env-var names", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "cis-degrade", method: "message/send", params: { message: { data: cisSampleStructuredRequest } } },
      cisRequest,
      { OPENSANCTIONS_DISABLED: "1" }
    );
    const lim = response.result.metadata.response.limitations;
    assert.ok(lim.some((l) => l.includes("not currently enabled")), "expected status-derived degrade note");
    assert.ok(!lim.some((l) => l.includes("OPENSANCTIONS_API_KEY")), "must not leak env-var name");
    assert.ok(!lim.some((l) => l.includes("degraded:")), "must not echo raw degrade reason");
  } finally {
    console.log = originalLog;
  }
});

test("cis_secondary_sanctions profile is detected from host and env", () => {
  const card = agentCard(cisRequest, {});
  assert.equal(card.x_agenda_intelligence.product_profile, "cis_secondary_sanctions");
  assert.equal(card.name, "CIS Secondary-Sanctions Exposure");
  assert.ok(Array.isArray(card.skills) && card.skills.length === 1);
  assert.equal(card.skills[0].id, "cis-secondary-sanctions-exposure");
  assert.match(card.description, /exporter, importer, trader, freight forwarder, or finance lead/);
  assert.match(card.description, /request the redacted intake by email at \S+@\S+/);
  assert.doesNotMatch(card.description, /free one-off pre-deal screening memo/);
  assert.doesNotMatch(card.description, /Targets enhanced due diligence/);
  assert.doesNotMatch(card.description, /decision-readiness score/);
  assert.doesNotMatch(card.skills[0].description, /decision-readiness score/);
  assert.equal(card.x_agenda_intelligence.live_retrieval.capability_declared, true);
  // Without SNAPSHOT_INDEX_URL, WATCHMAN_URL, or OPENSANCTIONS_API_KEY in env,
  // activation is deferred per ADR 0014 / ADR 0020.
  assert.equal(card.x_agenda_intelligence.live_retrieval.active, false);
  assert.equal(card.x_agenda_intelligence.live_retrieval.active_upstream, null);
  const options = card.x_agenda_intelligence.live_retrieval.upstream_options;
  assert.ok(Array.isArray(options) && options.length === 3);
  // Snapshot ($0, no host) first, then Watchman (free self-host), then OpenSanctions (paid).
  assert.equal(options[0].name, "Snapshot");
  assert.equal(options[1].name, "Watchman");
  assert.equal(options[1].license, "Apache-2.0");
  assert.equal(options[2].name, "OpenSanctions");
  assert.equal(options[2].license, "CC-BY-4.0");
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

test("statusInfo exposes inactive per-profile live_retrieval capability for cis_secondary_sanctions", () => {
  const status = statusInfo(cisRequest, {});
  assert.equal(status.profile, "cis_secondary_sanctions");
  // Capability is declared but activation is deferred until an upstream env var is set.
  assert.equal(status.boundaries.live_retrieval, false);
  assert.equal(status.boundaries.factual_verification, false);
  assert.equal(status.boundaries.human_review_required, true);
  assert.equal(status.live_retrieval.capability_declared, true);
  assert.equal(status.live_retrieval.active, false);
  assert.equal(status.live_retrieval.active_upstream, null);
  assert.equal(status.live_retrieval.upstream_options[0].name, "Snapshot");
  assert.equal(status.live_retrieval.upstream_options[0].active, false);
  assert.equal(status.live_retrieval.upstream_options[1].name, "Watchman");
  assert.equal(status.live_retrieval.upstream_options[2].name, "OpenSanctions");
  assert.ok(typeof status.live_retrieval.deferral_note === "string");
  assert.match(status.live_retrieval.deferral_note, /SNAPSHOT_INDEX_URL/);
});

test("statusInfo flips live_retrieval boundary to true with Snapshot when SNAPSHOT_INDEX_URL is set", () => {
  const status = statusInfo(cisRequest, { SNAPSHOT_INDEX_URL: "https://example.github.io/sanctions-name-index-compact.json" });
  assert.equal(status.boundaries.live_retrieval, true);
  assert.equal(status.live_retrieval.active, true);
  assert.equal(status.live_retrieval.active_upstream, "Snapshot");
  assert.equal(status.live_retrieval.deferral_note, undefined);
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
    assert.equal(result.status.state, "TASK_STATE_COMPLETED");
    assert.equal(result.metadata.product_profile, "agentic_interaction_trust");
    assert.equal(result.metadata.canonical_http_endpoint, "/v1/agentic-interaction/trust");
    assert.equal(result.metadata.human_review_required, true);
    const resp = result.metadata.response;
    assert.equal(resp.triage_recommendation, "require_step_up");
    assert.equal(resp.trust_signal, "medium");
    assert.equal(resp.decision_readiness_score, 40);
    assert.equal(resp.readiness_contract.profile, "agentic_interaction_trust");
    assert.equal(resp.readiness_contract.status, resp.decision_readiness_label);
    assert.deepEqual(resp.readiness_contract.signal, { field: "trust_signal", value: resp.trust_signal });
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

test("agentic_interaction_trust message/send asks for input on a missing structured request", async () => {
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
    assert.equal(response.result.status.state, "TASK_STATE_INPUT_REQUIRED");
    assert.equal(response.result.metadata.valid, false);
    assert.equal(response.result.metadata.product_profile, "agentic_interaction_trust");
  } finally {
    console.log = originalLog;
  }
});

// ---------------------------------------------------------------------------
// Corridor & Sanctions Risk Assistant — discovery FRONT (Zee-pattern), not a gate
// ---------------------------------------------------------------------------

const corridorAssistantRequest = new Request(
  "https://corridor-sanctions-assistant-a2a.example.workers.dev/message/send",
  { method: "POST", headers: { "user-agent": "node:test" } }
);

test("corridor_sanctions_assistant profile is detected and is a routing front, not a gate", () => {
  const card = agentCard(corridorAssistantRequest, {});
  assert.equal(card.x_agenda_intelligence.product_profile, "corridor_sanctions_assistant");
  assert.equal(card.name, "Corridor & Sanctions Risk Assistant");
  assert.equal(card.skills.length, 1);
  assert.equal(card.skills[0].id, "corridor-sanctions-orientation");
  // Front, not a gate: no structured product contract or schema.
  assert.equal(card.x_agenda_intelligence.product_contract, undefined);
  assert.deepEqual(card.x_agenda_intelligence.supported_contracts, ["orientation_and_routing"]);
  assert.equal(card.x_agenda_intelligence.routes_to.length, 4);
  assert.equal(card.x_agenda_intelligence.engagement.contact_email, "vassiliy.lakhonin@gmail.com");
  assert.match(card.x_agenda_intelligence.engagement.offer, /scoped and quoted before work starts/);
  assert.match(card.x_agenda_intelligence.engagement.next_step, /Fit, scope, fee, and timing/);
  assert.doesNotMatch(
    JSON.stringify({
      description: card.description,
      skill: card.skills[0],
      positioning: card.x_agenda_intelligence.commercial_positioning,
      focus: card.x_agenda_intelligence.focus,
      engagement: card.x_agenda_intelligence.engagement
    }),
    /free.{0,30}(memo|screening)|(?:memo|screening).{0,30}free/i
  );
  assert.ok(
    card.x_agenda_intelligence.boundaries.includes("Human review is required before any commercial action.")
  );
});

test("structured gate cards route to the current person-led scope and quote process", () => {
  const cards = [
    agentCard(new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send"), {}),
    agentCard(new Request("https://gulf-maritime-exposure-a2a.example.workers.dev/message/send"), {}),
    agentCard(new Request("https://kazakhstan-market-entry-readiness-a2a.example.workers.dev/message/send"), {})
  ];
  for (const card of cards) {
    assert.match(card.description, /Corridor & Sanctions Risk Assistant/);
    assert.match(card.description, /fit, scope, fee, and timing/);
    assert.doesNotMatch(card.description, /free.{0,30}(memo|screening)|(?:memo|screening).{0,30}free/i);
  }
});

test("corridor_sanctions_assistant message/send returns a deterministic orientation, not triage", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "corridor-1",
        method: "message/send",
        params: { message: { parts: [{ kind: "text", text: "Steel Kazakhstan->EU via Middle Corridor next month" }] } }
      },
      corridorAssistantRequest,
      {}
    );

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.id, "corridor-1");
    const result = response.result;
    assert.equal(result.status.state, "TASK_STATE_COMPLETED");
    assert.equal(result.metadata.product_profile, "corridor_sanctions_assistant");
    assert.equal(result.metadata.human_review_required, true);
    const resp = result.metadata.response;
    assert.equal(resp.kind, "orientation_and_routing");
    assert.equal(resp.gates.length, 4);
    assert.equal(resp.engagement.contact_email, "vassiliy.lakhonin@gmail.com");
    assert.match(resp.engagement.offer, /scoped and quoted before work starts/);
    assert.match(resp.engagement.next_step, /Fit, scope, fee, and timing/);
    assert.doesNotMatch(
      JSON.stringify({ response: resp, text: result.artifacts[0].parts[0].text }),
      /free.{0,30}(memo|screening)|(?:memo|screening).{0,30}free/i
    );
    assert.match(result.artifacts[0].parts[0].text, /Corridor & Sanctions Risk Assistant/);
    assert.match(result.artifacts[0].parts[0].text, /vassiliy\.lakhonin@gmail\.com/);
    assert.match(result.artifacts[0].parts[0].text, /confirm fit, scope, fee, and timing before work starts/);
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
    assert.equal(result.status.state, "TASK_STATE_COMPLETED");
    assert.equal(result.metadata.product_profile, "cis_secondary_sanctions");
    assert.equal(result.metadata.live_retrieval_status, "disabled");
    assert.equal(result.metadata.human_review_required, true);
    const resp = result.metadata.response;
    assert.equal(resp.triage_recommendation, "escalate_before_onboarding");
    assert.equal(resp.readiness_contract.profile, "cis_secondary_sanctions");
    assert.equal(resp.readiness_contract.status, resp.decision_readiness_label);
    assert.deepEqual(resp.readiness_contract.signal, {
      field: "secondary_exposure_signal",
      value: resp.secondary_exposure_signal
    });
    assert.ok(Array.isArray(resp.minimum_sources_before_review));
    // Degrade note must be surfaced so the caller knows retrieval is off...
    assert.ok(resp.limitations.some((line) => line.includes("Live sanctions-list retrieval")));
    // ...but the CC-BY attribution must NOT appear on the disabled path: nothing was
    // fetched, so there is no attribution obligation and no match to imply.
    assert.ok(!resp.limitations.some((line) => line.includes("via OpenSanctions")));

    // Machine-readable DataPart mirrors the structured response alongside the text part.
    const parts = result.artifacts[0].parts;
    assert.equal(parts[0].mediaType, "text/markdown");
    assert.ok("text" in parts[0]);
    const dataPart = parts.find((part) => "data" in part);
    assert.ok(dataPart, "expected a data part in the artifact");
    assert.equal(dataPart.mediaType, "application/json");
    assert.equal(dataPart.data.triage_recommendation, "escalate_before_onboarding");
    assert.equal(dataPart.data.human_review_required, true);
    assert.deepEqual(dataPart.data.readiness_contract, resp.readiness_contract);
  } finally {
    console.log = originalLog;
  }
});

test("cis_secondary_sanctions message/send asks for input on a missing structured request", async () => {
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
    assert.equal(response.result.status.state, "TASK_STATE_INPUT_REQUIRED");
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
  jwksUrlFromCard,
  maybeSignCard,
  publicJwkFromPrivate,
  signCard
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

test("signCard produces an AgentCardSignature that verifies against JWKS", async () => {
  const privJwk = await generateTestKey();
  const card = {
    name: "Test agent",
    version: "1.0.0",
    skills: [{ id: "a", name: "A" }],
    nested: { z: 1, a: [3, 2, 1] },
    supportedInterfaces: [
      {
        url: "https://test-agent.example/message/send",
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0"
      }
    ]
  };
  const signature = await signCard(card, privJwk);

  // A2A v1 section 8.4.2: `protected` and `signature`, both base64url.
  assert.match(signature.protected, /^[A-Za-z0-9_-]+$/);
  assert.match(signature.signature, /^[A-Za-z0-9_-]+$/);

  // Verify roundtrip against the public JWK. Signing input is
  // BASE64URL(protected) + "." + BASE64URL(payload) — ordinary JWS.
  const headerB64 = signature.protected;
  const sigB64 = signature.signature;
  const payloadB64 = base64urlEncode(new TextEncoder().encode(jcs(card)));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

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

  // Header must declare alg=ES256 and typ=JOSE, and must NOT carry the RFC 7797
  // unencoded-payload convention the earlier detached form used.
  const headerJson = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(Buffer.from(headerB64.replace(/-/g, "+").replace(/_/g, "/"), "base64")))
  );
  assert.equal(headerJson.alg, "ES256");
  assert.equal(headerJson.typ, "JOSE");
  assert.equal(headerJson.b64, undefined);
  assert.equal(headerJson.crit, undefined);
  assert.equal(headerJson.kid, "test-kid");
  assert.equal(headerJson.jku, "https://test-agent.example/.well-known/jwks.json");
});

test("signCard removes an existing signatures field before signing", async () => {
  const privJwk = await generateTestKey();
  const card = {
    name: "Test",
    skills: [],
    supportedInterfaces: [{ url: "https://test-agent.example/message/send" }]
  };
  const sig1 = await signCard(card, privJwk);
  const sig2 = await signCard({ ...card, signatures: [{ protected: "x", signature: "y" }] }, privJwk);
  // ECDSA signatures are non-deterministic, so the signature value may differ
  // even when the payload is identical. What MUST be identical is the header.
  assert.equal(sig1.protected, sig2.protected);
});

test("maybeSignCard is a no-op when no signing key is configured", async () => {
  const card = { name: "Test", skills: [] };
  const result = await maybeSignCard(card, {});
  assert.equal(result.signatures, undefined);
  assert.equal(result.name, "Test");
});

test("maybeSignCard adds a signature when AGENT_CARD_SIGNING_KEY is set", async () => {
  const privJwk = await generateTestKey();
  const card = {
    name: "Test",
    skills: [],
    supportedInterfaces: [{ url: "https://test-agent.example/message/send" }]
  };
  const result = await maybeSignCard(card, { AGENT_CARD_SIGNING_KEY: JSON.stringify(privJwk) });
  assert.equal(result.signatures.length, 1);
  assert.match(result.signatures[0].protected, /^[A-Za-z0-9_-]+$/);
  assert.match(result.signatures[0].signature, /^[A-Za-z0-9_-]+$/);
  // Original card content preserved
  assert.equal(result.name, "Test");
  const headerB64 = result.signatures[0].protected;
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  assert.equal(header.jku, "https://test-agent.example/.well-known/jwks.json");
});

test("jwksUrlFromCard rejects missing or non-HTTPS interface URLs", () => {
  assert.throws(() => jwksUrlFromCard({}), /supported interface URL/);
  assert.throws(
    () => jwksUrlFromCard({ supportedInterfaces: [{ url: "http://test-agent.example/message/send" }] }),
    /must use HTTPS/
  );
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

const KAZAKHSTAN_ORIGIN = "https://middle-corridor-deal-risk-gate-a2a.example.workers.dev";

function messageSendRequest(origin, { token, body } = {}) {
  const headers = { "content-type": "application/json", "user-agent": "node:test" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`${origin}/message/send`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      body ?? {
        jsonrpc: "2.0",
        id: "t1",
        method: "message/send",
        params: { message: { parts: [{ text: "Assess corridor deal risk for a Kazakhstan transit shipment." }] } }
      }
    )
  });
}

test("productionAuthKey resolves per-profile secrets and stays scoped", () => {
  assert.equal(productionAuthKey("kazakhstan", { MIDDLE_CORRIDOR_API_KEY: "secret" }), "secret");
  assert.equal(productionAuthKey("kazakhstan", {}), "");
  assert.equal(productionAuthKey("agenda", { MIDDLE_CORRIDOR_API_KEY: "secret" }), "");
  // Per-profile keys do not cross over: the Middle Corridor secret never gates the trust profile.
  assert.equal(productionAuthKey("agentic_interaction_trust", { MIDDLE_CORRIDOR_API_KEY: "secret" }), "");
  assert.equal(
    productionAuthKey("agentic_interaction_trust", { AGENTIC_INTERACTION_TRUST_API_KEY: "trust-secret" }),
    "trust-secret"
  );
  assert.equal(productionAuthKey("agentic_interaction_trust", {}), "");
  // And the trust secret never gates Middle Corridor.
  assert.equal(productionAuthKey("kazakhstan", { AGENTIC_INTERACTION_TRUST_API_KEY: "trust-secret" }), "");
  // CIS secondary-sanctions wired with its own scoped secret.
  assert.equal(
    productionAuthKey("cis_secondary_sanctions", { CIS_SECONDARY_SANCTIONS_API_KEY: "cis-secret" }),
    "cis-secret"
  );
  assert.equal(productionAuthKey("cis_secondary_sanctions", {}), "");
  assert.equal(productionAuthKey("cis_secondary_sanctions", { MIDDLE_CORRIDOR_API_KEY: "secret" }), "");
});

function fakeRateKv() {
  const store = new Map();
  return {
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async put(k, v) {
      store.set(k, String(v));
    }
  };
}

function ipRequest(ip) {
  return new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: { "cf-connecting-ip": ip }
  });
}

test("rateLimitPerHour parses env and stays off by default", () => {
  assert.equal(rateLimitPerHour({}), 0);
  assert.equal(rateLimitPerHour({ RATE_LIMIT_PER_HOUR: "0" }), 0);
  assert.equal(rateLimitPerHour({ RATE_LIMIT_PER_HOUR: "-5" }), 0);
  assert.equal(rateLimitPerHour({ RATE_LIMIT_PER_HOUR: "abc" }), 0);
  assert.equal(rateLimitPerHour({ RATE_LIMIT_PER_HOUR: "60" }), 60);
});

test("checkRateLimit is a no-op when unconfigured or no KV", async () => {
  assert.deepEqual(await checkRateLimit(ipRequest("1.1.1.1"), {}, "cis_secondary_sanctions"), {
    limited: false,
    limit: 0,
    count: 0
  });
  // Limit set but no KV binding -> still open.
  assert.equal(
    (await checkRateLimit(ipRequest("1.1.1.1"), { RATE_LIMIT_PER_HOUR: "2" }, "cis_secondary_sanctions"))
      .limited,
    false
  );
});

test("checkRateLimit throttles a client past the per-hour cap", async () => {
  const env = { RATE_LIMIT_PER_HOUR: "2", AGENDA_USAGE: fakeRateKv() };
  const req = ipRequest("9.9.9.9");
  assert.equal((await checkRateLimit(req, env, "cis_secondary_sanctions")).limited, false); // 1
  assert.equal((await checkRateLimit(req, env, "cis_secondary_sanctions")).limited, false); // 2
  const third = await checkRateLimit(req, env, "cis_secondary_sanctions");
  assert.equal(third.limited, true); // 3rd over cap
  assert.equal(third.limit, 2);
  // A different IP is bucketed independently.
  assert.equal((await checkRateLimit(ipRequest("8.8.8.8"), env, "cis_secondary_sanctions")).limited, false);
});

test("checkRateLimit fails open when KV errors", async () => {
  const env = {
    RATE_LIMIT_PER_HOUR: "1",
    AGENDA_USAGE: {
      async get() {
        throw new Error("kv down");
      },
      async put() {}
    }
  };
  assert.equal((await checkRateLimit(ipRequest("7.7.7.7"), env, "cis_secondary_sanctions")).limited, false);
});

test("isProductionAuthorized opens the route when no key is configured", () => {
  const req = messageSendRequest(KAZAKHSTAN_ORIGIN);
  assert.equal(isProductionAuthorized(req, {}, "kazakhstan"), true);
});

test("isProductionAuthorized requires a matching Bearer token when key is configured", () => {
  const env = { MIDDLE_CORRIDOR_API_KEY: "secret" };
  assert.equal(isProductionAuthorized(messageSendRequest(KAZAKHSTAN_ORIGIN), env, "kazakhstan"), false);
  assert.equal(isProductionAuthorized(messageSendRequest(KAZAKHSTAN_ORIGIN, { token: "wrong" }), env, "kazakhstan"), false);
  assert.equal(isProductionAuthorized(messageSendRequest(KAZAKHSTAN_ORIGIN, { token: "secret" }), env, "kazakhstan"), true);
});

test("public kazakhstan card does not pretend optional observability is authentication", () => {
  const card = agentCard(new Request(KAZAKHSTAN_ORIGIN), { AGENT_PROFILE: "kazakhstan" });
  assert.equal(card.securitySchemes, undefined);
  assert.equal(card.security, undefined);
  assert.deepEqual(card.securityRequirements, []);
  assert.equal(card.x_agenda_intelligence.public_endpoint, true);
  // Empty stays empty, but no longer silent: an open endpoint says it is open
  // on purpose, so a reader cannot mistake the absence of a scheme for an
  // oversight. X-Client-Id is named here as what it is, not as a credential.
  assert.equal(card.x_security_posture.required_authentication, false);
  assert.equal(card.x_security_posture.public_endpoint, true);
  assert.equal(card.x_security_posture.optional_client_identifier_header, "X-Client-Id");
  assert.equal(card.securitySchemes, undefined);
});

test("kazakhstan card advertises productionBearer requirement when key is set", () => {
  const card = agentCard(new Request(KAZAKHSTAN_ORIGIN), {
    AGENT_PROFILE: "kazakhstan",
    MIDDLE_CORRIDOR_API_KEY: "secret"
  });
  assert.equal(card.securitySchemes.productionBearer.httpAuthSecurityScheme.scheme, "bearer");
  assert.equal(card.security, undefined);
  // The declared posture follows the deployment, not a constant.
  assert.equal(card.x_security_posture.required_authentication, true);
  assert.equal(card.x_security_posture.public_endpoint, false);
  // schemes is a map of scheme name to its StringList of scopes. The array
  // form this asserted until 2026-08-26 fails the official v1 schema with
  // "schemes: must be object", and no deployment had a key set, so the
  // invalid card was never served and never noticed.
  assert.deepEqual(card.securityRequirements, [
    { schemes: { productionBearer: { list: [] } } }
  ]);
  assert.equal(card.x_agenda_intelligence.public_endpoint, false);
});

test("agenda card never advertises a production requirement even if the secret leaks into env", () => {
  const card = agentCard(request, { MIDDLE_CORRIDOR_API_KEY: "secret" });
  assert.equal(card.security, undefined);
  assert.equal(card.securitySchemes, undefined);
  assert.deepEqual(card.securityRequirements, []);
});

test("message/send on kazakhstan profile returns 401 without Bearer when key is set", async () => {
  const env = { AGENT_PROFILE: "kazakhstan", MIDDLE_CORRIDOR_API_KEY: "secret", AGENDA_USAGE: new MemoryKv() };
  const response = await handleRequest(messageSendRequest(KAZAKHSTAN_ORIGIN), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), "Bearer");
  const body = await response.json();
  assert.equal(body.error.code, -32001);
  assert.equal(body.error.data.security_scheme, "productionBearer");
});

test("message/send on kazakhstan profile succeeds with a valid Bearer when key is set", async () => {
  const env = { AGENT_PROFILE: "kazakhstan", MIDDLE_CORRIDOR_API_KEY: "secret", AGENDA_USAGE: new MemoryKv() };
  const response = await handleRequest(messageSendRequest(KAZAKHSTAN_ORIGIN, { token: "secret" }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.result, "valid Bearer yields a JSON-RPC result");
});

test("message/send stays open on kazakhstan profile when no key is configured", async () => {
  const env = { AGENT_PROFILE: "kazakhstan", AGENDA_USAGE: new MemoryKv() };
  const response = await handleRequest(messageSendRequest(KAZAKHSTAN_ORIGIN), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.result, "open demo returns a result without a key");
});

test("agent/card discovery stays public even when the production key is set", async () => {
  const env = { AGENT_PROFILE: "kazakhstan", MIDDLE_CORRIDOR_API_KEY: "secret", AGENDA_USAGE: new MemoryKv() };
  const response = await handleRequest(
    messageSendRequest(KAZAKHSTAN_ORIGIN, {
      body: { jsonrpc: "2.0", id: "c1", method: "agent/card" }
    }),
    env
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.result.name, "agent/card returns the card without a Bearer");
});

const GULF_ORIGIN = "https://gulf-maritime-exposure-a2a.example.workers.dev";
const GULF_ENV = { AGENT_PROFILE: "gulf_maritime_exposure", AGENDA_USAGE: new MemoryKv() };

function gulfRequest() {
  return new Request(`${GULF_ORIGIN}/message/send`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "node:test" }
  });
}

const GULF_GOLDEN = {
  vessel: { name: "Example Tanker", flag: "Panama", vessel_type: "crude oil tanker" },
  voyage: { chokepoint: "strait_of_hormuz", origin: "undisclosed Gulf terminal", destination: "STS area, Gulf of Oman" },
  cargo: "crude oil",
  counterparties: [{ role: "registered_owner", name: "Example Holding Ltd", jurisdiction: "Marshall Islands" }],
  exposure_facets: ["iran_oil_exposure", "dark_fleet_indicators", "sts_transfer", "insurance_or_pi_gap"],
  jurisdictions_in_scope: ["OFAC", "EU", "UK_OFSI"],
  decision_stage: "pre_fixture",
  dated_sources: [{ id: "g1", source_type: "ais_track_record", title: "AIS track extract", date: "2026-05-28" }],
  risk_question: "Is this Hormuz transit ready to fix, or should it be escalated before fixture?"
};

test("gulf profile agent card exposes the gulf maritime skill", () => {
  const card = agentCard(gulfRequest(), GULF_ENV);
  assert.equal(card.x_agenda_intelligence.product_profile, "gulf_maritime_exposure");
  assert.equal(card.x_agenda_intelligence.supported_contracts[0], "gulf_maritime_exposure_contract");
  assert.ok(card.skills.some((s) => s.id === "gulf-maritime-exposure"));
});

test("gulf message/send escalates before fixture with high signal (Python parity)", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "g-1", method: "message/send", params: { capability: "gulf_maritime_exposure", request: GULF_GOLDEN } },
      gulfRequest(),
      GULF_ENV
    );
    assert.equal(response.result.metadata.product_profile, "gulf_maritime_exposure");
    const resp = response.result.metadata.response;
    assert.equal(resp.triage_recommendation, "escalate_before_fixture");
    assert.equal(resp.exposure_signal, "high");
    assert.equal(resp.human_review_required, true);
    assert.equal(resp.readiness_contract.profile, "gulf_maritime_exposure");
    assert.equal(resp.readiness_contract.status, resp.decision_readiness_label);
    assert.deepEqual(resp.readiness_contract.signal, { field: "exposure_signal", value: resp.exposure_signal });
    assert.ok(resp.minimum_sources_before_review.includes("sanctions_list_extract"));
    assert.ok(resp.chokepoint_disruption_watch.some((w) => w.includes("Hormuz")));
  } finally {
    console.log = originalLog;
  }
});

// The offer that reaches a caller whose request worked.
//
// #262 put a contact in the base profile's response text. It did not reach the
// seven vertical gates, and it was the same generic sentence for everyone.
// Measured 2026-08-18..26: twelve substantive external calls from one caller,
// every one TASK_STATE_COMPLETED, no reply — while the failure paths, which
// nobody who succeeds ever sees, carried a contact the whole time.
//
// This asserts the offer names the run's own verdict and the run's own open
// items, so a later edit back to a generic signature fails here rather than
// going out quietly.
test("a completed gate offers person-led work on the caller's own open items", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "g-engage", method: "message/send", params: { capability: "gulf_maritime_exposure", request: GULF_GOLDEN } },
      gulfRequest(),
      GULF_ENV
    );

    const payload = response.result.metadata.response;
    const engagement = response.result.metadata.engagement;
    const markdown = response.result.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;

    assert.ok(engagement, "a completed gate must carry an engagement block");
    assert.ok(
      engagement.offer.includes(payload.triage_recommendation),
      "the offer must name the verdict this run returned"
    );
    assert.ok(
      payload.minimum_sources_before_review.some((source) => engagement.offer.includes(source)),
      "the offer must name at least one source this run is still short of, not a generic invitation"
    );
    // Both parts from one object, same rule as the base profile: a caller that
    // prints only the markdown must see exactly what the metadata carries.
    assert.ok(markdown.includes(engagement.offer), "text part must carry the same offer as the metadata");
    assert.ok(markdown.includes(engagement.next_step), "text part must carry the same next step as the metadata");
    assert.ok(markdown.includes(engagement.contact_email), "text part must carry the contact email");
    assert.ok(!/[$\u20ac\u00a3]\s?\d|\bUSD\b|\bEUR\b/.test(markdown), "offer must not quote a price");
    assert.ok(!/trusted by|customers|clients use|join \d/i.test(markdown), "offer must not claim traction");
  } finally {
    console.log = originalLog;
  }
});

// Found live, not in review: after the 2026-08-26 deploy the Middle Corridor
// deal-risk gate — the busiest host in the funnel — answered
// escalate_before_signature with seven named gaps and still offered the generic
// sentence, because it names them in `minimum_sources_before_go` and
// `missing_sources` rather than the fields the first version knew. This asserts
// the gate's own verdict and its own gaps reach the offer.
test("the deal-risk gate offers work on the sources it says are missing", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "dr-engage",
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [{ kind: "text", text: "Aktau to Jebel Ali, UAE buyer incorporated 2025, Georgian bank. Evidence before signature?" }]
          }
        }
      },
      new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send", { method: "POST" }),
      { AGENT_PROFILE: "kazakhstan" }
    );

    const payload = response.result.artifacts[0].parts.find((part) => part.mediaType === "application/json").data;
    const offer = response.result.metadata.engagement.offer;

    assert.ok(payload.minimum_sources_before_go.length > 0, "fixture must produce a gate with named gaps");
    assert.ok(offer.includes(payload.triage_recommendation), "the offer must name the gate's verdict");
    assert.ok(
      payload.minimum_sources_before_go.some((source) => offer.includes(source)),
      "the offer must name a source the gate says is missing"
    );
  } finally {
    console.log = originalLog;
  }
});

// The failure case. A caller whose request did not parse needs the request
// fixed, not a scoping conversation, and `invalidRequestResult` already hands
// it a contact. Offering person-led work there would read as a sales reply to
// a validation error.
test("a rejected request gets a contact but no offer of person-led work", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "g-engage-invalid", method: "message/send", params: { capability: "gulf_maritime_exposure", request: { foo: "bar" } } },
      gulfRequest(),
      GULF_ENV
    );
    assert.equal(response.result.status.state, "TASK_STATE_INPUT_REQUIRED");
    assert.equal(response.result.metadata.engagement, undefined, "a task asking for input must not carry an engagement block");
    assert.equal(
      response.result.metadata.support_contact,
      "vassiliy.lakhonin@gmail.com",
      "a task asking for input must still say how to reach a person"
    );
  } finally {
    console.log = originalLog;
  }
});

// The base profile builds its own offer into the routing note. The dispatch
// wrapper must leave that one alone rather than appending a second copy.
test("the base profile is not stamped twice with the same offer", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "engage-once",
        method: "message/send",
        params: { message: { role: "user", parts: [{ kind: "text", text: "Aktau to Jebel Ali, UAE buyer, Georgian bank" }] } }
      },
      new Request("https://agenda-intelligence-a2a.example.workers.dev/message/send", { method: "POST" }),
      {}
    );
    const markdown = response.result.artifacts[0].parts.find((part) => part.mediaType === "text/markdown").text;
    assert.equal(markdown.split("Person-led work:").length - 1, 1, "the offer must appear exactly once");
    assert.ok(
      response.result.metadata.engagement.offer.includes("open before a human can decide"),
      "the base profile's offer must name its own gaps too"
    );
  } finally {
    console.log = originalLog;
  }
});

test("gulf message/send asks for input on a non-gulf request shape", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "g-2", method: "message/send", params: { capability: "gulf_maritime_exposure", request: { foo: "bar" } } },
      gulfRequest(),
      GULF_ENV
    );
    assert.equal(response.result.status.state, "TASK_STATE_INPUT_REQUIRED");
    assert.equal(response.result.metadata.valid, false);
  } finally {
    console.log = originalLog;
  }
});

const GULF_PRICE_CAP = {
  voyage: { chokepoint: "suez_canal" },
  exposure_facets: ["russia_oil_price_cap"],
  decision_stage: "pre_fixture",
  dated_sources: [{ id: "p1", source_type: "ais_track_record", title: "AIS track", date: "2026-05-28" }],
  risk_question: "Is the price-cap attestation evidence sufficient before fixture?"
};

async function gulfResponseFor(reqBody) {
  const env = { AGENT_PROFILE: "gulf_maritime_exposure", AGENDA_USAGE: new MemoryKv() };
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "pc", method: "message/send", params: { capability: "gulf_maritime_exposure", request: reqBody } },
      gulfRequest(),
      env
    );
    return response.result.metadata.response;
  } finally {
    console.log = originalLog;
  }
}

test("gulf surfaces the price-cap attestation gap when facet present and attestation absent (Python parity)", async () => {
  const resp = await gulfResponseFor(GULF_PRICE_CAP);
  assert.ok(resp.top_exposure_dimensions.some((d) => d.includes("not yet evidenced")));
  assert.ok(resp.top_exposure_dimensions.some((d) => d.includes("Russia oil price-cap")));
  assert.ok(resp.watch_next.some((w) => w.includes("attestation refusal")));
});

test("gulf price-cap attestation supplied clears the gap without moving the score (Python parity)", async () => {
  const withAttestation = JSON.parse(JSON.stringify(GULF_PRICE_CAP));
  withAttestation.dated_sources.push({
    id: "p2",
    source_type: "price_cap_attestation_or_recordkeeping",
    title: "per-loading price-cap attestation + itemized ancillary-cost records",
    date: "2026-05-28"
  });
  const base = await gulfResponseFor(GULF_PRICE_CAP);
  const supplied = await gulfResponseFor(withAttestation);
  assert.ok(base.top_exposure_dimensions.some((d) => d.includes("not yet evidenced")));
  assert.ok(!supplied.top_exposure_dimensions.some((d) => d.includes("not yet evidenced")));
  assert.equal(supplied.decision_readiness_score, base.decision_readiness_score);
});

const MARKET_ENTRY_ORIGIN = "https://kazakhstan-market-entry-readiness-a2a.example.workers.dev";
const MARKET_ENTRY_ENV = { AGENT_PROFILE: "market_entry_readiness", AGENDA_USAGE: new MemoryKv() };

function marketEntryRequest() {
  return new Request(`${MARKET_ENTRY_ORIGIN}/message/send`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "node:test" }
  });
}

const MARKET_ENTRY_GOLDEN = {
  project_name: "Kazakhstan market-entry review",
  partner_or_company: "Example Mobility Company",
  market: "Kazakhstan / Almaty first",
  sector: "mobility",
  commercial_objective: "Evaluate Kazakhstan distribution, import, service, showroom, and partner-entry readiness.",
  decision_question: "Can the project move from concept discussion to controlled validation?",
  decision_stage: "pre_signature",
  supplied_sources: [
    { id: "s1", source_type: "partner_company_profile", title: "Company profile", date: "2026-06-01" },
    { id: "s2", source_type: "product_or_project_description", title: "Product catalogue", date: "2026-06-01" },
    { id: "s3", source_type: "market_size_source", title: "Kazakhstan macro source note", date: "2026-06-01" }
  ],
  requested_output: "both"
};

async function marketEntryResponseFor(reqBody, env = MARKET_ENTRY_ENV) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await handleJsonRpc(
      { jsonrpc: "2.0", id: "me", method: "message/send", params: { capability: "market_entry_readiness", request: reqBody } },
      marketEntryRequest(),
      env
    );
  } finally {
    console.log = originalLog;
  }
}

test("market-entry profile agent card exposes the readiness skill", () => {
  const card = agentCard(marketEntryRequest(), MARKET_ENTRY_ENV);
  assert.equal(card.x_agenda_intelligence.product_profile, "kazakhstan_market_entry_readiness");
  assert.equal(card.x_agenda_intelligence.supported_contracts[0], "kazakhstan_market_entry_readiness_contract");
  assert.ok(card.skills.some((s) => s.id === "kazakhstan-market-entry-readiness"));
});

test("market-entry currency-control gap names the 2026 mechanism (Python parity)", async () => {
  const response = await marketEntryResponseFor(MARKET_ENTRY_GOLDEN);
  const resp = response.result.metadata.response;
  const currency = resp.evidence_gaps.find((g) => g.source_type === "currency_control_and_repatriation_note");
  assert.ok(currency, "currency-control gap should surface when the note is not supplied");
  const blob = Object.values(currency).join(" ");
  assert.ok(blob.includes("economic substance"), "currency gap should name economic-substance scrutiny");
  assert.ok(blob.includes("50,000"), "currency gap should name the USD 50,000 registration threshold");
});

test("market-entry message/send returns proceed_to_validation / validation_ready (Python parity)", async () => {
  const response = await marketEntryResponseFor(MARKET_ENTRY_GOLDEN);
  assert.equal(response.result.metadata.product_profile, "kazakhstan_market_entry_readiness");
  const resp = response.result.metadata.response;
  assert.equal(resp.gate_decision, "proceed_to_validation");
  assert.equal(resp.readiness_label, "validation_ready");
  assert.equal(resp.human_review_required, true);
  assert.equal(resp.readiness_contract.profile, "kazakhstan_market_entry_readiness");
  assert.equal(resp.readiness_contract.status, resp.readiness_label);
  assert.equal(resp.readiness_contract.score, null);
  assert.deepEqual(resp.readiness_contract.routing, { field: "gate_decision", value: resp.gate_decision });
  assert.ok(resp.evidence_gaps.some((g) => g.source_type === "law_firm_opinion"));
  assert.ok(resp.boundary_notice.includes("Not legal"));
});

test("market-entry empty evidence at commitment stage stops", async () => {
  const bare = {
    project_name: "Bare file",
    partner_or_company: "Example Co",
    market: "Kazakhstan",
    decision_question: "Can we sign now?",
    decision_stage: "pre_signature",
    supplied_sources: []
  };
  const response = await marketEntryResponseFor(bare);
  const resp = response.result.metadata.response;
  assert.equal(resp.readiness_label, "insufficient_information");
  assert.equal(resp.gate_decision, "stop");
});

test("market-entry message/send rejects a bad source_type enum", async () => {
  const bad = JSON.parse(JSON.stringify(MARKET_ENTRY_GOLDEN));
  bad.supplied_sources[0].source_type = "not_a_real_source";
  const response = await marketEntryResponseFor(bad);
  assert.equal(response.result.status.state, "TASK_STATE_FAILED");
  assert.equal(response.result.metadata.valid, false);
});

test("market-entry message/send asks for input on a non-market-entry request shape", async () => {
  const response = await marketEntryResponseFor({ foo: "bar" });
  assert.equal(response.result.status.state, "TASK_STATE_INPUT_REQUIRED");
  assert.equal(response.result.metadata.valid, false);
});

function marketEntrySectorProbe(sector, overrides = {}) {
  return {
    project_name: "Sector probe",
    partner_or_company: "EU entrant",
    market: "Kazakhstan",
    sector,
    decision_question: "Ready for the next gate?",
    decision_stage: "pre_signature",
    supplied_sources: [
      { id: "s1", source_type: "product_or_project_description", title: "x", date: "2026-06-17" }
    ],
    ...overrides
  };
}

test("market-entry sector requirements differentiate evidence gaps (Python parity)", async () => {
  const renewable = (await marketEntryResponseFor(marketEntrySectorProbe("renewable_energy"))).result.metadata.response;
  const tech = (await marketEntryResponseFor(marketEntrySectorProbe("technology_transfer"))).result.metadata.response;
  const distribution = (await marketEntryResponseFor(marketEntrySectorProbe("distribution"))).result.metadata.response;
  const types = (r) => new Set(r.evidence_gaps.map((g) => g.source_type));

  assert.ok(types(renewable).has("grid_connection_and_offtake_evidence"));
  assert.ok(types(renewable).has("land_or_site_control_evidence"));
  assert.equal(types(distribution).has("grid_connection_and_offtake_evidence"), false);
  assert.ok(types(tech).has("ip_ownership_and_licensing_evidence"));
  assert.ok(types(tech).has("export_control_classification_note"));
  assert.ok(types(distribution).has("customs_broker_memo"));
});

test("market-entry watch_next is sector-tailored, not a static dump (Python parity)", async () => {
  const renewable = (await marketEntryResponseFor(marketEntrySectorProbe("renewable_energy"))).result.metadata.response;
  const tech = (await marketEntryResponseFor(marketEntrySectorProbe("technology_transfer"))).result.metadata.response;
  assert.ok(renewable.watch_next.includes("auction or PPA tariff change"));
  assert.ok(tech.watch_next.includes("export-control or dual-use classification change"));
  assert.notDeepEqual(renewable.watch_next, tech.watch_next);
  assert.ok(renewable.watch_next.includes("government or regulator signal"));
  assert.ok(renewable.watch_next.length < 20);
});

test("market-entry claim_audit reflects caller blockers and assumptions (Python parity)", async () => {
  const req = marketEntrySectorProbe("distribution", {
    known_blockers: ["No law-firm opinion supplied.", "No customs-broker memo."],
    known_assumptions: ["Public benchmarks are not signed quotes."]
  });
  const resp = (await marketEntryResponseFor(req)).result.metadata.response;
  const blocker = resp.claim_audit.find((c) => c.claim.includes("blockers"));
  assert.equal(blocker.status, "unsupported");
  assert.ok(blocker.how_to_use_now.includes("2 open blocker"));
  const assumption = resp.claim_audit.find((c) => c.claim.includes("decision-grade"));
  assert.equal(assumption.status, "assumption_only");
});

test("market-entry sector evidence caps launch_commitment (Python parity)", async () => {
  const fullPack = [
    "partner_company_profile",
    "product_or_project_description",
    "commercial_objective",
    "kazakhstan_use_case",
    "initial_source_links_or_documents",
    "law_firm_opinion",
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "counterparty_integrity_due_diligence",
    "bank_account_and_kyc_onboarding",
    "business_substance_evidence",
    "authority_to_sign_evidence",
    "contract_or_term_sheet_draft",
    "tax_accounting_note",
    "permanent_establishment_or_tax_residency_assessment",
    "currency_control_and_repatriation_note",
    "work_permit_and_local_employment_quota_note"
  ].map((t, i) => ({ id: `s${i}`, source_type: t, title: t, date: "2026-06-17" }));
  const req = marketEntrySectorProbe("renewable_energy", { supplied_sources: fullPack });
  const resp = (await marketEntryResponseFor(req)).result.metadata.response;
  assert.equal(resp.readiness_label, "committee_review_ready");
  assert.equal(resp.gate_decision, "route_to_committee");
  assert.ok(resp.evidence_gaps.some((g) => g.source_type === "grid_connection_and_offtake_evidence"));
});

test("market-entry complete file across all tiers escalates before signature (ADR 0019)", async () => {
  const fullPack = [
    "partner_company_profile",
    "product_or_project_description",
    "commercial_objective",
    "kazakhstan_use_case",
    "initial_source_links_or_documents",
    "law_firm_opinion",
    "counterparty_registry_extract",
    "beneficial_ownership_source",
    "counterparty_integrity_due_diligence",
    "bank_account_and_kyc_onboarding",
    "business_substance_evidence",
    "authority_to_sign_evidence",
    "contract_or_term_sheet_draft",
    "tax_accounting_note",
    "permanent_establishment_or_tax_residency_assessment",
    "currency_control_and_repatriation_note",
    "work_permit_and_local_employment_quota_note",
    "grid_connection_and_offtake_evidence",
    "land_or_site_control_evidence",
    "bankability_note",
    "local_content_or_procurement_localization_note"
  ].map((t, i) => ({ id: `s${i}`, source_type: t, title: t, date: "2026-06-17" }));
  const req = marketEntrySectorProbe("renewable_energy", { supplied_sources: fullPack });
  const resp = (await marketEntryResponseFor(req)).result.metadata.response;
  assert.equal(resp.readiness_label, "launch_commitment_ready");
  assert.equal(resp.gate_decision, "escalate_before_signature");
});

const AGENT_OUTPUT_VERIFICATION_ENV = { AGENT_PROFILE: "agent_output_verification" };
const agentOutputVerificationRequest = new Request(
  "https://agent-output-verification-a2a.example.workers.dev/message/send"
);

function groundedAuditFixture() {
  return {
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
    evidence: [{ evidence_id: "e1", source_type: "official_document", name: "Official gazette" }]
  };
}

async function agentOutputVerificationResponseFor(structured) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await handleJsonRpc(
      { jsonrpc: "2.0", id: "aov", method: "message/send", params: { request: structured } },
      agentOutputVerificationRequest,
      AGENT_OUTPUT_VERIFICATION_ENV
    );
  } finally {
    console.log = originalLog;
  }
}

test("agent-output-verification card exposes its three existing contracts as skills", () => {
  const card = agentCard(agentOutputVerificationRequest, AGENT_OUTPUT_VERIFICATION_ENV);
  assert.equal(card.x_agenda_intelligence.product_profile, "agent_output_verification");
  assert.ok(card.skills.some((skill) => skill.id === "agent-output-verification"));
  assert.ok(card.skills.some((skill) => skill.id === "pre-action-check"));
  assert.ok(card.skills.some((skill) => skill.id === "evidence-gap-analysis"));
  assert.equal(card.skills.length, 3);
});

function preActionCheckFixture(riskTier = "low") {
  return {
    run_id: "run-123",
    actor: { id: "procurement-agent", type: "ai_agent", operator: "Example buyer" },
    requested_action: "send supplier recommendation",
    target: { id: "supplier-456", type: "counterparty" },
    risk_tier: riskTier,
    ...groundedAuditFixture()
  };
}

test("agent-output-verification pre-action check continues a grounded low-risk action", async () => {
  const response = await agentOutputVerificationResponseFor(preActionCheckFixture());
  const result = response.result.metadata.response;
  assert.equal(result.decision, "continue");
  assert.equal(result.reason_code, "evidence_ready");
  assert.equal(result.run_id, "run-123");
});

test("agent-output-verification pre-action check stops an unsupported action", async () => {
  const request = preActionCheckFixture();
  request.claims[0].support_level = "unsupported";
  const response = await agentOutputVerificationResponseFor(request);
  const result = response.result.metadata.response;
  assert.equal(result.decision, "stop");
  assert.equal(result.reason_code, "unsafe_claims");
  assert.ok(result.blocking_gaps.length > 0);
});

test("agent-output-verification pre-action check requires approval for high risk and accepts resubmission", async () => {
  const request = preActionCheckFixture("high");
  const first = (await agentOutputVerificationResponseFor(request)).result.metadata.response;
  assert.equal(first.decision, "require_approval");
  assert.equal(first.approval_required, true);

  request.approval = { status: "approved", reference: "approval-record-1" };
  const resumed = (await agentOutputVerificationResponseFor(request)).result.metadata.response;
  assert.equal(resumed.decision, "continue");
  assert.equal(resumed.run_id, "run-123");
});

const PRE_ACTION_REPLAY_CASES = JSON.parse(
  readFileSync(new URL("../../../examples/pre-action-check/replay-cases.json", import.meta.url), "utf8")
);

function workerReplayRequest(testCase) {
  const request = structuredClone(PRE_ACTION_REPLAY_CASES.base_request);
  request.run_id = `replay-${testCase.name}`;
  if (testCase.risk_tier) request.risk_tier = testCase.risk_tier;
  if (testCase.support_level) request.claims[0].support_level = testCase.support_level;
  if (testCase.evidence_ids) request.claims[0].evidence_ids = testCase.evidence_ids;
  if (testCase.drop_supporting_quotes) delete request.claims[0].supporting_quotes;
  if (testCase.quote_evidence_id) request.claims[0].supporting_quotes[0].evidence_id = testCase.quote_evidence_id;
  if (testCase.unsupported_claims) request.unsupported_claims = testCase.unsupported_claims;
  if (testCase.approval_status) {
    request.approval = { status: testCase.approval_status, reference: `approval-${testCase.name}` };
  }
  if (testCase.policy_profile || testCase.policy_check_status) {
    request.policy_context = { profile: testCase.policy_profile || "default" };
    if (testCase.policy_check_status) {
      request.policy_context.checks = [
        {
          check_id: "delegated-authority",
          status: testCase.policy_check_status,
          evidence_gap: "No principal authorization supplied."
        }
      ];
    }
  }
  return request;
}

test("agent-output-verification keeps Python parity across twenty pre-action replay cases", async () => {
  assert.equal(PRE_ACTION_REPLAY_CASES.cases.length, 20);
  for (const testCase of PRE_ACTION_REPLAY_CASES.cases) {
    const response = await agentOutputVerificationResponseFor(workerReplayRequest(testCase));
    const result = response.result.metadata.response;
    assert.equal(result.decision, testCase.expected_decision, testCase.name);
    assert.equal(result.reason_code, testCase.expected_reason, testCase.name);
  }
});

test("agent-output-verification allows relay on a grounded claim set (Python parity)", async () => {
  const response = await agentOutputVerificationResponseFor(groundedAuditFixture());
  assert.equal(response.result.status.state, "TASK_STATE_COMPLETED");
  const resp = response.result.metadata.response;
  assert.equal(resp.verdict, "allow_relay");
  assert.equal(resp.trust_signal, "high");
  assert.equal(resp.human_review_required, false);
  assert.deepEqual(resp.unsafe_claims, []);
});

test("agent-output-verification blocks relay on an unsupported claim (Python parity)", async () => {
  const audit = groundedAuditFixture();
  audit.claims.push({ claim_id: "c2", claim: "Volumes tripled last quarter.", support_level: "unsupported" });
  const response = await agentOutputVerificationResponseFor(audit);
  const resp = response.result.metadata.response;
  assert.equal(resp.verdict, "block_unsafe_claims");
  assert.equal(resp.trust_signal, "low");
  assert.equal(resp.human_review_required, true);
  assert.ok(resp.unsafe_claims.some((item) => item.claim_id === "c2"));
  assert.ok(resp.readiness_score <= 49);
});

test("agent-output-verification flags an orphan evidence reference as unsafe (Python parity)", async () => {
  const audit = groundedAuditFixture();
  audit.claims[0].evidence_ids = ["e_missing"];
  delete audit.claims[0].supporting_quotes;
  const response = await agentOutputVerificationResponseFor(audit);
  const resp = response.result.metadata.response;
  assert.equal(resp.verdict, "block_unsafe_claims");
  assert.ok(resp.unsafe_claims.some((item) => item.reason.includes("not present")));
  assert.ok(resp.evidence_gaps.length > 0);
});

test("agent-output-verification requires verification for a weak claim (Python parity)", async () => {
  const audit = groundedAuditFixture();
  audit.claims[0].support_level = "weak";
  const response = await agentOutputVerificationResponseFor(audit);
  const resp = response.result.metadata.response;
  assert.equal(resp.verdict, "verify_before_relay");
  assert.equal(resp.human_review_required, true);
  assert.ok(resp.weak_claims.some((item) => item.claim_id === "c1"));
});

// The gate's stated job is checking that claims are backed. Until 2026-09-04 it
// scored the caller's own declared support_level, so one `direct` claim and an
// empty evidence array returned readiness 100 / review_ready — full marks for a
// pack with nothing in it. A declared level is an assertion; it counts only when
// the claim cites evidence actually supplied.
test("agent-output-verification scores nothing for a declared support level nothing backs (Python parity)", async () => {
  const response = await agentOutputVerificationResponseFor({
    claims: [{ claim_id: "c1", claim: "A claim with no evidence behind it.", support_level: "direct" }],
    evidence: []
  });
  const resp = response.result.metadata.response;
  assert.equal(resp.verdict, "insufficient_information");
  assert.equal(resp.readiness_score, 0);
  assert.equal(resp.readiness_label, "insufficient_information");
  assert.equal(resp.trust_signal, "unknown");
  assert.deepEqual(resp.unsafe_claims, []);
  assert.ok(resp.evidence_gaps.some((gap) => gap.includes("c1")));
  assert.ok(resp.owner_actions.some((action) => action.includes("caller assertion")));
});

test("agent-output-verification keeps an uncorroborated claim out of the review_ready band (Python parity)", async () => {
  const audit = groundedAuditFixture();
  audit.claims.push({ claim_id: "c2", claim: "Volumes tripled last quarter.", support_level: "direct" });
  const response = await agentOutputVerificationResponseFor(audit);
  const resp = response.result.metadata.response;
  assert.equal(resp.verdict, "verify_before_relay");
  assert.equal(resp.readiness_score, 50);
  assert.equal(resp.readiness_label, "partial");
  assert.deepEqual(resp.unsafe_claims, []);
  assert.ok(resp.evidence_gaps.some((gap) => gap.includes("c2")));
});

test("agent-output-verification still scores a corroborated claim set at full readiness (Python parity)", async () => {
  const response = await agentOutputVerificationResponseFor(groundedAuditFixture());
  const resp = response.result.metadata.response;
  assert.equal(resp.readiness_score, 100);
  assert.equal(resp.readiness_label, "review_ready");
});

test("agent-output-verification asks for input on a non-audit request shape", async () => {
  const response = await agentOutputVerificationResponseFor({ not: "an audit" });
  assert.equal(response.result.status.state, "TASK_STATE_INPUT_REQUIRED");
  assert.equal(response.result.metadata.valid, false);
});

test("agent-output-verification rejects a bad support_level enum", async () => {
  const audit = groundedAuditFixture();
  audit.claims[0].support_level = "definitely";
  const response = await agentOutputVerificationResponseFor(audit);
  assert.equal(response.result.status.state, "TASK_STATE_FAILED");
  assert.equal(response.result.metadata.valid, false);
});

// --- MCP over Streamable HTTP (2026-07-28 stateless core) ---------------------

const MCP_ENV = { AGENT_PROFILE: "agent_output_verification" };
const mcpRequest = new Request("https://agent-output-verification-a2a.example.workers.dev/mcp", {
  method: "POST",
  headers: { "user-agent": "node:test" }
});

async function mcpCall(payload, request = mcpRequest, env = MCP_ENV) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await handleMcpJsonRpc(payload, request, env);
  } finally {
    console.log = originalLog;
  }
}

test("mcp server/discover advertises the stateless revision and identity", async () => {
  const response = await mcpCall({ jsonrpc: "2.0", id: 1, method: "server/discover" });
  const result = response.result;
  assert.equal(result.protocolVersions[0], "2026-07-28");
  assert.equal(result.serverInfo.name, "agenda-intelligence-md");
  assert.equal(result.resultType, "complete");
  assert.equal(result._meta["io.modelcontextprotocol/serverInfo"].name, "agenda-intelligence-md");
});

test("mcp tools/list is cacheable and profile-scoped", async () => {
  const response = await mcpCall({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const result = response.result;
  assert.equal(result.cacheScope, "public");
  assert.ok(result.ttlMs > 0);
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    [
      "agent_output_verification",
      "pre_action_check",
      "decision_policies_list",
      "decision_check",
      "decision_verify"
    ]
  );
  assert.ok(result.tools[0].description.includes("Human review is required"));
  assert.deepEqual(result.tools[0].inputSchema.required, ["claims", "evidence"]);
  assert.ok(!("request" in result.tools[0].inputSchema.properties));
  assert.ok(result.tools[0].outputSchema.required.includes("verdict"));
  assert.ok(result.tools[1].inputSchema.required.includes("run_id"));
  assert.ok(result.tools[1].outputSchema.required.includes("decision"));
  for (const tool of result.tools.filter((tool) => tool.name !== "decision_check")) {
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    });
  }
  assert.deepEqual(result.tools.find((tool) => tool.name === "decision_check").annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  });
});

test("mcp tools/list embeds complete input and output schemas for every structured worker", () => {
  const profiles = [
    "kazakhstan",
    "cis_secondary_sanctions",
    "agentic_interaction_trust",
    "agent_output_verification",
    "gulf_maritime_exposure",
    "market_entry_readiness",
    "dual_use_technology_export"
  ];
  for (const profile of profiles) {
    for (const tool of mcpToolsForProfile(profile)) {
      assert.equal(tool.inputSchema.$schema, "https://json-schema.org/draft/2020-12/schema", tool.name);
      assert.equal(tool.inputSchema.type, "object", tool.name);
      if (tool.name === "decision_policies_list") {
        assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
      } else {
        assert.ok(Array.isArray(tool.inputSchema.required), tool.name);
        assert.ok(tool.inputSchema.required.length > 0, tool.name);
      }
      assert.equal(tool.outputSchema.$schema, "https://json-schema.org/draft/2020-12/schema", tool.name);
      assert.equal(tool.outputSchema.type, "object", tool.name);
      assert.ok(Array.isArray(tool.outputSchema.required), tool.name);
      assert.ok(tool.outputSchema.required.length > 0, tool.name);
    }
  }
});

test("mcp tools/call returns the same verdict as the A2A route", async () => {
  const audit = groundedAuditFixture();
  const mcp = await mcpCall({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "agent_output_verification", arguments: audit }
  });
  const a2a = await agentOutputVerificationResponseFor(groundedAuditFixture());

  const viaMcp = mcp.result.structuredContent;
  assert.equal(mcp.result.isError, false);
  assert.equal(viaMcp.verdict, "allow_relay");
  assert.deepEqual(viaMcp, a2a.result.metadata.response);
  assert.match(mcp.result.content[0].text, /verdict=allow_relay/);
  assert.ok(mcp.result.content[0].text.length < 500);
  assert.ok(!("artifacts" in viaMcp));
  assert.ok(Buffer.byteLength(JSON.stringify(mcp)) < 12_000);
});

test("mcp tools/call keeps the legacy request wrapper as an input compatibility shim", async () => {
  const response = await mcpCall({
    jsonrpc: "2.0",
    id: "legacy-wrapper",
    method: "tools/call",
    params: { name: "agent_output_verification", arguments: { request: groundedAuditFixture() } }
  });
  assert.equal(response.result.structuredContent.metadata.response.verdict, "allow_relay");
  assert.equal(JSON.parse(response.result.content[0].text).metadata.response.verdict, "allow_relay");
});

test("mcp tools/call on an unsupported claim blocks relay", async () => {
  const audit = groundedAuditFixture();
  audit.claims.push({ claim_id: "c2", claim: "Volumes tripled last quarter.", support_level: "unsupported" });
  const response = await mcpCall({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "agent_output_verification", arguments: audit }
  });
  assert.equal(response.result.structuredContent.verdict, "block_unsafe_claims");
});

test("mcp pre_action_check uses the same action decision as the A2A route", async () => {
  const request = preActionCheckFixture("high");
  const mcp = await mcpCall({
    jsonrpc: "2.0",
    id: "pre-action-mcp",
    method: "tools/call",
    params: { name: "pre_action_check", arguments: request }
  });
  const a2a = await agentOutputVerificationResponseFor(request);

  const viaMcp = mcp.result.structuredContent;
  assert.equal(mcp.result.isError, false);
  assert.equal(viaMcp.decision, "require_approval");
  assert.equal(viaMcp.decision, a2a.result.metadata.response.decision);
  assert.equal(viaMcp.reason_code, a2a.result.metadata.response.reason_code);
});

// A refusal that names no field is a dead end for a machine caller: nothing in
// "does not satisfy this tool's input contract" tells it which argument to add,
// so it cannot retry and does not come back. The A2A route has always answered
// with the full guide. This asserts the MCP route carries the same one.
test("an mcp refusal carries the field guide, not just a sentence", async () => {
  const env = { AGENT_PROFILE: "kazakhstan" };
  const request = new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/mcp", {
    method: "POST",
    headers: { "user-agent": "node:test" }
  });

  const refusal = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "gate-refusal",
      method: "tools/call",
      params: {
        name: "middle_corridor_deal_risk",
        arguments: { risk_question: "What do we need before signing?" }
      }
    },
    request,
    env
  );

  const payload = refusal.result.structuredContent;
  assert.equal(refusal.result.isError, true);
  // An object the gate does not recognise as a structured request is ADR 0026
  // case 1 — nothing structured arrived — not a request that failed validation.
  assert.equal(payload.error, "INPUT_REQUIRED");
  assert.ok(
    Array.isArray(payload.required_fields) && payload.required_fields.length > 0,
    "a refusal must name the fields it wants"
  );
  assert.ok(
    payload.example_request && typeof payload.example_request === "object",
    "a refusal must carry an example the caller can send back"
  );
  assert.ok(payload.front_door, "a refusal must say where to route instead");

  // The example is the arguments object itself, so a caller can retry with it
  // unchanged. An A2A envelope would not survive the hop into tools/call.
  assert.ok(!("jsonrpc" in payload.example_request));
  assert.ok(!("params" in payload.example_request));

  // params.message.parts is the A2A request path and does not exist in an MCP
  // tools/call, so no refusal reaching an MCP caller may point at it.
  assert.ok(!JSON.stringify(payload).includes("params.message.parts"));
});

// A2A can say "I need input"; MCP cannot. Its only way to tell a model to fix
// the call is isError, so a gate that answered INPUT_REQUIRED with isError:false
// was reporting an empty request as a call that worked.
test("an mcp caller that sends nothing gets an error, not a silent non-answer", async () => {
  const env = { AGENT_PROFILE: "cis_secondary_sanctions" };
  const request = new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/mcp", {
    method: "POST",
    headers: { "user-agent": "node:test" }
  });

  const refusal = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "needs-input",
      method: "tools/call",
      params: { name: "cis_secondary_sanctions_exposure", arguments: {} }
    },
    request,
    env
  );

  assert.equal(refusal.result.isError, true, "an empty request must not read as a completed call");
  const payload = refusal.result.structuredContent;

  // Kept distinct from INVALID_TOOL_INPUT on purpose: sending nothing and
  // sending something broken are different problems for the caller to fix.
  assert.equal(payload.error, "INPUT_REQUIRED");
  assert.ok(
    Array.isArray(payload.required_fields) && payload.required_fields.length > 0,
    "a refusal must name the fields it wants"
  );
  assert.ok(!JSON.stringify(payload).includes("params.message.parts"));
});

// The free-text profile kept its guide only in the artifact, so its MCP refusal
// arrived with no field named anywhere in it.
test("the free-text profile names its one argument when it refuses over mcp", async () => {
  const env = { AGENT_PROFILE: "agenda" };
  const request = new Request("https://agenda-intelligence-a2a.example.workers.dev/mcp", {
    method: "POST",
    headers: { "user-agent": "node:test" }
  });

  const refusal = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "empty-text",
      method: "tools/call",
      params: { name: "strategic_risk_triage", arguments: {} }
    },
    request,
    env
  );

  assert.equal(refusal.result.isError, true);
  const payload = refusal.result.structuredContent;
  assert.ok(
    Array.isArray(payload.required_fields) && payload.required_fields.length > 0,
    "even a one-argument tool must say which argument"
  );
  assert.ok(
    payload.required_fields.some((field) => field.startsWith("text")),
    "the named argument must be the one tools/call actually takes"
  );
  assert.ok(!JSON.stringify(payload).includes("params.message.parts"));
});

// A description that promises "evidence gaps" without saying evidence must be
// supplied reads, to an agent holding only a question, as a tool it can call.
// It cannot: the call is refused. The precondition belongs next to the promise.
test("a tool that grades supplied evidence says so in its description", async () => {
  const { mcpToolsForProfile } = await import("../src/mcp.js");
  const precondition = "brings none is refused";

  for (const profile of ["kazakhstan", "cis_secondary_sanctions", "gulf_maritime_exposure"]) {
    const [tool] = mcpToolsForProfile(profile);
    assert.ok(
      tool.inputSchema.required.length > 1,
      `${tool.name} is expected to take a structured request`
    );
    assert.ok(
      tool.description.includes(precondition),
      `${tool.name} must say the caller has to bring evidence`
    );
    // A refused caller needs somewhere to go, not just a no.
    assert.ok(tool.description.includes("corridor_sanctions_assistant"));
  }

  // The free-text tools take a question and are the place an empty-handed
  // caller is sent, so the clause would be false on them.
  for (const profile of ["agenda", "corridor_sanctions_assistant"]) {
    const [tool] = mcpToolsForProfile(profile);
    // One string argument, whether or not it is required — the front door
    // answers without it, which is why it is the place to send someone.
    assert.deepEqual(Object.keys(tool.inputSchema.properties), ["text"]);
    assert.ok(!tool.description.includes(precondition));
  }

  // Neither of these grades evidence: one takes no arguments, the other a receipt.
  const decision = mcpToolsForProfile("agent_output_verification");
  for (const name of ["decision_policies_list", "decision_verify"]) {
    const tool = decision.find((entry) => entry.name === name);
    assert.ok(!tool.description.includes(precondition), `${name} does not grade evidence`);
  }
});

// The front door is where every other gate's refusal now sends an empty-handed
// caller, so it must not turn one away — and its schema has to say so. It said
// the opposite while accepting a number, a null and an unrelated object alike.
test("the front door declares that it answers without a question", async () => {
  const { mcpToolsForProfile } = await import("../src/mcp.js");

  const [door] = mcpToolsForProfile("corridor_sanctions_assistant");
  assert.equal(door.name, "corridor_sanctions_assistant");
  assert.ok(!door.inputSchema.required, "the front door must not require an argument it answers without");
  assert.equal(door.inputSchema.additionalProperties, true);
  assert.ok(door.inputSchema.properties.text.description.includes("Optional"));

  // Its sibling takes the same single string and does enforce it. That contrast
  // is the point: a schema is a promise, and these two made opposite ones.
  const [triage] = mcpToolsForProfile("agenda");
  assert.deepEqual(triage.inputSchema.required, ["text"]);
  assert.equal(triage.inputSchema.additionalProperties, false);
});

// 404 on the MCP endpoint does not say "wrong method" — it says there is no MCP
// server at this address, and that is what the registry probes were told. The
// endpoint is advertised as streamable-http, whose client may open the stream
// with GET, so the honest answer for a POST-only server is 405.
test("the mcp endpoint answers a non-POST with 405, not 404", async () => {
  const { default: worker } = await import("../src/index.js");
  const env = { AGENT_PROFILE: "agenda" };

  for (const method of ["GET", "HEAD", "PUT", "DELETE"]) {
    const response = await worker.fetch(
      new Request("https://agenda-intelligence-a2a.example.workers.dev/mcp", { method }),
      env,
      { waitUntil() {} }
    );
    assert.equal(response.status, 405, `${method} /mcp must not read as a missing endpoint`);
    assert.equal(response.headers.get("allow"), "POST", `${method} must be told what is allowed`);
  }

  // A path that really is absent still says so.
  const missing = await worker.fetch(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/mcp/nope", { method: "GET" }),
    env,
    { waitUntil() {} }
  );
  assert.equal(missing.status, 404);
});

test("mcp decision gate lists its bounded policy and signs an exact-request receipt", async () => {
  const privateJwk = await generateTestKey();
  const env = {
    ...MCP_ENV,
    AGENT_CARD_SIGNING_KEY: JSON.stringify(privateJwk),
    AGENT_CARD_SIGNING_KID: privateJwk.kid
  };
  const listed = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "decision-policies",
      method: "tools/call",
      params: { name: "decision_policies_list", arguments: {} }
    },
    mcpRequest,
    env
  );
  assert.equal(listed.result.isError, false);
  assert.equal(listed.result.structuredContent.policies.length, 1);
  assert.equal(listed.result.structuredContent.policies[0].policy_id, "pre-action-check.v1");

  const invalidList = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "decision-policies-invalid",
      method: "tools/call",
      params: { name: "decision_policies_list", arguments: { unexpected: true } }
    },
    mcpRequest,
    env
  );
  assert.equal(invalidList.result.isError, true);
  assert.equal(invalidList.result.structuredContent.error, "INVALID_TOOL_INPUT");

  const checked = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "decision-check",
      method: "tools/call",
      params: { name: "decision_check", arguments: preActionCheckFixture() }
    },
    mcpRequest,
    env
  );
  const decision = checked.result.structuredContent;
  assert.equal(checked.result.isError, false);
  assert.equal(decision.decision, "continue");
  assert.equal(decision.receipt_status, "signed");
  assert.equal(decision.receipt.format, "agenda-readiness-receipt+jws");
  assert.equal(decision.receipt.token.split(".").length, 3);
  assert.match(decision.receipt.request_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(decision.receipt.action_hash, /^sha256:[a-f0-9]{64}$/);

  const verified = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "decision-verify",
      method: "tools/call",
      params: {
        name: "decision_verify",
        arguments: {
          receipt: decision.receipt.token,
          expected_request_hash: decision.receipt.request_hash,
          expected_action_hash: decision.receipt.action_hash
        }
      }
    },
    mcpRequest,
    env
  );
  assert.equal(verified.result.isError, false);
  assert.equal(verified.result.structuredContent.signature_valid, true);
  assert.equal(verified.result.structuredContent.binding_matches, true);
  assert.equal(verified.result.structuredContent.gate_passed, true);
});

test("mcp decision gate fails closed when a signing key is unavailable", async () => {
  const checked = await mcpCall({
    jsonrpc: "2.0",
    id: "decision-check-no-key",
    method: "tools/call",
    params: { name: "decision_check", arguments: preActionCheckFixture() }
  });
  assert.equal(checked.result.isError, true);
  assert.equal(checked.result.structuredContent.receipt_status, "unavailable");
  assert.equal(checked.result.structuredContent.receipt, null);
});

test("mcp tools/call keeps the largest worker result below a bounded context cost", async () => {
  const liveRequest = JSON.parse(
    readFileSync(new URL("../../../examples/kazakhstan-middle-corridor/live-agent-request.json", import.meta.url), "utf8")
  );
  const structuredRequest = liveRequest.params.message.parts[0].data;
  const response = await mcpCall(
    {
      jsonrpc: "2.0",
      id: "compact-middle-corridor",
      method: "tools/call",
      params: { name: "middle_corridor_deal_risk", arguments: structuredRequest }
    },
    new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/mcp"),
    { AGENT_PROFILE: "kazakhstan" }
  );

  assert.equal(response.result.structuredContent.triage_recommendation, "escalate_before_signature");
  assert.ok(!("artifacts" in response.result.structuredContent));
  assert.ok(response.result.content[0].text.length < 500);
  assert.ok(Buffer.byteLength(JSON.stringify(response)) < 15_000);
});

test("mcp tools/call rejects an unknown tool as a tool error, not a protocol error", async () => {
  const response = await mcpCall({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "not_a_tool", arguments: {} }
  });
  assert.equal(response.result.isError, true);
  assert.ok(response.result.structuredContent.error.includes("Unknown tool"));
});

test("mcp rejects an unsupported protocol version stated in _meta", async () => {
  const response = await mcpCall({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/list",
    params: { _meta: { "io.modelcontextprotocol/protocolVersion": "1999-01-01" } }
  });
  assert.equal(response.error.code, -32022);
  assert.ok(response.error.data.supported.includes("2026-07-28"));
});

test("mcp still answers the removed initialize handshake for older clients", async () => {
  const response = await mcpCall({
    jsonrpc: "2.0",
    id: 7,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "legacy" } }
  });
  assert.equal(response.result.protocolVersion, "2025-03-26");
  assert.equal(await mcpCall({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("mcp endpoint is routed and served without a session header", async () => {
  const originalLog = console.log;
  console.log = () => {};
  let response;
  try {
    response = await handleRequest(
      new Request("https://agent-output-verification-a2a.example.workers.dev/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "node:test" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 8, method: "server/discover" })
      }),
      MCP_ENV,
      {}
    );
  } finally {
    console.log = originalLog;
  }
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.protocolVersions[0], "2026-07-28");
});

test("mcp endpoint permits the 2026-07-28 routing headers in browser preflight", async () => {
  const response = await handleRequest(
    new Request("https://agent-output-verification-a2a.example.workers.dev/mcp", { method: "OPTIONS" }),
    MCP_ENV
  );
  const allowed = response.headers.get("access-control-allow-headers");
  assert.equal(response.status, 204);
  assert.match(allowed, /mcp-method/);
  assert.match(allowed, /mcp-name/);
});

test("mcp server card advertises the hosted streamable-http transport", () => {
  const card = mcpServerCard(
    new Request("https://agent-output-verification-a2a.example.workers.dev/.well-known/mcp/server-card.json"),
    MCP_ENV
  );
  assert.equal(card.protocolVersion, "2026-07-28");
  const hosted = card.transports.find((entry) => entry.type === "streamable-http");
  assert.equal(hosted.url, "https://agent-output-verification-a2a.example.workers.dev/mcp");
  assert.equal(hosted.stateless, true);
  assert.deepEqual(hosted.tools, [
    "agent_output_verification",
    "pre_action_check",
    "decision_policies_list",
    "decision_check",
    "decision_verify"
  ]);
  assert.equal(card.transport.type, "stdio");
});

test("deploy drift check reads only the newest deployment", async () => {
  const { newestReceipt } = await import("../scripts/deploy-all.js");

  // Shape of `wrangler deployments list`, oldest first. This is the real
  // 2026-08-14 sequence: the gate ran, then a plain deploy overwrote it.
  const drifted = [
    "Created:     2026-08-14T05:43:30.490Z",
    "Message:     Vizier ALLOW receipt vrf_a281519b",
    "Created:     2026-08-14T05:44:29.457Z",
    "Message:     -"
  ].join("\n");
  assert.equal(newestReceipt(drifted), null, "a superseded receipt must not count as live");

  const clean = [
    "Created:     2026-08-14T05:44:29.457Z",
    "Message:     -",
    "Created:     2026-08-14T06:22:24.359Z",
    "Message:     Vizier ALLOW receipt vrf_6bf1ffee"
  ].join("\n");
  assert.equal(newestReceipt(clean), "vrf_6bf1ffee");
});

// A valid receipt on an old version looks identical to a healthy fleet, which
// is how agent-output-verification sat eighty-five minutes behind the other
// seven on 2026-08-26 while `--check` reported success. The date of the newest
// deployment is the part that catches it.
test("deploy freshness check dates only the newest deployment", async () => {
  const { newestDeployedAt } = await import("../scripts/deploy-all.js");

  const listing = [
    "Created:     2026-08-26T10:24:42.521Z",
    "Message:     Vizier ALLOW receipt vrf_974b26ef",
    "Version(s):  (100%) 0ee4804d-d6a8-4a9d-8c2d-44b70fd79b5e",
    "                 Created:  2026-08-26T10:24:40.100Z",
    "Created:     2026-08-26T12:09:32.084Z",
    "Message:     Vizier ALLOW receipt vrf_7bdb60fb",
    "Version(s):  (100%) 246af187-9366-49a9-bd2f-2cc10aed2105",
    "                 Created:  2026-08-26T12:09:30.941Z"
  ].join("\n");

  assert.equal(
    newestDeployedAt(listing),
    Date.parse("2026-08-26T12:09:32.084Z"),
    "the indented per-version Created lines must not be mistaken for deployments"
  );

  assert.equal(newestDeployedAt(""), null, "no deployments must read as unknown, not as epoch zero");
  assert.equal(newestDeployedAt("Created:     not-a-date\n"), null);
});

// Dates were the first answer here and the wrong one: a squash merge writes a
// new commit with a new date and identical content, and the first one after
// that check shipped reported all eight environments stale while the tree was
// byte-identical. The deployment now carries a digest of what was deployed, so
// rebases and squashes move dates and leave the comparison alone.
test("deploy freshness reads the content stamp from the newest deployment only", async () => {
  const { newestDeployedDigest } = await import("../scripts/deploy-all.js");

  const listing = [
    "Created:     2026-08-26T12:09:32.084Z",
    "Message:     Vizier ALLOW receipt vrf_974b26ef src aaaaaaaaaaaa",
    "Created:     2026-08-27T09:00:00.000Z",
    "Message:     Vizier ALLOW receipt vrf_7bdb60fb src 4f2a91c0d3e8"
  ].join("\n");
  assert.equal(newestDeployedDigest(listing), "4f2a91c0d3e8", "a superseded stamp must not count as live");

  // Deployments made before the stamp existed. Unknown is not stale: reporting
  // drift on them would condemn the whole fleet until the next deploy.
  assert.equal(newestDeployedDigest("Created:     2026-08-26T12:09:32.084Z\nMessage:     -\n"), null);
  assert.equal(newestDeployedDigest(""), null);

  // The receipt and the digest share one message and must not consume each
  // other: the gate is the only path allowed to ship that environment, so a
  // reader that could see only one of the two would always be missing one.
  const { newestReceipt } = await import("../scripts/deploy-all.js");
  assert.equal(newestReceipt(listing), "vrf_7bdb60fb");
});

// A rotation that reaches nine of ten environments leaves no trace: the tenth
// keeps answering /stats with 401 and nothing else changes. Observed
// 2026-08-28, four environments behind. The environment list is therefore read
// from wrangler.toml rather than kept by hand.
test("stats-token rotation covers every environment wrangler.toml declares", async () => {
  const { deployedEnvironments } = await import("../scripts/rotate-stats-token.js");

  const toml = [
    'name = "agenda-intelligence-a2a"',
    'main = "src/index.js"',
    "",
    "[observability]",
    "enabled = true",
    "",
    "[[kv_namespaces]]",
    'binding = "AGENDA_USAGE"',
    "",
    "[env.cis-secondary-sanctions]",
    'name = "cis-secondary-sanctions-a2a"',
    "",
    "[env.cis-secondary-sanctions.vars]",
    'AGENT_PROFILE = "cis_secondary_sanctions"',
    "",
    "[[env.cis-secondary-sanctions.kv_namespaces]]",
    'binding = "AGENDA_USAGE"',
    "",
    "[env.dual-use-technology-export]",
    'name = "dual-use-technology-export-a2a"'
  ].join("\n");

  const environments = deployedEnvironments(toml);
  assert.deepEqual(
    environments.map((item) => item.env),
    ["", "cis-secondary-sanctions", "dual-use-technology-export"],
    "[env.x.vars] and [[env.x.kv_namespaces]] must not introduce extra environments"
  );
  // The top-level name must not be captured from a sub-table, and an
  // environment must not inherit the name of the one declared before it.
  assert.equal(environments[0].workerName, "agenda-intelligence-a2a");
  assert.equal(environments[1].workerName, "cis-secondary-sanctions-a2a");
  assert.equal(environments[2].workerName, "dual-use-technology-export-a2a");

  // The real file is the case that matters: ten environments, ten names.
  const live = deployedEnvironments(
    readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8")
  );
  assert.equal(live.length, 10);
  assert.ok(live.every((item) => item.workerName));
});

// The helper this replaced wrote the token with `> .env`, which also erased
// AGENDA_OBSERVABILITY_TOKEN — the credential `npm run funnel` reads. Rotating
// one secret must not silently revoke another.
test("stats-token rotation rewrites one key and keeps the rest of .env", async () => {
  const { withStatsToken } = await import("../scripts/rotate-stats-token.js");

  assert.equal(
    withStatsToken("AGENDA_OBSERVABILITY_TOKEN=abc\nSTATS_TOKEN=old\n", "new"),
    "AGENDA_OBSERVABILITY_TOKEN=abc\nSTATS_TOKEN=new\n"
  );
  assert.equal(withStatsToken("AGENDA_OBSERVABILITY_TOKEN=abc\n", "new"),
    "AGENDA_OBSERVABILITY_TOKEN=abc\nSTATS_TOKEN=new\n");
  assert.equal(withStatsToken("", "new"), "STATS_TOKEN=new\n");
});

// Measured 2026-08-18 on the live workers: a plain-language probe made five of
// the eight gates answer TASK_STATE_FAILED with `artifacts: []` — no required
// field, no example, no human to write to. The refusal is correct; the silence
// was not. Both halves are asserted here, including that the example shipped in
// the refusal is one the same gate accepts.
test("a gate that refuses a request says what it needs, and its own example works", async () => {
  const gates = [
    ["cis_secondary_sanctions", "cis_secondary_sanctions"],
    ["agentic_interaction_trust", "agentic_interaction_trust"],
    ["agent_output_verification", "agent_output_verification"],
    ["gulf_maritime_exposure", "gulf_maritime_exposure"],
    ["kazakhstan_market_entry_readiness", "market_entry_readiness"],
    ["critical_minerals_due_diligence", "critical_minerals_due_diligence"]
  ];
  const originalLog = console.log;
  console.log = () => {};
  try {
    for (const [productProfile, envProfile] of gates) {
      const rpcRequest = new Request("https://gate.example.workers.dev/message/send", {
        method: "POST",
        headers: { "content-type": "application/json" }
      });
      const send = (parts) =>
        handleJsonRpc(
          {
            jsonrpc: "2.0",
            id: `guidance-${productProfile}`,
            method: "message/send",
            params: { message: { messageId: `m-${productProfile}`, role: "ROLE_USER", parts } }
          },
          rpcRequest,
          { AGENT_PROFILE: envProfile }
        );

      const refused = (await send([{ kind: "text", text: "hi" }])).result;
      assert.equal(refused.status.state, "TASK_STATE_INPUT_REQUIRED");
      assert.equal(refused.metadata.product_profile, productProfile);

      const artifact = refused.artifacts[0];
      assert.ok(artifact, `${productProfile} must return guidance, not an empty artifacts[]`);
      const [markdown, json] = artifact.parts;
      assert.equal(markdown.mediaType, "text/markdown");
      assert.match(markdown.text, /## What it needs/);
      assert.match(markdown.text, /## A request that works/);
      assert.match(markdown.text, /corridor-sanctions-assistant-a2a/);
      assert.match(markdown.text, /vassiliy\.lakhonin@gmail\.com/);
      assert.ok(json.data.required_fields.length > 0);
      assert.deepEqual(json.data.example_request, GATE_REQUEST_GUIDES[productProfile].example);
      assert.deepEqual(refused.metadata.example_request, GATE_REQUEST_GUIDES[productProfile].example);

      const accepted = (await send([{ data: GATE_REQUEST_GUIDES[productProfile].example }])).result;
      assert.equal(
        accepted.status.state,
        "TASK_STATE_COMPLETED",
        `${productProfile} rejected the example it hands out: ${JSON.stringify(accepted.metadata?.errors)}`
      );
    }
  } finally {
    console.log = originalLog;
  }
});

// A2A v1 AgentCard (specification/a2a.proto message AgentCard) and
// AgentProvider define a closed field set. An independent conformance scan on
// 2026-08-23 failed every card this Worker serves on exactly this: `support`,
// `x_agenda_intelligence`, `x_agent_contract` and a top-level `signature` at
// the root, plus `provider.legalEntity`. Nothing but `capabilities.extensions`
// may carry vendor data.
const A2A_V1_CARD_FIELDS = new Set([
  "name",
  "description",
  "supportedInterfaces",
  "provider",
  "version",
  "documentationUrl",
  "capabilities",
  "securitySchemes",
  "securityRequirements",
  "defaultInputModes",
  "defaultOutputModes",
  "skills",
  "signatures",
  "iconUrl"
]);

test("the served agent card carries no field the A2A v1 schema does not define", async () => {
  for (const host of [
    "agenda-intelligence-a2a.example.workers.dev",
    "middle-corridor-deal-risk-gate-a2a.example.workers.dev",
    "cis-secondary-sanctions-a2a.example.workers.dev",
    "agentic-interaction-trust-a2a.example.workers.dev"
  ]) {
    const response = await handleRequest(
      new Request(`https://${host}/.well-known/agent-card.json`),
      {}
    );
    const card = await response.json();

    const unexpected = Object.keys(card).filter((key) => !A2A_V1_CARD_FIELDS.has(key));
    assert.deepEqual(unexpected, [], `${host} served non-schema root fields: ${unexpected}`);

    assert.deepEqual(
      Object.keys(card.provider).sort(),
      ["organization", "url"],
      `${host} served a provider with fields outside AgentProvider`
    );
  }
});

test("card data outside the schema survives inside capabilities.extensions", async () => {
  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/.well-known/agent-card.json"),
    {}
  );
  const card = await response.json();
  const extension = card.capabilities.extensions.find(
    (entry) => entry.uri === "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/a2a/extensions/agenda-intelligence/v1"
  );

  assert.ok(extension, "the vendor extension must be present");
  assert.equal(extension.required, false, "reading vendor metadata must never be required");
  assert.ok(extension.params.x_agenda_intelligence, "wrapper metadata must survive the move");
  assert.equal(extension.params.support.email, "vassiliy.lakhonin@gmail.com");
  assert.equal(extension.params.provider.legalEntity.type, "individual");
});

// An agent that finds a gate through its card and one that finds it through
// tools/list must learn the same contract. Until the card carried this, the
// first learned only that the gate accepts JSON, and the two transports —
// which share a dispatch — advertised different amounts about the same payload.
test("the served card carries the same tool contracts tools/list carries", async () => {
  const hosts = [
    ["agenda-intelligence-a2a.example.workers.dev", "agenda"],
    ["middle-corridor-deal-risk-gate-a2a.example.workers.dev", "kazakhstan"],
    ["cis-secondary-sanctions-a2a.example.workers.dev", "cis_secondary_sanctions"],
    ["agent-output-verification-a2a.example.workers.dev", "agent_output_verification"],
    ["dual-use-technology-export-a2a.example.workers.dev", "dual_use_technology_export"]
  ];

  for (const [host, profile] of hosts) {
    const response = await handleRequest(
      new Request(`https://${host}/.well-known/agent-card.json`),
      {}
    );
    const card = await response.json();
    const contracts = cardExtensionParams(card).x_tool_contracts;
    assert.ok(contracts, `${host} served no tool contracts`);

    // Read from the same source the MCP endpoint answers from, so a schema
    // change lands on both surfaces or on neither.
    const expected = mcpToolsForProfile(profile).map((tool) => ({
      name: tool.name,
      input_schema: tool.inputSchema,
      ...(tool.outputSchema ? { output_schema: tool.outputSchema } : {}),
      annotations: tool.annotations
    }));
    assert.deepEqual(contracts.tools, expected, `${host} card and tools/list disagree`);
    assert.equal(contracts.contract_version, VERSION);

    // The schemas must arrive whole. A card that names a tool and describes
    // half its payload is worse than one that describes none: it reads as a
    // complete contract.
    for (const tool of contracts.tools) {
      assert.equal(tool.input_schema?.type, "object", `${tool.name} input schema is not an object schema`);
      assert.ok(tool.annotations, `${tool.name} lost its annotations`);
    }
  }
});

test("a profile with no hosted tools serves no empty contract block", () => {
  const card = agentCard(
    new Request("https://corridor-sanctions-assistant-a2a.example.workers.dev/.well-known/agent-card.json"),
    { AGENT_PROFILE: "corridor_sanctions_assistant" }
  );
  // The front-door profile does have a tool today; the guard is that an empty
  // list never ships as `tools: []`, which reads as "this gate exposes nothing"
  // rather than "this card says nothing about tools".
  const contracts = card.x_tool_contracts;
  if (contracts) assert.ok(contracts.tools.length > 0, "an empty tool list must be omitted, not served");
});

test("toSpecWireCard moves anything it does not recognise, not a fixed list", () => {
  const wire = toSpecWireCard({
    name: "Test",
    skills: [],
    provider: { organization: "Someone", url: "https://example.test/", contact: "mailto:a@example.test" },
    x_future_field: { added: "by a profile that did not exist when this was written" }
  });

  assert.deepEqual(Object.keys(wire.provider).sort(), ["organization", "url"]);
  const params = wire.capabilities.extensions[0].params;
  assert.equal(params.x_future_field.added, "by a profile that did not exist when this was written");
  assert.equal(params.provider.contact, "mailto:a@example.test");
});

test("agentCard keeps its internal shape so profile and adapter readers are untouched", () => {
  const card = agentCard(request, {});
  assert.ok(card.x_agenda_intelligence, "internal readers use card.x_agenda_intelligence");
  assert.ok(card.support, "internal readers use card.support");
  assert.equal(card.provider.legalEntity.type, "individual");
});

// The subject line is the whole point of the 2026-08-26 rewrite: a replayed
// external call naming UAE, Fujairah, refined products and Kazakhstan came
// back with none of those words in 20,864 bytes of note. These four tests pin
// the properties that failure violated.
async function routingNoteFor(text, id = "subject-probe") {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id,
        method: "message/send",
        params: { message: { parts: [{ kind: "text", text }] } }
      },
      request
    );
    return response.result.artifacts[0].parts[0].text;
  } finally {
    console.log = originalLog;
  }
}

test("the note reads the caller's own subject back to them", async () => {
  const note = await routingNoteFor(
    "We are evaluating a UAE-based trading counterparty that ships refined products through Fujairah " +
      "and books transit via Kazakhstan. Screen the secondary-sanctions exposure before onboarding them."
  );

  assert.match(note, /read this as:/);
  assert.match(note, /United Arab Emirates/);
  assert.match(note, /Kazakhstan/);
  assert.match(note, /refined petroleum products/);
  // Fujairah's significance is that it sits outside the strait; naming the
  // country alone loses the fact the caller was paying for.
  assert.match(note, /Fujairah: bunkering and storage hub on the Gulf of Oman, outside the Strait of Hormuz/);
});

test("subject detection matches whole words, so 'before' is not the cargo class 'ore'", async () => {
  const note = await routingNoteFor("Screen this counterparty before onboarding them as a supplier.", "ore-probe");

  assert.doesNotMatch(note, /metals or ore/);
});

test("the note names the authorities to check, not just the source category", async () => {
  const note = await routingNoteFor(
    "Screen a UAE counterparty for secondary-sanctions exposure on a Kazakhstan transit route.",
    "regime-probe"
  );

  assert.match(note, /Regimes and lists that apply to what you named:/);
  assert.match(note, /OFAC SDN and Non-SDN Menu-Based lists/);
  assert.match(note, /UAE Executive Office for Control & Non-Proliferation/);
  assert.match(note, /OFAC EO 14024 \/ EO 14114/);
});

test("the answer precedes the packaging, and open items are named as work not as caller error", async () => {
  const note = await routingNoteFor(
    "Screen sanctions exposure for a Kazakhstan corridor shipment before signature.",
    "order-probe"
  );

  // Everything the caller came for has to appear before the install block.
  assert.ok(note.indexOf("Signal screen:") < note.indexOf("pip install agenda-intelligence-md"));
  assert.ok(note.indexOf("Collect next") < note.indexOf("pip install agenda-intelligence-md"));
  // The five identical "No caller-supplied ..." lines are gone from the note.
  assert.doesNotMatch(note, /No caller-supplied .* evidence in this live A2A request/);
  assert.match(note, /Collect next \(each line says what it settles\):/);
  assert.match(note, /settles designation status at a point in time/);
});

// Found live on the Middle Corridor gate minutes after the subject line
// shipped: the note named four places and a cargo class, then said the route
// and cargo were not supplied. The extractors only fired on the schema's own
// vocabulary.
test("the deal-risk gate reads the route and cargo the subject line already found", async () => {
  const originalLog = console.log;
  console.log = () => {};
  let response;
  try {
    response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "route-probe",
        method: "message/send",
        params: {
          message: {
            parts: [
              {
                kind: "text",
                text:
                  "Aluminium extrusions from Aktau to Jebel Ali via Baku and Poti, buyer is a UAE " +
                  "company incorporated in 2025, payment through a Georgian bank. What evidence " +
                  "will a bank ask for before signature?"
              }
            ]
          }
        }
      },
      new Request("https://middle-corridor-deal-risk-gate-a2a.example.workers.dev/message/send", {
        method: "POST",
        headers: { "content-type": "application/json" }
      })
    );
  } finally {
    console.log = originalLog;
  }

  const note = response.result.artifacts[0].parts[0].text;
  assert.doesNotMatch(note, /Route: not supplied/);
  assert.doesNotMatch(note, /Cargo: not supplied/);
  assert.match(note, /Route: Aktau, Jebel Ali, Baku, Poti/);
  assert.match(note, /Cargo: metals or ore \(cargo class read from the wording/);
  // The from/to capture ran to the end of the sentence and took the buyer and
  // payment clauses with it; the place-name path is used instead.
  assert.doesNotMatch(note, /Route:[^\n]*payment through a Georgian bank/);
});

test("the routing note states each source category once", async () => {
  const note = await routingNoteFor(
    "Screen sanctions exposure for a Kazakhstan corridor shipment before signature.",
    "dedupe-probe"
  );

  assert.doesNotMatch(note, /Full source-category checklist:/);
  const occurrences = note.split("\n").filter((line) => line.trim() === "- ownership/counterparty").length;
  assert.equal(occurrences, 0, "the bare category list should not reappear after Collect next");
});

test("direct REST POST /v1/evidence-packet/check validates packet and returns repair guidance", async () => {
  const payload = {
    claims: [
      {
        claim_id: "c1",
        claim: "Vessel has valid P&I insurance",
        support_level: "direct",
        evidence_ids: ["e1"],
        supporting_quotes: [{ evidence_id: "e1", text: "Gard confirms active P&I cover." }]
      }
    ],
    evidence: [
      {
        evidence_id: "e1",
        source_type: "insurance_certificate",
        title: "Gard P&I Certificate",
        date: "2026-05-01"
      }
    ]
  };

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/v1/evidence-packet/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.valid, true);
  assert.equal(json.packet_status, "review_ready");
  assert.equal(json.response.claim_count, 1);
  assert.equal(json.response.grounded_claim_count, 1);
  assert.match(json.response.repair_guidance, /# Evidence Packet Repair Prompt/);
  assert.equal(json.run_provenance.endpoint, "/v1/evidence-packet/check");
});

test("direct REST POST /v1/evidence-packet/repair-prompt generates actionable markdown", async () => {
  const payload = {
    packet: {
      claims: [
        {
          claim_id: "c1",
          claim: "Unverified transaction volume",
          support_level: "unsupported",
          evidence_ids: ["e99"]
        }
      ],
      evidence: []
    }
  };

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/v1/evidence-packet/repair-prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.valid, true);
  assert.equal(json.packet_status, "not_decision_ready");
  assert.match(json.repair_prompt, /Unsafe \/ Unsupported Claims to Fix or Remove:/);
  assert.match(json.repair_prompt, /Claim c1/);
});

test("direct REST POST /v1/critical-minerals/due-diligence evaluates mineral offtake file", async () => {
  const payload = {
    project_name: "Balkhash Copper-Cobalt",
    commodity: "copper",
    origin_jurisdiction: "Kazakhstan",
    decision_question: "Is the due diligence file complete for off-take?",
    decision_stage: "pre_offtake_agreement",
    supplied_sources: [
      { source_type: "mining_concession_or_license_extract", title: "License #102" },
      { source_type: "certified_ore_assay_report", title: "Assay Report" }
    ]
  };

  const response = await handleRequest(
    new Request("https://agenda-intelligence-a2a.example.workers.dev/v1/critical-minerals/due-diligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.commodity, "copper");
  assert.equal(json.origin_jurisdiction, "Kazakhstan");
  assert.equal(json.traceability_status, "verified");
  assert.equal(json.human_review_required, true);
  assert.equal(json.operational_decision.decision, "request_evidence");
});

test("critical_minerals_due_diligence profile over A2A and MCP", async () => {
  const env = { AGENT_PROFILE: "critical_minerals_due_diligence" };
  const cardReq = new Request("https://critical-minerals-due-diligence-a2a.example.workers.dev/.well-known/agent-card.json");
  const card = agentCard(cardReq, env);
  assert.equal(card.x_agenda_intelligence.product_profile, "critical_minerals_due_diligence");

  const mcpDiscover = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: "d1", method: "server/discover", params: {} },
    cardReq,
    env
  );
  assert.deepEqual(mcpDiscover.result.capabilities, {
    tools: { listChanged: false },
    resources: { listChanged: false, subscribe: false },
    prompts: { listChanged: false }
  });

  const mcpTools = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: "t1", method: "tools/list", params: {} },
    cardReq,
    env
  );
  assert.equal(mcpTools.result.tools[0].name, "critical_minerals_due_diligence");

  const mcpCall = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: "c1",
      method: "tools/call",
      params: {
        name: "critical_minerals_due_diligence",
        arguments: {
          request: {
            project_name: "Korgantas Rare Earths",
            commodity: "rare_earth_elements",
            origin_jurisdiction: "Kazakhstan",
            decision_question: "Proceed to offtake?",
            decision_stage: "pre_offtake_agreement",
            supplied_sources: []
          }
        }
      }
    },
    cardReq,
    env
  );
  const respPayload = mcpCall.result.structuredContent.metadata?.response || mcpCall.result.structuredContent;
  assert.equal(respPayload.triage_recommendation, "insufficient_information");
});

test("dual-use technology deployment serves its own signed-card payload", async () => {
  const env = { AGENT_PROFILE: "dual_use_technology_export" };
  const cardRequest = new Request(
    "https://dual-use-technology-export-a2a.example.workers.dev/.well-known/agent-card.json"
  );

  const response = await handleRequest(cardRequest, env);

  assert.equal(response.status, 200);
  const card = await response.json();
  assert.equal(card.name, "Dual-Use Technology & Export Controls Gate");
  assert.equal(
    card.capabilities.extensions[0].params.x_agenda_intelligence.product_profile,
    "dual_use_technology_export"
  );
  assert.deepEqual(card.skills.map((skill) => skill.id), ["dual-use-technology-export-controls"]);
});

test("dual-use technology profile routes structured MCP requests to its declared contract", async () => {
  const env = { AGENT_PROFILE: "dual_use_technology_export" };
  const request = new Request("https://dual-use-technology-export-a2a.example.workers.dev/mcp");
  const response = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: "dual-use-1",
      method: "tools/call",
      params: {
        name: "dual_use_technology_export",
        arguments: {
          shipment: {
            hs_code: "854231",
            eccn: "3A001",
            description: "Example integrated circuits",
            origin: "DE",
            destination: "KZ",
            end_user_sector: "civilian"
          },
          dated_sources: [
            { id: "du-1", source_type: "classification_note", title: "Exporter note", date: "2026-08-01" }
          ],
          risk_question: "Is this file complete enough for export-control human review?"
        }
      }
    },
    request,
    env
  );

  assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent.profile, "dual_use_technology_export");
  assert.equal(response.result.structuredContent.export_risk_triage.status, "decision_ready");
  assert.equal(response.result.structuredContent.export_risk_triage.score, 100);
});

// The published request/response pair is what verify:public-agents sends to the
// live worker, so a drift between the two would be found in production or not
// at all: the profile has no other example, and the public-example validator
// skips the vertical fixture directories. Asserting the pair here means the
// example and the code move together.
test("the published dual-use example gets the answer its response fixture publishes", async () => {
  const exampleDir = new URL("../../../examples/dual-use-technology-export/contract/", import.meta.url);
  const request = JSON.parse(readFileSync(new URL("decision_ready.request.json", exampleDir), "utf8"));
  const published = JSON.parse(readFileSync(new URL("decision_ready.response.json", exampleDir), "utf8"));

  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "dual-use-example",
      method: "SendMessage",
      params: {
        message: {
          messageId: "message-dual-use-example",
          role: "ROLE_USER",
          parts: [{ data: request }]
        }
      }
    },
    new Request("https://dual-use-technology-export-a2a.example.workers.dev/message/send", {
      method: "POST",
      headers: { "a2a-version": "1.0", "content-type": "application/json" }
    }),
    { AGENT_PROFILE: "dual_use_technology_export" }
  );

  const task = response.result.task;
  assert.equal(task.status.state, "TASK_STATE_COMPLETED");
  assert.equal(task.metadata.product_profile, "dual_use_technology_export");
  // Everything but contract_version, which moves with the release and says
  // nothing about whether this example still gets this answer.
  assert.deepEqual(task.metadata.response.export_risk_triage, published.export_risk_triage);
  assert.equal(task.metadata.response.profile, published.profile);
});

test("remote MCP HTTP transport handles resources and prompts", async () => {
  const req = new Request("https://agenda-intelligence-a2a.example.workers.dev/mcp");

  // resources/list
  const resList = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: "r1", method: "resources/list", params: {} },
    req
  );
  assert.ok(Array.isArray(resList.result.resources));
  assert.ok(resList.result.resources.some((r) => r.uri === "agenda://manifest"));
  assert.ok(resList.result.resources.some((r) => r.uri === "agenda://protocol/core"));

  // resources/read
  const resRead = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: "r2", method: "resources/read", params: { uri: "agenda://manifest" } },
    req
  );
  assert.equal(resRead.result.contents[0].mimeType, "application/json");
  const manifestData = JSON.parse(resRead.result.contents[0].text);
  assert.equal(manifestData.product, "Agenda Intelligence MD");

  // prompts/list
  const pList = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: "p1", method: "prompts/list", params: {} },
    req
  );
  assert.ok(Array.isArray(pList.result.prompts));
  assert.ok(pList.result.prompts.some((p) => p.name === "draft_evidence_memo"));

  // prompts/get
  const pGet = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: "p2",
      method: "prompts/get",
      params: { name: "draft_evidence_memo", arguments: { topic: "Critical Minerals Supply" } }
    },
    req
  );
  assert.match(pGet.result.messages[0].content.text, /Critical Minerals Supply/);
});

// A gate that names a canonical_http_endpoint is making a promise to any caller
// that reads its metadata or its rejection guidance. These tests hold the fleet
// to it: the endpoint is routed, the example it hands out is one it accepts, and
// the spec it publishes lists it.
function directV1Example(route) {
  return (route.guide || GATE_REQUEST_GUIDES[route.guideProfile]).example;
}

for (const [endpoint, route] of Object.entries(DIRECT_V1_ROUTES)) {
  test(`canonical endpoint ${endpoint} accepts the example it advertises`, async () => {
    const response = await handleRequest(
      new Request(`https://agenda-intelligence-a2a.example.workers.dev${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(directV1Example(route))
      }),
      { AGENT_CARD_SIGNING_KEY: "" }
    );

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(typeof json, "object");
    assert.ok(json !== null && !Array.isArray(json));
    assert.ok(Object.keys(json).length > 0);
  });

  test(`canonical endpoint ${endpoint} rejects an empty body with usable guidance`, async () => {
    const response = await handleRequest(
      new Request(`https://agenda-intelligence-a2a.example.workers.dev${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      })
    );

    assert.equal(response.status, 400);
    const json = await response.json();
    assert.equal(json.ok, false);
    assert.equal(json.valid, false);
    assert.ok(Array.isArray(json.errors) && json.errors.length > 0);
    assert.equal(json.canonical_http_endpoint, endpoint);
    assert.equal(json.schema, route.schema);
    assert.ok(Array.isArray(json.required_fields) && json.required_fields.length > 0);
    // The example handed back has to be the one this endpoint accepts, or the
    // guidance sends the caller straight into a second rejection.
    assert.deepEqual(json.example_request, directV1Example(route));
  });

  test(`canonical endpoint ${endpoint} is documented in the OpenAPI spec`, () => {
    const spec = openApiDocument(
      new Request("https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json")
    );
    const path = spec.paths[endpoint];
    assert.ok(path, `${endpoint} is served but missing from the spec`);
    assert.ok(path.post, `${endpoint} is a POST route but the spec does not describe post`);
    assert.equal(path.post.responses[200].description, "Gate triage response.");
  });
}

test("every /v1 endpoint the source advertises is actually routed", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const advertised = new Set(
    [...source.matchAll(/canonical_http_endpoint: "(\/v1\/[^"]+)"/gu)].map((match) => match[1])
  );
  assert.ok(advertised.size > 0, "expected the source to advertise canonical /v1 endpoints");
  for (const endpoint of advertised) {
    assert.ok(
      Object.hasOwn(DIRECT_V1_ROUTES, endpoint),
      `${endpoint} is advertised as a canonical endpoint but no route serves it`
    );
  }
});

// A request guide is a promise made to a caller who has already been refused
// once: send this, and it works. It has to be true on both transports. The
// Worker only ever checked its own — its enum validators walk a few fields, not
// the published schema — so an example could drift away from the schema its own
// guidance names and nothing here noticed. Measured 2026-09-04, three had:
// agent_output_verification carried { evidence_id, title, date } evidence
// against an evidence_item that is additionalProperties: false and requires
// source_type; gulf_maritime_exposure nested vessel and cargo inside a voyage
// that forbids them; critical_minerals_due_diligence put an id on
// supplied_sources, which has no id property. All three were accepted here and
// rejected by services.audit_claims and the HTTP API behind it — the same
// request, two answers, depending on which door the caller used. This is the
// same bug PRE_ACTION_CHECK_GUIDE carried until 2026-09-02.
//
// So every guide now names its schema, and this test reads that schema off disk
// and validates the example against it. A new gate cannot ship a guide without
// one, and an example cannot drift from the contract it advertises.

// The worker package has no dependencies and runs on plain `node --test`, so
// there is no ajv to reach for. This covers the keyword subset these v1 request
// schemas actually use; UNSUPPORTED_SCHEMA_KEYWORDS below fails the test rather
// than silently passing if one of them starts using something else.
const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  "$ref", "$defs", "type", "enum", "const", "required", "properties", "additionalProperties",
  "items", "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum",
  // Annotations and metadata: no effect on validity.
  "$schema", "$id", "title", "description", "default", "examples", "format", "x-schema-version"
]);

function resolveSchemaRef(ref, root) {
  assert.ok(ref.startsWith("#/"), `only local $ref is supported, got ${ref}`);
  let node = root;
  for (const segment of ref.slice(2).split("/")) {
    node = node[segment.replace(/~1/gu, "/").replace(/~0/gu, "~")];
    assert.ok(node, `unresolvable $ref ${ref}`);
  }
  return node;
}

function jsonSchemaErrors(value, schema, root, path = "") {
  if (schema.$ref) return jsonSchemaErrors(value, resolveSchemaRef(schema.$ref, root), root, path);

  const errors = [];
  const at = path || "(root)";
  const typeOf = (v) =>
    v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = allowed.some((t) => t === actual || (t === "number" && actual === "integer"));
    if (!ok) {
      errors.push(`${at}: expected ${allowed.join(" or ")}, got ${actual}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.some((option) => option === value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (Object.hasOwn(schema, "const") && schema.const !== value) {
    errors.push(`${at}: expected ${JSON.stringify(schema.const)}`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${at}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${at}: longer than maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${at}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${at}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${at}: has ${value.length} items, minItems is ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${at}: has ${value.length} items, maxItems is ${schema.maxItems}`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...jsonSchemaErrors(item, schema.items, root, `${path}/${index}`));
      });
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${at}: '${key}' is required`);
    }
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        errors.push(...jsonSchemaErrors(child, properties[key], root, `${path}/${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${at}: '${key}' is not a permitted property`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(...jsonSchemaErrors(child, schema.additionalProperties, root, `${path}/${key}`));
      }
    }
  }

  return errors;
}

// Only descends into the positions the validator above actually reads, so a
// constraint added anywhere it would have ignored shows up as an unsupported
// keyword instead of quietly passing.
function unsupportedSchemaKeywords(schema, found = new Set()) {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return found;
  for (const [keyword, child] of Object.entries(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(keyword)) found.add(keyword);
    if (keyword === "properties" || keyword === "$defs") {
      for (const subschema of Object.values(child)) unsupportedSchemaKeywords(subschema, found);
    } else if (keyword === "items" || keyword === "additionalProperties") {
      unsupportedSchemaKeywords(child, found);
    }
  }
  return found;
}

function loadV1Schema(ref) {
  assert.match(ref, /^schemas\/v1\/[a-z0-9-]+\.schema\.json$/u, `${ref} is not a schemas/v1 path`);
  return JSON.parse(readFileSync(new URL(`../../../${ref}`, import.meta.url), "utf8"));
}

const REQUEST_GUIDES = [
  ...Object.entries(GATE_REQUEST_GUIDES),
  ["pre_action_check", PRE_ACTION_CHECK_GUIDE]
];

for (const [name, guide] of REQUEST_GUIDES) {
  test(`request guide ${name} names the schema it is validated against`, () => {
    assert.equal(
      typeof guide.schema,
      "string",
      `${name} publishes an example but names no schema, so nothing can check it`
    );
    assert.ok(loadV1Schema(guide.schema), `${name} names ${guide.schema}, which does not exist`);
  });

  test(`request guide ${name} publishes an example its own schema accepts`, () => {
    const schema = loadV1Schema(guide.schema);
    const unsupported = unsupportedSchemaKeywords(schema);
    assert.deepEqual(
      [...unsupported],
      [],
      `${guide.schema} uses schema keywords this test does not implement: ${[...unsupported].join(", ")}`
    );

    const errors = jsonSchemaErrors(guide.example, schema, schema);
    assert.deepEqual(
      errors,
      [],
      `${name} hands callers a request that ${guide.schema} rejects:\n  ${errors.join("\n  ")}`
    );
  });
}

// The guide's schema and the schema the endpoint quotes back in its rejection
// are two independent strings pointing at one contract. If they disagree, the
// caller is told to read one file and handed an example built for another.
for (const [endpoint, route] of Object.entries(DIRECT_V1_ROUTES)) {
  test(`canonical endpoint ${endpoint} quotes the schema its guide names`, () => {
    const guide = route.guide || GATE_REQUEST_GUIDES[route.guideProfile];
    assert.ok(guide, `${endpoint} has no request guide`);
    assert.equal(route.schema, guide.schema);
  });
}

// The validator has to be able to fail, or the assertions above prove nothing.
test("the guide schema validator rejects the drift it is there to catch", () => {
  const schema = loadV1Schema("schemas/v1/evidence-audit.schema.json");
  const drifted = {
    claims: [{ claim_id: "c1", claim: "Example claim.", support_level: "direct", evidence_ids: ["e1"] }],
    // The shape agent_output_verification published until 2026-09-04.
    evidence: [{ evidence_id: "e1", title: "OFAC SDN extract", date: "2026-08-01" }]
  };
  const errors = jsonSchemaErrors(drifted, schema, schema);
  assert.ok(errors.some((error) => error.includes("'source_type' is required")));
  assert.ok(errors.some((error) => error.includes("'title' is not a permitted property")));
  assert.deepEqual(jsonSchemaErrors({ claims: [], evidence: [] }, schema, schema).filter(
    (error) => error.includes("minItems")
  ).length, 1);
});

test("a malformed but request-shaped body gets field-level errors, not just the schema", async () => {
  const response = await handleRequest(
    new Request(
      "https://critical-minerals-due-diligence-a2a.example.workers.dev/v1/critical-minerals/due-diligence",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_name: "Balkhash", commodity: "copper" })
      }
    )
  );

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.ok(json.errors.includes("origin_jurisdiction is required"));
  assert.ok(json.errors.includes("decision_question is required"));
});

test("the pre-action check endpoint returns the same decision the capability returns", async () => {
  const example = directV1Example(DIRECT_V1_ROUTES["/v1/agent-output/pre-action-check"]);
  const env = { AGENT_PROFILE: "agent_output_verification" };

  const rest = await handleRequest(
    new Request(
      "https://agent-output-verification-a2a.example.workers.dev/v1/agent-output/pre-action-check",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(example)
      }
    ),
    env
  );
  assert.equal(rest.status, 200);
  const restJson = await rest.json();

  const capability = await handleRequest(
    new Request("https://agent-output-verification-a2a.example.workers.dev/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "decision_check", arguments: example }
      })
    }),
    env
  );
  const capabilityJson = await capability.json();
  const viaCapability = capabilityJson.result.structuredContent;

  assert.equal(restJson.run_id, example.run_id);
  assert.equal(restJson.decision, viaCapability.decision);
  assert.equal(restJson.reason_code, viaCapability.reason_code);
  assert.equal(restJson.policy_version, viaCapability.policy_version);
  // No signing key is configured here, so the receipt must be reported as
  // unavailable rather than silently omitted.
  assert.equal(restJson.receipt_status, "unavailable");
  assert.equal(restJson.receipt, null);
});

// A relayed verdict carried the same weight whether or not anything had checked
// it, because nothing in the response said. Verification and the trust gate are
// deployments beside these gates, not a step between them and the caller, and
// most callers do not route through one.
test("every gate says whether its output was verified, and nine say it was not", async () => {
  const hosts = [
    ["cis-secondary-sanctions-a2a.example.workers.dev", "cis_secondary_sanctions", "not_performed"],
    ["middle-corridor-deal-risk-gate-a2a.example.workers.dev", "kazakhstan", "not_performed"],
    ["gulf-maritime-exposure-a2a.example.workers.dev", "gulf_maritime_exposure", "not_performed"],
    ["agenda-intelligence-a2a.example.workers.dev", "agenda", "not_performed"],
    // The verifier's own deployment: there the check and the answer are one call.
    ["agent-output-verification-a2a.example.workers.dev", "agent_output_verification", "self"]
  ];

  for (const [host, profile, expected] of hosts) {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: `verification-${profile}`,
        method: "SendMessage",
        params: {
          message: {
            messageId: `message-verification-${profile}`,
            role: "ROLE_USER",
            parts: [{ text: "Corridor and counterparty exposure question with dated sources." }]
          }
        }
      },
      new Request(`https://${host}/message/send`, {
        method: "POST",
        headers: { "a2a-version": "1.0", "content-type": "application/json" }
      }),
      { AGENT_PROFILE: profile }
    );

    const verification = response.result.task.metadata.verification;
    assert.ok(verification, `${host} said nothing about verification`);
    assert.equal(verification.status, expected, `${host} reported the wrong verification status`);
    assert.equal(verification.performed_by, expected === "self" ? profile : null);

    // The pointer must name a deployment that exists, or it sends the caller
    // nowhere. Both URLs are the verifier's, never the responding gate's.
    assert.match(verification.verifier.agent_card, /^https:\/\/agent-output-verification-a2a\./);
    assert.match(verification.verifier.mcp_endpoint, /\/mcp$/);
    assert.equal(verification.self_reported, true, "a self-reported status must say so");
    assert.match(verification.before_state_change, /performs no action/);
  }
});

// The claim this block makes about itself: it reports, it does not check. A
// status that could read as "checked and passed" would be worse than silence.
test("the verification block never claims an outcome it did not observe", () => {
  for (const profile of ["agenda", "cis_secondary_sanctions", "agent_output_verification"]) {
    const status = verificationStatus(profile);
    assert.ok(["self", "not_performed"].includes(status.status));
    assert.equal(status.self_reported, true);
    assert.ok(!("passed" in status) && !("verified" in status), "no field may read as a verdict");
  }
});

function memoryKv() {
  const store = new Map();
  return {
    store,
    put: async (key, value) => {
      store.set(key, value);
    },
    get: async (key) => store.get(key) ?? null,
    list: async ({ prefix }) => ({
      keys: [...store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true
    })
  };
}

async function sendTwice(env, ctx, text) {
  for (const _ of [0, 1]) {
    await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "journal",
        method: "SendMessage",
        params: {
          // A new message id per call, as a real caller sends: the hash must
          // not move because of it.
          message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ text }] }
        }
      },
      new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/message/send", {
        method: "POST",
        headers: { "a2a-version": "1.0", "content-type": "application/json" }
      }),
      env,
      ctx
    );
  }
}

// The counters cannot answer "what did this gate decide about this file last
// week": they keep no input and no verdict, and the detailed funnel events live
// in Workers Logs, which retains 72 hours on the free plan.
test("the journal records the verdict and a hash of the input, never the input", async () => {
  const kv = memoryKv();
  const pending = [];
  const env = { AGENDA_USAGE: kv, STATS_TOKEN: "test-token" };
  const ctx = { waitUntil: (promise) => pending.push(promise) };
  const secret = "Kyrgyz Trans Logistics LLP, Almaty to Bishkek, dual-use cargo";

  await sendTwice(env, ctx, `Counterparty exposure for ${secret} with dated sources.`);
  await Promise.all(pending);

  const response = await handleRequest(
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/decisions", {
      headers: { "x-stats-token": "test-token" }
    }),
    env,
    ctx
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.count, 2);

  // Nothing the caller sent may be recoverable from the store. These payloads
  // carry counterparty names, routes and cargo; keeping them would be a
  // different product with a different privacy posture.
  const stored = [...kv.store.values()].join("\n");
  assert.ok(!stored.includes("Kyrgyz Trans Logistics"), "the journal stored caller text");
  assert.ok(!stored.includes("Bishkek"), "the journal stored caller text");

  const [first, second] = body.records;
  assert.match(first.input_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.input_hash, second.input_hash, "the same input must hash the same across runs");
  assert.equal(first.agent_profile, "cis_secondary_sanctions");
  assert.equal(first.contract_version, VERSION);
  assert.ok(typeof first.decision === "string" && first.decision.length > 0);

  // Two runs of one file: reported as a pair, and reported as unchanged rather
  // than omitted — asked again and got the same answer is also an answer.
  assert.equal(body.runs.length, 1);
  assert.equal(body.runs[0].runs, 2);
  assert.equal(body.runs[0].changed, false);
});

test("the journal is private and the date is validated", async () => {
  const env = { AGENDA_USAGE: memoryKv(), STATS_TOKEN: "test-token" };
  const unauthorized = await handleRequest(
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/decisions"),
    env,
    {}
  );
  assert.equal(unauthorized.status, 401);

  const badDate = await handleRequest(
    new Request("https://cis-secondary-sanctions-a2a.example.workers.dev/decisions?date=yesterday", {
      headers: { "x-stats-token": "test-token" }
    }),
    env,
    {}
  );
  assert.equal(badDate.status, 400);
});

// The diff is the point: same input, different verdict.
test("a changed verdict on an unchanged input is reported as changed", () => {
  const runs = decisionRuns([
    { input_hash: "sha256:a", timestamp: "2026-08-27T09:00:00.000Z", decision: "escalate", status: "escalate", score: 40, contract_version: "1.7.1" },
    { input_hash: "sha256:a", timestamp: "2026-08-28T09:00:00.000Z", decision: "proceed", status: "proceed", score: 80, contract_version: "1.7.1" },
    { input_hash: "sha256:b", timestamp: "2026-08-28T09:05:00.000Z", decision: "proceed", status: "proceed", score: 80, contract_version: "1.7.1" },
    { input_hash: "sha256:b", timestamp: "2026-08-28T09:06:00.000Z", decision: "proceed", status: "proceed", score: 80, contract_version: "1.7.1" }
  ]);

  assert.equal(runs.length, 2, "a single run is not a pair and is not reported");
  assert.equal(runs[0].input_hash, "sha256:a", "changed pairs sort first");
  assert.equal(runs[0].changed, true);
  assert.equal(runs[1].changed, false);
  assert.deepEqual(
    runs[0].verdicts.map((verdict) => verdict.decision),
    ["escalate", "proceed"],
    "verdicts must read oldest first"
  );

  // A version bump is a different fact from a changed answer on one contract,
  // so the contract version is part of what counts as a change.
  const acrossVersions = decisionRuns([
    { input_hash: "sha256:c", timestamp: "2026-08-27T09:00:00.000Z", decision: "proceed", status: "proceed", score: 80, contract_version: "1.7.0" },
    { input_hash: "sha256:c", timestamp: "2026-08-28T09:00:00.000Z", decision: "proceed", status: "proceed", score: 80, contract_version: "1.7.1" }
  ]);
  assert.equal(acrossVersions[0].changed, true);
});

// Message and task identifiers are new on every call. Including them would give
// each run a fresh hash, which is the one thing this must not do.
test("the input hash ignores what changes on every call", () => {
  const first = canonicalDecisionInput({
    message: { messageId: "one", taskId: "t1", role: "ROLE_USER", parts: [{ text: "same file" }] }
  });
  const second = canonicalDecisionInput({
    message: { messageId: "two", taskId: "t2", role: "ROLE_USER", parts: [{ text: "same file" }] }
  });
  assert.deepEqual(first, second);

  const other = canonicalDecisionInput({
    message: { messageId: "three", role: "ROLE_USER", parts: [{ text: "a different file" }] }
  });
  assert.notDeepEqual(first, other);
});
