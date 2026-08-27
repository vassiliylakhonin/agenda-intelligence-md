# Agent-eval: gtta-global-policy

**Status:** complete — first end-to-end agent-eval run for Agenda Intelligence v0.9. Scored, observed, limitations recorded.

- **Question:** "How should a B2B AI provider with operations across the US, EU, and exposure to China assess the regulatory-divergence risk over the next 18–24 months, and what postures are available?" — pulled from `global-think-tank-analyst/examples/ai-governance-scenario-brief.md`.
- **Model:** Claude Sonnet 4.6 adaptive, same in both conditions.
- **Date:** 2026-05-20.
- **Evidence mode:** `reasoning_only` in both conditions; no live retrieval claimed or performed.
- **Skill under test:** global-think-tank-analyst.
- **Surface tested:** GTTA-only structural lift. The verified `meta.modules_used` from `analyze` was `[{"module": "global-think-tank-analyst", "role": "reasoning_method"}]` — no regional or sector specialists routed, confirming a clean GTTA-only test.

## Condition A — Baseline (no MCP)

Sonnet 4.6 adaptive, fresh session with no MCP servers attached. Same minimal prompt as Condition B but without instruction to call `analyze`. Output: 7-section markdown memo with jurisdiction trajectories, four strategic postures (A/B/C/D with Works-when / Breaks-when / Compliance investment), divergence vectors table, decision matrix, compliance investment allocation table, and a "Meta-Risk" closing section. Confident framing, no explicit fact/assessment separation, no provenance tags, no probability ranges, no live-retrieval disclosure.

Full text: [`gtta-global-policy-A.txt`](gtta-global-policy-A.txt).

## Condition B — Agenda Intelligence MCP attached

Same Sonnet 4.6 adaptive, fresh session, agenda-intelligence MCP server connected (`/opt/homebrew/bin/agenda-intelligence-mcp`, v0.9.0). The model called `analyze` with the prepared request. Two automatic schema-validation corrections happened before the call landed:

- `depth: "scenario_brief"` -> `"scenario"` (not in enum).
- `audience: "AI company leadership, product and compliance teams."` -> `"founder"` (audience is enum-constrained).

The MCP server returned a **skeleton memo** with `llm_invoked: false` because the server had no `ANTHROPIC_API_KEY` configured in its environment. This is the documented design path: with no key, `analyze` returns the assembled `system_prompt` and the host model completes the analysis. The host model (the same Sonnet 4.6 session) then produced a fully schema-conformant memo by following that system prompt: explicit facts / assessments / assumptions / unknowns sections, four scenarios with explicit probability ranges, four options with pros / cons / trade-offs, recommended actions with triggers, failure modes with likelihood and impact and mitigation, watch-next with indicator + trigger + source_type, and an audit table with per-claim basis labels.

Full text (raw JSON from `analyze` + host-model-completed memo): [`gtta-global-policy-B.txt`](gtta-global-policy-B.txt).

## Scoring

Eight binary criteria from [`docs/agent-eval-methodology.md`](../../docs/agent-eval-methodology.md). 0 = not present; 0.5 = partial; 1 = present.

| Criterion | A | B | Note |
|---|---|---|---|
| Fact / assessment / assumption / unknown separation | 0.5 | 1 | A has implicit "Direction / Works when / Breaks when" structure; B has explicit labelled sections. |
| Provenance discipline | 0 | 1 | A: no tags, no labels. B: per-claim basis table (Fact / Assessment / Assumption / Unknown). |
| Decision frame present | 1 | 1 | A: Section V "Decision Matrix" + posture-decision framing. B: explicit DECISION FRAME block with stakeholders + constraints. |
| Scenarios with probability ranges | 0 | 1 | A: no probabilities; postures use conditional Works-when, not scenarios. B: four scenarios with explicit ranges (0.40–0.55, 0.20–0.30, 0.10–0.20, 0.15–0.25). |
| Options with explicit trade-offs | 1 | 1 | Both have four postures / options with Works-when or Pros / Cons / Trade-offs. |
| Failure modes with likelihood and impact | 0.5 | 1 | A: names two meta-risks without quantification. B: five-row table with Likelihood, Impact, Mitigation columns. |
| Watch-next indicators with triggers | 0.5 | 1 | A: implicit "Timing: Now / Q3 2025 / 6-12 mo" column in investment-allocation table, no explicit trigger column. B: six-row table with Indicator + Trigger + Source Type. |
| Honest scope | 0 | 1 | A: no evidence-mode disclosure, no "no live retrieval" caveat, confident framing throughout. B: evidence_mode reasoning_only declared in meta, "No live sources consulted" in confidence reasoning, unknowns flagged, validation_score 0.71 self-assessed and labelled advisory. |
| **Total** | **3.5 / 8** | **8 / 8** | |

**Delta:** **+4.5** — above the methodology's "+3 or more = meaningful" threshold.

## Observations

Three findings stand out. They matter more than the raw delta.

**1. The structural lift comes from the assembled system prompt and the schema, not from the LLM call.** The MCP server did not invoke an LLM in this run (no `ANTHROPIC_API_KEY` in its env). The host model — the same Sonnet 4.6 adaptive that produced Condition A — completed the analysis by following the system_prompt returned by `analyze`. Same model, same single LLM turn, very different output shape. This is the cleanest evidence yet that the product shell's value is in the structured framing, not in routing the call to a particular model.

**2. Schema validation produced two silent corrections at the front door.** The model could not pass `scenario_brief` (not in depth enum) or a free-text audience string; both were forced into enum values (`scenario`, `founder`) before the analysis began. This is exactly the kind of constraint Condition A had no contact with. Trade-off: `"founder"` is an imperfect fit for "AI company leadership, product and compliance teams" — the schema preserved structural validity but lost audience specificity. A future revision could either expand the audience enum or add a freeform `audience_detail` field.

**3. The EU routing gap surfaced for the first time as a model-side inference, not a routing call.** The raw `meta.modules_used` from `analyze` was GTTA-only. The model, however, claimed in early commentary that `analyze` had "Flagged EU regional lens as relevant." That claim came from the system_prompt's reference to EU lens as a loadable lens inside the GTTA SKILL instructions — not from `route_modules()`, which has no EU branch. This is the gap previously documented in the original v0.9 audit: `agent-manifest.json` carries an EU lens entry and the GTTA SKILL references it, but `src/agenda_intelligence/product.py` `route_modules()` does not route geography "EU" or text containing "EU" / "European Union" to that lens. For this run it did not break the output — the model successfully reasoned about EU regulation anyway — but it is a real discrepancy between the SKILL-side promise of an EU lens and the product-shell-side routing. Worth treating as a follow-up: either add an EU branch to `route_modules()`, or remove the EU lens reference from the SKILL until routing exists.

