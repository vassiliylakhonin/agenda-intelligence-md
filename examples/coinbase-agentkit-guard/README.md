# Coinbase AgentKit Integration with AgentFinancialGuard

This example demonstrates how to integrate `AgentFinancialGuard` as a deterministic pre-sign firewall before broadcasting on-chain transactions via Coinbase AgentKit on Base.

## Quickstart

```python
from agenda_intelligence import AgentFinancialGuard

guard = AgentFinancialGuard()

# Before wallet_provider.send_transaction(...)
verdict = guard.check_transaction(
    recipient_address="0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663",
    amount_usd=25.0,
    network="base",
    asset="USDC",
    intent="Pay API data provider for dataset",
)

if verdict.is_allowed:
    # Safe to broadcast transaction
    tx = wallet_provider.send_transaction(...)
elif verdict.is_blocked:
    # Immediately abort: OFAC SDN match, infinite approval drainer, or prompt injection
    print(f"Transaction blocked: {verdict.violations}")
```

## Running the Example

```bash
python3 run.py
```
