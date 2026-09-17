# Coinbase AgentKit x Agenda Financial Guard

Pre-sign transaction firewall for autonomous AI agents built on [Coinbase AgentKit](https://github.com/coinbase/agentkit).

Protects agent treasuries by deterministically evaluating transactions before they are broadcast to Base Mainnet or Sepolia:
- **OFAC SDN & AML Screening**: Real-time rejection of sanctioned addresses and mixers (Tornado Cash, Lazarus, Garantex).
- **Drainer & Infinite Allowance Defense**: Identifies malicious approval calldata (`approve(max_uint256)`).
- **Spending Velocity Controls**: Enforces per-transaction caps and daily limits.
- **Prompt Injection Defense**: Neutralizes adversarial reasoning injected into agent memory.

---

## Quickstart

### 1. Installation

```bash
pip install agenda-intelligence-md cdp-agentkit-core
```

### 2. Guard Integration Example

```python
from agenda_guard_action_provider import AgendaFinancialGuardActionProvider

# 1. Initialize Financial Guard
guard = AgendaFinancialGuardActionProvider(
    max_single_limit_usd=100.0,
    rolling_24h_limit_usd=500.0,
)

# 2. Wrap AgentKit Wallet Provider
wallet_provider.send_transaction = guard.wrap_wallet_provider(
    wallet_provider.send_transaction
)

# 3. Clean Transaction (Allowed)
# Sends 25 USDC to vendor -> Executes normally

# 4. Dangerous Transaction (Blocked)
# If an agent attempts to send funds to a sanctioned mixer:
# -> PermissionError: [AgendaFinancialGuard BLOCKED] Transaction rejected (Risk Score: 95/100):
#    OFAC SDN / Sanctions violation: recipient address is associated with Tornado Cash
```

---

## Tool Interface for Agent Reasoning

Agents can also invoke the guard proactively as a reasoning tool:

```python
result = guard.check_transaction_safety(
    recipient="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount_usd=50.0,
    network="base",
    asset="USDC",
    intent="Purchase computing resources from vendor",
)
print(result)
```
