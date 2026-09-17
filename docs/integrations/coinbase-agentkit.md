# Coinbase AgentKit Integration Guide: Agenda Financial Guard & M2M Escrow Arbiter

This guide explains how to integrate **Agenda Financial Guard** and **M2M Escrow Arbiter** into autonomous AI agents powered by [Coinbase AgentKit](https://github.com/coinbase/agentkit) (`cdp-agentkit-core`).

---

## 1. Problem: The Agent Financial Vulnerability Vector

Autonomous on-chain agents interacting with decentralized protocols, liquidity pools, and peer agents face catastrophic financial risks:
1. **Sanctions & Compliance Violations**: Accidental or induced transactions to OFAC SDN blacklisted addresses (e.g. Tornado Cash, Lazarus Group).
2. **Smart Contract Drainers**: Malicious approval requests (`approve(max_uint256)`).
3. **Treasury Runaway Spend**: High-velocity spending loops draining wallets in minutes.
4. **Adversarial Prompt Injection**: Hackers steering the agent's LLM reasoning to divert treasury funds.

---

## 2. Solution: Deterministic Pre-Sign Firewall

`AgendaFinancialGuardActionProvider` provides a sub-10ms deterministic pre-sign firewall intercepting all transactions before they reach `wallet_provider.send_transaction`.

```
                    ┌───────────────────────────────┐
                    │    Autonomous Agent (LLM)     │
                    │   (Coinbase AgentKit Agent)   │
                    └───────────────┬───────────────┘
                                    │ 1. Proposed Tx & Intent
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │   AgendaFinancialGuardActionProvider (Pre-Sign Gate)    │
       │                                                         │
       │  [✓ Layer 1] OFAC SDN & AML Screening                   │
       │  [✓ Layer 2] Drainer & Infinite Approval Detection      │
       │  [✓ Layer 3] Spending Velocity & Per-Tx Caps            │
       │  [✓ Layer 4] Prompt Injection & Reasoning Defense       │
       └────────────────────────────┬────────────────────────────┘
                        ALLOW / REJECT Decision
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
               [REJECT: 95/100]             [ALLOW: 10/100]
            PermissionError raised       Broadcast to Base / Sepolia
```

---

## 3. Integration Code

```python
from cdp_agentkit_core.actions import ActionProvider
from integrations.coinbase_agentkit.agenda_guard_action_provider import AgendaFinancialGuardActionProvider

# 1. Initialize guard with organization velocity limits
guard = AgendaFinancialGuardActionProvider(
    max_single_limit_usd=100.0,
    rolling_24h_limit_usd=500.0,
    prefer_remote=True, # Queries Cloudflare Edge worker with sub-10ms latency
)

# 2. Attach pre-sign middleware to AgentKit wallet provider
wallet_provider.send_transaction = guard.wrap_wallet_provider(
    wallet_provider.send_transaction
)

# 3. Agents can also query safety explicitly before planning actions:
safety_report = guard.check_transaction_safety(
    recipient="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount_usd=25.0,
    network="base",
    asset="USDC",
    intent="Purchase daily API compute credits",
)
```

---

## 4. Autonomous M2M Escrow Arbitration

When two AgentKit agents engage in a B2B deal (e.g. data or compute purchase):
1. **Buyer Agent** deposits USDC into `M2MEscrow.sol` on Base.
2. **Seller Agent** submits the deliverable artifact.
3. If deliverables are disputed, `BaseEscrowRelayer` queries `m2m-escrow-arbiter` on Cloudflare Edge.
4. The arbiter evaluates SLA completion (pro-rata telemetry or all-or-nothing), signs the ruling with ECDSA, and settles the escrow on Base with mathematical balance conservation.
