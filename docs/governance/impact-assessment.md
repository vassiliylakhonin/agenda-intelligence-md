# AI System Impact Assessment — Kazakhstan / Middle Corridor Deal Risk Gate

**Version:** 1.0  
**Date:** 2026-06-22  
**Assessor:** Vassiliy Lakhonin  
**Review trigger:** Annual, or on material system change  
**Reference:** ISO/IEC 42001:2023, Clauses 6.1.4, 8.4 and Annex A, Section A.5

---

## 1. System description

| Field | Value |
|---|---|
| System name | Kazakhstan / Middle Corridor Deal Risk Gate |
| Deployment | Cloudflare Worker (edge, serverless) |
| Decision logic | Deterministic, rule-based triage (no LLM) + structured evidence schema |
| Primary function | Evidence-readiness triage for counterparty EDD |
| Intended use context | Middle Corridor / Central Asia trade transactions |
| Automation level | Advisory output only; human decision required |

---

## 2. Affected parties

| Party | How affected | Potential positive impact | Potential negative impact |
|---|---|---|---|
| **End users** (forwarders, consultants) | Primary recipients of triage output | Faster, structured EDD prep; fewer missed gaps | Over-reliance on output without human review |
| **Counterparties** (companies being assessed) | Their documentation is evaluated | Faster onboarding when documentation is complete | Incorrect "Gap" classification could delay or block a deal |
| **End clients** of users | Downstream beneficiaries of sound EDD | Better-documented transactions | Indirect harm if user acts on incorrect Gate output |
| **Regulatory bodies** | May receive EDD packages influenced by Gate output | More structured documentation | Gate output cited as a compliance opinion (misuse) |
| **Societies / markets** | Middle Corridor trade integrity | Increased trade transparency | Nil identified at current scale |

---

## 3. Risk register

| # | Risk scenario | Likelihood | Severity | Current mitigation | Residual risk |
|---|---|---|---|---|---|
| R1 | User treats Gate verdict as a legal compliance opinion | Medium | High | Mandatory disclaimer in every output; AI Policy §2 | Low–Medium |
| R2 | Rule-logic error: verdict wrong due to a rule bug or stale rule/schema | Low–Medium | High | Versioned rules; test suite + live drift canary on deployed verdicts; change-review on rule changes; mandatory human review; Covered/Gap distinction | Low |
| R3 | Counterparty wrongly flagged as "escalate" (false positive) | Low | Medium | Human oversight mandatory; user can re-run with updated documents | Low |
| R4 | Counterparty wrongly classified "proceed" (false negative) | Low | High | Disclaimers; scope limited to evidence-readiness, not sanctions verdict | Medium |
| R5 | User submits PII / sensitive personal data | Low | Medium | Session data not retained; no model training on user data (no LLM in path) | Low |
| R6 | System downtime during critical review | Low | Low | Cloudflare edge redundancy; no SLA commitment given (free tier) | Medium |
| R7 | Scope creep: user applies Gate to non-corridor transactions | Low | Low | Scope disclaimer in output; AI Policy §2 | Low |

**Overall residual risk level: MEDIUM** — acceptable under current policy given mandatory human oversight requirement.

---

## 4. Impact on individuals and groups

| Dimension | Assessment |
|---|---|
| Legal position of individuals | Not directly affected. Gate does not output personal credit, employment, or legal status decisions. |
| Physical / psychological wellbeing | Not affected. |
| Universal human rights | No identified pathway to rights impact at current scope and scale. |
| Discrimination / fairness | Risk of systematic bias against entities from certain jurisdictions (e.g. sanctioned-adjacent countries). Mitigated by "escalate" verdict (human review) rather than automated block. |

---

## 5. Societal impact

| Dimension | Assessment |
|---|---|
| Trade integrity (Middle Corridor) | Positive: improved documentation discipline reduces risk of illicit-finance exposure in CIS trade. |
| Concentration risk | Low: Gate is one tool among many; no market-dominant position. |
| Environmental | Negligible: serverless edge deployment; deterministic compute per request, no model inference. |

---

## 6. Controls applied (Annex A mapping)

| ISO 42001 Control | Status | Evidence |
|---|---|---|
| A.5.2 Impact assessment process | Implemented | This document |
| A.5.3 Documentation | Implemented | This document |
| A.5.4 Impact on individuals | Assessed (§4) | This document |
| A.5.5 Societal impact | Assessed (§5) | This document |
| A.6.2.6 Operation monitoring | Implemented | GA4 analytics + /stats endpoint |
| A.7.5 Data provenance | Implemented | Axis A/B source classification in output |
| A.8.2 System documentation for users | Implemented | Output disclaimer + AI Policy |
| A.8.3 External reporting of adverse impacts | Implemented | AI Policy §7 (email channel) |
| A.9.3 Responsible-use objectives | Implemented | AI Policy §3 (transparency, human oversight) |

---

## 7. Open gaps and remediation plan

| Gap | Priority | Target date |
|---|---|---|
| A.6.2.8 Event logs: structured log of each AI decision (input hash, verdict, timestamp) | Medium | Q3 2026 |
| A.8.4 Formal incident communication plan | Low | Q3 2026 |
| A.4.3 Formal data resource documentation | Low | Next policy review |

---

## 8. Conclusion

The Kazakhstan / Middle Corridor Deal Risk Gate presents a **medium overall risk profile**, concentrated in misuse scenarios (treating advisory output as a compliance verdict). All high-severity risks are mitigated to low or medium residual risk through mandatory human oversight requirements, explicit disclaimers, and scope-limiting design. No direct impact on individual rights or societal harm pathways identified at current scale.

This assessment supports a **proceed** determination for continued operation under the controls described above.

---

*Aligned with ISO/IEC 42001:2023 Annex A, Section A.5 and clause 6.1.4.*
