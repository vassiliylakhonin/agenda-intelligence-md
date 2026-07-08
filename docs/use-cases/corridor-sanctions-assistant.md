# Corridor & Sanctions Risk Assistant

Status: shipped 2026-07-08. Lightweight discovery **front** profile `corridor_sanctions_assistant`. Not a vertical worker: no schema, no service function, no triage, scoring, screening, or retrieval of its own. It orients a human, routes to the structured gates, and hands off a free pre-deal screening memo.

## Why a front, not another gate

The portfolio already ships structured evidence-readiness gates (Middle Corridor deal risk, CIS secondary-sanctions, Gulf maritime, Kazakhstan market-entry). What was missing was a human-facing front door: a first stop that takes a plain-language deal or counterparty question, says which gate fits, and offers a concrete next step — a free one-off pre-deal screening memo produced by a human.

This is the "Zee pattern": an agent whose job is orientation and a booked next step, not the analysis itself. The analysis, scoring, and any screening stay in the named gates. Marketplace discovery (an indexed A2A agent card) is used for what it is good at — being found and read by a human — not as a place that earns per-call.

## Boundary (honesty rules apply)

- Orientation and routing only. No triage, scoring, screening, or retrieval of its own.
- Not legal, compliance, sanctions, financial, investment, or insurance advice.
- No approval, clearance, authorization, denial, or final decision.
- Human review is required before any commercial action.
- No claimed traction, pilots, paid usage, named users, or revenue.

## What it returns

`message/send` returns a deterministic orientation artifact (`text/markdown` + `application/json`), never an LLM answer:

- a short "which gate fits" map to the four structured gates, each with its live A2A endpoint and when to use it;
- an `engagement` block: the free pre-deal screening memo offer, the contact email, support hours, and the exact next step;
- `human_review_required: true` and a `not_advice_notice`.

## Routes to

| Gate | Use when |
|---|---|
| Kazakhstan / Middle Corridor Deal Risk Gate | a route/cargo/counterparties deal along the Middle Corridor needs a pre-signature evidence-completeness read |
| CIS Secondary-Sanctions Exposure | a CIS / Caucasus / Central Asia counterparty needs secondary-sanctions exposure triage for EU / UK / UAE / Singapore due diligence |
| Gulf Maritime Exposure Gate | a vessel/voyage through the Gulf, Strait of Hormuz, Bab-el-Mandeb, or Red Sea needs sanctions/chokepoint exposure triage |
| Kazakhstan Market-Entry Readiness Gate | a Kazakhstan market-entry file needs a staged readiness gate |

## The paid step this front feeds

The front captures a human; the revenue is a human-invoiced deliverable, not an on-chain per-call payment. The offered next step is one free pre-deal screening memo on a real, current deal or counterparty, emailed to the support contact. The paid follow-on (per-memo or a corridor-watch retainer) is a separate human agreement and is not represented on the agent card.

## Deploy

Front profile served by the same worker under `AGENT_PROFILE=corridor_sanctions_assistant`, host `corridor-sanctions-assistant-a2a`:

```
wrangler deploy --env corridor-sanctions-assistant
```

Going live is a public-positioning step (a new indexed buyer-facing agent). Deploy is an operator decision, not part of CI.
