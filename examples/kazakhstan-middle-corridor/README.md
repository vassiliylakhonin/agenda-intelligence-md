# Kazakhstan / Middle Corridor Deal Risk Gate examples

These examples show the intended commercial workflow for the Kazakhstan-focused A2A agent:

1. Start with a route, cargo, counterparties, and risk question.
2. Attach dated sources supplied by the caller.
3. Run source coverage and evidence linting before memo drafting.
4. Produce a risk memo only with explicit evidence gaps and review limits.
5. Score the memo for decision-readiness before handoff.

The same evidence-gap picture is also reframed outward in `07-counterparty-readiness.json`. The numbered chain above answers the internal question "should we escalate before signature?"; the `counterparty_readiness` object (added to the response schema, emitted by `middle_corridor_deal_risk`) answers the other actor's question: "how complete is the dossier I must present to a bank, insurer, or counterparty under enhanced due diligence?" It tracks dossier-completeness only -- not clearance, approval, a sanctions determination, or compliance advice.

The examples are illustrative fixtures. They do not contain live retrieval, sanctions advice, compliance advice, or factual verification against external systems.

The `contract/` directory contains the product-grade structured JSON request/response fixtures validated by the Middle Corridor deal-risk schemas. The free-text live A2A request remains a demo convenience, not the canonical enterprise interface.

Live A2A endpoint:

```text
https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send
```

Example curl:

```bash
curl -X POST https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -d @01-request.json
```

Repeatable live agent test. `live-agent-request.json` carries a structured
`data` part so the request routes to the `middle_corridor_deal_risk_contract`
profile; a free-text part falls through to lightweight text triage and leaves
the deal-risk contract empty:

```bash
curl --fail-with-body --show-error --silent \
  -X POST https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send \
  -H 'content-type: application/json' \
  -H 'x-client-id: live-demo' \
  -H "x-request-id: demo-$(date +%s)" \
  --data-binary @examples/kazakhstan-middle-corridor/live-agent-request.json
```

Expected result: `escalate_before_signature`, `medium-high` risk signal, route/cargo/value extraction, supplied source detection for port notice, sanctions extract, and carrier note, plus a minimum-source list that still requires counterparty registry, beneficial ownership, customs/regulatory, insurance, and vessel/carrier history evidence.
