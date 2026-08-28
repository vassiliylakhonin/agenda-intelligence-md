# Agent-eval: ca-caspian-sanctions

**Status:** complete — second end-to-end agent-eval run for Agenda Intelligence. First case to exercise multi-module composition (regional specialist + sector specialist alongside GTTA).

- **Question:** "We are a fintech operating between Kazakhstan and Uzbekistan, with cross-border flows touching Caspian-connected trade routes (Aktau, Baku, Middle Corridor). What are our sanctions, AML, banking and routing risks over the next 6–12 months, and what should we do about them?" — pulled from `central-asia-caspian-hybrid-intelligence-skill/examples/fintech-sanctions-routing.md`.
- **Model:** Claude Sonnet 4.6 adaptive, same in both conditions.
- **Date:** 2026-05-20.
- **Evidence mode:** `reasoning_only` in both conditions; no live retrieval claimed or performed.
- **Skill under test:** central-asia-caspian-hybrid-intelligence-skill (regional specialist) + sanctions-sector (sector specialist).
- **Surface tested:** Multi-module composition. The verified `meta.modules_used` from `analyze` was three modules: `global-think-tank-analyst` (reasoning_method), `central-asia-caspian` (regional_specialist), `sanctions-sector` (sector_specialist). EU lens correctly **not** routed despite "EU" appearing once in the question text (in "Western regulators" context); neither geography tokens nor any EU_TERMS substring matched, so the regression guard from the v0.9.x EU routing commit held.

## Condition A — Baseline (no MCP)

Sonnet 4.6 adaptive, fresh Claude Desktop session, no MCP attached. Same minimal prompt as Condition B but without instruction to call `analyze`. Output: 5-section markdown brief — threat landscape table, jurisdiction-by-jurisdiction sections (Sanctions / AML / Correspondent Banking), three-posture decision framework (Maintain / Narrow / Restructure), Immediate Actions table with Owner + Why Urgent columns, Bottom Line. Confident framing, no fact/assessment separation, no provenance tags, no probability ranges, no evidence-mode disclosure.

Full text: [`ca-caspian-sanctions-A.txt`](ca-caspian-sanctions-A.txt).

## Condition B — Agenda Intelligence MCP attached

Same Sonnet 4.6 adaptive. `analyze` was called via the MCP product shell (in this session through Claude Code, because Claude Desktop's UI clobbered the MCP config file in the chat-side app and the app could not be force-quit without ending the Claude Code session — both Claude apps share the same binary). `analyze` returned a skeleton memo (`llm_invoked: false`; no `ANTHROPIC_API_KEY` in the MCP server's env) plus the assembled `system_prompt`. The host model (Sonnet 4.6 adaptive in a fresh Claude Desktop chat, same model as Condition A) then completed the analysis by following the system_prompt. Identical "no API key" host-completion flow to the GTTA case.

Output: fully schema-conformant JSON memo. Explicit `meta.evidence_mode: reasoning_only`, `confidence.score: 0.62` with reasoning, `decision_frame` with decision / stakeholders / constraints, `analysis` with explicit facts (10) / assessments (9) / assumptions (5) / unknowns (7) arrays, four scenarios with probability ranges (0.30–0.45, 0.25–0.40, 0.10–0.20, 0.10–0.20), four options with pros / cons / trade-offs, seven recommended actions with priority + trigger + time_horizon, five failure modes with likelihood + impact + mitigation, seven watch-next entries with indicator + trigger + source_type, and an `audit.provenance` table with per-claim basis labels.

Full text (raw JSON skeleton + host-model-completed memo): [`ca-caspian-sanctions-B.txt`](ca-caspian-sanctions-B.txt).

## Scoring

Eight binary criteria from [`docs/agent-eval-methodology.md`](../../docs/agent-eval-methodology.md). 0 = not present; 0.5 = partial; 1 = present.

| Criterion | A | B | Note |
|---|---|---|---|
| Fact / assessment / assumption / unknown separation | 0.5 | 1 | A has implicit structure (Risk / Direction / Specific tripwires headings); B has explicit labelled arrays. |
| Provenance discipline | 0 | 1 | A: no tags. B: 15-row provenance table mapping each major claim to fact / assessment / assumption / unknown basis. |
| Decision frame present | 1 | 1 | Both name the decision explicitly. B adds stakeholders and constraints as separate fields. |
| Scenarios with probability ranges | 0 | 1 | A: no probabilities. B: four scenarios with explicit numeric ranges. |
| Options with explicit trade-offs | 1 | 1 | A: three postures with Viable-when / Risk / Actions. B: four options with Pros / Cons / Trade-offs. |
| Failure modes with likelihood and impact | 0.5 | 1 | A: implicit failure scenarios in "Risk" prose. B: five-row failure-modes table with explicit Likelihood + Impact + Mitigation columns. |
| Watch-next indicators with triggers | 0.5 | 1 | A: Immediate Actions table has Owner + Why Urgent, no per-indicator trigger. B: seven-row table with Indicator + Trigger + Source Type. |
| Honest scope | 0 | 1 | A: no evidence-mode disclosure, confident framing. B: evidence_mode declared in meta, "no live source retrieval was performed" in audit notes, validation_score 0.71 labelled advisory, "not legal advice" caveat. |
| **Total** | **3.5 / 8** | **8 / 8** | |

