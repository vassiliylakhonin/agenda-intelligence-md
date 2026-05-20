# Agent-eval: gtta-global-policy

**Status:** scaffold — intended as the v0.9 full case. Fill both conditions, score, observe, mark status `complete` when done.

- **Question:** _(TODO: pull from `global-think-tank-analyst/examples/` — a question that exercises GTTA-only structural lift without triggering regional or sector routes. Candidates: global AI-policy coordination question, critical-minerals supply-chain framing question. Verify `route_modules` returns only `global-think-tank-analyst` for the chosen question and geography.)_
- **Model:** _(TODO — same model in both conditions; document version and date.)_
- **Date:** _(TODO)_
- **Evidence mode:** _(TODO: `reasoning_only` if no sources supplied; `user_provided` or `mixed` if upstream example is live-source-backed. Record the mapping decision and note that live retrieval is upstream of Agenda Intelligence.)_
- **Skill under test:** global-think-tank-analyst
- **Surface tested:** GTTA-only structural lift. `route_modules` should return `[{module: global-think-tank-analyst, role: reasoning_method}]` and nothing else for this case to be a clean GTTA test.

## Condition A — Baseline (no MCP)

_(TODO — fresh agent session, no MCP, paste question with minimal "be concise and decision-useful" prompt, capture full response.)_

## Condition B — Agenda Intelligence MCP attached

_(TODO — fresh agent session with `agenda-intelligence-mcp` attached, instruct agent to call `analyze` with question + geography + evidence_mode, capture full memo and any agent commentary.)_

## Scoring

| Criterion | A | B |
|---|---|---|
| Fact / assessment / assumption / unknown separation | 0/0.5/1 | 0/0.5/1 |
| Provenance discipline |  |  |
| Decision frame present |  |  |
| Scenarios with probability ranges |  |  |
| Options with explicit trade-offs |  |  |
| Failure modes with likelihood and impact |  |  |
| Watch-next indicators with triggers |  |  |
| Honest scope |  |  |
| **Total** | **n/8** | **n/8** |

**Delta:** _(TODO)_

## Observations

_(TODO — 1–2 paragraphs. Be honest about cases where the delta was small. Note any surprises about how the MCP changed output shape on a GTTA-only question.)_

## Limitations

- One model, one prompt run. Not statistically significant.
- Structural delta only. A high-delta output that's factually wrong is still wrong.
- Self-scored by author.
- This case isolates GTTA from regional/sector specialists; it does not validate routing or vertical-lens lift.
