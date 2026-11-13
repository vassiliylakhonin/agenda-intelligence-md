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

Default number matching is unchanged. To check a calculation, set the packet's
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

Operations are `sum` (2-20 operands), `difference` (first minus second), and
`percent_change` ((second - first) / abs(first) * 100, nonzero first operand).
Use plain decimal strings, not exponents, thousands separators or inferred
scales. Operands need the same explicit unit, a declared source and a verbatim
excerpt containing the value and unit. The result must occur in the claim.
Decimal equality is exact; no implicit rounding, unit conversion, table parsing
or JSONPath is performed. A repeating percentage needs review rather than a
guessed rounding tolerance.

`derivation_checks` reports `arithmetic_consistent` or `invalid` plus a reason.
A consistent proof can clear only its declared unmatched numeric display; it
does not increase lexical coverage, skip polarity/quote/reference checks, or
turn `factuality_status` into a truth label. Currency/scale spellings that the
existing matcher renders differently may still need review. Invalid or disabled
proofs remain review findings. A human must check entity, period, unit, operand
selection and whether the chosen operation makes sense. This is a deterministic
arithmetic check, not an automatic repair or repeat model call.

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
