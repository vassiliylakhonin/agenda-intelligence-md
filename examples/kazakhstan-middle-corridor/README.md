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
  -H 'A2A-Version: 1.0' \
  -H 'x-client-id: live-demo' \
  -H "x-request-id: demo-$(date +%s)" \
  --data-binary @examples/kazakhstan-middle-corridor/live-agent-request.json
```

Expected result: `escalate_before_signature`, `medium-high` risk signal, route/cargo/value extraction, supplied source detection for port notice, sanctions extract, and carrier note, plus a minimum-source list that still requires counterparty registry, beneficial ownership, customs/regulatory, insurance, and vessel/carrier history evidence.

## Prepare a deal file and hand it to a reviewer

The hosted product page includes a three-step intake: route/cargo/stage, counterparties, and optional source records. Choose source types yourself from the published taxonomy and enter actual IDs, titles and dates. The wizard prepares a structured request locally; it does not upload files, fetch URLs, verify documents, spend an attempt or perform a check. Review the JSON and explicitly choose the free check. The existing editor remains available for additional schema fields. Shared-network trial and daily limits remain unchanged.

The page and the pre-signature helper derive suggested roles and a first action from the returned `minimum_sources_before_go`, ordered by the declared stage. The hosted gate response itself retains its existing contract. These are workflow suggestions based on the existing missing-source list, not assignments, legal requirements or separate stage-specific minimums. All six existing `minimum_sources_before_go` remain open until the service recognizes a record; a changed stage does not waive one. For declared dual-use goods or electronics, the gate adds an end-user/re-export review lead; a named bank or trade-finance question adds a banking review lead. Neither establishes CHPL membership, licensing, bank acceptance or authorization. Source content, issuer and freshness remain unverified.

Choose **Run a worked example** on the product page to inspect a synthetic sparse file and a follow-up with explicitly synthetic records. The records are rejected, the gaps remain, and no trial attempt is consumed. Fake or placeholder records must not be used to manufacture a higher score. A successful real check may change the reported reference coverage; it is not a sanctions clearance or authorization.

For a pre-signature handoff, [`before-signature.mjs`](./before-signature.mjs) accepts an explicit evaluator callback and returns `hold` or `human_review`, never permission to sign. It makes no network call itself and never executes an operation. Errors, quota exhaustion, malformed and mismatched results stop the workflow. The callback must bind the response to the exact request, including evidence and stage; the unsigned response only echoes some fields and this helper cannot prove full input binding or source authenticity. Require an independent human decision and action-bound authorization at the point of signing; redo review when the case, sources or policy change. For an explicitly invoked hosted trial, see the [first-check client](../hosted-mcp/FIRST_CHECK.md). Its admission and trial limits apply.

Depending on the case, reviewers can separately open the CIS sanctions, dual-use export, Output Verification or Financial Guard pages from the wizard. No deal data is sent automatically, and each gate has separate input, admission and review requirements.
