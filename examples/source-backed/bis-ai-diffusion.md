# Case study: BIS AI Diffusion Rule — rescission and replacement uncertainty

> **Agenda-Intelligence-MD case study.** This example uses real, publicly
> verifiable sources. Evidence URLs point to live government documents, SEC
> filings, and industry association statements. Run the full pipeline:
>
> ```bash
> agenda-intelligence validate-brief examples/source-backed/bis-ai-diffusion.brief.json
> agenda-intelligence validate-evidence examples/source-backed/bis-ai-diffusion.evidence.json
> agenda-intelligence audit-claims examples/source-backed/bis-ai-diffusion.audit.json --strict
> agenda-intelligence score examples/source-backed/bis-ai-diffusion.brief.json \
>   --evidence examples/source-backed/bis-ai-diffusion.evidence.json --min-score 80
> ```

---

## The event

On **January 15, 2025**, the Biden administration published a landmark BIS
Interim Final Rule: *Framework for Artificial Intelligence Diffusion*. It
created the first global, tiered export control regime for advanced AI chips
(ECCN 3A090.a — H100-class and above) and closed-weight model weights trained
above 10²⁶ FLOP.

**Three tiers:**

| Tier | Countries | Regime |
|---|---|---|
| 1 | USA + 18 allies (AU, BE, CA, DK, FI, FR, DE, IE, IT, JP, NL, NZ, NO, KR, ES, SE, TW, GB) | Full access, expanded license exceptions |
| 2 | ~140 others (India, UAE, Singapore, Israel, Saudi Arabia, …) | Per-country compute caps; datacenter authorization required |
| 3 | China, Russia, Iran + embargoed states | Effective ban; presumption of denial |

**Compliance deadline: May 15, 2025.**

On **May 13, 2025** — two days before enforcement — the Trump administration
rescinded the rule, citing competitiveness concerns. BIS promised a replacement
"in the coming weeks." No replacement had been published as of the analysis
date (May 12, 2026).

---

## Before / after

### Before: typical LLM summary

> "The US government has introduced new export controls on AI chips that could
> affect companies selling semiconductors internationally. Some countries may
> face restrictions while others will have easier access. NVIDIA said the
> impact on its China business is limited. The rule was later reversed by the
> new administration."

What's missing: no signal classification, no affected-actor list, no scenario
analysis, no watch-next indicators, no uncertainty hook, no evidence
attribution.

### After: Agenda-Intelligence-MD brief (excerpt)

**Bottom line:** The Biden-era BIS AI Diffusion Rule — a global three-tier
export control regime for advanced AI chips and model weights — was rescinded
two days before its enforcement deadline. A replacement rule is pending;
compliance posture for Tier 2 countries (~140 states) remains undefined.

**Signal classification:** `signal`
**Signal markers:** `compliance_relevant_development`

**What changed:** Global tiered licensing requirements for ECCN 3A090.a
exports and model weights above 10²⁶ FLOP. Published January 15, rescinded
May 13 before the May 15 enforcement deadline.

**Why it matters:** Export compliance functions, cloud providers, and chip
manufacturers had begun structuring operations around the tier framework.
Rescission does not restore the pre-rule baseline — it creates a gap where
prior China-specific controls remain but the global tier architecture is
undefined.

**Main uncertainty:** Scope and timeline of the replacement rule — whether it
will replicate the tier architecture, revert to China-specific controls, or
introduce a new structure.

**Scenarios:**
- *China-specific revert* — replacement narrows scope to China/Macau/embargoed
  states; Tier 2 countries regain unrestricted access.
- *Modified global tier* — tier structure retained with higher thresholds or
  larger caps; compliance burden reduced but not eliminated.

**Watch next:** Federal Register for BIS replacement IFR; BIS Under Secretary
statements; SIA response; NVIDIA/AMD investor disclosures; datacenter
investment announcements in Tier 2 markets as proxy for regulatory clarity.

---

## Evidence audit result (5 claims, 6 sources)

| claim | support_level | evidence |
|---|---|---|
| IFR published Jan 15 2025, three-tier structure, May 15 deadline | direct | Federal Register IFR + BIS press release |
| NVIDIA assessed no material China impact | direct | NVIDIA 8-K (SEC, Jan 13 2025) |
| SIA formally opposed rule as rushed and under-consulted | direct | SIA statement + SIA formal comments PDF |
| Rule rescinded May 13, two days before enforcement | direct | BIS rescission press release |
| No replacement rule published as of analysis date | **partial** | BIS rescission press release only — live FR monitoring required |

**Orphan evidence refs:** 0  
**Unsupported claims (explicit):** scope of replacement rule; compliance cost incurred before rescission.

---

## CLI output

```
score: 84/100
note: Heuristic structural/evidence-discipline score; does not verify factual truthfulness.
relevance: 25/25
evidence_support: 15/25 — live_source_backed; 4/5 supported, 1/5 partially; unsupported_claims=2
completeness: 19/20
actionability: 14/15
clarity: 11/15
```

Passes `--min-score 80`. Partial score on evidence_support is honest: one
claim (replacement rule status) relies on a single source that does not
confirm the current state — live Federal Register monitoring is required.

---

## Sources (real, publicly accessible)

1. [Federal Register IFR 2025-00636](https://www.federalregister.gov/documents/2025/01/15/2025-00636/framework-for-artificial-intelligence-diffusion)
2. [BIS Biden press release, Jan 13 2025](https://www.bis.gov/press-release/biden-harris-administration-announces-regulatory-framework-responsible-diffusion-advanced-artificial)
3. [NVIDIA 8-K, SEC EDGAR, Jan 13 2025](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000007/nvda-20250113.htm)
4. [SIA statement on AI Diffusion plan](https://www.semiconductors.org/sia-statement-on-biden-administrations-plan-to-publish-export-control-framework-for-artificial-intelligence-diffusion/)
5. [SIA formal comments on IFR, Apr 15 2025 (PDF)](https://www.semiconductors.org/wp-content/uploads/2025/04/SIA-Comments-on-AI-Diffusion-IFR_April-15-2025.pdf)
6. [BIS rescission press release, May 13 2025](https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens)
