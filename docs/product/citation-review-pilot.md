# Check citations before sharing an AI answer

[Open the one-claim review](https://output-verification.agendamcp.dpdns.org/#one-claim-review).

Use this when you have an AI-written answer and the original material it cites.
Start with one important assertion. The service checks supplied references and
quote presence. When an assertion contains a number and its cited excerpts
are supplied, a numeric-context warning can flag figures for a closer read.
The reviewer decides whether the quote supports the assertion and whether the
original source can be trusted.

## Try your task

1. Use public or redacted material. Check the free allowance on the page before
   preparing input: five attempts per network for this campaign, shared by
   people on that network, with no daily reset. Checking availability is free.
2. Paste one assertion from the answer, the original source excerpt, and its
   exact supporting quote if the answer has one. Do not manufacture a quote or
   change the original source to make it pass. Select your own assessment of
   support; the service does not infer or verify that assessment.
3. Choose **Check this claim free**. No wallet is needed for an admitted trial.
   Only this assertion is checked; this is not coverage of the entire answer.
4. Inspect each returned issue against the original source. A missing quote
   may be a real problem or a correct paraphrase requiring reviewer judgment.
   For a numeric-context warning, compare the figure, unit, and what the figure
   describes. Keep a copy of the original before editing it.
5. Correct or remove the problematic assertion/quote and check again. The page
   compares successful checks; fewer findings do not establish factual truth.
6. Optionally choose **Useful next step** or **Still blocked** after completion.
   This sends only the choice linked to that completed trial, not its input or
   result. The separate email link opens a draft you review and send yourself.

For multiple assertions use the full request editor below the short form. For
an answer with retrieved chunks in a local pipeline, use the separate
[local RAG adapter](../integrations/rag-output.md), which has its own contract
and diagnostics. Local checks need no wallet or model API key.

An exhausted network may still inspect the saved example. A paid evaluation is
a separate explicit choice; no automatic checkout follows the free form. A
400/429 is not a completed review and must not be counted as useful output.

For the structured API result, `NUMERIC_CONTEXT_REVIEW` identifies a claim
that needs a closer read. `NUMERIC_CONTEXT_LIMIT` means some checks exceeded
the input budget. Send fewer claims or shorter excerpts to retry those checks.
Numeric warnings are advisory and preserve the readiness score and routing.
When an evaluation carries a receipt, its signature covers the warning and
reviewer action. Every evaluation still requires human review.

## What would establish useful demand

Record consent and pseudonymous participant/session labels outside public
telemetry. For each real task distinguish:

- whether the person reached a usable result;
- findings they confirmed as useful, false holds, or unresolved;
- whether a finding changed the answer;
- review time, only if actually measured with a comparable baseline;
- voluntary later use and actual payment, separately from stated interest.

Run the first usability pass with three independent participants and five real
review tasks across them. Each participant brings a public or redacted answer
with its cited sources. Use an available free trial or a supervised session of
the same trial evaluator in a local Worker if shared allowance is exhausted.
This pass needs no wallet. Record the delivery mode for each task.

For each task, record the claim, the human verdict on each flagged number,
any missed error found during source review, and any edit made before sharing.
For comparable tasks, alternate manual-first and tool-first order and time
from having the answer and source available to recording the decision. Include
input preparation in the tool time. Review the five cases individually, then
track voluntary repeat use and any actual purchase as separate follow-up
signals. Discovery requests and scores cannot substitute for these observations.

## Current status

No external participants have been recruited for this pilot. The owner has
authorized autonomous preparation and self-testing only; no invitations or
support messages are sent. Owner-agent public-document checks do not count as
external sessions, human ratings, retained customers, measured time savings or
willingness to pay.

The bundled-browser release checks cover five deliberately seeded public-document
tasks using the actual trial evaluator in local SQLite storage. They exercise
quote correction and preserve the semantic boundary: an exact quotation paired
with a false assertion may have no structural finding. Even that response
requires human review and reports factual verification as false.
