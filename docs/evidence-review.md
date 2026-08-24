# Local evidence review

`agenda-intelligence review` loads caller-selected local source files, converts
them to the stable evidence-packet request, runs `check_evidence_packet`, and
renders a reviewer-facing Markdown or JSON result.

It removes source-text copying from the command-line workflow. It does not
extract claims from free prose, retrieve sources, assess source authority, or
verify factual truth.

## Input contract

The manifest follows
[`evidence-review-request.schema.json`](../schemas/v1/evidence-review-request.schema.json).
Claims remain explicit. Each source uses a path relative to the manifest:

```json
{
  "packet_id": "board-review",
  "topic": "Board decision review",
  "claims": [
    {
      "claim_id": "c1",
      "text": "The board approved the project.",
      "source_ids": ["decision"]
    }
  ],
  "sources": [
    {
      "source_id": "decision",
      "title": "Board minutes",
      "path": "sources/board-minutes.docx"
    }
  ]
}
```

An agent can build this manifest after applying the packaged `source-ingest`
skill to the supplied report and sources. Claim extraction is a natural-language
task, so this adapter does not replace it with regular expressions or paragraph
splitting.

## Run

From the manifest directory or any other working directory:

```bash
agenda-intelligence review /path/to/manifest.json --out review.md --strict
agenda-intelligence review /path/to/manifest.json --format json
```

`--strict` exits non-zero unless every claim is `packet_complete`. Markdown
output contains the claim matrix, reviewer actions, source inventory, and
limitations. JSON output uses the existing evidence-packet response contract.
Neither output repeats the source text.

## Supported local files

| Format | Support | Notes |
|---|---|---|
| UTF-8 text, Markdown, RST, CSV, JSON | Built in | Read as text |
| DOCX | Built in | Extracts paragraph and table text from `word/document.xml` |
| PDF | Optional | Install `agenda-intelligence-md[documents]`; extraction quality depends on the PDF text layer |

Source paths must stay inside the manifest directory. Each source is limited to
20 MiB, extracted text to 2,000,000 characters, and PDF input to 500 pages.
These bounds limit accidental resource exhaustion; they are not a malware scan.

## Data handling

The adapter reads local files and calls the local deterministic service. It does
not send source content to a model, API, or network service. The service remains
stateless and does not store the manifest, source text, or result. `--out` writes
only the requested result file.

## Review boundary

- Unicode tokenization covers whitespace-delimited scripts, including Cyrillic
  and Arabic regression cases.
- Common negation cues are checked in English, Russian, and Arabic.
- Morphology, translation, paraphrase entailment, reversed semantic roles,
  source authority, and factual truth remain outside the deterministic check.
- Human review is required for every result, including `packet_complete`.
