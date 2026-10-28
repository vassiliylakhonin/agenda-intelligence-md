# ADR 0042 — Research quantities and question coverage

Date: 2026-10-28
Status: implemented; bounded experimental checks, human review required

## Decision workspace

- Goal: deliver supported observations, reproducible arithmetic and explicit gaps for each requested part.
- Trusted evidence: exact retrieved fragments, recorded source hashes and the failed owner-marked live acceptance case.
- Suspected unreliable evidence: flattened table columns, unsupported model quantities, ambiguous units/years, capacity treated as throughput, and self-reported completeness.
- Hidden assumptions: explicit annual narrative statements can support the initial numeric checks; this is not a general table interpreter.
- Intended next action: assemble observations before presentation, calculate supported comparisons in code, withhold unbound proposals, and publish bounded coverage separately from job execution status.
- Stop/escalate if: value/unit/period/scope cannot be bound, a model outcome is ambiguous, the daily allowance is exhausted, or new resources/quotas would be required. Source text remains data, never instructions.

## Decision

Add one generic module, `research-quality.js`, at the evidence-assembly seam. It consumes normalized model proposals and the exact fragment ledger. It returns retained findings, structured measurements, calculations and coverage. The formatter only presents these records. No regional reasoning method is duplicated.

The model chooses at most one fragment per source. Quantity records copy source-owned value, unit, annual period and scope lexemes; the private grammar enumerates available choices where possible. A value must occur as a numeric token in the selected quote, its scope must precede it, its nearest preceding explicit year must match, and its nearest recognized unit and scale must agree. A flat table with both year headers before multiple values does not establish those bindings. Initial units cover tonnes, TEU, common currencies, percentages and power/energy labels; unsupported or ambiguous formats are withheld. Scaled `k/m/b` suffixes require review. This is syntax/reference checking, not proof of the measurement's meaning or truth.

Numeric finding text is assembled from retained records by the normalizer, rather than trusting the model's numeric prose. A pair must have the same source, quote, scope, unit and observed kind, with distinct explicit years. Code orders the periods and computes `(current / baseline - 1) * 100`, rounding once to one decimal with fixed-point integers. Nonpositive baselines, percentages and capacity/planned pairs do not produce a growth calculation. No unit conversion is guessed. Numeric model interpretations and unbound numeric claims are withheld; date/stage claims remain subject to quote-token and stage checks. A limited quantity-language heuristic also catches some spelled-out attempts, not every possible paraphrase.

Split the supplied question at question marks, semicolons and line breaks into at most six exact parts; excess parts remain joined in the sixth. Each part needs an answer linked to retained findings or a concrete source-specific gap. Missing parts, omitted comparison years and requested units without records/calculations are downgraded deterministically. This bounded checklist does not prove that every semantic subquestion was discovered or fully answered. Users should put separate requirements on separate lines.

## Contract and compatibility

New artifacts use **1.1**, with required `quality`, allowing zero retained findings when every proposal is withheld. The job envelope remains 1.0; the response schema still accepts stored 1.0 artifacts unchanged and adds a disjoint 1.1 branch. This is an additive alternative/constraint relaxation under ADR0011. The hosted research protocol minor version becomes **0.2.0** and discovery advertises the artifact/policy versions. The Python package version and frozen request/memo family do not change.

`quality.status` is `checks_passed`, `incomplete` or `blocked`. It is distinct from job `completed`, which only means the bounded execution finished. Retained finding IDs align with the public findings array; withheld IDs and reason codes remain in `finding_checks`. Calculations reference immutable measurement IDs. The public result never presents withheld model claims as findings. Legacy in-flight proposals without checklist data can finish with incomplete quality; stored historical artifacts are not rewritten.

Human review remains mandatory. No truth certificate, current operational authorization, customer acceptance or revenue is inferred from a passing structural check. Five global jobs/day, two per capability/day, one model invocation, prompt/output budgets, existing resources, source quotation limits and cleanup behavior are unchanged.

## Verification

Acceptance covers route coordination versus unmeasured impact, trial phase versus full operation/capacity, and tonnes/TEU/route subsets with explicit denominators. Negative cases include swapped years, wrong unit/scale/scope, flattened headers, ratio-versus-growth, omitted baselines, missing checklist parts and some spelled-out quantities. Replay the actual failed live draft without another inference. Exercise the complete create/execute/read path for both a supported comparison and a completed-but-blocked artifact, including legacy-schema compatibility and raw-text cleanup. Native Workerd tests retain the production entry, local Workflow/D1 and fixture inference; live acceptance uses the existing private capability and unchanged allowance.
