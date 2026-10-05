# ADR 0034: Fleet reference and screening boundaries

Date: 2026-10-05. Accepted.

## Evidence

Caller-level probes reproduced impossible dates increasing readiness, complete
reference labels implying low risk or high trust, open market-entry blockers
allowing progression, and asserted guarantees waiving DSCR screening. Five
adapters discarded an earlier adverse name match after a later failed request.
The BIS CHPL reference distinguishes electronics equipment (4A) from CNC (4B)
and lists exact HS6 categories; the former four-digit prefix table overmatched.

## Decision

Keep v1 required fields, endpoints and enums. Add optional `source_record_review`
with policy `source-records.v1` to the legacy evidence services. Pure reference
review runs before scoring and response assembly (ADR 0021). Reject invalid
calendar dates, blank record identities and conflicting types attached to one ID
from coverage. Preserve caller adverse reports even when their reference is
malformed. Metadata review cannot establish document authenticity, content
support, recency, entity identity or actual risk. The Critical Minerals scoped
excerpt policy and Output Verification literal-text policy remain separate.

Complete reference sets can be ready for human dossier review, with actual risk
unknown and no action authorization. Agentic Trust always routes complete sets
for human review; trust cannot rise above medium from declarations. Outstanding
caller blockers pause market entry and create owner tasks. Screening flags and
configured outages constrain readiness before formatting. A later upstream
failure preserves earlier adverse matches. Unavailable DLP is incomplete
screening, never an observed leak. Unscoped name/ownership-screen receipt bytes must not
appear as clearance; raw diagnostic output remains available. Existing DLP-only
receipt fields retain their explicit scan scope for compatibility; they grant no
action authority.

Use the BIS 2024-02-23 snapshot's 50 exact HS6 codes. A valid 8–10 digit national
code may use its first six digits. A four-digit heading is unresolved. Non-list
membership supplies no export permission. Ask for applicable jurisdiction,
classification, end-use and Russia-related financial-institution context before
legal conclusions. The reference date is explicit and updates remain necessary.

Keep illustrative finance thresholds as assumptions. An asserted guarantee
requires document/legal review and cannot waive DSCR. No-debt scenarios have
inapplicable debt-coverage checks. Principal-only reserve estimates exclude
interest and fees and do not establish lender requirements.

## Compatibility and verification

These are conservative behavioral corrections; inputs remain valid and existing
response enum values remain available. Optional fields are mirrored into packaged
schemas, generated Worker contracts and TypeScript types. Golden outcomes change
where older recommendations contradicted their evidence. Regression probes
exercise public callers, preserve real flags and test partial-failure paths.
CI and the existing protected Vizier workflow must pass before release.
