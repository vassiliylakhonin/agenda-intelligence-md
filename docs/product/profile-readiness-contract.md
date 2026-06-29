# Profile Readiness Contract

`readiness_contract` is an additive normalized view over profile-specific
responses. It exists so agents, dashboards, and project-room workflows can
compare evidence-readiness outputs without flattening away profile detail.

It is not a replacement for the profile response. The profile-specific fields
remain the source of truth for sector language, source requirements, claim
audit detail, owner actions, watch indicators, limitations, and boundary
notices.

## Boundary

`readiness_contract` does not provide legal, compliance, sanctions, customs,
tax, financial, investment, insurance, cybersecurity, fraud, procurement, or
launch-authorization advice. It does not perform factual-truth verification,
identity verification, sanctions screening, approval, clearance, or autonomous
decision-making.

## Shape

Every profile that emits `readiness_contract` uses this minimum shape:

```json
{
  "profile": "cis_secondary_sanctions",
  "status": "not_decision_ready",
  "score": 42,
  "routing": {
    "field": "triage_recommendation",
    "value": "escalate_before_onboarding"
  },
  "signal": {
    "field": "secondary_exposure_signal",
    "value": "medium_high"
  },
  "blocking_gaps": [],
  "non_blocking_gaps": [],
  "claim_audit": [],
  "owner_actions": [],
  "watch_next": [],
  "human_review_required": true,
  "boundary_notice": "Evidence-readiness triage only..."
}
```

Rules:

- `status` is the profile's existing readiness/status label.
- `score` is the existing 0-100 readiness score when the profile has one;
  otherwise it is `null`.
- `routing` points to the existing recommendation field, such as
  `triage_recommendation` or `gate_decision`.
- `signal` points to the existing risk/trust/exposure signal when present;
  otherwise it is `null`.
- `blocking_gaps` is copied from the profile's existing `evidence_gaps`.
- `claim_audit` and `owner_actions` are copied when the profile already emits
  them; otherwise they are empty arrays.
- Missing data is not invented. Empty arrays and `null` are preferred over
  inferred content.

## Compatibility

The field is optional in response schemas and is not listed in `required`.
Consumers that already read profile-specific fields can continue doing so.
New consumers can read `readiness_contract` as a stable navigation layer and
then drill into the profile-specific fields for detail.
