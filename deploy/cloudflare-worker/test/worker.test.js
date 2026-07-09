import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  aiCatalog,
  apiCatalog,
  agentCard,
  buildUsageEvent,
  checkRateLimit,
  dealRiskContractResponseForRequest,
  didDocument,
  entityMap,
  handleJsonRpc,
  handleRequest,
  healthInfo,
  isProductionAuthorized,
  isStatsAuthorized,
  landingHtml,
  mcpServerCard,
  okfMarkdown,
  openApiDocument,
  profileContent,
  productionAuthKey,
  rateLimitPerHour,
  recordUsageStats,
  robotsTxt,
  routeModules,
  signalScreenForText,
  statusInfo,
  triageForText,
  usageStats
} from "../src/index.js";
import { PROBE_PROMPT_CHAR_THRESHOLD } from "../src/usage_constants.js";
import { PROFILE_REGISTRY, profileDiscovery } from "../src/profiles.js";
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
  globalThis.fetch = async (url) => {
    calls.push(new URL(url));
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

test("Snapshot adapter degrades to disabled when SNAPSHOT_INDEX_URL is unset", async () => {
  resetSnapshotCache();
  const result = await matchCounterpartyAgainstSnapshot({}, { name: "Gazprom" });
  assert.equal(result.status, "disabled");
  assert.deepEqual(result.matches, []);
});

test("agent card uses request origin for live endpoints", () => {
  const card = agentCard(request);

  assert.equal(card.protocolVersion, "1.0");
  assert.equal(card.version, "1.1.0");
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
  assert.equal(catalog.version, "1.1.0");
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

test("API catalog and OpenAPI routes advertise the public worker HTTP contract", async () => {
  const catalog = apiCatalog(request);
  const openapi = openApiDocument(request);

  assert.equal(
    catalog.linkset[0]["service-desc"][0].href,
    "https://agenda-intelligence-a2a.example.workers.dev/api/openapi.json"
  );
  assert.equal(openapi.openapi, "3.0.3");
  assert.equal(openapi.info.version, "1.1.0");
  assert.ok(openapi.paths["/message/send"].post);
  assert.ok(openapi.paths["/.well-known/ai-catalog.json"].get);
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
  assert.ok(map.entities.some((entity) => entity.slug === "human-review-packet"));
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
  assert.ok(entityBody.entities.some((entity) => entity.slug === "claim-audit"));

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
  const billable = { status: "success", upstream: "OpenSanctions", billable: true, cost_eur: 0.1 };
  for (let i = 0; i < 6; i += 1) {
    await recordUsageStats({ AGENDA_USAGE: kv }, { ...base, timestamp: `2026-05-30T10:0${i}:00.000Z`, live_retrieval: billable });
  }
  await recordUsageStats(
    { AGENDA_USAGE: kv },
    { ...base, timestamp: "2026-05-30T10:07:00.000Z", live_retrieval: { status: "degraded", upstream: "OpenSanctions", billable: false, cost_eur: 0 } }
  );
  await recordUsageStats(
    { AGENDA_USAGE: kv },
    { ...base, timestamp: "2026-05-30T10:08:00.000Z", live_retrieval: { status: "disabled", upstream: null, billable: false, cost_eur: 0 } }
  );

  // No budget cap configured: cost reported, no alert.
  const noCap = await usageStats({ AGENDA_USAGE: kv }, "2026-05-30");
  assert.equal(noCap.counters.billable_calls, 6);
  assert.equal(noCap.cost.estimated_cost_eur, 0.6);
  assert.deepEqual(noCap.cost.billable_upstreams, [{ name: "OpenSanctions", count: 6 }]);
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
    assert.equal(response.result.status.state, "TASK_STATE_FAILED");
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
  assert.ok(
    card.x_agenda_intelligence.boundaries.includes("Human review is required before any commercial action.")
  );
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
    assert.match(result.artifacts[0].parts[0].text, /Corridor & Sanctions Risk Assistant/);
    assert.match(result.artifacts[0].parts[0].text, /vassiliy\.lakhonin@gmail\.com/);
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
    assert.equal(response.result.status.state, "TASK_STATE_FAILED");
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

test("kazakhstan card advertises productionBearer scheme but no requirement when key is unset", () => {
  const card = agentCard(new Request(KAZAKHSTAN_ORIGIN), { AGENT_PROFILE: "kazakhstan" });
  assert.ok(card.securitySchemes.optionalClientId, "optionalClientId remains defined");
  assert.equal(card.securitySchemes.productionBearer.httpAuthSecurityScheme.scheme, "bearer");
  assert.deepEqual(card.security, []);
  assert.deepEqual(card.securityRequirements, []);
});

test("kazakhstan card advertises productionBearer requirement when key is set", () => {
  const card = agentCard(new Request(KAZAKHSTAN_ORIGIN), {
    AGENT_PROFILE: "kazakhstan",
    MIDDLE_CORRIDOR_API_KEY: "secret"
  });
  assert.deepEqual(card.security, [{ productionBearer: [] }]);
  assert.deepEqual(card.securityRequirements, [{ schemes: ["productionBearer"] }]);
});

test("agenda card never advertises a production requirement even if the secret leaks into env", () => {
  const card = agentCard(request, { MIDDLE_CORRIDOR_API_KEY: "secret" });
  assert.deepEqual(card.security, []);
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

test("gulf message/send rejects a non-gulf request shape", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const response = await handleJsonRpc(
      { jsonrpc: "2.0", id: "g-2", method: "message/send", params: { capability: "gulf_maritime_exposure", request: { foo: "bar" } } },
      gulfRequest(),
      GULF_ENV
    );
    assert.equal(response.result.status.state, "TASK_STATE_FAILED");
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

test("market-entry message/send rejects a non-market-entry request shape", async () => {
  const response = await marketEntryResponseFor({ foo: "bar" });
  assert.equal(response.result.status.state, "TASK_STATE_FAILED");
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

test("agent-output-verification card exposes the verification skill", () => {
  const card = agentCard(agentOutputVerificationRequest, AGENT_OUTPUT_VERIFICATION_ENV);
  assert.equal(card.x_agenda_intelligence.product_profile, "agent_output_verification");
  assert.ok(card.skills.some((skill) => skill.id === "agent-output-verification"));
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

test("agent-output-verification rejects a non-audit request shape", async () => {
  const response = await agentOutputVerificationResponseFor({ not: "an audit" });
  assert.equal(response.result.status.state, "TASK_STATE_FAILED");
  assert.equal(response.result.metadata.valid, false);
});

test("agent-output-verification rejects a bad support_level enum", async () => {
  const audit = groundedAuditFixture();
  audit.claims[0].support_level = "definitely";
  const response = await agentOutputVerificationResponseFor(audit);
  assert.equal(response.result.status.state, "TASK_STATE_FAILED");
  assert.equal(response.result.metadata.valid, false);
});
