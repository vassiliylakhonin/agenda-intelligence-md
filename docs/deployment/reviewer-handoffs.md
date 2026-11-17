# Evidence handoffs for a reviewer

Use the saved synthetic example first to see the output. For a pilot, choose one
workflow the team already runs and have its reviewer assess the result in the
existing process. Use redacted examples when sharing outside approved storage.

## Strategic-risk memo

- **For** an analyst preparing a memo for a risk lead.
- **Bring** the pending decision, draft, dated sources and proposed follow-up.
- **Hand over** the memo and a short list of missing references, vague monitoring
  indicators and actions that need owners. Ask the reviewer which findings
  changed the memo. For a raw question, start with the free route and evidence plan.

[Memo check instructions](memo-quality-gate.md)

## External agent request

- **For** a platform engineer and the owner of the tool receiving an external call.
- **Bring** the claimed actor, action, target, delegation and dated records.
- **Hand over** the missing identity and authority evidence plus the suggested
  route. Confirm the actor and enforce any approval in the tool owner's existing
  authorization path. Measure which missing records the review caught.

[Saved unknown-agent result](../../examples/agentic-interaction-trust/contract/unknown_a2a_agent_escalate.response.json) · [Pre-invoke integration](../../examples/agentic-interaction-trust/README.md)

## Counterparty onboarding

- **For** a trade operations lead preparing a CIS, Caucasus or Central Asia file
  for compliance.
- **Bring** the legal-entity name, jurisdiction, registry identifiers, disclosed
  owners, exposure scope and dated screening or registry results.
- **Hand over** a document request list and any potential name matches with
  their source, date and subject identifiers. A reviewer resolves possible
  matches, ownership and applicable rules. Compare which gaps would have sent the
  file back to operations.

[Saved onboarding result](../../examples/cis-secondary-sanctions/contract/escalate_before_onboarding.response.json) · [Source types and screening limits](../use-cases/cis-secondary-sanctions.md)

## Kazakhstan market entry

- **For** a project lead preparing a partner-signature, launch or committee decision.
- **Bring** the project, partner, decision stage and dated evidence already collected.
- **Hand over** the stage-specific gaps, suggested owners and committee brief.
  Ask legal, tax, banking and operations to confirm applicability and ownership
  before sending the brief. Compare time spent chasing missing records.

[Saved partner-signature result](../../examples/kazakhstan-market-entry-readiness/contract/pre_signature_validation.response.json) · [Owner plan and committee memo](../use-cases/kazakhstan-market-entry-readiness.md#local-preparation-and-owner-plan)

## Mineral supplier or offtake

- **For** procurement or counsel reviewing a supplier, project or offtake.
- **Bring** the decision scope, commodity, origin and processing locations,
  assessment date and dated excerpts tied to the claim and project.
- **Hand over** the missing document types, scope or date concerns and draft
  requests for the supplier. Compare the follow-up only for the same scope and
  have the reviewer confirm the source and suitability of each new record.

[Saved comparison result](../../examples/critical-minerals-due-diligence/contract/evidence_revision.response.json) · [Requesting evidence and rechecking](../use-cases/critical-minerals-due-diligence.md#from-missing-evidence-to-an-updated-dossier)

## Technology export

- **For** logistics or export operations preparing a file for export control review.
- **Bring** the goods and specifications, declared HS code and any supplied ECCN,
  transits, end user, end use and supported document references.
- **Hand over** the document gaps and checklist for the qualified reviewer.
  A reference-list HS result is a screening lead. Keep classification,
  licensing and release decisions in the reviewer's existing workflow.

[Saved export-review result](../../examples/dual-use-technology-export/contract/decision_ready.response.json) · [Evidence and review limits](../use-cases/dual-use-technology-export.md#export-review-readiness)

## Trade question

- **For** an operations lead unsure which specialist should review a shipment or
  counterparty.
- **Bring** one sentence about the cargo, route or counterparty and the decision
  coming up.
- **Hand over** the suggested review route and its list of required inputs.
  On a supported route, review the locally prepared draft and add actual
  source records before submitting to the specialist.

[Routing and local handoff](../use-cases/corridor-sanctions-assistant.md)
