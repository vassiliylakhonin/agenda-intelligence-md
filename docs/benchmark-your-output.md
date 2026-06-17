# Benchmark your own agent output

This repo ships a deterministic, LLM-free way to score **your** agent's
strategic-intelligence output and compare it to a published baseline. If you
build an agent, copilot, or pipeline that emits briefs, this is how you check
whether its output is well-formed, evidence-labeled, and audit-ready — before a
human reviews it.

It does **not** check whether the claims are true. See
[`factual-verification.md`](factual-verification.md) for that boundary. A high
score means a brief is structurally complete and traceable, not that it is
correct in the world.

## What you produce

`bench` reads a directory of cases. Each case is one brief plus optional
evidence and audit files, matched by a shared `<name>` prefix:

| File | Required | Schema | What it is |
|---|---|---|---|
| `<name>.brief.json` | yes | [`agenda-brief.schema.json`](../schemas/v1/agenda-brief.schema.json) | the brief your agent produced |
| `<name>.evidence.json` | optional | [`evidence-pack.schema.json`](../schemas/v1/evidence-pack.schema.json) | the evidence pack the brief draws on |
| `<name>.audit.json` | optional | [`evidence-audit.schema.json`](../schemas/v1/evidence-audit.schema.json) | claim-level audit (claim → evidence ids, support level) |

Copy a shipped case as a template — it has all three files in the layout
`bench` expects:

```
examples/source-backed/eu-ai-act.brief.json
examples/source-backed/eu-ai-act.evidence.json
examples/source-backed/eu-ai-act.audit.json
```

## Run it

```bash
# Put your cases in one directory, then:
agenda-intelligence bench ./my-cases/

# Machine-readable, for CI or a dashboard:
agenda-intelligence bench ./my-cases/ --format json

# Gate: non-zero exit if mean score is below a threshold or any audit ref is orphaned
agenda-intelligence bench ./my-cases/ --strict --min-score 80
```

Single-file checks, if you want to drill into one output:

```bash
agenda-intelligence validate-brief   ./my-cases/case.brief.json
agenda-intelligence score            ./my-cases/case.brief.json --evidence ./my-cases/case.evidence.json
agenda-intelligence audit-claims     ./my-cases/case.audit.json --strict
```

## Read the result

Each row of the `bench` table is one case:

| Column | Meaning |
|---|---|
| `schema` | brief conforms to the brief schema |
| `evidence` | evidence pack conforms (or `n/a` if no evidence file) |
| `audit` | claim-level audit conforms (or `n/a`) |
| `source cat` | the source-requirement category the brief declared |
| `source cov` | % of that category's `must_check` source types covered (diagnostic, not a gate) |
| `gaps` | count of uncovered `must_check` source types |
| `orphans` | audit `evidence_id`s that point at nothing — should be `0` |
| `score` | heuristic structural-completeness score, 0–100 |

The summary footer reports `cases`, `schema-valid %`, `mean score`, `mean
source coverage`, and total `audit orphan refs`.

## Compare to the baseline

The shipped 20-case set is the reference. Reproduce it with:

```bash
agenda-intelligence bench examples/source-backed/
```

| Metric | Baseline |
|---|---|
| Cases | 20 |
| Mean structural-completeness score | 87.6 / 100 |
| Score range | 84–91 |
| Schema-valid | 100% |
| With evidence pack | 100% |
| With claim-level audit | 100% |
| Audit orphan refs | 0 |

Practical reading of your own run:

- **Orphan refs > 0** — your audit cites evidence ids that do not exist. Fix
  first; this is a correctness defect in the output, not a tuning knob.
- **Schema-valid < 100%** — your agent is emitting malformed briefs. The
  validator message names the offending field.
- **Mean score well below ~84** — the briefs are thin on structure, evidence
  labeling, or decision-readiness, not necessarily wrong. Inspect a low row
  with `score <case>.brief.json` to see the per-dimension breakdown.

## Honest limits

- Heuristic score weights are hand-tuned and uncalibrated against expert
  judgment. Do not treat the number as an authoritative quality rating.
- Source coverage is a diagnostic of category `must_check` coverage, not a
  factual-accuracy measure.
- `bench` runs no LLM and makes no outbound requests. It evaluates structure,
  evidence labeling, claim traceability, and decision-readiness signals only.
- The shipped 20 cases use illustrative sources; they are not a live,
  factually verified benchmark.

See [`evaluation.md`](evaluation.md) for the full layer model and
[`rubric.md`](rubric.md) for the scoring dimensions.
