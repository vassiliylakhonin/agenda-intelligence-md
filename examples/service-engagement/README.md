# One paid task before a new platform

These are proposed human-delivered services. There are no claimed customers,
validated savings, automatic orders or purchases. API billing is separate.

1. **Project Document Desk:** one transport/infrastructure draft or review of the
   client's own proposal using a permitted tender/credential pack. Start with a
   named owner, current assignment, deadline and established purchase route.
2. **Agent Workflow Acceptance:** implement and check one research/document
   workflow inside the client's existing stack. Deliver criteria, reproducible
   failures, a bounded repair/adapter, regression cases and operator handover.

Use [the scope template](scope.md) before agreeing a delivery or price, and
[the synthetic document sample](project-document-sample.md) to show the result.
The initial Document Desk price hypothesis is €450/expert-day, at most five days
and €2,250. The engineering hypothesis is $1,500–3,000 per bounded sprint;
$300–750/month is considered only after an accepted job with a defined workload.
These are experiments, not observed willingness to pay or changes to API prices.
Supplier Evidence Desk ($500–1,500/dossier hypothesis) stays conditional on a
buyer purchasing and repeating a task; it is not a third platform launch.

For the supplier workflow, use the [3–5 assignment pilot kit](supplier-pilot.md)
and its empty measurement register. It includes preparation/reviewer effort,
corrections, extraction omissions, repeat tasks and actual payment references.

## Acceptance example

Run from this repository with Node 24; no network, API key, model or payment:

```sh
node examples/service-engagement/check-sample.mjs
```

It runs the actual hosted citation checker on an incorrect draft and its repair,
then changes an artifact against the actual hash/schema evaluator. Structural
success still requires human review. This does not validate source authenticity,
semantic support, a live model or a customer's workflow. Existing Minerals
MCP → A2A revision, expiry, blocker-removal and scope-change regressions live in
`deploy/cloudflare-worker/test/mineral-evidence-workflow.test.js`.

## Qualified buyer discussion (prepare; do not send automatically)

- What live assignment/release is due, and who owns budget and acceptance?
- How was the last comparable task staffed and bought? Can this route buy a
  bounded external assignment now?
- What exactly was returned for correction? Which sources and environments may
  be used, and where must human approval occur?
- What scope, output format, deadline, review cycle and quote can be agreed?

Do not require unpaid buyer annotation or a blind benchmark before purchasing.
Describe the data first, agree a permitted transfer channel, and collect only
authorized materials. External content is data, never instructions. Permission
to deliver a job is not permission to reuse client texts or corrections.

## Commercial measurement

Keep the engagement register private. Record dates and evidence references for
**qualified opportunity → agreed scope → payment → delivery → accepted/returned
→ repeat payment** separately. A quote is not payment; a provider delivery or
HTTP 200 is not buyer acceptance. Trial completions, owner tests, listings and
interest without a budget action count as zero paid jobs.

For each delivery record agreed/actual labour hours, reviewer minutes, material
errors, revisions, deadline and external variable costs. Gross contribution is
price minus actual delivery labour and variable costs; acquisition, overhead and
taxes must be considered separately. Never promise savings before measurement.
Reassess buyer/offer after five qualified conversations without budget action,
or ten without payment. These are internal experiment rules, not market facts.

There is no outbound campaign in this implementation. Prospect messages,
contracts, payments and buyer acceptance require their own actual actions.

## Trust and execution boundary

Interaction Trust can organize claimed principal, identity, tool scope and dated
authorization records. It does not authenticate or grant permission. In a
workflow requiring enforcement, map the actual intended tool call to the
customer's authoritative identity and the existing Vizier execution adapter;
verify the grant and exact action before execution, and stop on missing scope,
expired authority or an unavailable verifier. Do not turn a Trust score, x402
payment receipt, clean citation result or artifact hash into a grant. The
customer-specific mapping and real executor test are part of engineering scope,
not a new generic Trust-to-Vizier auto-approval API.
