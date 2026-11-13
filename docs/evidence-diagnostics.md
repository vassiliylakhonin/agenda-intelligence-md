# Evidence diagnostics: offsets and explicit arithmetic

These additions apply to the local Python package, CLI, and Python service shell.
They do not deploy or change the hosted Cloudflare Worker. Packet completeness
is not factuality, entailment or permission to act. Human review stays required.

## Exact source coordinates

`evidence-packet-response.schema.json` v1 adds optional `start_char` / `end_char`
fields to each quote check and to `lexical_support`. Coordinates are zero-based
Unicode code points in the original supplied source `text`, end exclusive:
`source_text[start_char:end_char]` in Python. JavaScript consumers must use
`Array.from(sourceText).slice(start_char, end_char).join('')`, not UTF-16 slicing.

- Quote offsets identify the first exact raw occurrence of the declared quote.
- Lexical offsets identify the closest sentence selected by the existing matcher,
  not a proof that the sentence entails the claim.
- Offsets are omitted when normalized, ellipsis or PDF-dehyphenation matching
  cannot map to an exact raw substring. No guessed coordinates or unified diff.
- `review_rag_answer` answer units add the same field names in the original
  answer, retaining `start` / `end` as compatibility aliases. Blank lines, CRLF,
  indentation and non-BMP characters do not change the coordinate system.

## Explicit opt-in derived numbers

To check a calculation, set the packet's
`derived_numbers` to `true` and declare a claim's `derivations`. The checker does
not search for combinations of unrelated numbers to make a claim pass.

```json
{
  "derived_numbers": true,
  "claims": [{
    "claim_id": "total",
    "text": "Revenue north and south total 30 USD.",
    "source_ids": ["ledger"],
    "derivations": [{
      "value": "30",
      "operation": "sum",
      "operands": [
        {"source_id": "ledger", "quote": "Revenue north 10 USD", "value": "10", "unit": "USD"},
        {"source_id": "ledger", "quote": "Revenue south 20 USD", "value": "20", "unit": "USD"}
      ]
    }]
  }],
  "sources": [{"source_id": "ledger", "text": "Revenue north 10 USD. Revenue south 20 USD."}]
}
```

Operations are:

- `sum`: 2-20 operands; `difference`: first minus second.
- `percent_change`: (second - first) / abs(first) * 100, nonzero first operand.
  This can express a declared YoY calculation; the checker does not infer which
  years or entities the operands describe.
- `product`: first times second; `quotient`: first divided by nonzero second.
- `percent`: first / second * 100, nonzero second operand.

Declaration values are bounded plain decimal strings. The source excerpt and
claim can use supported currency/scale spellings, for example `$1.5M` for an
operand declared as `1500000` `USD`. Quotes must still be verbatim in a cited
source. Sum, difference and percentage operations require identical declared
operand units. Product and quotient require `result_unit`: multiplication uses
`left*right`, division `left/right`, equal units divide to `ratio`, and the
literal unit `ratio` is dimensionless. There is no general unit algebra, automatic
operand search, inferred rounding, CAGR, or model call. A repeating decimal
needs review, not a guessed tolerance.

`derivation_checks` retains `status: arithmetic_consistent` for compatibility.
Only an exact successful check adds `derived_verified: true` and `formula`, for
example `((120) - (100)) / abs(100) * 100 = 20`. Invalid/disabled checks do not get
that marker or a formula. The marker means source-backed arithmetic consistency,
not truth or semantic support. A proof can discharge its normalized numeric
result, but cannot clear a table intersection mismatch, increase lexical coverage,
skip polarity/quote/reference checks, or change `factuality_status`. Humans must
check entity, period, units, operand selection and the chosen operation.

## Bounded numeric formatting

The local numeric matcher canonicalizes scales/currencies, supported grouped
number formats, ratios (`50%` equals unitless `0.5`, not `50` or `0.5 USD`), and
quarter forms such as `Q3 2026`, `2026-Q3`, `third quarter 2026`, and
`третий квартал 2026`. It does not parse arbitrary written-out quantities,
exchange currencies, or infer missing units. An ambiguous single separator such
as `1.234` remains a decimal, not an inferred thousands grouping. Unknown units
and unfamiliar language forms may need review. Formatting equivalence is not
semantic equivalence.

