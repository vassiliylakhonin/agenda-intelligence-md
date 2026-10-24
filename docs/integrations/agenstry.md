# Agenstry discovery and ownership

## Hosted fleet and installable package

The deployed Workers expose public Agent Cards at `/.well-known/agent-card.json`,
MCP discovery at `/mcp`, and A2A at `/message/send`. Their cards describe the
capabilities of the selected Worker profile. The Python package remains a
separate installable stdio MCP server:

```bash
pip install agenda-intelligence-md
agenda-intelligence-mcp
```

Use the Worker URL for a hosted listing. Use the repository/package for the
installable MCP listing. Follow the [hosted quickstart](../deployment/hosted-quickstart.md)
for actual request envelopes, structured examples and the signed payment path.

## Free discovery and paid evaluation

Cards, MCP initialize/tools-list, fixed synthetic worked examples and the no-op
heartbeat are public. Live evaluations use the configured pay-per-call policy.
A free example is a precomputed demonstration, not a live or paid evaluation.
Discovery does not authorize a transaction or establish successful client use.

Financial Guard reviews supplied pre-sign evidence against local risk rules.
M2M Escrow reviews delivery evidence and proposed allocations; it does not
execute or authorize payouts. Other profiles keep their published evidence and
human-review boundaries. Do not describe these checks as factual-truth
verification, identity authentication, current sanctions clearance or guaranteed
safety.

## Verify a workers.dev domain

1. In Agenstry Account, enter the exact Worker hostname and select the
   `/.well-known/ file` method, since workers.dev DNS is not under our control.
2. Copy that domain's issued public challenge into its own
   `AGENSTRY_VERIFY_TOKEN` environment variable in `wrangler.toml`.
3. Run local checks and deploy through the existing Vizier-protected workflow.
4. Check the live `/.well-known/agenstry-verify` response against the exact issued
   token, then select **Check now** in Agenstry and confirm **verified**.

Challenges are public ownership proofs, not API credentials. A shared placeholder
or a challenge issued for another domain is not a valid proof. Existing issued
file proofs are covered by the Worker regression tests.

Indexing, ownership verification, technical conformance and revenue evidence are
separate states. A public listing need not be bound to the owner's account.
Account impressions and calls cover Agenstry's own measurements and do not
replace direct Worker telemetry. Do not publish test traffic as customers or
revenue.

## Improve discovery honestly

### First result from a text-only catalog console

The first three card examples are read-only setup commands. Send exactly one
as a single text part, without case data, metadata or continuation:

- **Show a free worked example** — inspect saved synthetic inputs and findings.
- **Show input requirements** — get the serving entry tool's actual input schema,
  machine contract and free preflight path.
- **Show free trial options** — get this deployment's configured limits, shared
  allowance scope, current-allowance link and optional post-trial feedback path.

The last two responses are completed A2A display tasks with
`metadata.operation` and JSON `kind` equal to `catalog_input_requirements` or
`catalog_trial_options`. JSON has `schema_version: 1`, `product_profile`,
`authentication`, `next`, `availability_checked: false`,
`evaluation_performed: false`, `attempt_consumed: false`,
`authorization_granted: false`, `human_review_required: true` and
`not_advice_notice`.
Requirements add `input` (the named entry tool, actual `input_schema`, schema
and synthetic-example URLs), `contract` and `onboarding`. Trial options add
`trial` (configured terms, or `null` when disabled), `onboarding`, `pricing_url`,
`automatic_payment: false` and `automatic_evaluation_retry: false`. A disabled
trial advertises no trial terms or allowance link. The task is not persisted;
start a new request using the published contract instead of continuing its ID.

These responses read configuration and published schemas only. They do not
query allowance storage, fetch documents, evaluate a case or issue a receipt.
Telemetry records `catalog_input_requirements` and `catalog_trial_options`
as funnel views, never usage, trials or paid executions. Passing the linked
preflight establishes input shape only.

Ordinary evaluation intents live separately under the vendor extension's
`catalog_onboarding.evaluation_intents`; they are not one-click text starters.
Structured JSON examples remain available and retain normal evaluation
admission. Existing skill IDs and input/output schemas are unchanged.

Choose **Show a free worked example** in Agenstry's Try it console, or send that
exact sentence alone as one A2A text part. This returns the serving product's
saved synthetic input, findings, a saved correction where available, and a link
to review your own material. It performs no live evaluation, consumes no trial
attempt and grants no authorization. Configured deployment authorization still
applies. Do not attach case data, task/context IDs or message metadata to this
read-only command. Such requests follow normal evaluation or refusal handling.

The additive response contract is a completed A2A task with
`metadata.operation: "worked_example"`, `evaluation_performed: false`,
`attempt_consumed: false`, `authorization_granted: false` and
`task_persisted: false`. The artifact contains Markdown and JSON. The JSON data
has `schema_version: 1`, `kind: "precomputed_synthetic_fixture"`, `example`
(the saved request/response and optional follow-up), and `next.review_url`.
`next.trial_terms_url` appears only when that deployment has a trial enabled.
The completed display task is not stored for GetTask continuation.

Ordinary paid evaluations still return HTTP 402 without payment. Agenstry's
Try it console cannot settle that payment, so a 402 is not a service outage.
Use the returned product-page link for a deliberate existing free trial with
your own authorized evidence; HTTP, MCP and native A2A share its allowance.
Record these previews as `worked_example` funnel events, not evaluations,
customers, useful outcomes or paid executions. Maintainer checks must use
`X-Client-Id: agenda-owner-<purpose>`; do not publish owner console tests as demand.

For Output Verification, lead with report evidence quality, citation/reference
consistency and quoted-excerpt checks. A useful entry task is reviewing an
AI-drafted report before handover, correcting unsupported claims, and letting a
human review the revised evidence. The stable skill IDs and schemas remain the
same. Catalog taxonomy is controlled by Agenstry: clearer names and tags are
mapping inputs, not a guarantee of categorization or ranking. Do not claim
semantic entailment, factual truth or source authenticity to obtain a category.

Keep stable skill IDs and describe actual inputs, outputs and bounded examples.
Link the structured contracts and quickstart rather than inventing additional
skills to increase a score. Legal registry IDs and stronger authentication schemes
should only be declared when real and implemented. Submit revenue evidence only
for real independent settlements. Catalog scores may lag a deployment; inspect
both the public listing and current readiness result.

## Catalog corrections and adoption checks

If an inferred taxonomy capability does not match the signed card and tool
contract, record the public listing, claimed category, actual tool inputs/outputs
and audit timestamp. Correct a supported owner mapping if the account offers it;
otherwise submit a factual catalog correction to Agenstry. Revenue-evidence
forms are not proof of technical capability. Do not add unsupported skills to
make an inferred category or conformance score look correct.

The focused [Output Verification integration](../../examples/output-verification/README.md)
includes a runnable MCP request and tests for an unsupported claim, human-review
routing and paid admission. Measure external-candidate usable results, repeat
fingerprints and server-witnessed completed paid executions separately. Catalog
impressions, conformance probes, payment headers and response replays do not
establish new customers or purchases.
