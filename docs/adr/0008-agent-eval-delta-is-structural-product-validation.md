# Agent-Eval Delta is structural product validation, not factual verification

v0.9 uses **Agent-Eval Delta** as the product-shell validation surface for agent integrators. It is a per-case structural comparison of agent output with and without the Agenda Intelligence product shell wired in: provenance tags applied, signal classification produced, watch-next indicators present, uncertainty disclosed, evidence mode declared. It is not factual verification, not aggregate accuracy, and not a model-quality comparison.

Agent-Eval Delta replaces the previous validation framing only for the agent-first audience. **Practitioner Review** remains optional and audience-gated for buying-side trust and is not required for product-shell validation. **Benchmark** continues to mean deterministic protocol conformance across example cases as defined in CONTEXT.md.

Live retrieval is not part of Agent-Eval Delta. Example cases that rely on current sources checked upstream of Agenda Intelligence map to `user_provided` or `mixed` `evidence_mode` when run through `analyze`; `live_source_backed` is intentionally absent from `agenda-request.schema.json` and stays that way before v1.0.
