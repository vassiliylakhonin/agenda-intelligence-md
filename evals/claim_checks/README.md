# Small evidence-check diagnostic suite

This is a hand-labelled diagnostic set, not a representative accuracy benchmark.
It contains public-source snapshot checks and labelled synthetic probes. The unpublished
paper and its Annex B text are not distributed. No LLM judge or network call is used.

## Reproduce

```bash
python evals/claim_checks/run.py --repeats 25 --out /tmp/claim-check-results.json
```

The checked-in [results.json](results.json) records the suite SHA-256, package/Python
versions, platform and full-service times (including validation and indexing). One
warm-up per case is excluded. Times vary by machine, input size and corpus.
This is not a 2 ms guarantee or a comparison against another verifier.

## Recorded run

Python 3.12.15; 25 repeats per case; 14 cases.

- Review-needed cases: 6 caught, 2 missed.
- Supported cases: 4 clear, 2 false positives.

| Case | Source kind | Outcome | Median ms | p95 ms |
| --- | --- | --- | ---: | ---: |
| public-growth | public_source | clear | 12.154 | 12.274 |
| public-growth-wrong | public_source_mutation | caught | 12.029 | 12.137 |
| public-tariff-paraphrase | public_source | false_positive | 12.113 | 12.31 |
| public-no-source | public_source_question | caught | 0.374 | 0.418 |
| exact | synthetic | clear | 0.54 | 0.579 |
| negation | synthetic | caught | 0.568 | 0.602 |
| quote-absent | synthetic | caught | 0.756 | 0.815 |
| wrong-entity | synthetic | caught | 0.897 | 0.956 |
| unrelated-number | synthetic | caught | 0.837 | 0.874 |
| decimal | synthetic | clear | 0.729 | 0.767 |
| unicode | synthetic | clear | 0.779 | 0.821 |
| semantic-role-reversal | synthetic | missed | 0.496 | 0.553 |
| semantic-causality | synthetic | missed | 0.501 | 0.546 |
| valid-paraphrase | synthetic | false_positive | 0.484 | 0.521 |

The semantic role reversal and reversed causality pass despite being unsupported.
The tariff paraphrase and a synthetic valid paraphrase are flagged despite human
support. These are known limits, not cases removed to improve a score.

Expected labels mean "needs evidence review" versus "supported by this supplied
excerpt", not truth labels. Public claims are checked against frozen excerpts,
not current live documents. Each case has an annotation or kind in [cases.json](cases.json).
The prior PSD replay used a researcher translation; it is kept private and not
mixed into this public set. A source missing from the packet is a structural gap,
not proof that the claim is false.

Public excerpts come from the [EBRD release](https://www.ebrd.com/home/news-and-events/news/2025/ebrd-and-eu-help-improve-sustainability-of-transportation-throug.html)
and [TITR tariffs page](https://middlecorridor.com/en/for-clients/tariffs).
Snapshots were assembled on 2026-11-12 and the public pages rechecked on 2026-11-13.
EBRD excerpt formatting was normalized in the earlier run (EUR spelling, 2.5).
No unsupported relative-speed, production-accuracy or hallucination-prevention claims.

## Deterministic synthetic mutations

All 32 cases are synthetic: 16 altered claims and 16 paired unchanged controls.
No random sampling, LLM judge, new matching rule or claim about real-world error rates.
The generator applies one declared edit per seed: sign flip, bound-direction swap,
digit transposition, or Cyrillic/Latin homoglyph substitution in a distinct identifier.
The Unicode spelling, not a model judgment, defines identifier equality for this set.
Inequality edits change a constraint, but the two bounds can overlap at equality.

```bash
python evals/claim_checks/mutations.py --check
python evals/claim_checks/mutations.py --out /tmp/mutation-results.json --repeats 25
```

[Generated cases](mutation_cases.json), [generator](mutations.py), [recorded results](mutation_results.json).
Recall = caught / (caught + missed). Precision = caught / (caught + false alarms),
using only the four mutants and four paired identical controls per type. A null
precision means no positive predictions, not perfect or zero precision. These
small, balanced synthetic metrics are not production precision or accuracy.

| Mutation | Caught / altered | Missed | False alarms / controls | Recall | Precision |
| --- | ---: | ---: | ---: | ---: | ---: |
| sign_flip | 4 / 4 | 0 | 0 / 4 | 1.00 | 1.00 |
| bound_direction | 0 / 4 | 4 | 0 / 4 | 0.00 | undefined (no flags) |
| digit_transposition | 4 / 4 | 0 | 0 / 4 | 1.00 | 1.00 |
| homoglyph | 0 / 4 | 4 | 0 / 4 | 0.00 | undefined (no flags) |

Every generated case remains in the report, including failures. Unchanged controls
are intentionally easy exact matches; absence of false alarms here does not show
paraphrase quality. The original 14-case set retains its paraphrase false positives.
Use per-case issues and full-service timing from the JSON, not an aggregate marketing
claim. This change extends the benchmark only; the verifier is unchanged.

## After narrow bound/confusable rules (2026-11-13)

The original reports above are retained unchanged as the before baseline at
commit `4e87ae7`. [Mutation after report](mutation_results_after.json) and
[14-case after report](results_after.json) use the identical frozen case hashes.
Only the local Python evidence-packet checker and RAG adapter gained two narrow
review diagnostics; the hosted JavaScript `review_answer` is unchanged.

| Mutation | Before caught / 4 | After caught / 4 | Controls falsely flagged before / after |
| --- | ---: | ---: | ---: |
| Sign flip | 4 | 4 | 0 / 0 |
| Bound direction | 0 | 4 | 0 / 0 |
| Digit transposition | 4 | 4 | 0 / 0 |
| Mixed-script homoglyph | 0 | 4 | 0 / 0 |

Within this tiny synthetic set, recall is now 4/4 for each type and precision
is 4/(4+0) for each type. This is targeted regression coverage, not a claim that
all inequalities or confusables are handled. The 14-case public/synthetic set
is unchanged: 6 caught, 2 semantic misses, 4 clear, 2 false positives. Its two
paraphrase false positives were not fixed or dropped to improve this result.
No claim of production accuracy, general hallucination prevention or speedup.

The extra unit tests include unchanged mixed identifiers, ordinary bilingual
prose, equivalent upper-bound wording, distinct currencies/numbers, unrelated
entities, multiple clauses, and same-direction supplied sources. Those tests
check the new diagnostic codes, not absence of every older lexical warning.
A valid paraphrase may still require review under existing lexical rules.
