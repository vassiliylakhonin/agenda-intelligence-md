# Human Review Checklist

Use this checklist when manually evaluating a brief. Each item should be marked ✅ (present) or ❌ (missing/weak).

## 1. Relevance
- [ ] The brief directly addresses the signal/topic mentioned in the prompt.
- [ ] All “watch‑next” indicators are tied to the same topic.

## 2. Evidence Support
- [ ] Every factual claim is linked to an **EVIDENCE** reference.
- [ ] The evidence references come from the specified source plan (e.g., `technology‑ai/*.json`).
- [ ] Unsupported claims are explicitly flagged (e.g., “unsupported claim” note).
- [ ] Factual claims carry inline provenance tags: `[primary]`, `[secondary]`, `[user-provided]`, `[inference]`, or `[analyst-judgment]`.
- [ ] Time-sensitive claims carry `[stale-risk: YYYY-MM]` where applicable.
- [ ] Claims the reader should verify carry `[verify]`.
- [ ] Linguistic decisiveness matches provenance: claims tagged `[analyst-judgment]` / `[inference]` use hedges ("likely", "appears to", "suggests"); confident framing ("clearly", "will", "is") is reserved for `[primary]` / verified claims.
- [ ] Where sources disagree, both positions are surfaced with their provenance; the brief states which is preferred and why, or applies "flag-but-don't-use". Agreement between sources is treated as evidence only if the sources are independent.

## 3. Completeness
- [ ] Bottom line is present and concise.
- [ ] Signal classification is provided (noise / weak signal / signal / structural shift / trigger event).
- [ ] “What changed” section explains the core change.
- [ ] Main uncertainty is identified.
- [ ] Institutional path is described.
- [ ] Affected flows are listed.
- [ ] Watch‑next indicators are concrete and actionable.

## 4. Actionability
- [ ] The brief points to a clear decision or monitoring action.
- [ ] Trigger conditions (if any) are explicit.

## 5. Clarity / Readability
- [ ] Uses markdown headings, bullet lists, and short paragraphs.
- [ ] No unnecessary jargon or overly long sentences.
- [ ] Consistent formatting with other examples.

## 6. Delegation and accountability

- [ ] The brief is positioned as **analytical support for a human decision**, not as the decision itself.
- [ ] Recommendations are framed as options or next steps, not directives.
- [ ] The human reviewer remains the decision-maker; the brief does not present itself as a ratifier of a conclusion already reached.
- [ ] The boundary between analysis and advice is explicit — no claims of legal, compliance, sanctions, or investment authority.
- [ ] It is clear what would trigger escalation to a primary source or specialist.

## 7. Trust surface

- [ ] If external tools (search, MCP, file reads) were used to produce the brief: the source is noted and tagged.
- [ ] If no live verification was performed: this is stated, not implied.
- [ ] Time-sensitive claims (policy dates, enforcement posture, regulatory thresholds) carry a recency note or `[stale-risk: YYYY-MM]` flag.
- [ ] The brief does not claim permissions or access it did not use.

## Overall Score (0‑100)
(Use the weighted rubric from `rubric.md` to calculate.)

**Reviewer:** ________________  
**Date:** ________________
