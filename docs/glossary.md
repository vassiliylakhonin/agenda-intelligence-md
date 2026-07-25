# Portfolio glossary

Canonical glossary for the Agenda Intelligence portfolio. Linked from `CONTRIBUTING.md` in all four repos so a new contributor has one place to look up shared terminology.

This file is the single source of truth. The three sibling repos do not maintain local glossaries — they link here.

## How to use this file

Most terms have a dedicated `##` section in the relevant `AGENTS.md`. For those, this file is an index: a one-line description plus a direct anchor link to the canonical definition. A handful of terms that are used across the portfolio but are not surfaced as their own `##` section get a short definition here.

If a term you need is missing, open an issue against [agenda-intelligence-md](https://github.com/vassiliylakhonin/agenda-intelligence-md/issues) rather than redefining it locally — that's how the glossary stays the single source of truth.

## Terms with full definitions here

### Evidence mode

Every example memo in the portfolio must declare one of four evidence modes at the top:

- **`live-source-backed`** — primary sources were retrieved in the session that produced the memo. A `Retrieval date: YYYY-MM-DD` is required.
- **`user-provided sources`** — sources were supplied by the user inside the session, not independently retrieved. `Retrieval date` is also required.
- **`illustrative source packet`** — the memo demonstrates structure using a fabricated but clearly labeled source set. Not a claim of factual accuracy.
- **`reasoning-only`** — no sources used. Reasoning-from-context only.

Authoritative reference: `## Evidence rules` in each skill repo's `AGENTS.md`.

### Per-claim uncertainty labels (Verified / Plausible / Judgment / Unknown)

Four labels used inside memos to mark how solid each individual claim is. They appear in body prose and inside table cells. Their use is referenced in `## Evidence rules` (CA-Caspian and Gulf+ME), but the labels themselves do not have a canonical `##` section — their meaning is established by usage across `examples/`:

- **`Verified`** — backed by an authoritative primary source actually consulted.
- **`Plausible`** — consistent with available sources but not directly confirmed; would survive a desk-level check but should not be treated as established fact.
- **`Judgment`** — analyst evaluation, not a factual claim. Subjective, defensible, not citable.
- **`Unknown`** — material gap; named explicitly rather than silently elided.

These four labels are distinct from the **Per-claim provenance tags** (Axis A/B) — see below. The labels say *how solid* a claim is; the provenance tags say *where it came from*.

### Table-cell discipline

The rule that per-claim provenance tags (Axis A/B) must persist inside markdown tables exactly as they would in body prose. Each factual cell in a risk register, exposure map, options table, indicators table, actors table or scenarios table carries the same Axis A tag the same claim would carry inline.

Common failure: a tag gets dropped or mutated under layout pressure ("`[primary]`" disappears from a cell because the column is narrow). This is treated as a regression, not a formatting choice. A bulk-attribution footnote ("all cells: `[analyst-judgment]`") is not a substitute. A dedicated "Provenance" column is acceptable if it improves readability.

Authoritative reference: end of `## Per-claim provenance tags` in CA-Caspian and Gulf+ME `AGENTS.md`. Tracked as a known canon-failure mode in [`evals/failure-modes.md`](https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main/evals/failure-modes.md) in the Global Think Tank Analyst repo.

### Attribution / citation / quotation — mapping to the external literature

The portfolio's evidence vocabulary lines up with the taxonomy in a 2025 survey of evidence-based text generation with LLMs ("Attribution, Citation, and Quotation: A Survey of Evidence-based Text Generation with Large Language Models", arXiv:2508.15396). The survey's three terms map onto the product-runtime mechanisms:

| Survey term | Definition (survey) | Portfolio mechanism |
|---|---|---|
| Quotation | excerpts from evidence inserted into the text | `verify-quotes` and a claim's `supporting_quotes` (literal span presence) |
| Citation | citation markers that reference supporting evidence sources | `evidence_ids` on a claim (evidence-audit contract) |
| Attribution | broad linking of generated content back to grounding sources | `audit-claims` claim→evidence traceability; `evidence_mode` governs when attribution is required |

The survey groups its ~300 evaluation metrics into seven dimensions: Attribution, Citation, Correctness, Linguistic Quality, Preservation, Relevance, Retrieval. The toolkit deliberately addresses only the structural ones — **Attribution**, **Citation**, and **Preservation** (the literal-presence check that a quoted excerpt is preserved from its source). It does **not** measure **Correctness** (that is factuality — see [`factual-verification.md`](factual-verification.md)) and does not perform **Retrieval** or **Relevance** scoring by default. This is the same faithfulness-not-factuality boundary, stated in the survey's vocabulary.

On timing, the toolkit is **post-hoc** and **in-context** in the survey's scheme: it validates caller-supplied evidence after generation rather than retrieving live at generation time. The `cis_secondary_sanctions` profile is the one per-profile exception (ADR 0014).

## Terms that have their own `##` section — index

For these, click through to the canonical definition. Where a term exists in more than one repo's `AGENTS.md`, the linked one is the most fully developed.

| Term | Canonical location |
|---|---|
| Per-claim provenance tags (Axis A, Axis B) | [CA-Caspian `AGENTS.md` § Per-claim provenance tags](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/blob/main/AGENTS.md#per-claim-provenance-tags) |
| Retrieved-content trust | [agenda-intelligence-md `AGENTS.md` § Retrieved-content trust](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/AGENTS.md#retrieved-content-trust) |
| Honesty rules | [agenda-intelligence-md `AGENTS.md` § Honesty rules](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/AGENTS.md#honesty-rules) |
| Three-value response logic (Answer / Flag-but-don't-use / Stop-and-request) | [global-think-tank-analyst `AGENTS.md` § Three-value response logic](https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main/AGENTS.md#three-value-response-logic) |
| Stop-and-request — explicit triggers | [CA-Caspian `AGENTS.md` § Three-value response logic](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/blob/main/AGENTS.md#three-value-response-logic) (subsection) |
| Linguistic faithfulness | [global-think-tank-analyst `AGENTS.md` § Linguistic faithfulness](https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main/AGENTS.md#linguistic-faithfulness) |
| Geography routing | [agenda-intelligence-md `docs/geography-routing.md`](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/geography-routing.md) |
| Skill packaging convention | [agenda-intelligence-md `AGENTS.md` § Skill packaging convention](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/AGENTS.md#skill-packaging-convention-portfolio-wide) |
| Currency watch (list of fast-moving topics to re-verify) | [CA-Caspian `AGENTS.md` § Currency watch](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/blob/main/AGENTS.md#currency-watch) |
| Currency trigger (policy: when web-search is mandatory) | [CA-Caspian `AGENTS.md` § Currency trigger](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/blob/main/AGENTS.md#currency-trigger) |

Note on `Currency watch` vs `Currency trigger`: these are two distinct things despite the close names. `Currency watch` = list of topics + 90-day refresh discipline. `Currency trigger` = policy stating when verification is required (sanctions, OPEC+, chokepoint events, etc.) and the `[stale-risk: YYYY-MM]` fallback tag when verification is not possible.

## Maturity-framework asymmetry across the portfolio

The four repos do **not** use the same maturity framework. A contributor moving between them will see different vocabulary. This is intentional, not a drift to be reconciled.

| Repo | Framework | Where defined |
|---|---|---|
| `agenda-intelligence-md` (product shell) | Version targets in `ROADMAP.md` | [`ROADMAP.md`](../ROADMAP.md) |
| `global-think-tank-analyst` (method) | Maturity framework: practitioner reviews in `reviews/` | [`AGENTS.md` § Maturity framework and portfolio canon alignment](https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main/AGENTS.md#maturity-framework-and-portfolio-canon-alignment) |
| `central-asia-caspian-…` (vertical) | Bar 1 / Bar 2 (Agent-validated) | [`AGENTS.md` § Definition of done](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill/blob/main/AGENTS.md#definition-of-done) |
| `gulf-middle-east-…` (vertical) | Bar 1 / Bar 2 (Agent-validated) | [`AGENTS.md` § Definition of done](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill/blob/main/AGENTS.md#definition-of-done) |

If you are editing `STATUS.md` in a vertical-specialist repo, the Bar 1 / Bar 2 framework applies. If you are editing positioning in `global-think-tank-analyst`, the practitioner-review framework applies. Do not transplant Bar 1 / Bar 2 terminology into GTTA or into agenda-intelligence-md.
