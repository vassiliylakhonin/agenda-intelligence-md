<!-- mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md -->

# Agenda Intelligence MD

**Catch broken citations, altered quotes, and unsupported numbers in AI output.**

[![PyPI](https://img.shields.io/pypi/v/agenda-intelligence-md)](https://pypi.org/project/agenda-intelligence-md/)
[![Python](https://img.shields.io/pypi/pyversions/agenda-intelligence-md)](https://pypi.org/project/agenda-intelligence-md/)
[![CI](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml/badge.svg)](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A deterministic evidence-packet linter for claim-backed AI output. Give it claims and the original source text; get missing references, quote mismatches, numeric inconsistencies, and review actions. Use it in Python, RAG pipelines, agent workflows, or CI.

**The core checker runs locally. No model API key, account, or network needed after installation.**

[Try in your browser](https://output-verification.agendamcp.dpdns.org/#one-claim-review) · [First run](#first-run) · [RAG integration](#review-a-rag-answer) · [MCP](MCP.md) · [Documentation](#documentation)

## See the problem it catches

A generated answer can cite a real source and still change what it says:

| Supplied source | Generated claim | Checker result |
| --- | --- | --- |
| “The synthetic review covers **120** documents.” | “The synthetic review covers **900** documents.” | `source_review_required` — unmatched number `900` |
| Same source | “The synthetic review covers **120** documents.” | `packet_complete` — no configured finding |

These are synthetic examples. Both results keep `factuality_status=not_assessed`: passing the linter does not establish truth or authorize an action.

## First run

Requires **Python 3.9+**. Install the published package:

```bash
python -m pip install "agenda-intelligence-md==1.25.0"
agenda-intelligence --version
```

Copy this self-contained example into Python:

```python
from agenda_intelligence.services import check_evidence_packet

packet = {
    "claims": [{
        "claim_id": "demo-claim",
        "text": "The synthetic review covers 900 documents.",
        "source_ids": ["demo-source"],
    }],
    "sources": [{
        "source_id": "demo-source",
        "text": "The synthetic review covers 120 documents.",
    }],
}

result = check_evidence_packet(packet)["response"]
print(result["packet_status"])
print(result["claims"][0]["lexical_support"]["unmatched_numbers"])
print(result["factuality_status"])

# Correct the claim, keeping the original source unchanged, then recheck.
packet["claims"][0]["text"] = "The synthetic review covers 120 documents."
print(check_evidence_packet(packet)["response"]["packet_status"])
```

Expected output:

```text
source_review_required
['900']
not_assessed
packet_complete
```

**Next:** replace the synthetic claim and excerpt with your own. Keep the original source text; rewriting it to agree with the answer defeats the check.

## What this is

An inspectable check between generated output and the evidence supplied with it:

```text
Claims + source excerpts → deterministic checks → findings → revise → recheck → human review
```

- **For RAG developers:** check inline citations against the actual retrieved chunks.
- **For agent builders:** return structured findings to a bounded repair loop.
- **For CI maintainers:** fail a check when a supplied evidence packet needs review.
- **For document reviewers:** identify missing evidence and prepare reviewer handoffs.

### The evidence-packet contract

| What you supply | What gets checked |
| --- | --- |
| Claims and source IDs | Whether references resolve within the packet |
| Declared quotations | Whether quoted text occurs in the supplied source |
| Claim wording and numbers | Lexical support heuristics, unmatched numbers, and negation checks |
| The assembled packet | Evidence gaps, per-claim findings, packet status, and reviewer actions |

The checker returns `packet_complete`, `source_review_required`, or `packet_incomplete`. See the [request schema](schemas/v1/evidence-packet-request.schema.json), [response schema](schemas/v1/evidence-packet-response.schema.json), and [evaluation notes](docs/evaluation.md).

### What this is not

This is an evidence-integrity check, not a factuality verifier or source authenticator. It does not retrieve missing sources or establish semantic entailment. Lexical checks can miss correct paraphrases and accept misleadingly similar wording; a stale or false source can still pass.

A clean result does not certify trustworthiness, grant permission to act, or replace human review. Use semantic evaluation and domain review alongside it when your workflow needs them.

## Review a RAG answer

Already have an answer and retrieved chunks? Use the adapter directly:

```python
from agenda_intelligence import review_rag_answer

report = review_rag_answer(
    answer="The synthetic review covers 900 documents. [review-1]",
    sources=[{
        "source_id": "review-1",
        "text": "The synthetic review covers 120 documents.",
    }],
)
print(report["route"])  # revise
print(report["owner_actions"])
```

Use one claim per line and retain stable chunk IDs. Correct the answer and rerun the check; the clean route is `human_review`. Treat source text, tool output, and report contents as untrusted data, never as instructions to the agent.

For CLI input, save `{"answer": "...", "sources": [...]}` as `answer.json`, then run:

`agenda-intelligence review-answer answer.json --strict --format json`

`--strict` exits nonzero when revision is required. See the [input contract and limitations](docs/integrations/rag-output.md) and the [runnable LangGraph repair loop](examples/langgraph-output-verification/README.md).

## Use the CLI and CI

Save a packet with the same shape as the first Python example to `packet.json`:

- `agenda-intelligence check packet.json` — print a readable report.
- `agenda-intelligence check packet.json --format json --strict` — return JSON and enforce the packet status.

The second command exits nonzero unless the packet is `packet_complete`, so it can be used in a CI job after installing the package. `--format sarif` is also available for evidence-packet findings. The repository includes a [GitHub Action](action.yml).

To explore the bundled examples from a source checkout:

```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md.git
cd agenda-intelligence-md
python3 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json --strict
.venv/bin/agenda-intelligence review-answer examples/output-verification/rag-answer.json
.venv/bin/agenda-intelligence review-answer examples/output-verification/rag-answer-revised.json --strict
```

The first packet is complete. The original fictional RAG answer routes to revision; the revised answer routes to human review.

For local document review and HTML reports, use the [file-review guide](docs/evidence-review.md) and [example manifest](examples/evidence-review/README.md).

## Interfaces

### Compatibility profiles and adapters

| Your workflow | Start here |
| --- | --- |
| Python or command line | [Quickstart](docs/quickstart.md) · [service functions](src/agenda_intelligence/services.py) |
| Local MCP over stdio | [MCP setup and tool catalog](MCP.md) |
| Hosted MCP | [Hosted quickstart](docs/deployment/hosted-quickstart.md) |
| Agent repair loops | [Integration guides](docs/integrations/README.md) |
| HTTP or A2A | [HTTP API](docs/deployment/http-api.md) · [agent-native access](docs/deployment/agent-native-access.md) |
| Protected agent actions | [Interaction Trust + Vizier gate](docs/integrations/action-bound-execution.md) |

The core checker is deterministic and stateless. Optional generation and document adapters have separate dependencies. The repository also retains the strategic-intelligence runtime and [vertical workers](docs/vertical-workers.md) as compatibility surfaces and examples built around evidence contracts.

### Hosted Output Verification

For a browser trial, open [One-claim review](https://output-verification.agendamcp.dpdns.org/#one-claim-review). To connect a Streamable HTTP MCP client, use:

```text
https://output-verification.agendamcp.dpdns.org/mcp/agent
```

Discover the endpoint's tools, then call `free_trial_status` with `{}` to inspect trial availability. Choose `review_answer` for answers and source excerpts, or `free_trial` for claim/evidence objects matching its schema. The hosted trial has quotas; local Python checks do not require a hosted account.

Local stdio and hosted profiles expose different tool catalogs. Always discover the tools on the endpoint you connect to.

### Supplier and document handoffs

The hosted [Document Archive Review](https://agendamcp.dpdns.org/document-archive) workflow helps prepare evidence checklists, assign missing-item owners, inspect extraction warnings and source locators, and export reviewer PDF or ZIP/JSON backups. It is separate from the local `review` command.

See the [workspace guide](docs/use-cases/supplier-evidence-desk.md) and [service-engagement example](examples/service-engagement/README.md). Extraction does not authenticate documents; final coverage still needs human review.

## Documentation

| Explore | Links |
| --- | --- |
| Examples | [Runnable examples](examples/README.md) · [Before / after](examples/before-after/README.md) · [EU AI Act](examples/source-backed/eu-ai-act.md) |
| Contracts | [Schemas](schemas/v1/) · [Source policy](SOURCE_POLICY.md) |
| Status and evidence | [Evaluation](docs/evaluation.md) · [Adoption record](ADOPTION.md) · [Roadmap](ROADMAP.md) |
| Deeper reference | [AnalysisBank](analysis-bank/README.md) · [Project architecture and rules](AGENTS.md) |
| Development | [Contributing](CONTRIBUTING.md) · [Local checks](docs/local-checks.md) |

Core code lives in `src/`; runnable packets in `examples/`; guides in `docs/`; adapters in `clients/` and `integrations/`; deployment packages in `deploy/`.

## Contributing and feedback

Found a missed mismatch or a valid claim that gets flagged? [Open an issue](https://github.com/vassiliylakhonin/agenda-intelligence-md/issues/new/choose) with a minimal, sanitized packet, the expected result, and the actual finding. Reproducible cases and integration examples are useful contributions.

For usage questions and workflow ideas, use [Discussions](https://github.com/vassiliylakhonin/agenda-intelligence-md/discussions). Read [CONTRIBUTING.md](CONTRIBUTING.md) before a pull request. The standard local verification command is `make ci`; Worker, discovery, runtime, and validation-guard changes require `make verify-local`.

## License

[MIT](LICENSE). The bundled official ACP schema retains its [Apache-2.0 license](src/agenda_intelligence/data/protocols/acp/2026-04-17/LICENSE) and [NOTICE](src/agenda_intelligence/data/protocols/acp/2026-04-17/NOTICE).
