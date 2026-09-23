# Awesome-MCP & Agent Directory Submission Guide

This document contains ready-to-submit entries for community catalogs, including `punkpepe/awesome-mcp-servers`, the official Model Context Protocol Directory (`modelcontextprotocol/servers`), Smithery.ai, Glama.ai, and Coinbase AgentKit community repositories.

---

## 1. Awesome-MCP-Servers Entry (`punkpeye/awesome-mcp-servers`)

**PR Target**: [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)  
**Target File**: `README.md`  
**Category**: `Finance & FinTech` or `Security & Compliance`  

```markdown
- [Agenda Intelligence MD](https://github.com/vassiliylakhonin/agenda-intelligence-md) - Autonomous pre-sign transaction firewall, OFAC/AML sanctions screening, and deterministic M2M escrow arbiter for AI agent economies. Deployed across 12 Cloudflare Edge nodes with sub-10ms latency, Vizier cryptographic gate receipts, x402 Base USDC micropayments, and on-chain Base settlement.
```

---

## 2. Model Context Protocol Server Entry (`server.json` Snippet)

**Target Repository**: [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

```json
{
  "name": "agenda-intelligence-md",
  "displayName": "Agenda Intelligence — Sanctions & Deal-Risk Gates",
  "description": "Agent transaction firewall (OFAC/AML screening, drainer defense, velocity caps) and autonomous B2B escrow arbiter for Base USDC.",
  "version": "1.12.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/vassiliylakhonin/agenda-intelligence-md"
  },
  "homepage": "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/",
  "endpoints": {
    "mcp_stream": "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/mcp",
    "financial_guard": "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/mcp",
    "m2m_escrow_arbiter": "https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/mcp"
  },
  "tools": [
    "agent_financial_pre_sign_check",
    "m2m_escrow_arbitration_ruling",
    "strategic_risk_triage",
    "fleet_directory"
  ]
}
```

---

## 3. Smithery.ai & Glama.ai Automated Listings

Both platforms auto-index from repository root manifests:
* **Smithery**: Configured in `smithery.yaml` (stdio via `uvx agenda-intelligence-md`).
* **Glama**: Configured in `/.well-known/glama.json` (hosted edge endpoints with maintainer attestation).

### Direct Claude Desktop Configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "command": "uvx",
      "args": ["agenda-intelligence-md"]
    }
  }
}
```

---

## 4. ElizaOS Community Plugin Registry Entry

**NPM Package**: [`@agenda-intelligence/plugin-guard`](https://www.npmjs.com/package/@agenda-intelligence/plugin-guard) (v1.12.0)  
**PR Target**: [elizaos/plugins](https://github.com/elizaos-plugins) / [awesome-eliza](https://github.com/elizaos/awesome-eliza)

```json
{
  "name": "@agenda-intelligence/plugin-guard",
  "description": "Deterministic transaction firewall and autonomous B2B escrow arbiter for ElizaOS agents on Base.",
  "npm": "https://www.npmjs.com/package/@agenda-intelligence/plugin-guard",
  "repository": "https://github.com/vassiliylakhonin/agenda-intelligence-md/tree/main/integrations/elizaos",
  "tags": ["security", "compliance", "ofac", "escrow", "base", "usdc", "x402"]
}
```

---

## 5. Coinbase AgentKit Community Extension PR Template

**PR Title**: `feat(community-action-provider): add Agenda Financial Guard pre-sign transaction firewall`

**Description**:
> Adds `AgendaFinancialGuardActionProvider`, an enterprise security middleware for Coinbase AgentKit agents operating on Base Mainnet and Sepolia.
>
> ### Capabilities:
> - **OFAC SDN Blacklist Check**: Blocks transactions to designated addresses/mixers (Tornado Cash, Lazarus, Garantex).
> - **Drainer Defense**: Neutralizes infinite approval requests (`approve(max_uint256)`).
> - **Treasury Velocity Limits**: Enforces per-transaction caps ($100 default) and 24h rolling budget limits ($500 default).
> - **Prompt Injection Shield**: Identifies adversarial jailbreaks injected into transaction intent.
>
> Tested with `cdp-agentkit-core` on Base Sepolia and Base Mainnet.

---

## 6. Virtuals Protocol / Morpheus Worker Listing

```json
{
  "service_name": "agenda_security_guard",
  "description": "Pre-sign transaction security firewall and M2M escrow arbiter on Base.",
  "functions": [
    "check_transaction_safety",
    "arbitrate_escrow_dispute"
  ],
  "monetization": {
    "protocol": "x402",
    "price_per_call_usdc": 0.05,
    "network": "base"
  }
}
```
