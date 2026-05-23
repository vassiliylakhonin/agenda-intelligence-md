# Threat model

What this toolkit **does** and **does not** catch when used to validate, score, or audit strategic-intelligence agent output.

This document is honest about the gap between structural validation (what `validate-brief`, `validate-evidence`, and `score` actually check) and the broader trust questions a downstream reader cares about. It is not a security threat model in the InfoSec sense; it is an analytical-trust threat model for the validator surface.

Companion to:
- [`AGENTS.md`](../AGENTS.md) — project rules and retrieved-content trust
- [`evals/human_checklist.md`](../evals/human_checklist.md) — manual reviewer pass
- [`evals/rubric.md`](../evals/rubric.md) — scoring rubric
- [`SOURCE_POLICY.md`](../SOURCE_POLICY.md) — source-tiering rules

---

## What the toolkit does catch

These are real, automated checks. If a brief passes, these properties hold:

- **Structural validity.** The brief, evidence pack, memory card, lens manifest, and signal records conform to their JSON schemas (`schemas/v1/*.schema.json`). Missing required fields, wrong types, and extraneous keys are caught.
- **Provenance-tag well-formedness.** Each tagged claim carries a syntactically valid Axis A tag (`[primary]` / `[secondary]` / `[user-provided]` / `[inference]` / `[analyst-judgment]`) and any Axis B tags (`[verify]`, `[stale-risk: YYYY-MM]`) are well-formed.
- **Evidence-pack ↔ brief reference integrity.** Orphan evidence references (citations in the brief with no corresponding entry in the evidence pack) and unreferenced evidence entries are detected by `score` / `evidence-audit`.
- **Mode/structure consistency.** Briefs declared `live-source-backed` are checked against the presence of an attached evidence pack; mode declarations are not silently downgraded.
- **Score arithmetic transparency.** Scores are deterministic functions of structural checks; the rubric is open in `evals/rubric.md` and the scorer is open in `src/agenda_intelligence/`.
- **Schema sync.** `tests/test_schema_sync.py` enforces that the published schemas match the in-code expectations.

If `validate-brief` / `validate-evidence` / `score` pass on a brief, you can rely on these properties without re-checking by hand.

---

## What the toolkit does **not** catch

These are the gaps a reader of a passing brief should still verify themselves. Listed in order of likely operational impact.

### 1. Factual correctness

The toolkit does not verify whether a fact is true. A brief can pass every check while citing a fabricated source URL, misquoting a real source, or asserting numbers that do not appear in the cited document. **Validation says the brief is well-structured; it does not say it is right.**

Mitigation: human review against primary sources; the human checklist's "Sample claim verification" step is the operative control here.

### 2. Semantic provenance correctness

The toolkit checks that a claim carries a syntactically valid provenance tag. It does **not** check that the tag is the **right** tag. A claim tagged `[primary]` may in fact be sourced from a press release that summarises a primary document; a claim tagged `[secondary]` may in fact be the analyst's own judgment with a vaguely related citation appended.

Mitigation: reviewer judgement; spot-checking against cited URLs.

### 3. Source quality

`SOURCE_POLICY.md` defines tiering rules; the toolkit does not currently classify a URL into a tier or refuse a source on quality grounds. A brief built entirely on Tier-3 commentary can pass validation if it is otherwise well-structured.

Mitigation: rubric scoring; reviewer judgement; future work on automated source-tier detection.

### 4. Recency / staleness

`[stale-risk: YYYY-MM]` tags are syntactically validated; their **truth** is not. A claim tagged `[stale-risk: 2025-11]` may in fact be much older or newer. `retrieved_at` timestamps on evidence pack entries are not cross-checked against the actual document.

Mitigation: human reviewer; per-domain refresh discipline in the consuming skill repos.

### 5. Score gaming via stripped unsupported claims

A brief author can construct the evidence pack only from the claims that have sources, hiding analytical leaps elsewhere in the brief. The structural checks will then return `unsupported_claims=0` even though the brief contains assertions that should belong in that bucket. The score will look better, the brief will be less honest.

