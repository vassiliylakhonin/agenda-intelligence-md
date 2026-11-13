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
