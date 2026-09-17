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
OAuth-Authorization-Server: /.well-known/oauth-authorization-server
OpenID-Configuration: /.well-known/openid-configuration
OpenAPI: /api/openapi.json
Payment-Manifest: /.well-known/payment-manifest
X402: /.well-known/x402
Owners: /.well-known/owners.json
Security: /.well-known/security.txt
AI-Plugin: /.well-known/ai-plugin.json
Agents-JSON: /.well-known/agents.json
Brick-Blue: /.well-known/brick-blue.json
`;

export const GLAMA_JSON = {
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "name": "agenda-intelligence",
  "description": "Institutional geopolitical risk, sanctions screening, OFAC 50% rule, and dual-use export control gates for AI agents.",
  "maintainers": ["vassiliylakhonin"],
  "homepage": "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/",
  "repository": "https://github.com/vassiliylakhonin/agenda-intelligence-md"
};

export const SECURITY_TXT = `Contact: mailto:vassiliy.lakhonin@gmail.com
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en, ru
Canonical: https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/security.txt
Policy: https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/SECURITY.md
Hiring: https://github.com/vassiliylakhonin
Acknowledgments: https://github.com/vassiliylakhonin/agenda-telemetry-vault
`;

export const OWNERS_JSON = {
  "$schema": "https://verifymcp.io/schemas/owners-v1.json",
  "version": "1.0",
  "owners": [
    {
      "name": "Vassiliy Lakhonin",
      "role": "Founder & Maintainer",
      "email": "vassiliy.lakhonin@gmail.com",
      "github": "vassiliylakhonin",
      "website": "https://github.com/vassiliylakhonin/agenda-intelligence-md"
    }
  ],
  "organization": {
    "name": "Agenda Intelligence",
    "github": "vassiliylakhonin",
    "repo": "https://github.com/vassiliylakhonin/agenda-intelligence-md",
    "telemetry_vault": "https://github.com/vassiliylakhonin/agenda-telemetry-vault"
  },
  "service": {
    "name": "Agenda Intelligence Compliance & Sanctions Gateway",
    "description": "Deterministic 5-factor compliance, sanctions screening, and Middle Corridor risk gating on Cloudflare Edge.",
    "security_contact": "vassiliy.lakhonin@gmail.com",
    "security_posture": {
      "zero_retention_guarantee": true,
      "payload_persistence": "ephemeral_ram_only",
      "dlp_strip": true
    }
  }
};

export const X402_JSON = {
  "x402_version": "1.0",
  "title": "Agenda Intelligence Compliance & Sanctions Gateway",
  "description": "Deterministic 5-factor sanctions compliance, OFAC 50% Rule, and dual-use screening on Edge.",
  "currency": "USD",
  "pricing_models": {
    "tier_1_sandbox": {
      "id": "tier-1-sandbox",
      "name": "Community Sandbox",
      "price": 0.0,
      "billing_scheme": "per_day",
      "rate_limit": "100 queries/day",
      "auth_required": false,
      "terms": "Free community sandbox."
    },
    "tier_2_pro": {
      "id": "tier-2-pro",
      "name": "Dedicated Pro Tenant",
      "price": 490.0,
      "billing_scheme": "monthly",
      "quota": "10,000 queries/month",
      "auth_required": true,
      "auth_type": "Bearer",
      "sla": "99.9%"
    },
    "tier_micro_check": {
      "id": "tier-micro-check",
      "name": "Agent Financial Pre-Sign Check",
      "price": 0.05,
      "billing_scheme": "per_call",
      "auth_required": false,
      "settlement_header": "X-Payment-Tx",
      "terms": "Single deterministic pre-sign transaction security validation."
    },
    "tier_micro_dispute": {
      "id": "tier-micro-dispute",
      "name": "M2M Escrow Dispute Evaluation",
      "price": 0.50,
      "billing_scheme": "per_call",
      "auth_required": false,
      "settlement_header": "X-Payment-Tx",
      "terms": "Deterministic B2B dispute ruling and cryptographic clearance receipt."
    },
    "tier_3_deal_dossier": {
      "id": "tier-3-dossier",
      "name": "Confidential Deal Dossier",
      "standard_price": 99.0,
      "pilot_price": 49.0,
      "billing_scheme": "per_deal",
      "turnaround_sla_hours": 24,
      "deliverables": [
        "5-factor audit (OFAC 50%, UBO, CHPL dual-use HS Tier 1-4, AIS vessel, Evidence Gaps)",
        "Cryptographic Vizier JWS receipt for compliance banks"
      ]
    }
  },
  "payment_rails": [
    {
      "method": "paypal",
      "name": "PayPal & Credit/Debit Card",
      "checkout_url": "https://paypal.me/vaskenzy/49USD",
      "contact": "vassiliy.lakhonin@gmail.com"
    },
    {
      "method": "direct_invoice",
      "supported_currencies": ["USD", "EUR", "KZT"],
      "contact": "vassiliy.lakhonin@gmail.com"
    },
    {
      "method": "usdc_on_base",
      "name": "USDC on Base (Agentic Settlement)",
      "chain": "base",
      "chain_id": 8453,
      "asset": "USDC",
      "recipient_address": "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
      "settlement_endpoint": "/v1/settle",
      "settlement_header": "X-Payment-Tx",
      "supported": true,
      "contact": "vassiliy.lakhonin@gmail.com"
    }
  ],
  "settlement_endpoint": "/v1/settle",
  "contact": "vassiliy.lakhonin@gmail.com"
};

export const PAYMENT_MANIFEST_JSON = {
  "version": "1.0",
  "protocol": "mpp/1.0",
  "provider": {
    "name": "Agenda Intelligence",
    "operator": "Vassiliy Lakhonin",
    "contact": "vassiliy.lakhonin@gmail.com",
    "repo": "https://github.com/vassiliylakhonin/agenda-intelligence-md"
  },
  "monetization": {
    "model": "tiered_subscription_and_audit",
    "receiving_wallet": "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
    "settlement_endpoint": "/v1/settle",
    "payment_rails": [
      {
        "method": "usdc_on_base",
        "chain": "base",
        "chain_id": 8453,
        "asset": "USDC",
        "recipient_address": "0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
        "settlement_endpoint": "/v1/settle",
        "settlement_header": "X-Payment-Tx"
      },
      {
        "method": "paypal",
        "checkout_url": "https://paypal.me/vaskenzy/49USD"
      }
    ],
    "tiers": [
      {
        "id": "tier-1-sandbox",
        "name": "Community Sandbox",
        "amount": 0,
        "currency": "USD",
        "cadence": "daily",
        "included_calls": 100,
        "auth": "none"
      },
      {
        "id": "tier-2-pro",
        "name": "Dedicated Pro Tenant",
        "amount": 490,
        "currency": "USD",
        "cadence": "monthly",
        "included_calls": 10000,
        "auth": "bearer_token",
        "sla": "99.9%"
      },
      {
        "id": "tier-3-dossier",
        "name": "Confidential Deal Dossier",
        "amount": 99,
        "introductory_amount": 49,
        "currency": "USD",
        "cadence": "per_deal",
        "turnaround_hours": 24,
        "includes_jws_receipt": true
      }
    ]
  },
  "endpoints": {
    "mcp": "/mcp",
    "intake": "/profiles/confidential-project-room",
    "status": "/status",
    "sample_dossier": "/sample-dossier",
    "settle": "/v1/settle"
  }
};

export const MPP_JSON = PAYMENT_MANIFEST_JSON;

export const LLMS_TXT = `# Agenda Intelligence MD

