# Red-team brief — evidence-mode discipline validator

**For:** Codex (coding agent), working directly in this repo.
**Author of brief:** Claude (paired red-team round). Findings below are **tested**, not hypothesized — reproduce them, do not trust them blind.

## What this is (and the honesty boundary)

This is an **agent-validated robustness** round on the load-bearing evidence-discipline validator. It is **NOT** practitioner validation and **NOT** market validation. Per [ADR 0008](../../docs/adr/0008-agent-eval-delta-is-structural-product-validation.md) and the README non-goal "no practitioner-validated benchmark claims": do **not** describe the result of this round as practitioner-validated, do not quote it as customer-grade proof, and do not let a "two AIs agreed" outcome drift into a stronger claim than "structural robustness". Two LLMs share blind spots; this round only hardens declared-structure discipline, it does not establish domain ground-truth.

## Target

- Validator: `check_evidence_mode_discipline` in [src/agenda_intelligence/evidence_mode.py](../../src/agenda_intelligence/evidence_mode.py) (line ~34).
- Contract it claims to enforce (module docstring):
  - `reasoning_only`: no `audit.provenance[]` entry may carry a non-empty `source`.
  - `user_provided` / `mixed`: every provenance entry with `basis == "fact"` must carry a non-empty `source` **or** end its `claim` text with the literal token `[verify]` (case-sensitive).
- Existing fixtures: `tests/fixtures/evidence_mode/{golden,failure}/`. Test runner: `tests/test_evidence_mode_discipline.py`.

## Reproduce these (run first)

```python
# PYTHONPATH=src python3 this
from agenda_intelligence.evidence_mode import check_evidence_mode_discipline as chk

def m(mode, prov):
    return {"meta": {"evidence_mode": mode}, "audit": {"provenance": prov}}

cases = {
  "A_basis_relabel_to_assessment": m("mixed", [{"claim":"OFAC designated Bank XYZ on 2026-01-01.","basis":"assessment"}]),
  "B_empty_provenance_list":        m("mixed", []),
  "C_verify_marker_on_fabrication": m("mixed", [{"claim":"IMO 9999999 was blacklisted by OFAC. [verify]","basis":"fact"}]),
  "D_reasoning_only_fact_in_claim": m("reasoning_only", [{"claim":"OFAC sanctioned Bank XYZ on 2026-01-01.","basis":"fact"}]),
  "E_no_provenance_key":            {"meta":{"evidence_mode":"mixed"},"audit":{}},
  "F_verify_trailing_period":       m("mixed", [{"claim":"Real sourced fact needing review [verify].","basis":"fact"}]),
}
for name, memo in cases.items():
    print(name, chk(memo))
```

Tested result (Claude, on current `main`): A,B,C,D,E → `ok=True`; F → `ok=False`.

## Classification and what to do

Do **not** treat every `ok=True` as a bug to "fix" — most are the threat-model boundary of a structural validator. Classify each, then act:

| Case | Verdict | Action |
|---|---|---|
| **F** trailing punctuation after `[verify]` | **Real false-positive bug.** A legitimately marked claim is rejected. | **Fix the validator.** Tolerate trailing punctuation/whitespace after the marker without letting a mid-sentence `[verify]` pass spuriously. Add F as a new **golden** fixture (must pass). Add a regression unit case. |
| **B / E** `mixed`/`user_provided` with empty or missing `provenance` | **Decision needed.** Is a memo declaring caller-supplied evidence but carrying zero provenance entries a contradiction? | Propose a rule: `mixed`/`user_provided` SHOULD have ≥1 provenance entry, else flag. Weigh false-positive risk on legitimately short memos. If adopted, add golden + failure fixtures. If rejected, document why in the threat model. Your call — record the reasoning. |
| **A / C / D** mislabeled `basis`, fabrication tagged `[verify]`, determinative fact in `reasoning_only` claim text | **Threat-model boundary, NOT a structural-fix target.** The validator checks declared structure; it cannot detect a lying or mislabeling author, and `[verify]` is a human-review flag, not a fabrication detector. | Do **NOT** bolt on NLP/keyword fabrication detection — that would overclaim. Instead **document the boundary** in [docs/threat-model.md](../../docs/threat-model.md) and/or [docs/evidence-modes.md](../../docs/evidence-modes.md): state plainly what the discipline check guarantees and what it explicitly does not (cannot detect mislabeled `basis`, cannot detect fabricated content, `[verify]` only forces review). Optionally add A/C/D as documented "known-bypass" fixtures under a clearly named directory so they are tracked, not silently passing. |

## Meta-finding (flag, do NOT auto-fix this round)

`check_evidence_mode_discipline` is **test-only**: its own docstring says "Not an MCP tool. Not a CLI subcommand yet." It is not wired into `validate_memo` / the MCP server / HTTP API / A2A adapter, so a memo served at runtime is **never** subjected to it. That means the validator guards fixtures, not production output.

Wiring it into runtime changes the behavior of existing endpoints and touches the v1 contract surface — per [AGENTS.md](../../AGENTS.md) change-discipline that is **not** an unprompted additive change. **Do not wire it in this round.** Write a one-paragraph note (in the PR description or a short `docs/adr/` draft stub) stating the gap and the options (post-hoc validator surfaced via existing `validate-memo`, vs. left as eval-only), so the human can decide. Surfacing the decision is the deliverable, not the rewrite.

## Constraints (repo change-discipline)

- **No schema changes.** v1 schema family is frozen ([ADR 0003](../../docs/adr/0003-v1-compatibility-policy.md)). The discipline check is post-hoc and must stay a non-schema validator.
- All new fixtures must stay **schema-valid** (failure fixtures pass `validate_memo` but fail the discipline check — see existing runner).
- Add a `CHANGELOG.md` "Unreleased" entry describing the fix + the documented threat-model boundary.
- Touch no dual-copy path (`src/agenda_intelligence/data/...`) — this validator and its fixtures are not packaged data, so no dual-copy sync needed. Confirm by grep before committing.
- Run `make ci` (lint + typecheck + full suite) green before opening the PR. `black --line-length=120` and `flake8 --max-line-length=120` must pass.

## Falsifiable output Codex must return

1. A verdict table: for A–F, `ok=` observed, classification (BYPASS-boundary / FALSE-POSITIVE / DECISION), action taken.
2. The validator fix for F + regression fixture, with `make ci` green.
3. Threat-model boundary paragraph landed in the docs.
4. The empty-provenance decision (B/E): adopted-with-rule or rejected-with-reason.
5. The meta-finding note for human decision.
6. One PR. Do not merge — leave for human review (this round documents validator guarantees, which is positioning-adjacent).

If F does not reproduce as a false-positive on your checkout, stop and report the divergence rather than inventing a fix.
