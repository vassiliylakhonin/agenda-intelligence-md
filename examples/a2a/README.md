# A2A examples

Runnable JSON-RPC examples for the `agenda-intelligence-a2a` stdio shell.

Run any example with:

```bash
agenda-intelligence-a2a < examples/a2a/middle-corridor-deal-risk.request.json
```

Available examples:

- `agent-card.request.json` - returns the A2A agent card and supported capabilities.
- `middle-corridor-deal-risk.request.json` - runs the Kazakhstan / Middle Corridor structured deal-risk gate.
- `audit-claims.request.json` - validates and summarizes claim-level evidence support.
- `source-coverage.request.json` - checks whether an evidence pack covers a source-requirement category.
- `score-output.request.json` - scores a before/after output pair.

These examples are structured JSON only. They do not add live retrieval, factual-truth verification, or legal/compliance/sanctions/financial/insurance advice.
