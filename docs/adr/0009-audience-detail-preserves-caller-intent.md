# Audience detail preserves caller intent alongside enum

The `audience` field in `agenda-request.schema.json` is enum-bound to `founder`, `analyst`, `policymaker`, `investor`. This shape is intentional: it gives `analyze` a small, prompt-routable set of audience prototypes. The first agent-eval run (`evals/agent-eval/gtta-global-policy.md`) showed the cost: a caller targeting "AI company leadership, product and compliance teams" was silently coerced to `founder` to satisfy the enum, losing audience specificity at the boundary.

To preserve caller intent without breaking the enum-keyed prompt logic, requests may also carry an optional `audience_detail` string. When present, the server renders it into the verified request-context block alongside `audience`, so the host model sees both the prototype and the original framing. `audience` remains the prompt-routable signal; `audience_detail` is descriptive only. This is an additive optional field per ADR 0003, safe in v0.x.
