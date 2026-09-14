// Generated discovery documents for edge serving.
// llms.txt follows https://llmstxt.org / AnswerDotAI convention.
// agents.txt follows draft-car-agents-txt-wellknown convention.

export const AGENTS_TXT = `# agents.txt - Agent Discovery & Policy Declaration
# Ref: https://llmstxt.org / draft-car-agents-txt-wellknown

User-agent: *
Allow: /

# Discovery surfaces
LLMs-txt: /llms.txt
Agent-Card: /.well-known/agent-card.json
AI-Catalog: /.well-known/ai-catalog.json
ARD: /.well-known/ard.json
MCP-Server: /.well-known/mcp/server-card.json
OAuth-Protected-Resource: /.well-known/oauth-protected-resource
OpenAPI: /api/openapi.json
`;

export const GLAMA_JSON = {
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "maintainers": ["vassiliylakhonin"]
};

export const LLMS_TXT = `# Agenda Intelligence MD

> Deterministic evidence-packet linter, claim verification preflight, and specialized risk gates for AI agent actions.

## Discovery Surfaces
- [ARD (Agent Resource Discovery)](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/ard.json): Machine-readable resource catalog and endpoint registry.
- [AI Catalog](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/ai-catalog.json): Canonical AI catalog with machine-readable resource descriptors.
- [A2A Agent Card](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json): Agent-to-Agent discovery card and capabilities.
- [MCP Server Manifest](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/mcp/server-card.json): Model Context Protocol server manifest.
- [Glama MCP Verification](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/glama.json): Glama MCP ownership verification manifest.
- [OAuth Protected Resource Metadata (RFC 9728)](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/oauth-protected-resource): RFC 9728 OAuth 2.0 protected resource metadata and authorization server discovery.
- [OpenAPI 3.1 Contract](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/api/openapi.json): Complete OpenAPI 3.1 REST API specification.
- [API Catalog](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/api-catalog): RFC 6690 linkset discovery catalog.
- [Entity Map](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/entitymap.json): Machine-readable concept map and knowledge graph.

## Specialized Risk Gates
- [Middle Corridor Deal Risk Gate](https://middle-corridor-deal-risk-gate.vassiliy-lakhonin.workers.dev): Cross-border logistics, sanctions screening, and trade route risk assessment.
- [CIS Secondary Sanctions Exposure](https://cis-secondary-sanctions-exposure.vassiliy-lakhonin.workers.dev): Secondary-sanctions exposure triage for EU/UK/OFAC compliance.
- [Agentic Interaction Trust Gate](https://agentic-interaction-trust-gate.vassiliy-lakhonin.workers.dev): Pre-action trust evaluation for multi-agent autonomous interactions.
- [Gulf Maritime Exposure Gate](https://gulf-maritime-exposure-gate.vassiliy-lakhonin.workers.dev): Maritime sanctions, vessel tracking, and chokepoint transit risk triage.
- [Kazakhstan Market Entry Readiness](https://kazakhstan-market-entry-gate.vassiliy-lakhonin.workers.dev): Regulatory, compliance, and counterparty readiness for market entry.
- [Dual-Use Technology Export Gate](https://dual-use-technology-export-a2a.vassiliy-lakhonin.workers.dev): Export control classification, ECCN mapping, and dual-use tech screening.
- [Critical Minerals Due Diligence Gate](https://critical-minerals-due-diligence-a2a.vassiliy-lakhonin.workers.dev): Supply chain provenance, ESG risks, and strategic mineral compliance.
- [Agent Output Verification Gate](https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev): Deterministic evidence verification and claim linter for LLM outputs.
- [Pre-Action Check Gate](https://pre-action-check-a2a.vassiliy-lakhonin.workers.dev): Stateless policy boundary pre-flight checks before agent execution.
- [Strategic Risk Triage Hub](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev): Multi-domain risk routing and strategic evidence aggregation.

## Product MCP Tools
- [check_evidence_packet](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): primary deterministic preflight for claim/source packets; checks references, declared quotes, lexical support, unmatched numbers, and claims that negate the source sentence they cite.
- [analyze](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): accepts an AgendaRequest, routes geography to bundled regional references, assembles a system prompt from the Global Think Tank Analyst method, and returns a memo validated against schemas.
- [validate_memo](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): validates a third-party memo against agenda-memo.schema.json and returns errors plus a score where implemented.
- [check_memo_quality](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): checks schema validity plus post-hoc evidence-readiness quality guardrails for a third-party memo.
- [list_signals / get_signal](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): read access to the vendored Global Think Tank Analyst signal archive.
- [deep_dive](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): reserved stub; returns a v2 placeholder pointing callers at analyze with depth: scenario or red_team.
- [middle_corridor_deal_risk](https://middle-corridor-deal-risk-gate.vassiliy-lakhonin.workers.dev/mcp): Kazakhstan / Middle Corridor deal-risk gate; structured deal_risk_request in, triage recommendation + decision-readiness + evidence gaps out.
- [cis_secondary_sanctions_exposure](https://cis-secondary-sanctions-exposure.vassiliy-lakhonin.workers.dev/mcp): CIS counterparty secondary-sanctions exposure triage for EU/UK/UAE/Singapore EDD.
- [agentic_interaction_trust](https://agentic-interaction-trust-gate.vassiliy-lakhonin.workers.dev/mcp): trust-evidence triage for an agent-mediated interaction before a high-stakes action.
- [gulf_maritime_exposure](https://gulf-maritime-exposure-gate.vassiliy-lakhonin.workers.dev/mcp): maritime sanctions + chokepoint-disruption exposure triage for a vessel/voyage transiting Strait of Hormuz / Persian Gulf / Red Sea.
- [kazakhstan_market_entry_readiness](https://kazakhstan-market-entry-gate.vassiliy-lakhonin.workers.dev/mcp): Kazakhstan market-entry readiness gate for distribution / import / service / showroom / EPC files.
- [agent_output_verification](https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp): relay-readiness triage of another agent's claim-backed output.
- [pre_action_check](https://pre-action-check-a2a.vassiliy-lakhonin.workers.dev/mcp): stateless action-boundary routing from caller-supplied claim evidence, risk, and policy checks.
- [fleet_directory](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): enumerates all 10 specialized risk gates with live URLs, canonical REST paths, and capabilities.

## Commercial Discovery Discipline & Project Room
- [Confidential Project Room](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/profiles/confidential-project-room): Alias-first, redacted workflow for high-assurance due diligence.
- [Redacted Example](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/profiles/confidential-project-room/redacted-example.json): Synthetic redacted example demonstrating clean separation of evidence IDs from confidential facts.
- Public profiles are crawlable, claim-addressable evidence packets: source IDs, buyer questions, project claims, missing evidence, owner actions, and readiness decisions.
- Success is buyer behavior: redacted file, second profile request, paid concierge review interest, budget-owner intro, or concrete workflow correction.

## Geography Routing Terms
- Central Asia / Caspian (CA_CASPIAN_TERMS): almaty, azerbaijan, baku, caspian, central asia, georgia, kazakhstan, kyrgyzstan, middle corridor, tajikistan, tashkent, tcita, tcitr, turkmenistan, uzbekistan.
- Gulf / Middle East (GULF_ME_TERMS): arabian gulf, bab el mandeb, bab-el-mandeb, bahrain, gcc, gulf, hormuz, iran, iraq, ksa, kuwait, levant, middle east, oman, persian gulf, qatar, red sea, saudi arabia, strait of hormuz, uae, united arab emirates, yemen.
- European Union (EU_TERMS): brussels, cbam, cjeu, ecb, eu ai act, eu enforcement, eu regulation, european central bank, european commission, european council, european parliament, european union, gdpr, nis2, schrems.
- Sanctions / Export Controls (SANCTIONS_TERMS): entity list, export control, export controls, ofac, sanctions, secondary sanctions.

## Operational Governance & Boundaries
- [GitHub Repository](https://github.com/vassiliylakhonin/Agenda-Intelligence-md): Source code, schemas, and verification test suite.
- Deterministic claim and source linter over caller-supplied evidence.
- No live factuality determination, no autonomous web retrieval without human-in-the-loop review.
- All edge deployments gated cryptographically with Vizier policy covenants.
`;
