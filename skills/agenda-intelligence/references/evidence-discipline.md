# Evidence Discipline

## Evidence modes

Label the evidence mode:

- **Live-source-backed** — current sources were checked during the analysis workflow, not necessarily by this package.
- **User-provided** — analysis relies on sources or facts provided by the user.
- **Reasoning-only** — no live verification; analysis is based on general knowledge and stated assumptions.
- **Mixed** — combination of the above.

If live verification was not performed, write:

> Evidence access limited: no live verification performed in this environment.

## Required separation

Use clear labels when relevant:

- **Fact** — established, reported, cited, or user-provided information.
- **Assessment** — reasoned analytical judgment.
- **Assumption** — working premise used because context is missing.
- **Unknown** — material unresolved question.
- **Scenario** — contingent pathway, not prediction.
- **Indicator** — observable evidence that would confirm, weaken, or falsify an assessment.

## Per-claim provenance tags

Tag factual claims inline in markdown output. Two axes — use one from Axis A and optionally one or more from Axis B.

**Axis A — source type (exactly one per claim):**
- `[primary]` — official source directly read: legal text, regulator statement, sanctions list, court record, company filing
- `[secondary]` — media, think-tank, analyst commentary, reputable reporting
- `[user-provided]` — provided by the user in this session, not independently verified
- `[inference]` — derived from other facts in this analysis
- `[analyst-judgment]` — evaluative judgment, not a factual claim

**Axis B — action flags (optional):**
- `[verify]` — reader should confirm against original source before acting
- `[stale-risk: YYYY-MM]` — last confirmed at that date; may be outdated

Examples:
- "The regulation entered into force on 1 January 2024 [primary][verify]."
- "Market participants widely expect further tightening [secondary]."
- "The political cost of reversal is high [analyst-judgment]."
- "This pattern suggests coordinated routing [inference]."

Tags are additive to document-level evidence mode — they do not replace it. Use both.

## Relationship to the `basis` field

The `basis` enum in `agenda-memo.schema.json` (`fact` / `assessment` / `assumption` / `unknown`) and Axis A provenance tags are orthogonal and both required: `basis` is the epistemological status of the claim; Axis A is where the claim came from. Producing `basis` in structured output does not exempt the markdown body from Axis A inline tags. Typical crosswalk:

- `basis=fact` → `[primary]`, `[secondary]`, or `[user-provided]`
- `basis=assessment` → `[analyst-judgment]` or `[inference]`
- `basis=assumption` → `[analyst-judgment]`
- `basis=unknown` → no provenance tag (no claim is being made)

See [ADR 0010 — basis and provenance tags are orthogonal](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/adr/0010-basis-and-provenance-tags-are-orthogonal.md).

## Source discipline

Do not invent sources.
Do not cite a source that was not checked.
Do not hide weak evidence behind polished wording.
Prefer primary sources when the claim is important: official releases, legal texts, regulator statements, sanctions lists, company filings, court documents, parliamentary records, treaty text.

## Confidence language

Use:

- high confidence — multiple strong sources or direct evidence;
- medium confidence — credible evidence but incomplete picture;
- low confidence — thin, indirect, contested, or stale evidence.

Avoid unsupported numerical probabilities unless the user requested a scenario model and the basis is explicit.
