# MCP connection measurement decision

- goal: identify hosted MCP connection obstacles before expanding Worker features.
- trusted_evidence: tool execution already emits usage/payment events; parsed initialize, server/discover and tools/list requests emit no funnel events. Output Verification's campaign allowance is five; x402 prose still says two.
- suspected_unreliable_evidence: request labels and caller fingerprints do not establish customer identity. Partial provider coverage cannot establish absence of usage.
- hidden_assumptions: aggregate connection observations help locate integration failures; discovery alone does not establish demand or successful task completion.
- intended_next_action: add bounded discovery observations using the existing funnel source, aggregate them separately in the private vault, align advertised trial allowance with the existing policy, run local/CI checks and gated fleet deployment.
- stop_or_escalate_if: authorization, payment, signing or deployment gates fail; telemetry would expose request content or credentials; historical missing observations would become certified zeros.

Only actual recognized MCP discovery methods are recorded. No request bodies,
clientInfo strings, JSON-RPC IDs or user-provided protocol strings are added.
Owner verification remains excluded; connection rows are not evaluations,
payments or confirmed customers. Earlier dates remain unmeasured.
