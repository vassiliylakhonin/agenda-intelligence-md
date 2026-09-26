<!-- mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md -->

# Agenda Intelligence MD

**Check whether an AI-generated claim has a usable evidence trail before a person acts on it.** This repository contains a local evidence-packet checker and 12 hosted, domain-specific review demos. It is for analysts, reviewers, and developers who need to see missing sources and unresolved questions rather than receive a false "approved" label.

A typical result says which documents are present, which evidence is missing, what to check next, and whether a human must review it. It does **not** establish that a claim is true or that a trade, payment, or deal is cleared.

[Try the Middle Corridor demo](https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/) · [Try the CIS sanctions demo](https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev/) · [Run the local checker](#try-the-local-checker) · [See all profiles](deploy/cloudflare-worker/)

## Start with a synthetic example

A logistics reviewer has a proposed Aktau-Baku-Poti shipment but only partial counterparty and sanctions evidence. [Middle Corridor Deal-Risk Gate](https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/) flags missing documents and routes the file to human review before signature. Its synthetic example reports `reason_code: escalate_before_signature`, `next_permitted_action: human_review_before_any_action`, and an evidence gap such as `No counterparty registry extract supplied`. These are review prompts, not a compliance verdict.

Open the demo and press **Run a worked example**; no key or checkout is needed for the free sandbox (50 requests/hour). For an API integration, this synthetic A2A v1 request is from the [live agent card](https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json):

```bash
curl -sS 'https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/message/send' \
  -H 'Content-Type: application/json' \
  -H 'A2A-Version: 1.0' \
  -H 'X-Trace-Id: example-trace-001' \
  --data-binary @- <<'JSON'
{
  "jsonrpc": "2.0",
  "id": "example-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "example-msg-1",
      "role": "ROLE_USER",
      "parts": [
        {
          "kind": "data",
          "data": {
            "route": "Aktau — Baku — Poti",
            "cargo": "industrial equipment",
            "counterparties": [
              {
                "role": "forwarder",
                "name": "Example Forwarding",
                "jurisdiction": "KZ"
              }
            ],
            "dated_sources": [
              {
                "id": "mc-1",
                "source_type": "port_operator_notice",
                "title": "Aktau port notice",
                "date": "2026-08-01"
              },
              {
                "id": "mc-2",
                "source_type": "sanctions_list_extract",
                "title": "EU consolidated extract",
                "date": "2026-08-02"
              }
            ],
            "risk_question": "Is this shipment ready for a pre-signature human review?",
            "decision_stage": "pre_signature"
          }
        }
      ]
    }
  }
}
JSON
```

Expect a JSON-RPC task in `TASK_STATE_COMPLETED` with a profile verdict, evidence gaps, `human_review_required`, and the trace ID echoed in task metadata. A completed task means triage ran, **not** that the shipment was approved. The [agent card](https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json) is the maintained source of the example; use it when integrating another profile.

## Which part of this repository do I need?

- **Local evidence review:** supply claims, citations and source text to the CLI, Python API or MCP tool. It checks references, quotes, numbers and lexical support without fetching outside sources. [Request schema](schemas/v1/evidence-packet-request.schema.json) · [Runnable sample](examples/evidence-packet/request.json).
- **Hosted domain triage:** 12 Cloudflare Worker profiles share one implementation but expose different evidence requirements for corridors, sanctions, maritime risk, agent transactions and output review. Start with [Middle Corridor](https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev/) or [CIS Secondary Sanctions](https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev/). Each profile's live card defines its input and API example.
- **Architecture in one line:** one deterministic evidence/checking core, adapters for CLI/Python/MCP, and a shared Cloudflare Worker deployed with profile-specific routing. [Technical docs](docs/quickstart.md).

## Try the local checker

```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
python3 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/agenda-intelligence check examples/evidence-packet/request.json
```

The sample reports `packet_status=packet_complete`, two claims and one source, with `factuality=not_assessed`. Complete means the **supplied packet** passed structural and lexical checks; an inaccurate or stale source could still pass. For JSON output or a failing CI gate, use `--format json` or `--strict`. See [the evidence contract](#the-evidence-packet-contract) below.

## Boundaries and availability

- No autonomous live source retrieval in the hosted fleet. A source can be absent, stale, or wrong. Missing evidence is `UNKNOWN` or a gap, never automatic clearance. Human review is required for high-stakes decisions.
- The hosted response's verdict v1 carries `reason_code`, dated sources (or `as_of: null` when not known), `evidence_gaps`, `next_permitted_action` and `human_review_required`; a `trace_id` helps follow one run. Free-text input is a demo convenience: inferred fields are labelled, not verified facts.
- The free sandbox is limited to 50 requests/hour. Paid terms differ by profile; inspect that profile's landing page and manifest before buying anything. The existing payment integration is **not certified for standard x402 clients** and should not be described as plug-and-play x402.
- This is pre-compliance review support, not legal, sanctions, financial, investment, insurance, trading or factuality advice. [Source policy](SOURCE_POLICY.md) · [Evaluation notes](docs/evaluation.md).

**License:** [MIT](LICENSE). **Questions or pilot discussion:** [open a GitHub issue](https://github.com/vassiliylakhonin/agenda-intelligence-md/issues).

---

## Technical reference

## Core concepts

Agenda Intelligence MD is a deterministic evidence-packet linter for claim-backed AI output.

Give it claims, the source IDs each claim relies on, optional quotations, and the supplied source text. It returns broken references, quote mismatches, lexical-support gaps, unmatched numbers, claims that negate the source they cite, and the next reviewer actions.

It reports **packet completeness**, not whether a claim is true:

- not a factuality verifier;
- no autonomous live source retrieval;
- no authorization, approval, or compliance decision;
- human review is required for every result.

---

## First run (other options)

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

Find where a claim could be supported, before deciding what it cites:

```bash
.venv/bin/agenda-intelligence discover examples/evidence-review/manifest.json
```

`discover` derives literal patterns from each claim — figures and quoted spans
first, then content terms, rarest first — and matches every one against every
source, reporting the line that matched. Nothing is sampled and no model is
called, so it behaves the same on 40 sources and on 4,000. It names the sources
a claim's own figures reach but it does not cite, and the ones it cites where
not one pattern occurs. Candidates are places to look: nothing here verifies a
claim, and a source that supports one in different words does not appear at all.

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
pip install "agenda-intelligence-md==1.12.1"
agenda-intelligence check /path/to/evidence-packet.json --strict
```

Generate an interactive standalone HTML reviewer report from local documents:

```bash
.venv/bin/agenda-intelligence review examples/evidence-review/manifest.json --format html
```

---

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

Numeric support is format-aware but deliberately conservative. Equivalent scaled values, percentages, and common date
forms are compared canonically (`$10M` ↔ `10,000,000 USD`, `62%` ↔ `62 percent`, and `12 May 2024` ↔ `2024-05-12`).
Currency is part of the comparison: `10M USD` does not support `10M EUR`, and the linter performs no currency conversion
or approximate-value inference.

Quote presence remains strict after Unicode, typography, whitespace, ellipsis, soft-hyphen, and PDF line-break
hyphenation normalization. When an otherwise absent quote has a typo-level candidate at 95% similarity or higher,
the quote check may include a bounded `near_miss` diff for the reviewer. It still reports `status: absent` and keeps the
packet incomplete. Candidates whose numeric facts or negation cues differ are not presented as harmless near misses.

### What weighted term overlap can and cannot see

Lexical support is an IDF-weighted share of a claim's content terms that appear in the source it names. Terms that occur
throughout the supplied corpus carry less weight than rare entities, while a single-document packet preserves the original
plain-overlap scale. Corpus text, sentences, numeric facts, and term sets are indexed once per check run and reused across
claims.

**Negation is checked.** `not` and `no` are stopwords and never reach the ratio, so "the board approved it" and "the board did not approve it" score the same against the same source. Where a claim and its closest sentence in the cited source disagree on negation or denial, the claim is downgraded to `weak` and carries `lexical_support_polarity_mismatch`. Polarity is read at sentence scope: a negation elsewhere in the same document does not flag an unrelated claim.

**Reversed roles are not checked, and are not claimed to be.** "A approved a facility for B" and "B approved a facility for A" contain the same terms and both score `supported`. Deciding who did what to whom is not something term overlap can do, and no heuristic here pretends otherwise. A reviewer still has to read the sentence. The limit is pinned by a test (`test_polarity_check_does_not_claim_to_catch_reversed_roles`) so it stays visible.

**Unicode text is tokenized, but language understanding is not claimed.**
Cyrillic and Arabic words are no longer discarded, common Russian and Arabic
function words are excluded from lexical coverage, and common English, Russian,
and Arabic negation cues are checked. A conservative deterministic fold covers
common English plurals/verb suffixes and Russian noun/adjective inflections. It
is not a full morphological analyzer and does not resolve translation,
cross-language support, paraphrases, or semantic roles. Those remain model or
reviewer tasks.

---

## Agent Guardrail & Self-Correction Loop

Validate packets and automatically run agent self-correction feedback loops in LangChain, LlamaIndex, CrewAI, DSPy, or vanilla LLM loops:

```python
from agenda_intelligence.integrations import EvidenceClaim, EvidencePacket, EvidencePacketGuardrail, EvidenceSource

guardrail = EvidencePacketGuardrail(strict=True, max_repair_attempts=2)

# Optional zero-dependency typed input; plain dictionaries remain supported.
packet = EvidencePacket(
    claims=(EvidenceClaim("c1", "The board approved the budget.", ("s1",)),),
    sources=(EvidenceSource("s1", "The board approved the budget after review."),),
)

# Direct check
result = guardrail.check(packet)
if not guardrail.is_complete(result):
    repair_prompt = guardrail.get_repair_prompt(packet_json, result)
    # Provide repair_prompt back to LLM to revise output

# Automated retry loop with custom LLM generation function
final_packet, success, repair_history = guardrail.validate_or_repair(
    packet_json,
    llm_repair_fn=lambda prompt: my_llm_chain.invoke({"prompt": prompt}),
)

# Event-loop pipelines can await check_async(...) or validate_or_repair_async(...).
# LangGraph can use the dependency-free async node returned by:
node = guardrail.as_langgraph_node(packet_key="evidence_packet", result_key="evidence_check")
```

---

## Concurrency & A2A Demos

The repository includes runnable end-to-end demonstrations of the agent-first architecture:

- **Bounded concurrency example ([`examples/infinite-swarm-batch.py`](examples/infinite-swarm-batch.py))**: Sends 250 synthetic requests and reports transport latency and actual task states. It is a load demonstration, not a capacity benchmark or comparison with staff.
- **A2A step-up simulation ([`examples/agent-to-agent-negotiation.py`](examples/agent-to-agent-negotiation.py))**: Demonstrates a synthetic request being stopped until operator-authorization evidence is supplied. No real transaction is authorized.
- **Profile scaffolder ([`scripts/agent-factory.py`](scripts/agent-factory.py))**: Creates starter files for a proposed vertical profile. Generated files are inactive until schemas, implementation, tests, and review are added.

---

## GitHub Action CI Integration

Add deterministic evidence linting to your repository CI workflow (`.github/workflows/evidence-lint.yml`):

```yaml
name: Evidence Lint
on: [push, pull_request]

permissions:
  contents: read
  security-events: write

jobs:
  lint-evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate evidence packet
        uses: vassiliylakhonin/agenda-intelligence-md@main
        with:
          path: 'evidence/packet.json'
          command: 'check'
          format: 'sarif'
          strict: 'true'
```

With `format: sarif`, findings are uploaded to GitHub code scanning and point to the corresponding `claim_id` line in
the packet JSON. `text` and `json` output remain available.

---

## Python API

```python
import json
from pathlib import Path

from agenda_intelligence.services import check_evidence_packet, build_repair_prompt

packet = json.loads(Path("examples/evidence-packet/request.json").read_text())
result = check_evidence_packet(packet)
print(result["response"]["packet_status"])

# Generate actionable markdown repair instructions for an agent
if result["response"]["packet_status"] != "packet_complete":
    prompt = build_repair_prompt(packet, result["response"])
    print(prompt)
```

The service layer is stateless. It does not persist packet contents or fetch missing sources.

---

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

---

## Why a repo full of markdown?

The repository predates the evidence-packet focus and also packages agent reasoning instructions. Files under `skills/` are executable instructions for compatible agent runtimes, not ordinary prose documentation. They remain available for compatibility, but they are not the primary product interface.

---

## MCP

The packaged MCP server exposes the same evidence-packet preflight to agent clients:

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

---

## Compatibility profiles and adapters

The strategic-intelligence shell, HTTP API, A2A adapter, Cloudflare Workers, and five domain profiles remain in the repository. They demonstrate how the same service layer can be wrapped for different transports and domains. They represent active prototypes and technical wedges for vertical domains.

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

---

## Verification Contract

The repository keeps three checks separate:

1. `check` reports packet completeness and lexical-support diagnostics.
2. `grounded-check` performs the older claim-to-corpus lexical diagnostic.
3. `verify-claims` applies declared freshness, authority, independence, jurisdiction, and identifier rules to caller-supplied evidence.

None discovers the right sources for the caller. `verified` in the bounded Claim Verdict contract means the supplied evidence meets that declared contract; it is not absolute truth.

---

## Schemas

Canonical schemas live under [`schemas/v1/`](schemas/v1/). Packaged copies under `src/agenda_intelligence/data/schemas/v1/` must remain byte-equivalent; CI checks this invariant.

Start with:

- [`evidence-packet-request.schema.json`](schemas/v1/evidence-packet-request.schema.json)
- [`evidence-packet-response.schema.json`](schemas/v1/evidence-packet-response.schema.json)
- [`evidence-review-request.schema.json`](schemas/v1/evidence-review-request.schema.json)
- [`evidence-audit.schema.json`](schemas/v1/evidence-audit.schema.json)
- [`claim-verification-request.schema.json`](schemas/v1/claim-verification-request.schema.json)

The full registry is in [`agent-manifest.json`](agent-manifest.json).

---

## Before / after and benchmarks

The older agenda-analysis evaluation surface remains available for regression and compatibility work:

- [`examples/before-after/eu-ai-act.md`](examples/before-after/eu-ai-act.md)
- [`examples/before-after/red-sea-shipping.md`](examples/before-after/red-sea-shipping.md)
- [`examples/before-after/sanctions-routing.md`](examples/before-after/sanctions-routing.md)
- [`examples/source-backed/eu-ai-act.md`](examples/source-backed/eu-ai-act.md)

These are evaluation fixtures, not customer evidence or production benchmarks.

---

## AnalysisBank

[`analysis-bank/`](analysis-bank/) contains compatibility fixtures for reasoning-memory retrieval and failure-pattern regression. It is not part of the primary evidence-packet workflow.

---

## Hosted payment surfaces (experimental)

The hosted profiles expose their own current pricing and free sandbox limits. The integration at `/v1/settle` and the browser corridor screen exist, but do not assume a standard x402 client can complete payment: the integration is not certified for that interoperability. The local evidence-packet checker does not require a wallet. See each profile's live landing page and [the hosted manifest](https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/) for current terms.

## Status

| Surface | Status |
|---|---|
| Evidence-packet request/response schemas | Implemented |
| `check_evidence_packet` Python service | Implemented |
| `agenda-intelligence check` packet auto-detection | Implemented |
| `agenda-intelligence review` local-file workflow | Implemented for UTF-8, Markdown, DOCX, and optional PDF input |
| `agenda-intelligence review --format html` | Implemented (Generative UI) |
| `check_evidence_packet` MCP tool | Implemented |
| AI Fleet (Vertical Workers) | Active (12 profiles deployed on Cloudflare Edge) |
| Interactive Web3 UI (`/corridor-bankability`) | Active (Brave / Web3 Wallet on Base) |
| Payment integration | Experimental; not certified for standard x402 clients |
| Agent Financial Guard | Implemented (Pre-sign transaction firewall for AI agents) |
| M2M Escrow Arbiter & Base Contract | Implemented (Autonomous B2B dispute resolution on Base) |
| Live Source Retrieval | Not configured in the hosted fleet |

Current classification: `Ecosystem Expansion & R&D`.

---

## Documentation

| Topic | File |
|---|---|
| Pitch Deck (12 Slides) | [`docs/pitch/PITCH_DECK.md`](docs/pitch/PITCH_DECK.md) |
| Case Studies | [`docs/pitch/CASE_STUDIES.md`](docs/pitch/CASE_STUDIES.md) |
| Unit Economics | [`docs/pitch/UNIT_ECONOMICS.md`](docs/pitch/UNIT_ECONOMICS.md) |
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

---

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

---

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

---

## Roadmap

The current phase focuses on **Product-Led Growth & Ecosystem Expansion**. 
We are rapidly iterating on Generative UI for interactive evidence dashboards, deploying new vertical AI workers for adjacent domains (e.g., ESG, supply chain), and registering capabilities with agent catalogs (Agenstry).

See [`ROADMAP.md`](ROADMAP.md) for the active expansion initiatives.

---

## License

[MIT](LICENSE)


For explicit Base native-USDC operator review, see [Financial Guard human review](docs/financial-human-review.md). Install the optional `agenda-intelligence-md[reviews]==1.12.1` extra.
