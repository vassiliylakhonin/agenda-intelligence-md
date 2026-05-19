# Agenda Intelligence

Agenda Intelligence is the domain of structuring, validating, scoring, and auditing strategic-risk analysis so that analyst-facing agent output is evidence-disciplined and decision-ready without claiming to verify factual truth.

## Language

**Agenda Intelligence MD**:
An evidence and evaluation layer for strategic-intelligence agents that defines reasoning protocols, schemas, scoring, and audit expectations.
_Avoid_: Fact-checker, news crawler, autonomous news agent, agent framework

**Agenda Brief**:
A structured analytical output that states what changed, why it matters, the signal classification, the main uncertainty, and observable watch-next indicators.
_Avoid_: Summary, article, report

**Analytical Memo**:
The canonical human-facing markdown deliverable that preserves the full analysis, trade-offs, actor incentives, and decision implications.
_Avoid_: JSON projection, schema surface, validator input

**Brief Projection**:
The machine-readable Agenda Brief JSON surface used for validation, scoring, benchmarking, and integrations.
_Avoid_: Full memo, canonical deliverable, complete analysis

**Evidence Pack**:
A collection of claim support records that links claims to sources, source limits, freshness, and unsupported claims.
_Avoid_: Bibliography, source list, fact base

**Evidence Mode**:
The provenance label for how evidence was available during the analysis workflow.
_Avoid_: Retrieval capability, source guarantee, factual truth status

**Source Plan**:
A normative checklist of source types required or recommended for a claim category.
_Avoid_: Retrieval result, crawl plan, search query list

**Source Planning Layer**:
The source-plan files and CLI/MCP surfaces that expose required and recommended source types for analysis categories.
_Avoid_: Source acquisition layer, retrieval layer, crawler

**Legacy Manifest Key**:
A public manifest field name kept for compatibility even when the domain term has changed.
_Avoid_: Current domain term, refactor target without migration

**Canonical CLI Command**:
A primary public command name documented as the stable interface for automation and examples.
_Avoid_: Convenience alias, deprecated shortcut

**Convenience Alias**:
A supported shorthand command that maps to a canonical CLI command.
_Avoid_: Canonical command, separate feature

**Source Discipline**:
The policy discipline that determines what evidence is required before making or strengthening a claim.
_Avoid_: Source retrieval, source fetching, citation formatting

**Missing Required Source**:
A source type from a Source Plan that was required or expected but was not available in the evidence pack.
_Avoid_: Schema error, hidden gap, validation failure

**Legacy Fetch Command**:
The pre-v1 CLI command that prints a source plan for `--category` and does not implement brief evidence fetching.
_Avoid_: Retrieval engine, evidence fetcher, crawler

**Evidence Audit**:
A claim-level traceability record that assigns support level, uncertainty, and risk-if-wrong to important claims.
_Avoid_: Fact check, source pack

**Benchmark**:
A deterministic evaluation run that checks protocol conformance, evidence discipline, claim audit coverage, quote presence, and score thresholds across example cases.
_Avoid_: Expert judgment, factual accuracy test, analytical truth benchmark

**Source-Structured Example**:
An example case that includes an agenda brief, evidence pack, and optionally a claim-level evidence audit.
_Avoid_: Live-source-backed example, factual benchmark

**Live-Source-Backed Example**:
An example whose current sources were actually checked during the analysis workflow.
_Avoid_: Illustrative source example, placeholder source example

**Illustrative Source Example**:
An example that uses placeholder or illustrative sources to demonstrate evidence structure rather than live factual support.
_Avoid_: Live-source-backed example, factual benchmark

**Heuristic Score**:
A deterministic score for structure, evidence discipline, and decision-readiness signals.
_Avoid_: Quality score, truth score, expert grade, factual accuracy score

**Score Gate**:
A pragmatic threshold used to catch regressions in structure, evidence discipline, or decision-readiness signals.
_Avoid_: Quality verdict, expert approval, factual correctness gate

