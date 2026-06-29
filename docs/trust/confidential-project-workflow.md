# Confidential Project Workflow

Use this workflow when an evidence-readiness review involves a private deal file, investment project, procurement packet, financing data room, strategic infrastructure project, or any source pack where company names, counterparties, people, dates, amounts, sites, or document titles may identify the client or transaction.

This is a confidentiality discipline for Agenda Intelligence MD outputs. It is not a security certification, legal review, privacy assessment, or replacement for the client's data-handling policy.

## Default rule

Do not require real company names to produce value.

The useful unit is the evidence relationship:

```text
claim -> source item -> support level -> evidence gap -> owner action -> decision route
```

Named entities should be replaced with stable aliases unless the caller explicitly confirms that names are public and safe to repeat.

## Alias protocol

Use generic aliases that preserve workflow role without identifying the party:

| Sensitive item | Alias pattern |
|---|---|
| Project company | `ProjectCo` |
| Holding company or sponsor | `SponsorCo` |
| Public authority | `Public-Authority-1` |
| Bank or DFI | `Lender-1`, `DFI-1` |
| OEM | `OEM-A` |
| Integrator | `Integrator-B` |
| Site, colocation, or power provider | `Site-Provider-1` |
| Anchor customer | `Anchor-Customer-1` |
| Legal, tax, or technical adviser | `Advisor-1` |
| Named executive or official | `Executive-1`, `Official-1` |
| Country or city, if sensitive | `Jurisdiction-1`, `City-1` |

Keep aliases stable inside one packet. Do not reuse the same alias for different parties.

## Redaction checklist

Before producing a public or shareable artifact, replace or generalize:

- Company, bank, vendor, customer, adviser, ministry, and individual names.
- Exact meeting dates, call times, and internal deadlines that can identify the file.
- Exact deal values, power capacity, volumes, prices, account names, and customer demand unless already public and approved for reuse.
- Site names, project code names, tender IDs, procurement IDs, internal document titles, and file paths.
- Signature status, NDA status, and negotiation status for named counterparties.
- Quotes from private documents unless the caller explicitly marks the excerpt as safe to include.
- Email addresses, phone numbers, personal names, account IDs, and direct contact details.

Preserve what the reviewer needs:

- Document type.
- Evidence age or freshness.
- Source role.
- Claim being tested.
- Support level.
- Missing evidence.
- Likely owner action.
- Decision route.
- Normalized `readiness_contract` for cross-profile routing.

## Readiness contract

For project-room outputs, include a `readiness_contract` block that mirrors the
review state without adding a new decision.

Use:

- `profile: confidential_project_room`
- `status`: the `readiness.route`
- `score: null` unless a separate scoring rubric is explicitly defined
- `routing`: the readiness route as a named value
- `blocking_gaps`: claim gaps that block human review, committee review, public reuse, lender review, or procurement handoff
- `claim_audit`: compact claim IDs, support levels, evidence IDs, and repeatability status
- `owner_actions`: the existing owner-action list
- `boundary_notice`: a short non-advice / non-approval notice

## Source item handling

Use local source IDs instead of private file names:

| Source ID | Source role | Date / age | Confidentiality | Notes |
|---|---|---:|---|---|
| `S1` | Feasibility study excerpt | current / stale / unknown | confidential / redacted / public |  |
| `S2` | Vendor proposal | current / stale / unknown | confidential / redacted / public |  |
| `S3` | Board or committee memo | current / stale / unknown | confidential / redacted / public |  |

Do not place private source text in public examples. Summarize the evidence role and limitation instead.

## Output boundary

A confidential evidence-readiness packet may say:

- "The vendor-delivery claim is only partially supported by `S2` because the proposal omits shipment timing and export-control conditions."
- "The demand claim should not be repeated externally without a signed term sheet or a redacted customer letter."
- "The file is `not_decision_ready` for committee review because tax treatment, delivery route, and anchor demand are unsupported."

It must not say:

- "The project is legally approved."
- "The vendor is compliant."
- "The buyer should invest."
- "The financing will close."
- "The named counterparty is safe, sanctioned, reliable, or unreliable."

## Logging discipline

For private workflows, wrappers should log only operational metadata:

- `request_id`
- endpoint or tool name
- status
- duration
- input size
- selected template or source-requirement category

Do not log:

- prompt text
- evidence packs
- document excerpts
- private names
- exact deal terms
- full memo content
- API keys or credentials

Full-payload logging must be explicit opt-in and documented outside the default workflow.

## Public example rule

Public repo examples must be synthetic or public-only.

If a private review inspires a reusable template, extract only the generic workflow pattern. Do not include the client sector combination, named parties, exact timing, unusual financing structure, or distinctive sequence of events if those details can identify the transaction.