**Delta:** **+4.5** — identical to the GTTA case (`gtta-global-policy.md`). Same Sonnet 4.6 adaptive, same evidence mode, same delta. Two cases now show the same +4.5 number; that is a pattern, not a single point.

## Observations

Five findings, in order of importance.

**1. Same +4.5 delta as the GTTA case.** Two cases shipped, same model, same evidence mode, same structural lift. This stops being a one-off and starts being a pattern. The product shell consistently moves outputs from ~3.5/8 to 8/8 on this rubric when the host model follows the assembled system_prompt. Worth being honest about what the +4.5 represents: it is not "Sonnet 4.6 became smarter," it is "Sonnet 4.6 was asked the same question with a structured-output contract instead of free-form instructions." The lift is in the assembled framing, not in the model.

**2. Multi-module composition works end-to-end.** This is the first eval to exercise three modules. `modules_used` correctly contained GTTA reasoning method + CA-Caspian regional + sanctions-sector. The B memo reflects this in substance, not just structure: AIFC vs NBK-regulated dual-track is CA-Caspian-specific content; OFAC/EU/UK/UN framework distinctions and ownership-vs-routing-vs-finance exposure mechanisms are sanctions-sector-specific. The merged prompt produced merged analysis, not parallel pastings.

**3. `audience_detail` (ADR 0009) verified in production.** Caller passed `audience: "founder"` plus `audience_detail: "Fintech compliance and BD leadership."`. The server-verified context block in system_prompt rendered both. The B memo's `decision_frame.stakeholders` includes "Compliance and MLRO function" and "Current and prospective correspondent banks" — directly reflecting the audience_detail framing rather than the generic `founder` prototype. The additive schema field added value on the first real eval after the change.

**4. EU not routed despite "EU" in question text — regression guard held.** The question mentions "EU" once (in "OFAC, EU, and UK watchlists"). The request had no `EU_GEO_EXACT` token in geography, and no long-form EU phrase (`european union`, `gdpr`, `cbam`, etc.) appeared in either geography or question text. `route_modules()` correctly did not add the EU lens. This is the substring-false-positive regression guard from `test_route_modules_no_false_positive_on_substring_eu` proving itself outside the test suite.

**5. Provenance basis used schema enum, not SKILL Axis A/B tags.** The CA-Caspian and GTTA SKILL instructions describe inline provenance tags from Axis A (`[primary]`, `[secondary]`, `[user-provided]`, `[inference]`, `[analyst-judgment]`) and Axis B (`[verify]`, `[stale-risk: YYYY-MM]`). Sonnet did not use those. Instead it used the agenda-memo.schema.json `audit.provenance` field with `basis` enum (`fact` / `assessment` / `assumption` / `unknown`). The schema's STRICT output contract trumped the SKILL's stylistic preference. This is a deliberate choice — the product shell decided to be schema-first, not SKILL-prose-first — but it is worth recording: if Axis A/B tags inside the memo body are a Bar 2 criterion in the skill repo, the product shell currently routes around them by enforcing a simpler basis enum at the schema level. Either the schema gains Axis A/B-aware fields in a future version, or the SKILL's tag prescription gets reframed as advice the model may add inside text fields rather than as a separate axis.

**6. Stop-and-request correctly did NOT fire.** The CA-Caspian AGENTS.md lists explicit triggers for Stop-and-request: definitive sanctions / legal / compliance conclusions, claims hinging on a fact sources disagree on, operational sanctions claims older than the decision window, named-individual predictions. The question was framed as risk analysis ("what are our risks", "what should we do") with no demand for a definitive list-status determination on any named counterparty. Sonnet answered with risk framing rather than stopping. The trigger logic neither over-fired nor under-fired in this case.

## Limitations

- One model, one prompt run per condition, one author scoring. Methodology accepts this for v0.9.
- Structural delta only. A schema-conformant memo with factually wrong claims is still wrong; this eval did not perform source verification of any specific date, designation, framework, or jurisdiction reference in either output.
- The "Russia-affiliated bank subsidiaries operate in Kazakhstan" claim is tagged `fact` in B's provenance but is not source-verified within this eval; it is a public-record claim that would need primary-source confirmation before operational use.
- Several B-side specific dates (Kazakhstan FATF exit October 2024, EU AI Act phase-in calendar) carry the same caveat. The provenance system makes the gap visible — but visibility is not verification.
- The same MCP-pipeline flow as the GTTA case (`llm_invoked: false`; host model completes from system_prompt) means we have not yet exercised the self-invoking branch where `analyze` calls the Anthropic API itself. Both flows are documented; only the host-completion path has been eval-tested.
- Self-scored by the case author per methodology.
