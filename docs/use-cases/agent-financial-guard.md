# Agent Financial Guard & Autonomous Transaction Firewall

Status: shipped 2026-09-17. Vertical worker service function `agent_financial_guard`. Schema family v1, additive (non-breaking under [ADR 0003](../adr/0003-v1-compatibility-policy.md)).

## Proposition

Autonomous AI agents equipped with crypto wallets (Coinbase AgentKit, Stripe Agent Toolkit, Circle Programmable Wallets, Privy Server Wallets) are now conducting unassisted on-chain transactions, swaps, vendor settlements, and API resource purchases.

If an agent is compromised by prompt injection, misconfiguration, or malicious smart contracts, unauthorized fund drain or sanctions non-compliance can happen in seconds with irreversible blockchain finality.

**Agent Financial Guard** acts as an edge-evaluated pre-sign firewall. Before an agent broadcasts or signs any on-chain transaction or settlement, it submits the proposed transaction and intent to the gate.

The gate evaluates 4 deterministic security layers:
1. **OFAC SDN & Sanctions / AML Screening**: Screens destination addresses against global sanctions (OFAC, UN, EU) and high-risk mixer contracts (e.g., Tornado Cash, Lazarus, Garantex).
2. **Contract Security & Drainer Defense**: Identifies unconstrained approvals (`approve(max_uint256)`), suspicious calldata, and drainer transfer patterns.
3. **Velocity & Spending Limits**: Enforces single transaction ceilings (`max_single_limit_usd`) and 24-hour rolling velocity limits to prevent catastrophic treasury depletion.
4. **Adversarial Intent & Prompt Injection Defense**: Inspects the natural language reasoning prompt driving the agent's transaction for jailbreaks, prompt injection, and unauthorized exfiltration attempts.

## Interfaces

The gate is exposed across three standard protocols:

1. **Direct HTTP REST API**:
   - `POST https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check`
2. **Model Context Protocol (MCP)**:
   - Tool `agent_financial_pre_sign_check` via `https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/mcp`
3. **Google Agent-to-Agent (A2A)**:
   - `POST https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/message/send` (JSON-RPC 2.0 `SendMessage`)

## Request Example

```json
{
  "run_id": "tx-guard-9921",
  "transaction": {
    "network": "base_mainnet",
    "token": "USDC",
    "amount_usd": 25.0,
    "recipient": "0x5b5296a3a7bac0f5f096f93b60c1c121f2e5c663",
    "method": "transfer",
    "calldata": "0xa9059cbb..."
  },
  "intent": {
    "prompt": "Settling monthly LLM inference API bill for vendor 0x5b5296a...",
    "caller_task_id": "session-1082"
  },
  "policy_limits": {
    "max_single_limit_usd": 100.0,
    "daily_velocity_limit_usd": 500.0
  }
}
```

## Response Example

```json
{
  "contract_version": "1.0.0",
  "profile": "agent_financial_guard",
  "financial_guard_verdict": {
    "status": "decision_ready",
    "decision": "allow",
    "score": 10,
    "checks": {
      "sanctions_aml": true,
      "contract_security": true,
      "velocity_limits": true,
      "prompt_injection": true
    },
    "violations": [],
    "evidence_gaps": [],
    "vizier_status": "edge_evaluated",
    "vizier_clearance_receipt": null,
    "execution_advisory": "Transaction verified through deterministic security policies. Ready to sign."
  },
  "vizier_status": "edge_evaluated",
  "vizier_clearance_receipt": null,
  "execution_advisory": "Transaction verified through deterministic security policies. Ready to sign."
}
```

## Compliance & Security Guarantees

- **Zero-Retention**: No transaction payloads, private keys, or caller tokens are persisted to disk or cloud storage.
- **Deterministic Edge Execution**: Sub-5ms evaluation at Cloudflare's global edge without third-party network roundtrips.
- **Cryptographic Receipts**: Integration with the Vizier signing authority for auditable governance records.
