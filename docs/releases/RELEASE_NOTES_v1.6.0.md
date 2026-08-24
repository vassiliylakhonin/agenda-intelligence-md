# v1.6.0 — local evidence review from real files

Agenda Intelligence can now review an evidence packet whose sources are local
files instead of copied JSON strings.

```bash
agenda-intelligence review manifest.json --out evidence-review.md --strict
```

The manifest names explicit claims and points to UTF-8, Markdown, DOCX, or
optional PDF sources. The command extracts bounded text, runs the deterministic
evidence-packet checks, and writes Markdown or JSON for a reviewer. It does not
repeat full source text in the output.

## What changed

- `agenda-intelligence review <manifest>` adds the local-file workflow.
- `evidence-review-request.schema.json` defines the manifest contract.
- File paths stay inside the manifest directory. Individual file size,
  extracted text, and PDF page count are capped.
- Unicode tokenization retains Cyrillic and Arabic words and preserves numeric
  percentages.
- Common English, Russian, and Arabic negation cues reach the polarity check.
- The optional `documents` extra installs PDF extraction support:
  `pip install "agenda-intelligence-md[documents]==1.6.0"`.

The release also carries the Worker, agent-card, MCP, telemetry, and packaged
skill fixes listed in `CHANGELOG.md` since v1.5.0. Cloudflare Workers now report
the same 1.6.0 version as the Python package.

## Compatibility

The new manifest schema and CLI command are additive. Existing v1 request and
memo schemas, service response shapes, MCP tool names, HTTP routes, and A2A
profiles are unchanged.

Cloudflare Workers do not expose `agenda-intelligence review`: they cannot read
files on the caller's machine, and this release does not add a document-upload
endpoint. The command runs locally through the Python package.

## Boundaries

The deterministic check reports packet completeness, quote mismatches, lexical
support gaps, numeric mismatches, and polarity conflicts. It does not extract
claims automatically, translate text, resolve semantic roles, discover sources,
or determine whether a claim is true. Human review remains required.

Not legal, compliance, sanctions, financial, investment, insurance, or trading
advice.