## Named table intersections

For rectangular Markdown tables and standalone CSV/TSV, the first row is the
header and the first column is the row label. A claim that literally names a row
and a column has its numbers checked against that intersection, not pooled from
neighbors. For example, `Company A` + `2025` + `500` cannot borrow `500` from
Company B or 2024. Numeric labels themselves are retained as context. Raw CSV uses
the standard-library parser; local file ingestion preserves empty cells and
quoted delimiters rather than shifting values into adjacent columns.

Packet `lexical_support.table_checks` is present only for recognized, explicitly
named intersections. Each entry reports `source_id`, `row`, `column`,
`column_index` (zero-based including the row-label column), `cell`, `status`
(`cell_consistent` or `mismatch`) and `unmatched_numbers`. Conflicting selected
cells/sources remain review findings. `cell_consistent` is numeric consistency
with that supplied cell, not a claim-level truth verdict or original-file byte
coordinates. Other lexical and human-review gates remain.

This is deliberately bounded: one literal row/column selection per numeric
claim works best. Multiple selections in one claim can require review rather
than pooled support. No provenance is asserted for missing labels, ragged tables,
HTML/PDF layout, escaped Markdown pipes, merged cells, multi-level headers or
inferred entity aliases. Absence of `table_checks` means not assessed, not passed.
The hosted JavaScript Worker is unchanged by these local Python additions.

## Opt-in PR summary

The root composite action accepts `pr-comment: 'true'` for evidence `check`.
It creates or updates one bot-owned summary, even when strict checking fails.
It never copies claim/source text, IDs or owner actions into the comment.

```yaml
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: vassiliylakhonin/agenda-intelligence-md@main
        with:
          path: evidence/packet.json
          strict: 'true'
          pr-comment: 'true'
```

Pin a reviewed commit SHA rather than `main` in production. The default token
is `github.token`; an explicit `github-token` may be supplied. Fork PRs and
non-`pull_request` events are skipped. Missing write permission produces a
warning, not a false green check. Do not switch to `pull_request_target` to
bypass fork restrictions. Commenting is off by default and does not grant
repository permissions. It is not enabled automatically in this repository.

## Reproducible diagnostics

See [the small diagnostic suite](../evals/claim_checks/README.md). It reports
catches, misses, false positives and time, including known semantic failures.
There is no LLM-judge comparison and no claim of general hallucination detection.

## Narrow bound-direction and confusable-spelling review

The local Python evidence-packet checker now adds:

- `lexical_support_bound_direction_mismatch`: explicit `at most`/`at least`,
  `no more than`/`no less than`, `не более`/`не менее`, `не больше`/`не меньше`
  changed direction at the same numeric value/unit in the closest local context.
- `lexical_support_confusable_identifier`: a claim/source word has a distinct
  Cyrillic/Latin visual-confusable spelling and one spelling mixes the scripts.
  The bounded character map is `аеорсухіјкмтнв` to `aeopcyxijkmthb` (case-folded).

Both are review warnings, not assertions of falsehood or malicious intent.
No characters are silently replaced to make a claim pass. Identical supplied
mixed-script words do not trigger this mismatch warning. Separate English and
Russian words in bilingual prose are not mixed-script tokens. This is not a full
Unicode confusables scanner or transliteration system; unlisted characters,
whole-script substitutions, zero-width controls and other attacks are outside
this rule. It compares exact normalized spellings, not identities or intent.

Bounds are matched to nearby numeric contexts with a lexical overlap threshold
and a limited English proper-name anchor. A matching bound direction among the
closest sources avoids the direction warning. Missing bounds, different values
or currencies are not inferred into opposites by this rule. Logical entailment,
open/closed interval reasoning, entity resolution, scope, nested negation and
arbitrary inequalities are not implemented. Text beyond these rules may still
require review through existing lexical or numeric checks. Source contradictions
and manipulated sources remain the caller's responsibility.

The additions propagate through `check_evidence_packet`, its CLI and the local
`review_rag_answer` adapter. No new hosted JavaScript capability or deployment is
implied. See the frozen before/after diagnostic reports for the tested scope.
