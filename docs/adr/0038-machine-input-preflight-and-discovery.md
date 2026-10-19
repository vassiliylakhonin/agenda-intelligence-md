# ADR 0038: same-origin machine contracts and schema-only preflight

Status: accepted. Date: 2026-10-19.

## Decision workspace

- goal: let a client discover a tool's input, example, advisory output and payment conditions without executing it or spending a trial.
- trusted_evidence: actual Worker tool catalogs, generated input/output schemas, existing payment admission code and offline standard-client tests.
- suspected_unreliable_evidence: stale shared legacy payment copy, HTML schema links and synthetic examples mistaken for real source verification; directory scores are not execution guarantees.
- hidden_assumptions: the caller explicitly trusts the serving origin; discovery can be stale; schema conformance does not imply successful admission or supported evidence.
- intended_next_action: publish additive metadata, a bounded schema preflight, mirrored schemas and tested client; use existing reviewed release/deploy gates.
- stop_or_escalate_if: schema mismatch, changed evaluation prices/auth/quota, dynamic schema compilation, unsigned payment acceptance or a failed required release gate.

## Contract

Expose `/.well-known/agent-contract.json` (`contract_version: agent-call.v1`) with profile/version, task selection text, actual authentication, MCP/A2A endpoints, `validation`, `offers`, advisory `decision_contract` and `retry_policy`. Each offer names a published tool and links its input/output schema and synthetic example on the same origin. A missing example is explicit, never a fabricated valid receipt. Fleet entries link to this host contract rather than inferring another host's runtime configuration.

`POST /v1/validate-input` and MCP `validate_input` accept only `{tool,input}`. The selected tool must belong to this host; `free_trial` uses its raw input shape only if the trial is enabled. See the input-validation schemas for success and invalid-input results. Invalid input returns a successful validation operation with `valid:false`, bounded schema findings and JSON Pointer `missing_fields`; malformed wrappers and unavailable tool names return errors. No evaluated result or receipt is created, no allowance or money is reserved, and production authentication still applies. Supplied payment credentials are refused. It is not an evaluation mode flag on paid routes.

Compile pinned Ajv validators at build time from published schemas and bundle pure helpers into committed JavaScript. No runtime eval, caller-provided schemas, remote references or network calls. Bound JSON to 256 KiB, depth 64 and 10,000 nodes, with at most 64 findings. Do not echo submitted values in findings. Input schema validation does not establish source truth, authenticity, policy approval, permission or available trial quota.

Retain existing domain verdicts and `next_action: block | review | insufficient` with `authorization_granted:false`; use each output schema to locate legacy envelopes. Do not invent `continue`, a universal receipt or an approval/resume token. An actual policy authority and enforcing integration would be needed to implement those semantics.

Synchronize payment discovery with configured x402 v2. Show per-operation offers and label shared optional subscriptions/dossiers and the legacy activation endpoint separately. The exact operation's current 402 challenge remains authoritative; discovery is not a payment instruction. Preserve existing prices, settlement validation, request binding and exact-request recovery. Changed evidence needs a new digest/admission. Do not claim maintainer-tested live settlement or third-party certification.

## Compatibility and verification

Additive hosted MCP utility and fleet fields require a minor release and refreshed monitor inventory. Financial Guard and Escrow keep their existing `request` wrappers while publishing the complete nested input schemas. Existing direct/raw compatibility paths remain. The generic example client follows only same-origin links from an explicitly trusted origin, rejects redirects and does not evaluate, fund, sign or retry.

Tests cover all twelve profiles, actual examples, REST/MCP parity, schema failures, production authorization, cross-profile/oversized inputs, payment rejection, no ledger reservations, payment-402 parity and cross-origin link refusal. Full repository and Worker checks plus marked post-deploy discovery/preflight probes are required. Synthetic tests and owner probes are not customer demand or usefulness evidence.