**Quote Verification**:
The bounded check that a quoted or excerpted fragment appears in supplied local text or fetched source text.
_Avoid_: Factual verification, fact check, truth test

**Network Quote Verification**:
A bounded quote-verification mode that fetches already-specified source URLs to check whether quoted fragments are present.
_Avoid_: Source retrieval, source discovery, crawler, factual verification

**Claim Support Status**:
The current evidence-pack relationship assigned to a claim, such as supported, partially supported, or unsupported.
_Avoid_: Truth, factual score, binary verdict

**Claim Support Level**:
The current evidence-audit strength assigned to a claim, such as direct, partial, weak, or unsupported.
_Avoid_: Truth, factual score, binary verdict

**Unsupported Claim**:
A claim or intended claim that cannot be backed by the available evidence.
_Avoid_: Error, validation failure, hidden assumption

**Claim Verdict**:
A future claim-assessment result that may distinguish verified, contradicted, partially supported, unresolved, and not verifiable.
_Avoid_: Current schema field, truth, factual score

**Claim Type**:
A stable minimum taxonomy label for the kind of claim being audited.
_Avoid_: Exhaustive ontology, ad hoc tag, sector lens

**Signal**:
A public-agenda development that may require monitoring because it changes leverage, incentives, risk, or decision context.
_Avoid_: News item, update, event

**Signal Tracker**:
A living dated record of how a monitored signal evolves, including status, developments, source notes, and watch indicators.
_Avoid_: Reasoning memory, memo, summary archive

**Signal Classification**:
The analytical category assigned to a development, such as noise, weak signal, signal, structural shift, or trigger event.
_Avoid_: Priority, severity, status

**Signal Marker**:
A practical domain marker assigned to a development, such as compliance-relevant development, enforcement marker, or escalation marker.
_Avoid_: Base signal classification, priority, severity

**Exposure Dimension**:
A dimension of impact such as legal, compliance, reputational, operational, market-access, or financial exposure.
_Avoid_: Signal classification, signal marker

**Watch Indicator**:
An observable future development that would confirm, weaken, falsify, escalate, or resolve an assessment.
_Avoid_: Next step, recommendation, prediction

**Lens**:
A regional or sector-specific analytical frame used to adapt the protocol to a strategic-risk domain.
_Avoid_: Template, prompt, persona

**AnalysisBank**:
A memory layer of reusable reasoning lessons from successful and failed analyses.
_Avoid_: Knowledge base, source archive, transcript store

**Reasoning Memory**:
A compact, reusable lesson about how to reason better in a recurring agenda-analysis situation.
_Avoid_: World fact, source dump, private transcript, legal conclusion

**Authoring Source**:
The top-level human-editable version of a protocol, schema, skill, source policy, or manifest.
_Avoid_: Runtime copy, packaged asset

**Discovery Manifest**:
The manifest that declares which protocols, lenses, schemas, source plans, and package assets are publicly discoverable by CLI and MCP tools.
_Avoid_: Content source of truth, package mirror

**Packaged Mirror**:
The byte-equal runtime copy of an authoring source stored under `src/agenda_intelligence/data` for installed CLI and MCP usage.
_Avoid_: Source of truth, fork, generated variant

**Breaking Change**:
A post-v1.0 change that can invalidate existing documents, break CLI or MCP consumers, or make benchmark scores incomparable without an explicit migration path.
_Avoid_: Refactor, cleanup, terminology fix

## Relationships

