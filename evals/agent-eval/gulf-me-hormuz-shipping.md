# Agent-eval: gulf-me-hormuz-shipping

**Status:** complete — third end-to-end agent-eval run for Agenda Intelligence. Closes the original v0.9 scaffold set; first eval to surface a canonical regional-skill rule (IRGC vs Iran-state vs Iran-private commercial actor distinction) being held in Condition B and partially collapsed in Condition A.

- **Question:** "What Iran sanctions adjacency risk does a European refiner face when sourcing crude from Gulf trading hubs (UAE, Oman) via intermediary trading houses?" — pulled from `gulf-middle-east-hybrid-intelligence-skill/examples/iran-sanctions-routing-exposure.md`.
- **Model:** Claude Sonnet 4.6 adaptive, same in both conditions.
- **Date:** Condition A run on 2026-05-20; Condition B `analyze` call on 2026-05-20, host completion on 2026-05-21.
- **Evidence mode:** `reasoning_only` in both conditions; no live retrieval claimed or performed.
- **Skill under test:** gulf-middle-east-hybrid-intelligence-skill (regional specialist) + sanctions-sector (sector specialist).
- **Surface tested:** Multi-module composition. Verified `meta.modules_used` from `analyze` = three modules: `global-think-tank-analyst` (reasoning_method), `gulf-middle-east` (regional_specialist), `sanctions-sector` (sector_specialist). EU lens correctly **not** routed (geography contains "UAE", "Oman", "Iran", "Gulf"; no EU_GEO_EXACT token, no EU_TERMS substring).

## Condition A — Baseline (no MCP)

Sonnet 4.6 adaptive, fresh Claude Desktop session, no MCP attached, explicit prompt instruction to not call tools. Output: 5-section markdown brief — Core Risk Architecture, Specific Exposure Vectors table, Regulatory & Enforcement Environment, Decision Framework (Maintain / Deepen DD / Restructure with bullet conditions), and a closing "Decision Most Likely Warranted" paragraph plus a non-legal-advice disclaimer.

Iran actor distinction in A: mentions "IRGC-affiliated" once in passing in the trading-house-layering exposure-vector row ("Entity A buys from Entity B (Iran-linked) which bought from Entity C (IRGC-affiliated)") but otherwise treats Iran exposure as a generic "Iran-linked" / "Iranian crude" framing without structurally separating Iran-state, IRGC-affiliated, and Iran-private commercial actors.

Full text: [`gulf-me-hormuz-shipping-A.txt`](gulf-me-hormuz-shipping-A.txt).

## Condition B — Agenda Intelligence MCP attached

