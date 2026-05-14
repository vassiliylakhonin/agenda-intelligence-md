# Signal Lifecycle

Use this reference when a signal requires ongoing monitoring across multiple sessions, not just a one-shot brief.

A signal lifecycle tracker is not a summary archive. It is a living record of how a situation evolves — what changed, when, and why the classification or status shifted.

## When to open a tracker

Open a tracker when:
- a signal is classified as `signal`, `structural_shift`, or `trigger_event`;
- the user asks to monitor a situation over time;
- a one-shot brief flags watch indicators that need follow-up;
- a `developing` situation has not resolved within the expected horizon.

Do not open a tracker for `noise` or one-time `weak_signal` events unless they escalate.

## Lifecycle stages

```
detected → developing → escalated ┐
                                   ├→ resolved → archived
                     stable ───────┘
```

| Stage | Meaning | Typical next stage |
|---|---|---|
| `detected` | First identified; not yet deeply analyzed | `developing` or `stable` |
| `developing` | Actively evolving; requires close monitoring | `escalated` or `stable` |
| `escalated` | High priority; action or decision required | `stable` or `resolved` |
| `stable` | Relevant but not rapidly changing; periodic review | `developing`, `escalated`, or `resolved` |
| `resolved` | Situation concluded or no longer material | `archived` |
| `archived` | Retained for historical reference; no active monitoring | — |

## Transition rules

Move status only when a concrete development justifies it. Do not change status based on time elapsed alone.

**detected → developing:** new information confirms the signal is real and evolving.

**developing → escalated:** a trigger event occurs, enforcement action lands, or a decision point is imminent.

**escalated → stable:** immediate pressure resolved without full resolution; still relevant.

**any → resolved:** situation has concluded, reversed, or become permanently irrelevant to the user's context.

**resolved → archived:** enough time has passed that active retrieval is no longer useful; the entry is kept for reference.

## Update format

Each development entry should answer:
1. What materially changed since the last update?
2. What is the evidence mode for this update?
3. Did the lifecycle status change? If so, why?

Keep each entry short. A tracker is not a memo — full analysis lives in the brief. Cross-reference the brief by date if needed.

## Integration with analysis-bank

When a signal reaches `resolved`:
1. Distill the key reasoning lesson into an `analysis-bank` memory card.
2. Focus on what the tracker got right or wrong about the trajectory.
3. Note which watch indicators proved reliable and which did not.

This closes the loop: the tracker records what happened; the memory card captures what the agent should do differently next time.

## Integration with AgendaBrief

When producing a brief for a tracked signal:
- reference the `signal_id` in the brief;
- align the brief's `signal_classification` with the tracker's current `classification`;
- use the tracker's `watch_indicators` as the basis for the brief's `watch_next` section;
- after the brief, update the tracker's `developments` array and `last_updated`.

## Schema

The machine-readable format is `schemas/signal-tracker.schema.json`.

Required fields: `signal_id`, `title`, `classification`, `status`, `first_detected`, `last_updated`, `summary`, `watch_indicators`.

`resolution_note` is required when status is `resolved` or `archived`.

## Storage

Store tracker files in `analysis-bank/` alongside memory cards, or in a dedicated `signal-tracker/` directory if the volume warrants separation. Use the `signal_id` as the filename: `{signal_id}.json`.

## Example

```json
{
  "signal_id": "eu-ai-act-enforcement-2025",
  "title": "EU AI Act enforcement — high-risk system compliance deadline",
  "classification": "structural_shift",
  "status": "developing",
  "region": "EU",
  "sector": "AI regulation",
  "first_detected": "2025-08-01",
  "last_updated": "2026-05-14",
  "next_review": "2026-08-01",
  "summary": "The EU AI Act high-risk system requirements entered application in August 2025. Enforcement capacity at member-state level is uneven. Major providers are filing conformity assessments; SME compliance remains incomplete.",
  "developments": [
    {
      "date": "2025-08-01",
      "what_changed": "High-risk system requirements entered application.",
      "evidence_mode": "live_source_backed",
      "source_note": "EUR-Lex, Official Journal of the EU.",
      "status_change": "developing"
    },
    {
      "date": "2026-02-15",
      "what_changed": "European AI Office published first enforcement guidance; national authorities still building capacity.",
      "evidence_mode": "live_source_backed",
      "source_note": "European AI Office official release."
    }
  ],
  "watch_indicators": [
    "First enforcement action or fine by a national market surveillance authority.",
    "European AI Office publishes binding interpretation on high-risk classification.",
    "Major provider receives non-compliance notice.",
    "SME compliance rate data published by Commission."
  ]
}
```
