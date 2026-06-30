# Product-shell rubric

Ten dimensions plus a six-point human review checklist. This rubric is the structural standard for memos produced through the `analyze` product shell. It complements — does not replace — the deterministic heuristic scorer documented in [`evals/rubric.md`](../evals/rubric.md) (5 weighted dimensions, 0–100 score) and the operational reviewer aid in [`evals/human_checklist.md`](../evals/human_checklist.md).

Use this file when:
- writing or reviewing an `agenda-memo` for product-shell validation;
- judging a candidate eval case for inclusion under `tests/fixtures/evidence_mode/golden/` or `tests/fixtures/evidence_mode/failure/`;
- defining what an "agent-eval delta" actually measures (see [ADR 0008](adr/0008-agent-eval-delta-is-structural-product-validation.md)).

**Not a CI gate in v0.9.** Scores from this rubric are logged as baseline only. Gating happens after calibration in v0.9.x+.

## Minimal CI quality guard

The full rubric is not a CI gate, but a small post-hoc `memo_quality` guard now
checks whether a schema-valid memo is usable as an evidence-readiness artifact.
It rejects common failures that schema validation cannot see:

- approval, clearance, compliance, or "safe to proceed" overreach;
- unknowns or missing evidence that are not surfaced as reader-visible gaps;
- recommended actions that are generic monitoring rather than owner actions;
- `watch_next` items that are not observable indicators;
- source-backed modes that fail evidence-mode discipline.

Golden and failure fixtures live under `tests/fixtures/memo_quality/`. The
current regression set has 4 golden memos and 7 schema-valid failure memos,
registered in `tests/fixtures/memo_quality/manifest.json`. The manifest maps
each fixture to the guardrail it protects, validates against
`schemas/v1/memo-quality-fixture-manifest.schema.json`, and
`memo-quality-bench` rejects missing or unregistered fixtures. Run the batch
gate with:

```bash
agenda-intelligence memo-quality-bench tests/fixtures/memo_quality
```

## Ten dimensions

Each dimension is binary at the case level (passes / does not pass). Aggregation across a case set is left to the eval harness, not prescribed here.

| # | Dimension | Passes when |
|---|---|---|
| 1 | **Decision frame** | The memo names the decision or monitoring question it serves. Generic "situation report" framing without a decision context does not pass. |
| 2 | **Routing** | `meta.modules_used` reflects the geography the request actually concerns. A Kazakhstan request that loaded only `global-think-tank-analyst` (without `central-asia-caspian`) fails this dimension. See [`tests/test_geography_routing.py`](../tests/test_geography_routing.py) for the canonical fixtures. |
| 3 | **Evidence mode** | `meta.evidence_mode` matches what the caller actually provided. `reasoning_only` requires no sources anywhere; `user_provided`/`mixed` require sources or `[verify]` on every fact entry. Enforced by [`check_evidence_mode_discipline`](evidence-modes.md#discipline-rule-post-hoc-not-a-schema-replacement). |
| 4 | **Fact / assessment separation** | Each `audit.provenance[]` entry carries an appropriate `basis` (`fact`, `assessment`, `assumption`, `unknown`). Hedged interpretations are not stated as facts; bare events are not labelled as assessments. |
| 5 | **Mechanism specificity** | The memo describes *how* a risk operates (concrete chain: actor → action → effect), not just *that* something is risky. "Tensions remain elevated" without mechanism does not pass. |
| 6 | **Actor incentives** | Where the analysis turns on a specific actor's choice, the memo states the actor's incentives or constraints. Memos that treat states/firms as black boxes do not pass. |
| 7 | **Watch-next indicators** | `watch_next[]` contains concrete, observable indicators (filings, designations, prices, vessel movements, statutory deadlines). "Monitor closely" without an observable is the canonical failure. |
| 8 | **Source / audit integrity** | Every `audit.provenance[]` `claim` matches a claim actually made in the memo body. Fabricated provenance entries, dangling references, or sourced cells that contradict the body all fail. |
| 9 | **No unsupported determinative claims** | Determinative language on sanctions designations, vessel SDN status, court rulings, regulatory effective dates, or legal/compliance conclusions is either sourced or hedged. Confident phrasing on unverified determinatives fails this dimension. |
| 10 | **Schema validity** | The memo validates against [`schemas/v1/agenda-memo.schema.json`](../schemas/v1/agenda-memo.schema.json) with no extra fields and no missing required fields. |

## Six-point human review checklist

Six gates, all must pass. Sign as `Reviewer / Date` at the bottom of the memo's eval record.

1. **Read the decision frame and re-state it in one sentence.** If you can't, dimension 1 fails.
2. **Open `audit.provenance` and walk every entry against the body.** Each entry should reference a claim you can find verbatim or near-verbatim in the body. Dimensions 4 and 8 live here.
3. **Run `check-memo-quality` and read its output.** Treat any `errors` list as a hard fail for the minimal quality guard. Do not waive.
4. **Spot-check the mechanism.** Pick one risk statement and try to articulate the actor → action → effect chain without re-reading. If you can't, dimensions 5 and 6 fail.
5. **Read `watch_next[]` aloud as monitoring instructions.** If a watch item could not be observed by a desk analyst with public data, it fails dimension 7.
6. **Look for determinative language outside provenance.** Scan body prose for "is sanctioned", "was added to", "enters into force on", "court ruled" without a source or `[verify]`. Any such occurrence fails dimension 9.

## Not in scope

- Factual correctness of cited sources (out of scope for the product shell; see [`docs/factual-verification.md`](factual-verification.md) for the post-v1 layer).
- Writing quality, tone, prose polish — covered by the existing heuristic rubric, not by this one.
- Aggregate benchmark claims. This rubric scores cases, not products.
