# ADR 0033: Critical Minerals documentary readiness

Date: 2026-10-05. Accepted.

## Problem

Document-type presence was sufficient to claim verified provenance. Country and
commodity heuristics asserted legal restrictions, and the US incentive branch
ignored the 2025 credit termination. Python and Worker domain text diverged.

## Decision

Keep endpoints, required input fields and response enums. Add optional source
excerpt, declared scope, document_id, valid_until and assessment_date fields;
add structured dossier_review output with policy version `mineral-dossier.v2`.
This is a conservative behavioral correction: label-only legacy requests remain
valid but cannot obtain readiness by naming documents. A complete dossier returns
require_approval, not transaction permission. No independent verified-origin status
is issued. Source text remains data, never executable instructions.

A pure reviewer accumulates source quality rows, de-duplicates document references
and derives stage-specific owner tasks before service formatting (ADR 0021).
Assessment time is supplied explicitly; missing time is a stated limitation.
The Python and Worker implementations must agree at the public contract seam.

CSDDD is an applicability question, not a universal mandatory certification. The
old audit type aliases responsible-sourcing evidence. Country/commodity labels do
not establish legal quotas, monopoly or FEOC results. Legacy false exposure flags
mean not established, never clearance. Natural/enriched uranium and EU/US market
scopes must be distinguished by humans. Ore assay cannot qualify aerospace titanium.

Enabled upstream sanctions/DLP findings remain policy blocks with human review;
name screening is not identity verification or an OFAC ownership aggregation.
Unavailable DLP screening must not be called an observed secret leak, and upstream
blocks cannot leave review_ready/100 in the result.

## Consequences

All five decision stages have distinct evidence requirements. Investment requires
foundational concession and ownership evidence too. Score reflects documentary
coverage, not safety or project bankability. Synthetic examples use fictional
issuers and never imply completed third-party diligence. No new external data
subscription, automatic legal rule engine or settlement is introduced.

Commercial value remains a hypothesis: test whether one procurement team uses the
owner-action list to shorten dossier preparation; do not count free demos or bot
requests as paying customer validation.
