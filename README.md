<!-- mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md -->

# Agenda Intelligence MD

A deterministic evidence-packet linter for claim-backed AI output.

It checks whether a claim is supported by the evidence you supply: broken references, mismatched quotations, unmatched numbers, missing evidence, and other evidence-pack integrity problems. It is designed for local workflows, agent pipelines, and CI jobs, and it does not require a model API key.

This project is not a fact-checker for real-world truth, not a source authenticator, and not permission to act. It validates the evidence relationship in the packet you provide.

## Why this exists

When AI systems produce claims, it is often difficult to tell whether the source text actually supports the statement. Agenda Intelligence MD gives you a deterministic check on the evidence trail instead of trusting a model output at face value.

Use it to:

- validate AI-generated claims before publishing or acting on them
- review a RAG answer with inline citations and retrieved snippets
- lint evidence packets in CI or local development
- review supplier or document handoff packages with explicit evidence gaps
- attach output verification to agents and workflows

## What it checks

The core checker validates the supplied packet:

- claims resolve to source IDs that actually exist
- declared quotes match the provided source text
- numbers and wording are consistent with the supplied evidence
- evidence gaps and missing support are surfaced as findings
- packet status is reported in a deterministic way

## What it does not do

Agenda Intelligence MD does not:

- establish factual truth in the world
- verify source authenticity or provenance
- certify that a document is trustworthy or authorized
- grant permission to act or relay a decision
- replace human review for consequential actions

## Choose your starting point

