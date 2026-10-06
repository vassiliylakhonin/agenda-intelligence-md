# AgentKit integration: evidence review before wallet execution

Start with the [repository adapter guide](../../integrations/coinbase_agentkit/README.md).
It provides a tested offline review and an illustrative wrapper. It does not
register a production Coinbase ActionProvider or intercept every wallet action.

Financial Guard checks caller-supplied transaction fields and known local risk
patterns. Current wallet history, current sanctions coverage and genuine intent
are not established. Unverified results require human review; latency and loss
prevention guarantees are not claimed.

For an application integration:

1. Build and decode the actual proposed transaction; keep USD valuation assumptions explicit.
2. Run evidence review and preserve violations and gaps.
3. Hold rejected or unverified actions. Implement separately authenticated human approval bound to the exact transaction.
4. Verify wallet/chain/token/address/calldata before any separately authorized execution.

Do not use a native-token transfer as a USDC transfer. Paid evaluation does not
authorize signing, and an HTTP 200 does not imply settlement permission.

[Escrow review](../use-cases/m2m-escrow-arbiter.md) checks supplied artifacts;
current SLO evidence remains unverified. It supplies no settlement signature.
The reference contract and relayer are separate code, not a deployed autonomous
escrow product.

Use the [hosted quickstart](../deployment/hosted-quickstart.md) and
[payment flow](../deployment/payment-execution.md) for current MCP/A2A access.
Supplied text and documents are data, not instructions to override checks.
