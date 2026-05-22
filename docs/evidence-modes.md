# Evidence modes

Every `agenda-memo` declares one of three `meta.evidence_mode` values. The enum is fixed by [`schemas/agenda-memo.schema.json`](../schemas/agenda-memo.schema.json); the post-hoc discipline rule documented here adds enforceable semantics on top of the schema.

This file is the canonical reference for the product-shell memo contract. The portfolio glossary at [`docs/glossary.md`](glossary.md) describes a four-mode classification used to label *example* memos in the sibling skill repos (`live-source-backed`, `user-provided`, `illustrative`, `reasoning-only`); those are documentation labels, not the schema enum. For the schema, only the three values below are valid.

## The three modes

| Mode | Meaning | Caller responsibility |
|---|---|---|
| `reasoning_only` | No caller-supplied sources. Memo is reasoning-from-context. | None — must not pass sources. |
| `user_provided` | All factual claims must be backed by caller-supplied evidence. | Provide sources for every determinative fact. |
| `mixed` | Some claims are backed by caller-supplied evidence; others are reasoning or explicitly flagged for downstream verification. | Provide sources where available; mark unverifiable determinative facts with `[verify]`. |

There is no fourth mode for "live retrieval" because the product shell does not retrieve. Live retrieval is upstream of `analyze`; the memo reflects what the caller provided.

## Discipline rule (post-hoc, not a schema replacement)

Implemented in [`src/agenda_intelligence/evidence_mode.py`](../src/agenda_intelligence/evidence_mode.py) as `check_evidence_mode_discipline(memo) -> {"ok", "errors"}`. The schema permits `audit.provenance[]` entries with or without a `source` field; this function makes the implicit contract enforceable.

- **`reasoning_only`** — no `audit.provenance[]` entry may carry a non-empty `source`. Carrying a source contradicts the declared mode.
- **`user_provided` and `mixed`** — every provenance entry with `basis: "fact"` must either carry a non-empty `source` string **or** end its `claim` text with the literal token `[verify]` (case-sensitive). Entries with `basis` of `assessment`, `assumption`, or `unknown` are exempt — they are not asserted as factual.

The rule applies uniformly across domains. Sanctions designations, vessel SDN entries, and regulatory effective dates are the categories most likely to be incorrectly stated as bare facts, which is why the fixture set exercises them explicitly — but the rule itself is domain-agnostic.

## Fixtures (5 golden + 5 failure)

Generated deterministically by [`tests/fixtures/evidence_mode/build.py`](../tests/fixtures/evidence_mode/build.py) from a single baseline memo. To regenerate after editing the builder:

```
python3 tests/fixtures/evidence_mode/build.py
```

Each pair holds everything constant except `meta.evidence_mode` and `audit.provenance` so the discipline rule is the only variable under test. The full set is enumerated under [`tests/fixtures/evidence_mode/`](../tests/fixtures/evidence_mode); tests live in [`tests/test_evidence_mode_discipline.py`](../tests/test_evidence_mode_discipline.py).

### Golden (must pass schema and discipline)

| Fixture | Mode | What it demonstrates |
|---|---|---|
| `reasoning-only-clean.json` | `reasoning_only` | Assessment and unknown bases only; no `source` field anywhere. |
| `user-provided-fact-with-source.json` | `user_provided` | Fact provenance entry carries a caller-supplied source string. |
| `mixed-fact-with-verify-marker.json` | `mixed` | One sourced fact plus one `[verify]`-marked fact; both pass. |
| `mixed-vessel-with-source.json` | `mixed` | Vessel SDN claim with caller-supplied source — vessel-domain golden. |
| `user-provided-regulatory-with-verify.json` | `user_provided` | EU CBAM deadline marked `[verify]` — regulatory-domain golden. |

### Failure (must pass schema but fail discipline)

| Fixture | Mode | Why it fails |
|---|---|---|
| `reasoning-only-with-source.json` | `reasoning_only` | Provenance carries a `source` while mode forbids sources. |
| `user-provided-fact-no-source.json` | `user_provided` | Bare fact provenance with neither source nor `[verify]`. |
| `mixed-fact-bare.json` | `mixed` | Vessel SDN designation stated as a bare fact (no source, no `[verify]`). |
| `user-provided-sanctions-bare.json` | `user_provided` | OFAC SDN designation stated as a bare fact — sanctions-domain failure. |
| `mixed-regulatory-bare.json` | `mixed` | EU AI Act effective date stated as a bare fact — regulatory-domain failure. |

## What this is not

- Not a factuality check. The rule cannot tell whether a sourced claim is true; only that the structural discipline is observed.
- Not a schema. The enum stays in `agenda-memo.schema.json`; the rule is post-hoc.
- Not an MCP tool or CLI subcommand. Importable Python function used by tests and (later) the bench and rubric pipelines.
- Not a CI gate in v0.9. Scores from the eval suite are logged as baseline only.
