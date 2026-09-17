# Awesome-MCP & Agent Directory Submission Draft

This document contains ready-to-submit entries for community catalogs, including `punkpepe/awesome-mcp-servers`, the official Model Context Protocol Directory, and Coinbase AgentKit community repositories.

---

## 1. Awesome-MCP-Servers Entry

**Category**: `Finance & Risk Management` / `Security & Compliance`

```markdown
- [Agenda Intelligence MD](https://github.com/vassiliylakhonin/agenda-intelligence-md) - Autonomous pre-sign transaction firewall, OFAC/AML sanctions screening, and deterministic M2M escrow arbiter for AI agent economies. Deployed across 12 Cloudflare Edge nodes with sub-10ms latency, Vizier cryptographic gate receipts, and Base Mainnet smart contract settlement.
```

---

## 2. Model Context Protocol Server Entry (`server.json` Snippet)

```json
{
  "name": "agenda-intelligence-md",
  "description": "Agent transaction firewall (OFAC/AML screening, drainer defense, velocity caps) and autonomous B2B escrow arbiter for Base USDC.",
  "version": "1.10.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/vassiliylakhonin/agenda-intelligence-md"
  },
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

## 3. Coinbase AgentKit Community Extension PR Template

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

## 4. ElizaOS Community Plugin Registry Entry

```json
{
  "name": "@agenda-intelligence/plugin-guard",
  "description": "Deterministic transaction firewall and autonomous B2B escrow arbiter for ElizaOS agents on Base.",
  "repository": "https://github.com/vassiliylakhonin/agenda-intelligence-md/tree/main/integrations/elizaos",
  "tags": ["security", "compliance", "ofac", "escrow", "base", "usdc"]
}
```

---

## 5. Virtuals Protocol / Morpheus Worker Listing

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