| Use case | Start here | Result |
| --- | --- | --- |
| Try one claim in a browser | [One-claim review](https://output-verification.agendamcp.dpdns.org/#one-claim-review) | Review a single claim and source excerpt in a hosted trial |
| Add evidence checks to Python or CI | [First run](#first-run) | A local deterministic check without a model API key |
| Review a RAG answer or connect an agent | [Interfaces](#interfaces) | Citation repair guidance, MCP tools, and integration examples |
| Prepare a supplier document handover | [Supplier workflow](#prepare-a-supplier-document-handover) | Missing-document and owner follow-up lists for human review |

## First run

Python 3.9 or later. Install the published package without cloning the repository:

```bash
python -m pip install "agenda-intelligence-md==1.24.0"
agenda-intelligence --version
```

Run a self-contained synthetic packet in Python:

```python
from agenda_intelligence.services import check_evidence_packet

packet = {
    "claims": [{
        "claim_id": "demo-claim",
        "text": "The synthetic review covers 12 documents.",
        "source_ids": ["demo-source"],
    }],
    "sources": [{
        "source_id": "demo-source",
        "text": "The synthetic review covers 12 documents.",
    }],
}
result = check_evidence_packet(packet)["response"]
print(result["packet_status"], result["factuality_status"])
```

Expected output:

```text
packet_complete not_assessed
```

This example needs no account, model API key, or network after installation. It checks the supplied evidence relationship, not source authenticity or factual truth.

To run the repository's CLI examples from a source checkout:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json --format json
```

For the published package, use:

```bash
python -m pip install "agenda-intelligence-md==1.24.0"
```

The bundled synthetic packet reports `packet_status=packet_complete` and `factuality=not_assessed`. A stale or inaccurate source can still pass. Add `--strict` when packet findings should fail a check instead of just reporting them.

For document-based review, start with the [local-file review guide](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/evidence-review.md) and [example manifest](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/examples/evidence-review/README.md):

```bash
.venv/bin/agenda-intelligence review examples/evidence-review/manifest.json --format html
```

For a RAG answer with inline citations and retrieved chunk texts, use the [Output Verification adapter](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/integrations/rag-output.md):

```bash
.venv/bin/agenda-intelligence review-answer examples/output-verification/rag-answer.json
.venv/bin/agenda-intelligence review-answer examples/output-verification/rag-answer-revised.json --strict
```

The original fictional answer routes to revision; the corrected answer routes to human review. Both run without a wallet, model API key, or network.

## The evidence-packet contract

| Input | Check |
| --- | --- |
| Claims and source IDs | References resolve within the supplied packet |
| Declared quotes | Quotations match the supplied source text |
| Claim wording and numbers | Deterministic support heuristics, unmatched numbers, and negation checks |
| Findings | Packet status, evidence gaps, and reviewer actions |

These checks use supplied text only. They do not retrieve missing sources or establish semantic entailment. Lexical overlap can miss paraphrases and accept misleadingly similar wording.

See [docs/evaluation.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/evaluation.md) for tested behavior and limitations.

## Interfaces

| Interface | Start here |
| --- | --- |
| CLI and Python service | [Quickstart](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/quickstart.md) and `check_evidence_packet` in [services.py](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/src/agenda_intelligence/services.py) |
| Local MCP | [MCP.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/MCP.md) |
| Hosted MCP | [Hosted quickstart](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/deployment/hosted-quickstart.md) |
| CI evidence linting | [GitHub Action](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/action.yml) |
| Agent repair loops | [Integration guides](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/integrations/README.md) |
| Protected agent actions | [Interaction Trust + Vizier gate](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/integrations/action-bound-execution.md) |
| HTTP and A2A | [HTTP shell](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/deployment/http-api.md) and [A2A adapter](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/deployment/agent-native-access.md) |

The core checker is deterministic, stateless, and usable without a model API key. Optional generation and document adapters have separate dependencies.

## Hosted Output Verification

Connect a Streamable HTTP MCP client to:

```text
https://output-verification.agendamcp.dpdns.org/mcp/agent
```

Refresh `tools/list` and call `free_trial_status` with `{}`. For an answer and source excerpts, choose `review_answer` or the optional `open_answer_review` form. For existing claim/evidence objects, use `free_trial` with your own input matching that tool's schema.

The local server exposes a 32-tool MCP catalog via stdio. The hosted worker exposes a different subset depending on the configured profile. Always discover tools from the endpoint you actually connect to.

## Prepare a supplier document handover

For broader document archives, use the free [Document Archive Review](https://agendamcp.dpdns.org/document-archive) tool. It helps you:

- prepare a supplier or company evidence checklist
- assign owners for missing items
- attach authorized documents and source excerpts
- review extraction warnings and page/paragraph locators
- export a reviewer PDF, ZIP backup, or JSON backup

This hosted workflow is separate from the local Python `review` command. Extraction does not authenticate documents, and complete coverage still requires human review.

See the [workspace guide](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/use-cases/supplier-evidence-desk.md) and the [service-engagement pilot](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/examples/service-engagement/README.md).

## Repository layout

- `src/` — core library and claim/evidence checks
- `examples/` — runnable example packets and integrations
- `docs/` — references, quickstarts, deployment, and integration guides
- `api/` — API-oriented surfaces and interfaces
- `clients/` — client-specific adapters and examples
- `contracts/` — protocol and schema definitions
- `analysis-bank/` — memory cards and retrieval guidance
- `deploy/` — deployment and infra helpers
- `tests/` and `test/` — validation and regression checks

## Examples and status

- [Runnable examples](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/examples/README.md)
- [Before / after evidence examples](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/examples/README.md)
- [EU AI Act example](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/examples/source-backed/eu-ai-act.md)
- [Evaluation notes](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/docs/evaluation.md)
- [AnalysisBank](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/analysis-bank/README.md)
- [Adoption record](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/ADOPTION.md)

## Development and docs

Read:

- [AGENTS.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/AGENTS.md)
- [CONTRIBUTING.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/CONTRIBUTING.md)
- [SOURCE_POLICY.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/SOURCE_POLICY.md)

Common verification command:

```bash
make ci
```

Run `make verify-local` when changing Worker, discovery, runtime, or validation-guard code.

## License

This project is distributed under the [MIT License](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/LICENSE).

The bundled official ACP schema retains its [Apache-2.0 license](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/src/agenda_intelligence/data/protocols/acp/2026-04-17/LICENSE) and [NOTICE](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.2/src/agenda_intelligence/data/protocols/acp/2026-04-17/NOTICE).

## Final note

Agenda Intelligence MD is best thought of as an evidence contract and preflight checker: a way to make AI-supported claims inspectable, before they become operational decisions.

If you want the fastest path in, start with the local Python install and the first-run example above.