This pattern is documented as a failure mode in the consuming Global Think Tank Analyst repo ([`evals/failure-modes.md`](https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main/evals/failure-modes.md) #13).

Mitigation: treat the evidence pack as an audit of the **whole** brief, not a curated subset; explicit reviewer pass on unsupported assertions.

### 6. JSON projection dropping load-bearing content

A brief's JSON projection (e.g., `agenda-brief.json`) can pass schema validation and score well while omitting the operationally important parts of the source memo (options, trade-offs, actor-incentive detail, "what would change the judgment"). The structural surface is fine; the projection is not the memo.

Mitigation: always preserve the markdown memo as the canonical artifact; treat the projection as a structural surface for validators, not as the deliverable.

### 7. Prompt-injection inside processed content

`AGENTS.md` declares the retrieved-content trust rule for agents using the toolkit, but the validators themselves do not detect prompt-injection material embedded in evidence-pack `excerpt` fields, `notes` fields, or in the brief's body text. A brief that has absorbed an injected directive (e.g., dropped caveats, inverted a conclusion) can still pass structural validation.

Mitigation: enforce the trust rule at the consuming-agent layer; surface suspected injections in the brief's `data_integrity_notes` field when the analyst or agent notices them.

### 8. Adversarial structural inputs

The validators are not adversarially fuzzed in the current test suite. Behavior on hand-crafted malformed JSON, deeply nested objects, oversized strings, or unicode edge cases is not guaranteed.

Mitigation: future work — fuzz fixtures under `evals/cases/` with paired assertions in `tests/test_validation.py`.

### 9. Cross-brief consistency

Each brief is validated independently. The toolkit does not check whether two briefs from the same agent run contradict each other, share suspicious identical phrasing, or reuse the same evidence pack across unrelated topics.

Mitigation: human reviewer; future work on cross-brief diffing.

### 10. Agent identity and provenance

The toolkit does not verify which agent produced a brief, which model version, which skill repo, or whether the brief was produced by an agent at all (vs hand-written or edited). The `agent-manifest.json` is descriptive, not enforced.

Mitigation: signing or attestation work is out of scope for this version.

---

## Known gaps in the schema surface

Concrete items where the schema set could be tightened without changing the toolkit's scope:

- **No automated data-integrity detection.** The brief schema has `data_integrity_notes` for prompt-injection, source-anomaly, stale/conflicting-source, retrieval-limit, or other integrity observations surfaced by an analyst or agent. Validators check the field shape; they do not detect those risks themselves.
- **No `source-tier` field** on evidence pack entries. Tiering is in `SOURCE_POLICY.md` as a human-applied rule.
- **No `retrieved_at` freshness assertion** beyond presence — no rule that a `live-source-backed` brief with `retrieved_at` older than N months should warn.
- **No cross-claim consistency check** (e.g., two claims with the same `[primary]` source attribution to different facts).

These are candidates for prioritisation, not commitments.

---

## How to read this in practice

When you see a brief that passed `validate-brief`, `validate-evidence`, and `score`:

- **You can trust:** the brief is structurally well-formed, all evidence references are accounted for, provenance tags are syntactically valid, the score is what the rubric computes.
- **You still need to verify:** factual correctness, that tags are semantically right, source quality, recency, that the evidence pack covers the whole brief (not just the source-backed subset), that the projection includes load-bearing content, and that prompt-injection or source-anomaly concerns were actually noticed and handled.

A passing brief is a brief that has passed a structural bar. It is not a brief that has passed a trust bar. The two are different.

---

## Adversarial fixtures in the test suite

Selected gaps from this document are now codified as adversarial fixtures and tests in [`tests/test_validation.py`](../tests/test_validation.py):

- `test_adversarial_prompt_injection_in_watch_next_passes_structural_validation` — gap #7 (prompt-injection in processed content). Fixture: [`adversarial-prompt-injection-in-watch-next.json`](../tests/fixtures/adversarial-prompt-injection-in-watch-next.json).
- `test_adversarial_score_gaming_empty_fields_passes_structural_validation` — gaps #5 (score gaming via empty content) and #2 (semantic provenance correctness). Fixture: [`adversarial-score-gaming-empty-fields.json`](../tests/fixtures/adversarial-score-gaming-empty-fields.json).
- `test_adversarial_injection_in_evidence_source_passes_structural_validation` — gap #7 (prompt-injection in evidence pack source fields). Fixture: [`adversarial-injection-in-evidence-source.json`](../tests/fixtures/adversarial-injection-in-evidence-source.json).

Each test asserts the **current** validator behavior — that these inputs pass structural validation despite being untrustworthy. If detection is added later, the tests will need to be updated alongside the code. This is intentional: it makes the gap visible in CI rather than only in prose.

## Status

This is a description of the current toolkit, not a roadmap. Items in "Known gaps" are observations, not commitments. The Anti-criteria in `AGENTS.md` Definition of Done still apply: do not turn this document into adoption-style language.
