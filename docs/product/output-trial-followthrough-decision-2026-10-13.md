# Output Verification trial follow-through decision workspace

- goal: let interested users iterate on evidence, keep completed results reviewable and collect optional useful-next-step feedback.
- trusted_evidence: owner authorizes implementation, merge and production; local regression reproduces loss of completed review/feedback on refused retries; existing D1 completion receipts and KV usage are separate from provider-delivered console logs.
- suspected_unreliable_evidence: fingerprints and browser labels do not identify customers; missing usage logs do not establish a runtime emission failure; no usefulness replies or paid completions observed.
- hidden_assumptions: five campaign attempts allow iteration; existing reservations remain counted; availability is advisory and atomic POST admission remains authoritative.
- intended_next_action: regression-first five-attempt Output experiment; preserve successful result/feedback on refused or failed retries; make result feedback explicit; diagnose usage coverage using bounded read-only queries and runtime emission checks; run required checks and protected deployment.
- stop_or_escalate_if: test/gate failure, mixed-deployment verification failure, need for credentials beyond existing access, or any change to paid authorization, reservation history or provider data retention.

Scope: Output Verification gets five attempts per network for the campaign; other products retain two. Shared fleet cap remains 1,000 per UTC day. Keep the existing campaign namespace so used reservations count. Do not treat self-reported feedback or five attempts as proof of product-market fit. Assess new completions, repeat attempts, refusals, feedback and confirmed paid executions in later telemetry.
