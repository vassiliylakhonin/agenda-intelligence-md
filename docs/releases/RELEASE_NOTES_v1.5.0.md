# v1.5.0 — negation reaches the evidence check

Lexical support is the share of a claim's content terms found in the source it
names. `not` and `no` are stopwords, so they never reached that ratio, and a
claim asserting the exact opposite of its own source came back as a complete
packet. Measured on the previous release:

```
claim  "The EBRD did not approve the loan facility in March 2024."
source "The EBRD approved the loan facility in March 2024."

c2: packet_complete (lexical_support=supported, coverage=0.875)
```

## What changed

- `check_evidence_packet` now compares negation and denial cues between a claim
  and its closest sentence in the cited source. A one-sided cue downgrades
  `supported` to `weak`, adds `lexical_support_polarity_mismatch` to `issues[]`,
  and emits a reviewer action. Both directions are covered: a negated claim
  against a positive source, and a positive claim against a negated one.
- Polarity is read at sentence scope rather than over the multi-sentence excerpt
  window, so a negation elsewhere in the same document does not flag an
  unrelated claim.
- `grounded_check` carried the identical blind spot and gets the same guard,
  downgrading `grounded` to `weakly_grounded`.
- This release also carries the accumulated Worker, A2A and MCP work merged
  since v1.4.0. See CHANGELOG.md for the full list.

## What this release does not do

Reversed subject and object stay out of reach. "A approved a facility for B" and
"B approved a facility for A" share every content term and both still score
`supported`. Term overlap cannot decide who did what to whom, and no heuristic
here pretends otherwise. The limit is documented in README.md and pinned by
`test_polarity_check_does_not_claim_to_catch_reversed_roles`.

The polarity rule is measured only on cases written alongside it. There is no
held-out set, so its behaviour on unfamiliar text is not established. Known
directions of miss: negation carried without a cue word is not detected, and a
cue inside a subordinate clause of the matching sentence can flag a claim that
is in fact supported.

## Compatibility

No schema change. `lexical_support.status` keeps `supported`, `weak`, and
`unsupported`; the new string lands in the existing free-form `issues[]` array.
MCP tool names, required arguments, CLI commands, and service response shapes
are unchanged.

One behaviour change: `agenda-intelligence check --strict` now exits non-zero on
a packet whose claim and source disagree on negation.

## Boundaries

Caller-supplied data only. No retrieval, no factual-truth determination, no
source-authority scoring, no authorization. Human review is required before any
commercial action.

Not legal, compliance, sanctions, financial, investment, insurance, or trading
advice.
