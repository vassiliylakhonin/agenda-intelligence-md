# Corridor & Sanctions Risk Assistant

Status: shipped 2026-07-08. Lightweight discovery **front** profile `corridor_sanctions_assistant`. The free-text orientation has a published response schema and is not itself a structured deal-triage gate. Configured upstream screening may report leads or availability limitations. It orients a human, routes to the structured gates, and supplies a path to person-led work after fit, scope, fee, and timing are confirmed.

## Why a front, not another gate

The portfolio already ships structured evidence-readiness gates (Middle Corridor deal risk, CIS secondary-sanctions, Gulf maritime, Kazakhstan market-entry). The human-facing front door takes a plain-language deal or counterparty question, says which gate fits, and explains what to send for person-led work. Fit, scope, fee, and timing are confirmed before work starts.

This is the "Zee pattern": an agent whose job is orientation and a clear next step, not the analysis itself. The analysis, scoring, and any screening stay in the named gates. Marketplace discovery lets a human find the card and follow the route to person-led work. It is not treated as a per-call revenue channel.

## Boundary (honesty rules apply)

- Orientation and routing only. No triage, scoring, screening, or retrieval of its own.
- Not legal, compliance, sanctions, financial, investment, or insurance advice.
- No approval, clearance, authorization, denial, or final decision.
- Human review is required before any commercial action.
- No claimed traction, pilots, paid usage, named users, or revenue.

## What it returns

`message/send` returns a deterministic orientation artifact (`text/markdown` + `application/json`), never an LLM answer:

- a short "which gate fits" map to the four structured gates, each with its live A2A endpoint and when to use it;
- an `engagement` block: the person-led review route, the contact email, support hours, and the exact next step;
- `human_review_required: true` and a `not_advice_notice`.

## Orientation and handoff

The free router returns `role: orientation_only`, `not_a_clearance: true`, an ordered `route_plan` of keyword-based review leads, and short bank/compliance and insurance checklists. A selected specialist still has its own input, price, admission and human-review requirements. Multiple suggestions are not assessed findings, legal applicability, or a mandatory sequence.

The selected `handoff_draft` is deliberately incomplete: it carries the caller's question into a compatible question field and lists required fields that still need to be supplied. It does not infer identities, routes, source records or permission from prose, and it does not submit the draft. The page can prepare the recommended gate locally; if the input changes, rerun orientation first. A DLP finding suppresses the new draft and HS hint until the caller reviews and redacts the input. Do not place confidential information in a URL.

When an explicitly labeled six-digit HS code is supplied, `hs_hint` reports whether it appears in the bundled dated CHPL reference snapshot. A match is a lead, and absence is not clearance or proof that goods are uncontrolled. The full `screen_dual_use_hs_code` is a separate paid tool; do not pay automatically. Check the serving price and terms before use. The snapshot does not classify a product or settle licensing.

## Routes to

| Gate | Use when |
|---|---|
| Kazakhstan / Middle Corridor Deal Risk Gate | a route/cargo/counterparties deal along the Middle Corridor needs a pre-signature evidence-completeness read |
| CIS Secondary-Sanctions Exposure | a CIS / Caucasus / Central Asia counterparty needs secondary-sanctions exposure triage for EU / UK / UAE / Singapore due diligence |
| Gulf Maritime Exposure Gate | a vessel/voyage through the Gulf, Strait of Hormuz, Bab-el-Mandeb, or Red Sea needs sanctions/chokepoint exposure triage |
| Kazakhstan Market-Entry Readiness Gate | a Kazakhstan market-entry file needs a staged readiness gate |

## The person-led step this front feeds

The agent routes a caller to person-led work, not an on-chain per-call payment. The caller emails a one-line description of the route or counterparty and the next decision or review. Fit, scope, fee, and timing are confirmed before work starts. The card publishes no service price and promises no free deliverable.

## Deploy

Front profile served by the same worker under `AGENT_PROFILE=corridor_sanctions_assistant`, host `corridor-sanctions-assistant-a2a`:

```
wrangler deploy --env corridor-sanctions-assistant
```

Going live is a public-positioning step (a new indexed buyer-facing agent). Deploy is an operator decision, not part of CI.


## Hosted connection

For remote MCP initialization, discovery and A2A heartbeat, see the
[hosted quickstart](../deployment/hosted-quickstart.md). The orientation tool is free; the separate HS screen and specialist evaluations have their own admission and pricing.
