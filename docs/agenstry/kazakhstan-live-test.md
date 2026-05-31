# Kazakhstan Corridor A2A live test

This is the repeatable live test for the public Kazakhstan / Middle Corridor Deal Risk Gate A2A agent.

## Endpoint

- Agent card: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json>
- JSON-RPC endpoint: <https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send>

## Test command

```bash
curl -X POST https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -H 'x-client-id: live-demo' \
  -d @examples/kazakhstan-middle-corridor/live-agent-request.json
```

## What a useful response should show

- `triage_recommendation`: `escalate_before_signature`
- `risk_signal`: `medium-high`
- `route`: `Altynkol -> Aktau/Kuryk -> Baku -> Poti`
- `cargo`: `industrial equipment`
- `value`: `USD 2.4m`
- `counterparties`: `Kazakhstan forwarder, Azerbaijan port agent, Georgian consignee`
- `supplied_sources`: `port_operator_notice`, `sanctions_list_extract`, `carrier_note`
- `minimum_sources_before_go`: `counterparty_registry_extract`, `beneficial_ownership_source`, `customs_or_regulatory_source`, `insurance_clause_or_underwriter_note`, `vessel_or_carrier_history`

## Interpretation

The agent is useful when it refuses to treat a partial evidence pack as decision-ready. In this test, the supplied sources are enough to identify a real corridor-risk question, but not enough to support contract signature or committee review. The valuable output is the missing-source list, escalation recommendation, commercial-impact framing, and next action to run `source_coverage` and `audit_claims` in the MCP server.

This live A2A wrapper does not perform live source retrieval, factual-truth verification, sanctions screening, legal analysis, financial advice, insurance advice, or compliance approval.