- An **Agenda Brief** may be supported by one **Evidence Pack**.
- An **Analytical Memo** may contain or be accompanied by one **Brief Projection**.
- A **Brief Projection** captures the validation surface of an **Analytical Memo**, not necessarily every load-bearing analytical detail.
- An **Evidence Mode** describes the evidence conditions behind an **Agenda Brief** or **Evidence Pack**.
- A **Source Plan** describes what sources an **Evidence Pack** should contain for a category.
- The **Source Planning Layer** exposes **Source Plans** through files, CLI, and MCP surfaces.
- `source_acquisition` is a **Legacy Manifest Key** whose domain meaning is **Source Planning Layer**.
- **Source Discipline** governs when a claim is supported enough to state, weaken, or flag as unsupported.
- A **Missing Required Source** should be disclosed in the evidence pack and reflected in scoring or review.
- The **Legacy Fetch Command** may print a **Source Plan**, but it does not fetch evidence for a brief.
- An **Evidence Audit** traces important claims in an **Agenda Brief** to evidence items.
- A **Benchmark** evaluates whether cases conform to the shipped protocol and evidence expectations.
- A **Source-Structured Example** may be a **Live-Source-Backed Example** or an **Illustrative Source Example** depending on the evidence actually used.
- A **Heuristic Score** may be used inside a **Benchmark** as a transparent gate, but it does not measure analytical truth.
- A **Score Gate** flags cases that need review when their **Heuristic Score** falls below a chosen threshold.
- **Quote Verification** may check whether excerpts referenced by an **Evidence Pack** appear in source text.
- **Network Quote Verification** is a form of **Quote Verification**, not a **Source Plan** executor or retrieval engine.
- A **Claim Support Status** records the relationship between a claim and its evidence without turning the package into a factuality verifier.
- A **Claim Support Level** records evidence strength inside an **Evidence Audit**.
- An **Unsupported Claim** may appear in an **Evidence Pack** as a source-coverage gap or in an **Evidence Audit** as a load-bearing claim gap.
- A **Claim Verdict** is a future layer and should not replace shipped **Claim Support Status** or **Claim Support Level** enums before v1.0.
- A **Claim Type** classifies audited claims without trying to model every strategic-risk domain exhaustively.
- A **Signal** has one **Signal Classification** at a time.
- A **Signal Marker** may express compliance, enforcement, or escalation relevance while temporarily sharing the shipped `signal_classification` schema field.
- An **Exposure Dimension** describes where impact concentrates without becoming the primary **Signal Classification**.
- A **Signal Tracker** records the current state and dated developments of a monitored **Signal**.
- A **Signal** is monitored through one or more **Watch Indicators**.
- A **Lens** adapts **Agenda Intelligence MD** to a region or sector through domain-specific reasoning checks, actor and flow maps, signal markers, anti-patterns, and watch indicators.
- Multiple **Lenses** may be composed when a task has both regional and sector reasoning needs.
- **AnalysisBank** stores **Reasoning Memories** after analyses or failures when the lesson generalizes.
- An **Authoring Source** is copied into exactly one **Packaged Mirror** when the asset must ship inside the Python package.
- The top-level `agent-manifest.json` is the **Discovery Manifest** for public CLI and MCP asset lookup.
- A **Packaged Mirror** must remain byte-equal to its **Authoring Source** unless a future ADR changes the packaging model.
- A **Convenience Alias** maps to a **Canonical CLI Command** and should not gain separate semantics.
- A **Breaking Change** requires a major version or an explicit deprecation path after v1.0.

## Example dialogue

> **Dev:** "Should this tool decide whether the AI Act claim is true?"
> **Domain expert:** "No. It should validate the **Agenda Brief**, inspect the **Evidence Pack**, run bounded **Quote Verification** where possible, and make unsupported claims visible. Truth verification remains outside **Agenda Intelligence MD** through v1.0."

## Flagged ambiguities

