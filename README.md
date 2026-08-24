<!-- mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md -->

# Agenda Intelligence MD

Agenda Intelligence MD is a deterministic evidence-packet linter for claim-backed AI output.

Give it claims, the source IDs each claim relies on, optional quotations, and the supplied source text. It returns broken references, quote mismatches, lexical-support gaps, unmatched numbers, claims that negate the source they cite, and the next reviewer actions.

It reports **packet completeness**, not whether a claim is true:

- not a factuality verifier;
- no autonomous live source retrieval;
- no authorization, approval, or compliance decision;
- human review is required for every result.

[![PyPI version](https://img.shields.io/pypi/v/agenda-intelligence-md?style=flat-square)](https://pypi.org/project/agenda-intelligence-md/) [![CI](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml/badge.svg)](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## First run

Run the canonical synthetic packet from a source checkout:

```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
python -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json
```

Expected shape:

```text
packet_status=packet_complete claims=2 sources=1 factuality=not_assessed
  c1: packet_complete (lexical_support=supported, coverage=1.0)
  c2: packet_complete (lexical_support=supported, coverage=1.0)
```

Use JSON for an agent loop or CI pipeline:

```bash
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json --format json
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json --strict
```

`--strict` exits non-zero unless every claim is `packet_complete`.

Review local source files without copying their full text into JSON:

```bash
.venv/bin/agenda-intelligence review examples/evidence-review/manifest.json \
  --out evidence-review.md --strict
```

The manifest keeps claims explicit and points to local UTF-8, Markdown, DOCX,
or PDF sources. Paths are resolved inside the manifest directory. DOCX support
uses the Python standard library; PDF extraction requires
`pip install -e ".[documents]"`. The command makes no network or model call and
does not include source text in its JSON or Markdown result. See
[`docs/evidence-review.md`](docs/evidence-review.md).

Install the pinned release without cloning the source and check your own packet:

```text
pip install "agenda-intelligence-md==1.6.0"
agenda-intelligence check /path/to/evidence-packet.json --strict
```

## The evidence-packet contract

The request has two required collections:

- `claims`: a claim ID, claim text, declared `source_ids`, and optional verbatim quotes;
- `sources`: a source ID and the text supplied by the caller.

Request schema: [`schemas/v1/evidence-packet-request.schema.json`](schemas/v1/evidence-packet-request.schema.json)

Response schema: [`schemas/v1/evidence-packet-response.schema.json`](schemas/v1/evidence-packet-response.schema.json)

Runnable example: [`examples/evidence-packet/request.json`](examples/evidence-packet/request.json)

The response has three packet statuses:

| Status | Meaning |
|---|---|
| `packet_complete` | References resolve and the named source text has strong lexical overlap with the claim. |
| `source_review_required` | References resolve, but lexical support is weak, a numeric value is not present, or the claim and its closest source sentence disagree on negation. |
| `packet_incomplete` | A source is missing, a quote is absent, or the claim has no source reference. |

`factuality_status` is always `not_assessed`. A complete packet can still rely on a wrong, stale, biased, or irrelevant source.

### What term overlap can and cannot see

Lexical support is the share of a claim's content terms that appear in the source it names. That ratio is blind to two things, so both are handled separately.

**Negation is checked.** `not` and `no` are stopwords and never reach the ratio, so "the board approved it" and "the board did not approve it" score the same against the same source. Where a claim and its closest sentence in the cited source disagree on negation or denial, the claim is downgraded to `weak` and carries `lexical_support_polarity_mismatch`. Polarity is read at sentence scope: a negation elsewhere in the same document does not flag an unrelated claim.

**Reversed roles are not checked, and are not claimed to be.** "A approved a facility for B" and "B approved a facility for A" contain the same terms and both score `supported`. Deciding who did what to whom is not something term overlap can do, and no heuristic here pretends otherwise. A reviewer still has to read the sentence. The limit is pinned by a test (`test_polarity_check_does_not_claim_to_catch_reversed_roles`) so it stays visible.

**Unicode text is tokenized, but language understanding is not claimed.**
Cyrillic and Arabic words are no longer discarded, and common English,
Russian, and Arabic negation cues are checked. The deterministic check still
does not resolve morphology, translation, cross-language support, paraphrases,
or semantic roles. Those remain model or reviewer tasks.

## Python API

```python
import json
from pathlib import Path

from agenda_intelligence.services import check_evidence_packet

packet = json.loads(Path("examples/evidence-packet/request.json").read_text())
result = check_evidence_packet(packet)
print(result["response"]["packet_status"])
```

The service layer is stateless. It does not persist packet contents or fetch missing sources.

## What this is

- A small JSON contract for claim-backed AI output.
- A deterministic preflight before human review.
- A CLI and Python service suitable for local and CI use.
- A local-file review adapter that returns a reviewer-facing Markdown or JSON result.
- An inspectable base for domain-specific compatibility profiles.

## What this is not

- A general LLM evaluation platform.
- A GRC, vendor-management, or document-storage system.
- An agent authorization or policy-enforcement layer.
- Legal, compliance, sanctions, financial, investment, insurance, or trading advice.
- Proof that a source or claim is factually correct.

## Why a repo full of markdown?

The repository predates the evidence-packet focus and also packages agent reasoning instructions. Files under `skills/` are executable instructions for compatible agent runtimes, not ordinary prose documentation. They remain available for compatibility, but they are not the primary product interface.

## MCP

The packaged MCP server exposes the same evidence-packet preflight to agent
clients:

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "command": "uvx",
      "args": ["--from", "agenda-intelligence-md", "agenda-intelligence-mcp"]
    }
  }
}
```

Run a focused stdio example against an editable install:

```bash
.venv/bin/python examples/evidence-packet/mcp_client.py \
  --command ".venv/bin/agenda-intelligence-mcp"
