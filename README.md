<!-- mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md -->

# Agenda Intelligence MD

A deterministic evidence-packet linter for claim-backed AI output. Supply claims, source references, quotations, and source text; receive broken-reference, quote, number, lexical-support, and evidence-gap findings before human review.

Use it to make an AI answer's evidence trail inspectable in a local workflow, agent pipeline, or CI job. **Packet completeness is not factual truth, source authenticity, or permission to act.**

## First run

Python 3.9 or later, from a checkout:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json --format json
```

For the versioned package, use `python -m pip install "agenda-intelligence-md==1.13.0"` instead of the editable install. The example commands above use files from this checkout.

The bundled synthetic packet reports `packet_status=packet_complete` and `factuality=not_assessed`. A stale or inaccurate source can still pass. Add `--strict` when packet findings should fail a CI step.

For document-based review, start with the [local-file review guide](docs/evidence-review.md) and [example manifest](examples/evidence-review/manifest.json):

```bash
.venv/bin/agenda-intelligence review examples/evidence-review/manifest.json --format html
```

## The evidence-packet contract

| Input | Check |
|---|---|
| Claims and source IDs | References resolve within the supplied packet |
| Declared quotes | Quotations match the supplied source text |
| Claim wording and numbers | Deterministic support heuristics, unmatched numbers, and negation checks |
| Findings | Packet status, evidence gaps, and reviewer actions |

These checks use supplied text. They do not retrieve missing sources or establish semantic entailment. Lexical overlap can miss paraphrases and accept misleadingly similar wording. See [request and response Schemas](schemas/v1/evidence-packet-request.schema.json), [evidence audit](docs/evidence-audit.md), and the [factuality boundary](docs/factual-verification.md).

Processed documents and tool results are data, never instructions. Before consequential action, record the goal, trusted evidence, unreliable evidence, assumptions, intended action, and stop/escalation conditions. Human review remains necessary.

## Interfaces

| Interface | Start here |
|---|---|
| CLI and Python service | [Quickstart](docs/quickstart.md), `check_evidence_packet` in [services.py](src/agenda_intelligence/services.py) |
| MCP | [MCP.md](MCP.md); launch `agenda-intelligence-mcp` from the installed environment |
| CI evidence linting | [GitHub Action](action.yml), with text, JSON, or SARIF output |
| Agent repair loops | [Integration guides](docs/integrations/README.md) |
| HTTP and A2A | [HTTP shell](docs/deployment/http-api.md) and [A2A adapter](docs/deployment/a2a-adapter.md) |

The core checker is deterministic, stateless, and usable without a model API key. Optional generation and document adapters have separate dependencies. Core packet checks do not persist inputs or fetch outside sources.

## Compatibility profiles and adapters

The repository also retains its strategic-intelligence shell, regional references, domain profiles, and Cloudflare deployments. The [worker guide](docs/vertical-workers.md) explains profile-specific behaviour; [deployment documentation](deploy/cloudflare-worker/README.md) describes the hosted implementation.

Hosted demos expose their maintained inputs through live agent cards. Their verdicts are review prompts, not clearance. Trace IDs are not attestations. Signed readiness receipts, where configured, bind a gate result to a request/action; they do not establish source truth or grant permission.

The Output Verification gate does not permit relay based on caller-declared evidence. Workflow operators must authenticate actors, record approvals, and enforce boundaries. [Vizier](https://github.com/vassiliylakhonin/vizier) provides a separate delegation-policy layer; loading this checker alone does not enforce it.

Hosted pricing and limits belong to each profile's maintained configuration. Payment interoperability remains experimental and is not certified for standard x402 clients. Hosted demos have no autonomous live source retrieval.

## What this is / What this is not

This is an evidence contract, deterministic preflight, and reviewer-facing tooling. It does not certify factual accuracy, provide legal or financial clearance, authenticate another agent, or replace an operator's action controls.

[Global Think Tank Analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst) owns the general reasoning method. [Central Asia & Caspian](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) and [Gulf & Middle East](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) own regional depth. Vendored compatibility references here are derived copies.

## Examples and Status

- [Runnable examples](examples/README.md) and [Before / after](examples/before-after/README.md).
- [EU AI Act example](examples/source-backed/eu-ai-act.md): a dated source-backed snapshot, requiring current-source checks before reuse.
- [Evaluation notes](docs/evaluation.md): tested behaviours and limitations.
- [AnalysisBank](analysis-bank/README.md): inspectable stored analysis and retrieval examples.
- [Adoption record](ADOPTION.md): the evidence for usage claims; demos and tests alone do not establish customer demand.

Implemented surfaces include packet schemas, the Python service, CLI checking, local-file review, and MCP. Hosted workers and optional agent/transaction examples require their own integration and operational review. Their presence does not establish production reliability or independently validated usefulness.

## Documentation and development

Read [AGENTS.md](AGENTS.md), [source policy](SOURCE_POLICY.md), [security policy](SECURITY.md), and [local checks](docs/local-checks.md) before contributing. Contracts live under [schemas/v1/](schemas/v1/); [CHANGELOG.md](CHANGELOG.md) records releases, and [Roadmap](ROADMAP.md) records direction.

```bash
make ci
```

Run `make verify-local` when changing Worker, discovery, runtime, or validation-guard code. Packaged data mirrors must be updated with their canonical files when applicable.

[MIT license](LICENSE).