- "score" means a heuristic structural and evidence-discipline score, not an expert-calibrated factual accuracy score.
- "verify" means checking quote or fragment presence in supplied or fetched text, not verifying that the claim is true in the world.
- The markdown **Analytical Memo** is the canonical human deliverable; the JSON **Brief Projection** is the validator and integration surface.
- `support_status` and `support_level` are related but distinct shipped schema terms; do not collapse or rename them before v1.0.
- `unsupported_claims` in **Evidence Pack** and **Evidence Audit** share the **Unsupported Claim** concept but may differ in granularity; keep them semantically aligned, not necessarily byte-identical.
- **Evidence Audit** is a stable schema contract for claim traceability, not a factual truthfulness layer.
- `claim_type` is a stable minimum taxonomy: add real case-derived enum values when needed, but do not remove or rename existing values before v1.0.
- A **Lens** is a portable reasoning layer, not a **Source Plan**, schema contract, or output template; default output blocks are examples, not the reason the lens exists.
- Choose **Lenses** by reasoning need and **Source Plans** by evidence need; one task may use regional plus sector lenses and one primary source plan with optional secondary plans.
- A claim should not be reduced to binary true/false; if stronger assessment is added after v1.0, model it as **Claim Verdict** rather than overloading current schema fields.
- Top-level protocol, schema, skill, source-policy, and manifest files are the **Authoring Source**; files under `src/agenda_intelligence/data` are **Packaged Mirrors** for runtime access.
- `noise`, `weak_signal`, `signal`, `structural_shift`, and `trigger_event` are base **Signal Classification** values; `compliance_relevant_development`, `enforcement_marker`, and `escalation_marker` are **Signal Marker** values that remain in the same enum for v1.0 compatibility.
- When a **Signal Marker** value is used in the shipped `signal_classification` field, the base signal-strength classification is implicit or must be stated in prose; preserve this compatibility trade-off before v1.0.
- Reputational risk is an **Exposure Dimension**, not a shipped `signal_classification` enum value before v1.0.
- `source-requirements` files define **Source Plans**; they specify required source types but do not make Agenda Intelligence MD a retrieval engine before v1.0.
- Use **Source Planning Layer**, not "source acquisition layer", for the shipped source-plan capability before v1.0.
- Do not rename the `source_acquisition` manifest key before v1.0; treat it as a compatibility wire name.
- **AnalysisBank** must not store stale-prone world facts such as claims about a specific company, route, or enforcement state; store those in source-backed examples, evidence packs, or signal trackers instead.
- **Signal Tracker** files belong in `signal-trackers/`; when a signal resolves, distill a separate **Reasoning Memory** into `analysis-bank/`.
- **Benchmark** results must not be presented as proof of analytical correctness or factual truth; expert review and LLM-judge review are optional layers outside deterministic baseline numbers.
- The historical `examples/source-backed/` directory contains **Source-Structured Examples**; do not imply every case is live-source-backed unless its evidence was actually checked.
- **Illustrative Source Examples** should not use `live_source_backed`; use `user_provided` or `mixed` unless current sources were actually checked during the analysis workflow.
- The public CLI command remains `score` before v1.0, but product language should call the result a **Heuristic Score** or protocol score, not a quality score.
- `--min-score` is a **Score Gate** for regression detection and diagnostic review, not a pass/fail judgment on analytical quality.
- After v1.0, removing enum values, renaming required fields, changing MCP tool names or signatures, changing score semantics, or moving runtime asset paths without compatibility is a **Breaking Change**.
- If an asset is not listed in the **Discovery Manifest**, CLI and MCP tools should not treat it as a public runtime asset even if the file exists in the repository.
- `validate-brief`, `validate-evidence`, and `score` are **Canonical CLI Commands**; `check`, `audit`, and `eval` are **Convenience Aliases** that remain supported but should not be the primary documented surface.
- `live_source_backed` means current sources were checked during the analysis workflow, not necessarily by Agenda Intelligence MD itself.
- A brief/evidence-pack **Evidence Mode** mismatch is a warning, not a schema failure; align modes in simple cases and use `mixed` when the brief relies on evidence beyond the pack.
- `verify-quotes --fetch` performs **Network Quote Verification** against already-specified URLs; it does not discover sources or verify claim truth.
- `fetch --category` is a **Legacy Fetch Command** alias for printing a **Source Plan**; `fetch --brief` is not implemented before v1.0.
- Missing `must_check` source types are **Missing Required Sources**; they should not make `validate-evidence` fail before v1.0 unless an explicit future strict source-plan gate is used.