Same Sonnet 4.6 adaptive. `analyze` was called via Claude Code (in this session through `~/.claude.json` MCP wiring, because Claude Desktop's chat-side UI overwrote the chat-app MCP config file mid-session and the app could not be force-quit without ending the Claude Code session — both Claude apps share the same binary). `analyze` returned the standard skeleton memo (`llm_invoked: false`; no `ANTHROPIC_API_KEY` in MCP server env) plus the assembled `system_prompt`, which was then pasted into a fresh Claude Desktop chat where the host model (same Sonnet 4.6 adaptive) completed the analysis by following that system_prompt. Same "no API key" host-completion flow as the previous two eval runs.

Iran actor distinction in B: explicit. The assembled system_prompt from `analyze` embedded the Gulf+ME regional module which includes the "Iran actor distinction (CRITICAL)" rule. Sonnet held it: the memo's `audit.validation_details` literally states *"IRGC vs. Iran-state vs. Iran-private distinction is applied throughout per regional module requirement; no undifferentiated 'Iran risk' framing used."* The analysis body uses "IRGC-network-linked", "IRGC-Quds Force-linked networks", "IRGC-linked beneficial ownership" as distinct from generic Iran-state framings. This is the first eval where a canonical regional-skill rule was demonstrably enforced through the assembled prompt rather than left to model intuition.

Output otherwise schema-conformant: explicit `meta.evidence_mode: reasoning_only`, `confidence.score: 0.62` with reasoning, `decision_frame` with decision / stakeholders / constraints, `analysis` with explicit facts (9) / assessments (7) / assumptions (5) / unknowns (6) arrays, four scenarios with probability ranges, four options with pros / cons / trade-offs, seven recommended actions with priority + trigger + time_horizon, five failure modes with likelihood + impact + mitigation, seven watch-next entries with indicator + trigger + source_type, and an `audit.provenance` table with per-claim basis labels.

Full text (raw JSON skeleton + host-model-completed memo): [`gulf-me-hormuz-shipping-B.txt`](gulf-me-hormuz-shipping-B.txt).

## Scoring

Eight binary criteria from [`docs/agent-eval-methodology.md`](../../docs/agent-eval-methodology.md). 0 = not present; 0.5 = partial; 1 = present.

| Criterion | A | B | Note |
|---|---|---|---|
| Fact / assessment / assumption / unknown separation | 0.5 | 1 | A: implicit section structure, no labels. B: explicit labelled arrays. |
| Provenance discipline | 0 | 1 | A: no tags. B: 16-row per-claim basis table. |
| Decision frame present | 1 | 1 | Both name the decision; B adds explicit stakeholders + constraints fields. |
| Scenarios with probability ranges | 0 | 1 | A: no probabilities. B: four scenarios with explicit ranges (0.35–0.50, 0.15–0.30, 0.15–0.25, 0.10–0.20). |
| Options with explicit trade-offs | 1 | 1 | A: Maintain / Deepen DD / Restructure with conditions. B: four options with Pros / Cons / Trade-offs. |
| Failure modes with likelihood and impact | 0.5 | 1 | A: failure scenarios implicit in "Restructure or Exit" triggers, no quantification. B: five-row table with explicit Likelihood + Impact + Mitigation columns. |
| Watch-next indicators with triggers | 0.5 | 1 | A: triggers embedded in "Deepen DD" conditions, no standalone watch list with source types. B: seven-row table with Indicator + Trigger + Source Type. |
| **Total** | **4.0 / 8** | **8 / 8** | |


## Observations

Six findings, in order of importance.

**1. The Iran actor distinction canon rule held in B and partially failed in A.** The Gulf+ME AGENTS.md is unusually explicit about a specific failure mode: collapsing Iran-state, IRGC-affiliated, and Iran-private commercial actors into one undifferentiated "Iran". A passes this poorly — one passing mention of "IRGC-affiliated" inside a table cell, and otherwise generic "Iran-linked" framing. B passes it cleanly — the actor distinction is referenced in `audit.validation_details`, and the body uses IRGC-network-linked / IRGC-Quds Force / IRGC-linked beneficial ownership as distinct categories from Iran-state regulation references. This is the first eval where a canonical *regional-skill* rule was demonstrably routed through the assembled system_prompt and enforced in output. The mechanism is concrete: the regional module embeds the canon as instruction, the strict output contract forces the model to commit to it, and the audit fields force the model to declare the commitment explicitly.

**2. Smaller delta because the baseline was stronger.** +4.0 vs +4.5 in the first two cases. Not because B regressed — B scores 8/8 in all three. Because Condition A in this case included a closing "This analysis is based on general knowledge... It does not constitute legal advice. Engage qualified sanctions counsel" disclaimer, which earns 0.5 on honest scope. The other two baselines had no equivalent. Reading: when the baseline is structurally stronger, the structural-shell delta narrows but does not disappear. The product shell's value is asymmetric across input quality — biggest lift on weak baselines, smaller (but still meaningful) lift on already-structured baselines.

**3. Multi-module composition confirmed a third time.** Three modules (GTTA reasoning method + gulf-middle-east regional + sanctions-sector sector). The merged system_prompt produced merged analysis: Gulf-specific content (UAE free zone names — Fujairah, Hamriyah, Sharjah; Omani blending operations; P&I club guidance on AIS gaps; FATF UAE greylisting history) sits alongside sanctions-sector content (ISA / IFCA / EU Reg 267/2012 / UK 2019 specific instrument names; ownership/control vs routing vs finance exposure mechanisms). GTTA case = single module. CA+Caspian and Gulf+ME = three modules each. Composition holds in both.

**4. EU regression guard held in production for a second case.** Geography list was `["UAE", "Oman", "Iran", "Gulf"]`. No EU exact token, no EU_TERMS substring. EU correctly not added to `modules_used`. The substring-false-positive guard from the v0.9.x EU routing commit continues to do its job: bare two-letter "eu" is matched only as an exact geography token, not inside arbitrary words. Across three evals now, EU has been routed only when it should be (GTTA case = not routed correctly; CA+Caspian = not routed correctly; Gulf+ME = not routed correctly).

**5. `audience_detail` flowed through a third time.** Caller passed `audience: "founder"` + `audience_detail: "Refinery sanctions compliance and trade-finance leadership."`. The verified context block rendered both. B's `decision_frame.stakeholders` includes "Refinery compliance and sanctions counsel" and "Trade-finance banks and letter-of-credit providers" — directly reflecting the audience_detail framing, not generic founder. ADR 0009 now has three eval-cases worth of evidence that it works as intended.

**6. The SKILL Axis A/B vs schema basis enum discrepancy repeated.** Same pattern as CA+Caspian case: Sonnet used the schema's `audit.provenance.basis` enum (fact / assessment / assumption / unknown) and did not use the Gulf+ME SKILL's specified inline Axis A tags (`[primary]` / `[secondary]` / `[inference]` / `[analyst-judgment]`) or Axis B action flags (`[verify]` / `[stale-risk]`). The schema's strict output contract continues to override the SKILL's stylistic preference. Two cases now show this — it is the system's behavior, not a one-off. The repo follow-up from `ca-caspian-sanctions.md` observation 5 stands: either the schema gains Axis A/B-aware fields or the SKILL's tag prescription gets reframed as advice for text fields.
