# Browser request-surface diagnostics decision

- goal: distinguish future claimed first-party browser submissions while investigating malformed A2A requests.
- trusted_evidence: 41 archived malformed A2A refusals include form-encoded and multipart media. Reproduction through the actual handler returns HTTP 400; its published JSON repair reaches HTTP 402 without evaluation. Current emitted first-party forms send JSON to REST trial/evaluation routes.
- suspected_unreliable_evidence: original bodies are unavailable; browser-family fingerprint joins do not establish a sender. The existing evidence cannot attribute those refusals to our UI or a particular catalog.
- hidden_assumptions: a finite surface claim helps future diagnosis but remains spoofable. Unclaimed or historical missing values cannot establish external demand.
- intended_next_action: add a same-origin-only browser header and bounded payment-event field, verify bundled submissions and refusal/auth/payment boundaries, then release through existing tests and the Vizier fleet gate.
- stop_or_escalate_if: telemetry would retain arbitrary labels or input, caller hashes or access rules change, or a build/deployment gate fails.

The header is not an identity, purpose exclusion or access credential. Old
events remain unattributed. Form-encoded A2A payloads remain invalid JSON;
loosening the parser without evidence would hide incorrect client behavior.

A separate owner-authorized local self-review of a public research article
found a quote mismatch and missing evidence reference. A semantically false
claim paired with an exact source quote still passed structural checks with
mandatory human review. This is a known boundary, not factual verification,
independent human feedback, a hosted trial completion or customer traction.
