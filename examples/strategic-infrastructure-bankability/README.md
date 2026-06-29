# Strategic Infrastructure Bankability Example

This example is synthetic. It is not based on a real project, client, lender, vendor, public authority, site, or procurement process.

Use it to test whether Agenda Intelligence MD can turn a confidential or redacted infrastructure project packet into a human-review readiness artifact without exposing company names.

## What it demonstrates

- Stable aliases instead of real names.
- Claim-level evidence review for a project file.
- Weekly/status-call conversion into a decision-readiness delta.
- Bankability blocks: demand, procurement, site/power, financing, tax/customs, regulatory/export-control, governance, and risk-register maturity.
- `not_decision_ready` routing when the packet has plausible activity but not enough evidence for the next decision.
- `unclear_due_to_missing_evidence` routing when the week added activity but not enough proof.
- Unsafe-to-repeat claims that should not be used externally without caveats.

## Files

| File | Purpose |
|---|---|
| [`status.synthetic.md`](status.synthetic.md) | Synthetic messy weekly/status input for the `weekly-delta` CLI |
| [`synthetic-profile.md`](synthetic-profile.md) | Redacted-style evidence-readiness profile for a fictional project |
| [`weekly-status-delta.synthetic.md`](weekly-status-delta.synthetic.md) | Synthetic weekly/status-call delta that turns activity into evidence state and owner actions |
| [`claim.audit.json`](claim.audit.json) | Claim-level evidence audit using generic source IDs and aliases |

## Boundary

This example does not approve or reject a project. It does not provide legal, compliance, procurement, tax, customs, sanctions, export-control, financial, insurance, or investment advice.
