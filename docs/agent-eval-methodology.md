# Agent-eval methodology

Validation framework for an agent-first product, replacing the older "domain practitioner reviews a memo" pattern (Bar 2.2 / B2.3 in the skill-repo Definitions of Done as originally written; the human-review framing now lives in B2.8 — audience-gated practitioner review).

## Why this exists

The original Bar 2 in `global-think-tank-analyst`, `central-asia-caspian-hybrid-intelligence-skill`, and `gulf-middle-east-hybrid-intelligence-skill` required external human review by a domain practitioner (sanctions desk, compliance lead, analyst). That framing was correct when the consumer was a human reading memos.

Since `agenda-intelligence-md` v0.8.0 the primary consumer is an **agent** (Claude Desktop, Cursor, custom MCP client). The honest validation question is no longer "would a sanctions expert label this useful?" but "does the MCP layer materially change what an agent produces on the same question?"

This document defines that test. It does not replace domain review when the downstream audience is compliance / risk leadership; it replaces it when the downstream audience is agent integrators and AI builders.

## What this is not

- Not a benchmark. Per-case scores do not aggregate into an accuracy claim.
- Not factuality verification. Structural test only.
- Not a substitute for human review when buying-side trust requires expert attribution.
- Not a comparison of model quality. Same model in both conditions.

## Setup

For each agent-eval case:

- **Model.** Pick one model (Claude Sonnet 4.7, GPT-5, etc.) and use the same model in both conditions. Document the model and date.
- **Question.** Pull from the skill's existing `examples/` folder, ideally a `live-source-backed` or `user-provided` case so the question is already framed.
- **Evidence mode.** Map the source-evidence mode of the example to one of the three `evidence_mode` values that `agenda-request.schema.json` accepts: `reasoning_only`, `user_provided`, or `mixed`. **Live-source-backed examples** map to `user_provided` (when the upstream-checked sources are passed into the request) or `mixed` (when the agent also reasons from internal knowledge). `live_source_backed` is **intentionally absent** from the request schema because live retrieval is not implemented inside Agenda Intelligence; the live-source-backed framing applies upstream (in the skill repo's analysis workflow), not inside `analyze`. Record the mapping decision in the eval file under **Evidence mode** so the reader can see the upstream framing without expecting Agenda Intelligence to have fetched anything.

## Procedure

Two conditions, same question, same model:

### Condition A — Baseline

1. Open a fresh agent session with no MCP servers attached.
2. Paste the question with a minimal "be concise and decision-useful" prompt.
3. Capture the full response verbatim.

### Condition B — MCP-attached

1. Open a fresh agent session with the Agenda Intelligence MCP server attached.
2. Paste the same question, instructing the agent to call `analyze` with the question and any geography / depth / evidence_mode fields available.
3. Capture the full memo returned by `analyze`, plus any agent commentary.

## Scoring rubric — 8 binary criteria

Score each output (A and B) yes / partial / no. Partial = 0.5.

1. **Fact / assessment / assumption / unknown separation.** Are these four categories present and clearly labeled?
2. **Provenance discipline.** Are factual claims attributed (fact / assessment / assumption / unknown)? In source-backed cases, are citations distinguished from inferences?
3. **Decision frame present.** Is the underlying decision named, not just the topic?
4. **Scenarios with probability ranges.** Are alternative outcomes named with quantified uncertainty (numeric or labelled range), not just "tensions remain elevated"?
5. **Options with explicit trade-offs.** Are there at least two distinct paths with pros, cons, and a stated trade-off?
6. **Failure modes with likelihood and impact.** Are downside scenarios named with their likelihood and impact, plus a mitigation?
7. **Watch-next indicators with triggers.** Are the things to watch concrete (named indicator) and falsifiable (named trigger)?
8. **Honest scope.** Are limits stated (no live retrieval, no legal advice, unknowns flagged)? Does the output avoid confident framing for inferences?

Total: 0 – 8. Delta = score(B) – score(A).

## Output format

One markdown file per case at `evals/agent-eval/<case-id>.md`, structured:

```markdown
# Agent-eval: <case-id>

- **Question:** <verbatim>
- **Model:** <name + version>
- **Date:** YYYY-MM-DD
- **Evidence mode:** reasoning_only | user_provided | mixed
- **Skill under test:** <e.g., central-asia-caspian-hybrid-intelligence-skill>

## Condition A — Baseline (no MCP)

<full response, or first ~800 chars + "[truncated; full text at evals/agent-eval/<id>-A.txt]">

## Condition B — Agenda Intelligence MCP attached

<full memo, or first ~800 chars + "[truncated; full text at evals/agent-eval/<id>-B.txt]">

## Scoring

| Criterion | A | B |
|---|---|---|
| Fact / assessment / assumption / unknown separation | 0/0.5/1 | 0/0.5/1 |
| Provenance discipline | | |
| Decision frame present | | |
| Scenarios with probability ranges | | |
| Options with explicit trade-offs | | |
| Failure modes with likelihood and impact | | |
| Watch-next indicators with triggers | | |
| Honest scope | | |
| **Total** | **n/8** | **n/8** |

**Delta:** +X.

## Observations

1–2 paragraphs: where the MCP materially changed the shape of the output, where it didn't, what surprised you. Honest about cases where the delta was small.

## Limitations

- One model, one prompt run. Not statistically significant.
- The MCP integration adds structure; it does not improve factual recall.
- Self-scored by the author. Not an external review.
```

## Bar replacement language for skill-repo AGENTS.md

The vertical skill repos (CA-Caspian, Gulf+ME) replace the human-review B2.2 with this agent-eval criterion, plus a sibling B2.3 that exercises the evidence-mode mapping through `analyze` and a B2.7 honesty-discipline rule:

> **B2.2 — Agent-eval delta documented.** At least three agent-evals committed under `evals/agent-eval/` per the methodology above. Each case runs the same model on the same question with and without the Agenda Intelligence MCP server or product shell loaded with the regional specialist, then scores both outputs against the structural rubric tied to `agenda-memo.schema.json`. Self-scored by the author; aggregate scores are not claimed. Cases must include the model, date, full prompts or enough prompt text to reproduce, both outputs or excerpts, and a delta + observations section.
>
> **B2.3 — Evidence-mode mapping exercised.** At least one agent-eval demonstrates how source-backed specialist work is passed into Agenda Intelligence MD's `analyze` contract as `user_provided` or `mixed`, not as `live_source_backed`. This proves the specialist evidence vocabulary does not break the product-shell schema.
>
> **B2.7 — Agent-eval honesty discipline.** Agent-eval writeups explicitly state that deltas are structural, not factual verification, not model-quality comparisons, and not aggregate benchmarks.

If the skill repo's intended audience also includes domain practitioners (compliance, sanctions desks), keep the human-review criterion as a separate **B2.8 — Practitioner review (optional, audience-gated)**: at least one named domain practitioner has read at least one example and recorded "useful in their workflow" or "useful with these revisions" under `validated-cases/`. B2.8 is a trust layer, not the hard Bar 2 gate when the downstream consumer is an agent integrator.

## Limitations of this methodology

- The agent-eval is structural, not factual. A high-delta output that's structurally rich but factually wrong is still wrong.
- Self-scoring is honest only when the rubric is binary enough to constrain wishful grading. The 8 criteria above are intentionally narrow.
- Per-case results do not generalize. Three agent-evals do not validate "the MCP works for every question," only "the MCP changed these three outputs in this measured way."
- This methodology presumes the consumer is an agent or an agent integrator. For pure human-reader contexts, fall back to B2.8.