> Deterministic evidence-packet linter, claim verification preflight, and specialized risk gates for AI agent actions.

## Discovery Surfaces
- [Sample Redacted Deal Dossier](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/sample-dossier): Real-world 5-factor forensic sanctions and deal-risk audit report with Vizier JWS receipt.
- [ARD (Agent Resource Discovery)](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/ard.json): Machine-readable resource catalog and endpoint registry.
- [AI Catalog](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/ai-catalog.json): Canonical AI catalog with machine-readable resource descriptors.
- [A2A Agent Card](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json): Agent-to-Agent discovery card and capabilities.
- [MCP Server Manifest](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/mcp/server-card.json): Model Context Protocol server manifest.
- [Glama MCP Verification](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/glama.json): Glama MCP ownership verification manifest.
- [OAuth Protected Resource Metadata (RFC 9728)](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/oauth-protected-resource): RFC 9728 OAuth 2.0 protected resource metadata and authorization server discovery.
- [OpenAPI 3.1 Contract](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/api/openapi.json): Complete OpenAPI 3.1 REST API specification.
- [API Catalog](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/api-catalog): RFC 6690 linkset discovery catalog.
- [Entity Map](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/entitymap.json): Machine-readable concept map and knowledge graph.
- [M2M Crypto Settlement](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/v1/settle): Programmatic Base USDC verification and Pro Bearer key provisioning.

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
- [Agent Financial Guard Gate](https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev): Pre-sign transaction firewall, OFAC/AML sanctions screening, drainer defense, and prompt injection prevention.
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
- [agent_financial_pre_sign_check](https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/mcp): deterministic pre-sign financial transaction firewall for autonomous agents with wallet keys.
- [fleet_directory](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp): enumerates all 11 specialized risk gates with live URLs, canonical REST paths, and capabilities.

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
