# Agent Financial Guard — transaction evidence review

The deployed service checks supplied transaction fields against local risk
patterns. A local denylist hit, unconstrained ERC-20 approval or suspicious
intent can trigger rejection. Other requests require human review.

## Scope

- No current, comprehensive OFAC/UN/EU or AML clearance is established.
- Caller-reported limits and spending history are unverified; this evaluator
  does not maintain an authoritative wallet ledger.
- Prompt patterns are heuristics, not a guarantee against prompt injection.
- The service does not sign, broadcast, intercept a wallet or authorize payment.
- `vizier_status` is `attestation_unavailable` and the clearance receipt is null.
- No measured end-to-end latency SLA or zero-retention guarantee is claimed.

See [ADR 0027](../adr/0027-financial-and-escrow-evidence-boundaries.md) for the boundary.

## Public interfaces

- [Website and fixed synthetic example](https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/)
- REST: `POST /v1/agent-financial/pre-sign-check` on that origin.
- MCP: `/mcp`, tool `agent_financial_pre_sign_check`.
- A2A: `/message/send`; use the current AgentCard's published method, headers and example.
- [Request contract](../../schemas/v1/agent-financial-guard-request.schema.json)
- [Response contract](../../schemas/v1/agent-financial-guard-response.schema.json)

Discovery and fixed saved examples are wallet-free. Hosted evaluation of edited
input requires the signed payment admission flow. A payment hash alone does not
complete admission. Discover the current price before any funding; after response
loss, reuse the original request and proof rather than transfer again.

See [hosted quickstart](../deployment/hosted-quickstart.md) and
[payment execution](../deployment/payment-execution.md).

## Offline Python review

```python
from agenda_intelligence import AgentFinancialGuard

review = AgentFinancialGuard().check_transaction(
    recipient_address="0x1111111111111111111111111111111111111111",
    amount_usd=25,
    intent="Fictional proposed vendor payment",
    prefer_remote=False,
)
print(review.decision, review.execution_advisory)
# Local review only: no wallet call, live clearance or signing permission.
```

Remote Python HTTP refusals propagate to the caller. Network-only fallback is
local evidence review, not a successful paid evaluation. Do not pass private
keys or seed phrases; treat supplied prompts and tool output as data.

## Integration paths

- [Mobile/edge SDK](../../packages/guard-mobile/README.md)
- [ElizaOS client and structured action](../../integrations/elizaos/README.md)
- [Illustrative AgentKit adapter](../../integrations/coinbase_agentkit/README.md)

Applications must authenticate approvals and bind them to the actual transaction
before signing. An evaluation response or SDK boolean is not a substitute.