```

The example initializes the MCP server, calls `check_evidence_packet` with the
synthetic packet, and prints only the review summary. See
[`examples/evidence-packet/mcp_client.py`](examples/evidence-packet/mcp_client.py)
and [`MCP.md`](MCP.md).

Before using the result for an irreversible or high-stakes action, record the
goal, supplied evidence, suspected unreliable evidence, assumptions, intended
action, and stop/escalation conditions. The tool checks packet structure, not
whether a claim is true or an action is authorized.

Existing MCP tools such as `audit_claims`, `verify_quotes`, `grounded_check`,
and `verify_claims` remain compatible; no tool was removed or renamed.

`pre_action_check` adds a stateless action boundary on top of the existing
claim audit. It returns `continue`, `request_evidence`, `require_approval`, or
`stop` from caller-supplied evidence, risk, policy-check results, and an
optional external approval reference. The caller still authenticates the
actor, stores approvals, enforces the result, and performs the action. The
request and response contracts are
[`pre-action-check-request.schema.json`](schemas/v1/pre-action-check-request.schema.json)
and
[`pre-action-check-response.schema.json`](schemas/v1/pre-action-check-response.schema.json).
Twenty illustrative replay cases are in
[`examples/pre-action-check/replay-cases.json`](examples/pre-action-check/replay-cases.json).

Two authoring tools, `create_brief` and `append_evidence`, let an agent assemble a brief or an evidence pack step by step inside the contract instead of hand-building JSON and validating it afterwards. Both are deterministic and stateless: they validate on every call and return the document to the caller. They do not write files, retrieve sources, draft prose, or assess factual truth, and `append_evidence` never infers a `supported` claim status on its own.

Claude Code plugin installation also remains available:

```text
/plugin marketplace add vassiliylakhonin/agenda-intelligence-md
/plugin install agenda-intelligence@agenda-intelligence
```

## Compatibility profiles and adapters

The strategic-intelligence shell, HTTP API, A2A adapter, Cloudflare Workers, and five domain profiles remain in the repository. They demonstrate how the same service layer can be wrapped for different transports and domains. They are not the default commercial wedge and do not establish product-market fit.

| Compatibility surface | Reference |
|---|---|
| Strategic agenda analysis | [`Agenda-Intelligence.md`](Agenda-Intelligence.md) |
| HTTP API | [`docs/deployment/http-api.md`](docs/deployment/http-api.md) |
| A2A adapter | [`docs/deployment/a2a-adapter.md`](docs/deployment/a2a-adapter.md) |
| Middle Corridor example | [`docs/use-cases/kazakhstan-middle-corridor.md`](docs/use-cases/kazakhstan-middle-corridor.md) |
| CIS secondary-sanctions example | [`docs/use-cases/cis-secondary-sanctions.md`](docs/use-cases/cis-secondary-sanctions.md) |
| Agentic interaction example | [`docs/use-cases/agentic-interaction-trust.md`](docs/use-cases/agentic-interaction-trust.md) |
| Gulf maritime example | [`docs/use-cases/gulf-maritime-exposure.md`](docs/use-cases/gulf-maritime-exposure.md) |
| Kazakhstan market-entry example | [`docs/use-cases/kazakhstan-market-entry-readiness.md`](docs/use-cases/kazakhstan-market-entry-readiness.md) |
| Live A2A demo pack | [`docs/agenstry/demo-pack.md`](docs/agenstry/demo-pack.md) |

The compatibility profiles are evidence-routing examples only. They do not provide legal, compliance, sanctions, financial, investment, insurance, or trading advice. Human review is required before any commercial action.

## Verification Contract

The repository keeps three checks separate:

1. `check` reports packet completeness and lexical-support diagnostics.
2. `grounded-check` performs the older claim-to-corpus lexical diagnostic.
3. `verify-claims` applies declared freshness, authority, independence, jurisdiction, and identifier rules to caller-supplied evidence.

None discovers the right sources for the caller. `verified` in the bounded Claim Verdict contract means the supplied evidence meets that declared contract; it is not absolute truth.

## Schemas

Canonical schemas live under [`schemas/v1/`](schemas/v1/). Packaged copies under `src/agenda_intelligence/data/schemas/v1/` must remain byte-equivalent; CI checks this invariant.

Start with:

- [`evidence-packet-request.schema.json`](schemas/v1/evidence-packet-request.schema.json)
- [`evidence-packet-response.schema.json`](schemas/v1/evidence-packet-response.schema.json)
- [`evidence-review-request.schema.json`](schemas/v1/evidence-review-request.schema.json)
- [`evidence-audit.schema.json`](schemas/v1/evidence-audit.schema.json)
- [`claim-verification-request.schema.json`](schemas/v1/claim-verification-request.schema.json)

The full registry is in [`agent-manifest.json`](agent-manifest.json).

## Before / after and benchmarks

The older agenda-analysis evaluation surface remains available for regression and compatibility work:

- [`examples/before-after/eu-ai-act.md`](examples/before-after/eu-ai-act.md)
- [`examples/before-after/red-sea-shipping.md`](examples/before-after/red-sea-shipping.md)
- [`examples/before-after/sanctions-routing.md`](examples/before-after/sanctions-routing.md)
- [`examples/source-backed/eu-ai-act.md`](examples/source-backed/eu-ai-act.md)

These are evaluation fixtures, not customer evidence or production benchmarks.

## AnalysisBank

[`analysis-bank/`](analysis-bank/) contains compatibility fixtures for reasoning-memory retrieval and failure-pattern regression. It is not part of the primary evidence-packet workflow.

## Status

| Surface | Status |
|---|---|
| Evidence-packet request/response schemas | Implemented |
| `check_evidence_packet` Python service | Implemented |
| `agenda-intelligence check` packet auto-detection | Implemented |
| `agenda-intelligence review` local-file workflow | Implemented for UTF-8, Markdown, DOCX, and optional PDF input |
| Legacy agenda-brief behavior for `check` | Preserved |
| `check_evidence_packet` MCP tool | Implemented |
| Live source discovery | Not implemented |
| Factuality determination | Not implemented by evidence-packet preflight |
| Paying customers or named pilots | None claimed |

Current classification: `portfolio-proof` / `build-to-learn`.

## Documentation

| Topic | File |
|---|---|
| Adoption | [`ADOPTION.md`](ADOPTION.md) |
| Quickstart | [`docs/quickstart.md`](docs/quickstart.md) |
| Evidence audit | [`docs/evidence-audit.md`](docs/evidence-audit.md) |
| Local evidence review | [`docs/evidence-review.md`](docs/evidence-review.md) |
| Factuality boundary | [`docs/factual-verification.md`](docs/factual-verification.md) |
| Evaluation | [`docs/evaluation.md`](docs/evaluation.md) |
| Source policy | [`SOURCE_POLICY.md`](SOURCE_POLICY.md) |
| Security | [`SECURITY.md`](SECURITY.md) |
| Threat model | [`docs/threat-model.md`](docs/threat-model.md) |
| Roadmap | [`ROADMAP.md`](ROADMAP.md) |

## Repository layout

```text
schemas/v1/                    public JSON contracts
src/agenda_intelligence/       Python service and transport adapters
examples/evidence-packet/      canonical packet example
tests/                         contract and regression tests
skills/                        compatibility agent instructions
deploy/cloudflare-worker/      compatibility Worker implementation
docs/                          reference and compatibility documentation
```

## Development

```bash
pip install -e ".[dev]"
make ci
make verification-report
```

`make verify-local` also runs the compatibility Cloudflare Worker tests.
`make verification-report` runs both verification surfaces and writes
`.verification/results.json`: a deterministic, machine-readable record of the
checks and hashed contracts. It uses no paid APIs and deliberately makes no
claim about factual truth, live deployment health, adoption, or market value.

## Roadmap

The next decision is adoption, not another vertical worker: test the evidence-packet contract on redacted practitioner artifacts, measure repeat use, and keep it portfolio-only if no repeated workflow appears. See [`ROADMAP.md`](ROADMAP.md).

## License

[MIT](LICENSE)
