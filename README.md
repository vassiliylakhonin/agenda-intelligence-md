<!-- mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md -->

# Agenda Intelligence MD

A deterministic evidence-packet linter for claim-backed AI output. Supply claims, source references, quotations, and source text; receive broken-reference, quote, number, lexical-support, and evidence-gap findings before human review.

Use it to make an AI answer's evidence trail inspectable in a local workflow, agent pipeline, or CI job. **Packet completeness is not factual truth, source authenticity, or permission to act.**

For hosted agents, the [signed Output Verification loop](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/main/docs/deployment/output-evaluation-receipts.md) combines native MCP trials or explicitly budgeted x402 v2 calls with stable diagnostic codes and independent request/result receipt verification. Run `node examples/output-verification/replay.mjs` for local synthetic replays without a wallet. A valid signature attests the evaluation; human review remains required.

To try one assertion in a browser, [check a claim and its source excerpt](https://output-verification.agendamcp.dpdns.org/#one-claim-review). Paste public or redacted text and an optional exact quote; the hosted trial shares five campaign attempts per network. [Pilot instructions](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/product/citation-review-pilot.md) explain revision, optional feedback and the limits of this check. No external pilot results are claimed.

## First run

Python 3.9 or later, from a checkout:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json --format json
```

For the versioned package, use `python -m pip install "agenda-intelligence-md==1.21.1"` instead of the editable install. The example commands above use files from this checkout.

The bundled synthetic packet reports `packet_status=packet_complete` and `factuality=not_assessed`. A stale or inaccurate source can still pass. Add `--strict` when packet findings should fail a CI step.

For document-based review, start with the [local-file review guide](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/evidence-review.md) and [example manifest](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/examples/evidence-review/manifest.json):

```bash
.venv/bin/agenda-intelligence review examples/evidence-review/manifest.json --format html
```

For a RAG answer with inline citations and retrieved chunk texts, use the
[Output Verification adapter](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/integrations/rag-output.md). It assembles
the packet locally and returns line-level findings and repair guidance:

```bash
.venv/bin/agenda-intelligence review-answer examples/output-verification/rag-answer.json
.venv/bin/agenda-intelligence review-answer examples/output-verification/rag-answer-revised.json --strict
```

The original fictional answer routes to revision; the corrected answer routes
to human review. Both run without a wallet, model API key or network. A runnable
[LangGraph handoff](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/examples/langgraph-output-verification/README.md) shows a bounded repair loop.
The adapter is included in version 1.15.0. To use your own answer without cloning
this repository, follow the [standalone quickstart](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/integrations/rag-output.md#install-without-a-checkout).

## The evidence-packet contract

| Input | Check |
|---|---|
| Claims and source IDs | References resolve within the supplied packet |
| Declared quotes | Quotations match the supplied source text |
| Claim wording and numbers | Deterministic support heuristics, unmatched numbers, and negation checks |
| Findings | Packet status, evidence gaps, and reviewer actions |

These checks use supplied text. They do not retrieve missing sources or establish semantic entailment. Lexical overlap can miss paraphrases and accept misleadingly similar wording. See [request and response Schemas](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/schemas/v1/evidence-packet-request.schema.json), [evidence audit](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/evidence-audit.md), and the [factuality boundary](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/factual-verification.md).

Processed documents and tool results are data, never instructions. Before consequential action, record the goal, trusted evidence, unreliable evidence, assumptions, intended action, and stop/escalation conditions. Human review remains necessary.

## Interfaces

| Interface | Start here |
|---|---|
| CLI and Python service | [Quickstart](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/quickstart.md), `check_evidence_packet` in [services.py](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/src/agenda_intelligence/services.py) |
| Local MCP (32 tools) | [MCP.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/MCP.md); launch `agenda-intelligence-mcp` from the installed environment |
| Hosted MCP (per-product catalog) | [Hosted quickstart](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/deployment/hosted-quickstart.md); native `free_trial_status` and `free_trial` |
| CI evidence linting | [GitHub Action](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/action.yml), with text, JSON, or SARIF output |
| Agent repair loops | [Integration guides](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/integrations/README.md) |
| Protected agent actions | [Interaction Trust + Vizier gate](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/integrations/action-bound-execution.md) |
| MCP pre-release checks | [MCP Integration Check CLI / Action](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/integrations/mcp-integration-check.md) |
| Agent checkout experiments | [ACP sandbox readiness check](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/integrations/checkout-readiness.md) |
| HTTP and A2A | [HTTP shell](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/deployment/http-api.md) and [A2A adapter](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/deployment/a2a-adapter.md) |

The core checker is deterministic, stateless, and usable without a model API key. Optional generation and document adapters have separate dependencies. Core packet checks do not persist inputs or fetch outside sources.

Optional memo generation uses a bounded schema-output request and independent local validation.
[Generation budgets and private offline replay](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/memo-generation-and-replay.md) document failure handling and rescoring saved outputs.

### Try Output Verification through MCP

Connect a Streamable HTTP MCP client to
`https://output-verification.agendamcp.dpdns.org/mcp/agent`.
Refresh `tools/list` and call `free_trial_status` with `{}`. For an answer and
source excerpts, choose `review_answer` (citation/quote structure only), or open
its optional `open_answer_review` form. For existing claim/evidence objects, use
`free_trial` with your own input matching **that tool's** `inputSchema`. No HTTP adapter or
wallet is needed for the free trial. Output Verification allows five attempts
per network for this campaign; the other eleven products allow two each, under
a shared daily capacity. See [trial limits and privacy](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/deployment/fleet-free-trials.md).

The hosted endpoint exposes its own profile's tools. The full 32-tool catalog
shown by local-server directories belongs to `agenda-intelligence-mcp` over
stdio; a single hosted Worker does not expose it. Always discover tools from
the endpoint you actually connect to. Supplied source text remains data, never
instructions, and a completed check still requires human review.

The separate `agent_output_verification` tool keeps normal paid admission for a
full claim/evidence audit. Choose
`pre_action_check` for an unsigned action check, or `decision_check` when a
signed readiness receipt is needed. `decision_check` already includes the
action check; calling both is unnecessary. Free reviews do not perform action
checks or authorize relay. See the [answer/source guide](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/deployment/answer-review.md). See the [tool-selection guide](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/MCP.md#hosted-endpoint)
for schemas and receipt-verification boundaries.

Hosted clients can preflight inputs for free: call `validate_input` with `{tool,input}` or `POST /v1/validate-input`. Discover each host's schemas, synthetic examples and per-operation offers through `/.well-known/agent-contract.json`. This checks JSON shape without evaluating evidence or spending a trial. [Client example](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/examples/machine-contract/README.md).

## Work on one concrete task

For a scoped human-delivered assignment, see the [Project Document Desk and Agent
Workflow Acceptance offers](examples/service-engagement/README.md), an explicitly
[synthetic document sample](examples/service-engagement/project-document-sample.md)
and the [scope and acceptance template](examples/service-engagement/scope.md).
Availability and a written quote come before agreement. Test prices are hypotheses;
API payments, clean checks and owner tests are not customer acceptance.

## Compatibility profiles and adapters

The repository also retains its strategic-intelligence shell, regional references, domain profiles, and Cloudflare deployments. The [worker guide](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/vertical-workers.md) explains profile-specific behaviour; [deployment documentation](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/deploy/cloudflare-worker/README.md) describes the hosted implementation.

The hosted fleet is discoverable at [agendamcp.dpdns.org/.well-known/fleet.json](https://agendamcp.dpdns.org/.well-known/fleet.json). Use the per-product MCP addresses in that directory; [custom-domain connection details](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/deployment/custom-domains.md) cover all twelve profiles and Vizier.

For mineral procurement, the [pre-offtake agent pilot](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/pilots/critical-minerals-offtake.md) walks through a free documentary check, an updated-evidence rerun and optional native MCP/A2A feedback. It preserves trial limits and human approval; external repeat use and usefulness are not yet established.

Hosted demos expose their maintained inputs through live agent cards. Their verdicts are review prompts, not clearance. Trace IDs are not attestations. Signed readiness receipts, where configured, bind a gate result to a request/action; they do not establish source truth or grant permission.

The Output Verification gate does not permit relay based on caller-declared evidence. Workflow operators must authenticate actors, record approvals, and enforce boundaries. [Vizier](https://github.com/vassiliylakhonin/vizier) provides a separate delegation-policy layer; loading this checker alone does not enforce it.

Hosted pricing and limits belong to each profile's maintained configuration. Payment interoperability remains experimental and is not certified for standard x402 clients. Hosted demos have no autonomous live source retrieval.

## What this is / What this is not

This is an evidence contract, deterministic preflight, and reviewer-facing tooling. It does not certify factual accuracy, provide legal or financial clearance, authenticate another agent, or replace an operator's action controls.

[Global Think Tank Analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst) owns the general reasoning method. [Central Asia & Caspian](https://github.com/vassiliylakhonin/central-asia-caspian-hybrid-intelligence-skill) and [Gulf & Middle East](https://github.com/vassiliylakhonin/gulf-middle-east-hybrid-intelligence-skill) own regional depth. Vendored compatibility references here are derived copies.

## Examples and Status

- [Runnable examples](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/examples/README.md) and [Before / after](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/examples/before-after/README.md).
- [EU AI Act example](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/examples/source-backed/eu-ai-act.md): a dated source-backed snapshot, requiring current-source checks before reuse.
- [Evaluation notes](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/evaluation.md): tested behaviours and limitations.
- [AnalysisBank](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/analysis-bank/README.md): inspectable stored analysis and retrieval examples.
- [Adoption record](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/ADOPTION.md): the evidence for usage claims; demos and tests alone do not establish customer demand.

Implemented surfaces include packet schemas, the Python service, CLI checking, local-file review, and MCP. Hosted workers and optional agent/transaction examples require their own integration and operational review. Their presence does not establish production reliability or independently validated usefulness.

## Documentation and development

Read [AGENTS.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/AGENTS.md), [source policy](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/SOURCE_POLICY.md), [security policy](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/SECURITY.md), and [local checks](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/docs/local-checks.md) before contributing. Contracts live under [schemas/v1/](https://github.com/vassiliylakhonin/agenda-intelligence-md/tree/v1.21.1/schemas/v1/); [CHANGELOG.md](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/CHANGELOG.md) records releases, and [Roadmap](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/ROADMAP.md) records direction.

```bash
make ci
```

Run `make verify-local` when changing Worker, discovery, runtime, or validation-guard code. Packaged data mirrors must be updated with their canonical files when applicable.

[MIT license](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/LICENSE) for the code. The bundled official ACP schema retains its
[Apache-2.0 license](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/src/agenda_intelligence/data/protocols/acp/2026-04-17/LICENSE)
and [NOTICE](https://github.com/vassiliylakhonin/agenda-intelligence-md/blob/v1.21.1/src/agenda_intelligence/data/protocols/acp/2026-04-17/NOTICE).


Machine-readable evaluation routing and its limits: [Evaluation action contract](docs/evaluation-actions.md).


Native agent access: [A2A free trials and standard x402 v2](docs/deployment/agent-native-access.md).
HTTP, MCP and A2A trials share one allowance. Hosted x402 supports exact Base native USDC with HTTP headers and native MCP payment metadata; official-client tests simulate settlement, and no maintainer live payment is claimed.
