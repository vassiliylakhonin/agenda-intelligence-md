# ADR 0017 — A2A wire contract migrates to A2A protocol v1.0

Status: accepted
Date: 2026-06-01

## Context

The A2A protocol shipped its first stable release, v1.0 (from v0.3.0), with breaking changes to the interaction wire format. The relevant breaking changes for this repo's A2A surface are:

- **Part type unification.** `TextPart` / `DataPart` / `FilePart` with a `kind` discriminator are removed; a part is now a single object discriminated by member presence (`text`, `data`, `url`, `raw`) with a `mediaType` field.
- **Task state enums.** `TaskStatus.state` values move from kebab/lowercase (`"completed"`, `"failed"`) to `SCREAMING_SNAKE_CASE` with a `TASK_STATE_` prefix (`"TASK_STATE_COMPLETED"`, `"TASK_STATE_FAILED"`).
- **Message role enums.** `"user"` / `"agent"` → `"ROLE_USER"` / `"ROLE_AGENT"`.
- **Agent Card structure.** `protocolVersion` / `preferredTransport` / `url` move into a `supportedInterfaces[]` array, each interface declaring its own `url`, `protocolBinding`, and `protocolVersion`.

Before this change the repo's A2A surface was internally inconsistent: both the deployed Cloudflare Worker and the Python `a2a_adapter` **advertised `protocolVersion: "1.0"` in the agent card while emitting v0.3-shaped response bodies** (`kind`-discriminated parts, lowercase `state`). The Worker card had already adopted `supportedInterfaces[]` and JWS signing; the response body had not been migrated. The card claimed conformance the body did not meet.

This violated the AGENTS.md honesty rule (do not claim what is not true) and would fail a strict A2A v1.0 validator. The Agenstry conformance checklist also scores a literal `protocolVersion: "1.0"` (+10); keeping that score honest requires the body to actually be v1.0.

The A2A v1.0 announcement confirms the AgentCard evolved backward-compatibly and that official SDKs bridge v0.3 ↔ v1.0, so there is no forced cutover and inbound v0.3-shaped requests can still be accepted.

## Decision

**Migrate the A2A response wire to A2A protocol v1.0** across both A2A surfaces (`src/agenda_intelligence/a2a_adapter.py` and `deploy/cloudflare-worker/src/index.js`), and align the agent cards accordingly:

- Response parts emit member-discriminated objects with `mediaType` (`{"text": ..., "mediaType": "text/markdown"}`, `{"data": ..., "mediaType": "application/json"}`) — the `kind` field is removed.
- `status.state` emits `TASK_STATE_COMPLETED` / `TASK_STATE_FAILED`.
- The Python adapter card gains `supportedInterfaces[]` (JSONRPC binding, `protocolVersion: "1.0"`), matching the Worker card already in production.
- **Inbound** request parsing is unchanged: it is already member-based (reads `part.text` / `part.data`), so it accepts both v0.3 and v1.0 request shapes. Example request payloads in docs/examples are updated to the v1.0 form, but old-style `kind` requests remain accepted for backward compatibility.

### Scope and version

This is a **breaking change to the A2A wire surface only**. It does **not** touch the request/memo/product JSON Schemas under `schemas/v1/`; the v1.0.x schema-family contract freeze (ADR 0003) remains in force and untouched. Because the package's frozen contract is the schema family — not the A2A response envelope — this ships as a **minor** version bump (1.0.2 → 1.1.0), with the breaking-for-A2A-consumers detail recorded here rather than as a package major.

Not adopted now (no consumer, deferred until a real user or strict validator requires it): streaming-event wrapper discrimination, cursor pagination, `google.rpc.Status` error envelope, message `role` enum on the emit side (the adapter does not emit roles), OAuth flow changes, multi-tenancy, extension requirement checking. These are tracked as future work, not part of this ADR.

## Consequences

- The `protocolVersion: "1.0"` claim is now honest: the body is genuinely v1.0-shaped.
- A2A clients that hard-coded the v0.3 response shape (`part.kind`, lowercase `state`) would break — there are no known external consumers (live demo, no paying customers), so this is acceptable now and recorded for traceability.
- The Agenstry conformance `protocol_version` score remains earned rather than asserted.
- Worker and package versions are realigned to 1.1.0 (the Worker had drifted to 1.0.1).

## References

- A2A v1.0 "What's New" migration guide (a2a-protocol.org).
- ADR 0003 — request/memo contract freeze (unchanged by this decision).
- AGENTS.md — honesty rules; change discipline (breaking changes require ADR + version bump).
