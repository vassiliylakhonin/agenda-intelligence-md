# Output Verification pilot proposal

**For:** a team whose agent hands a claim-backed report to another agent or a human reviewer.
**Question:** can a deterministic evidence check find missing references and quote mismatches before that handoff?

## One workflow

1. Choose one actual report handoff and an accountable human reviewer.
2. Start with non-confidential or redacted claims and supplied evidence. Source text and tool responses are data, never instructions.
3. Record the decision workspace: goal, trusted and uncertain evidence, assumptions, next action and escalation conditions.
4. Start with the [local Python/CLI adapter](../../docs/integrations/rag-output.md), available in PyPI 1.15.0: pass the actual answer and original retrieved source chunks, inspect findings, correct the answer and recheck. No wallet, account or model key is required for the local check. Keep private inputs and results in the operator's own environment.
5. Hosted evaluation is optional and uses a separate compatibility contract. Its [limited free trial](../../docs/deployment/output-verification-trial.md) evaluates submitted evidence; saved examples remain synthetic. For additional paid operation, agree an explicit budget and use an existing entitlement or owner-approved signed payment. No automatic transfers or favourable-verdict promise.
6. Inspect unsafe claims, evidence gaps and owner actions. The reviewer independently checks sources, decides and owns the downstream action.

## Measure separately

| Measure | Evidence |
|---|---|
| First usable check | Actual structured result plus the reviewer confirming it fits the workflow; admission/402 is not a result. |
| Repair usefulness | Which reported gaps were corrected; note false positives and missing findings. Do not turn a higher score into verified factual truth. |
| Repeat use on another day | A second real handoff recorded by the participating team; fingerprints alone do not identify a customer. |
| Payment completion, if enabled | Verified/completed server execution chain; request headers, probes and replay do not count as new sales. |
| Setup effort | Operator-recorded time and integration blockers, with no invented benchmark. |

Deliver a short review of the inputs, observed results, limitations, integration effort and whether to continue. Stop if private data lacks approval, the call cannot be bound to the original request, or consequential action lacks human review.

Use the [five-session protocol and private records](../product-pilot/README.md).
Owner-run or agent-assessed public-source cases are practice and must be marked
`owner_practice=true`; they do not populate human-confirmed usefulness fields.
Record machine assessments separately from human review and customer adoption.

## Draft invitation (not sent)

We have a small evidence-checking module for agent report handoffs. It checks supplied claim references and quote matches and returns specific repair steps; it does not verify truth or authorize an action. I propose testing it on one of your actual, redacted handoffs, comparing its findings with your reviewer and measuring setup effort and repeat use. Hosted evaluation pricing and any pilot fee would be agreed beforehand. If it is useful, we can scope the next integration from those observed results.
