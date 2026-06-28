# Strategic Infrastructure Bankability Example

This example is synthetic. It is not based on a real project, client, lender, vendor, public authority, site, or procurement process.

Use it to test whether Agenda Intelligence MD can turn a confidential or redacted infrastructure project packet into a human-review readiness artifact without exposing company names.

## What it demonstrates

- Stable aliases instead of real names.
- Claim-level evidence review for a project file.
- Bankability blocks: demand, procurement, site/power, financing, tax/customs, regulatory/export-control, governance, and risk-register maturity.
- `not_decision_ready` routing when the packet has plausible activity but not enough evidence for the next decision.
- Unsafe-to-repeat claims that should not be used externally without caveats.

## Files

| File | Purpose |
|---|---|
| [`synthetic-profile.md`](synthetic-profile.md) | Redacted-style evidence-readiness profile for a fictional project |
| [`claim.audit.json`](claim.audit.json) | Claim-level evidence audit using generic source IDs and aliases |

## Boundary

This example does not approve or reject a project. It does not provide legal, compliance, procurement, tax, customs, sanctions, export-control, financial, insurance, or investment advice.
