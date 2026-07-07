# Agent Readiness Checklist

status: build-to-learn · classification: portfolio-proof · updated: 2026-07-06

A pre-publication readiness checklist for operators shipping an agent surface — an MCP server, an A2A endpoint, or both — plus a static linter (`validate-agent-card`) that checks a published agent card against it. The stance in one line: **MCP-first, A2A-later, payment-safe, human-escalated.**

This is declaration hygiene for delegation: can a stranger's agent (or a registry crawler) read your card and know who operates the surface, what it does and does not do, how to authenticate, what it may never spend, and when a human takes over. It is not a security audit, not a compliance review, and not a claim that a well-declared agent is a trustworthy agent.

## Why this exists (observed registry telemetry)

One public registry index reported, as of 2026-07-06 (live dashboard, on-chain-only revenue methodology): 4,235 agents indexed → 65.8% with valid cards → 5.9% live → 0.6% with signed cards → 0.5% with any 30-day on-chain revenue ($491 total across 21 agents).

Read plainly: most published agents fail at declaration and liveness hygiene long before demand is the constraint. This checklist covers the declaration part — the part an operator controls before launch. Label: supply-side observation from one index; not a demand claim for this or any product.

## Stance

- **MCP-first.** Ship the MCP surface first; it is the practical integration standard today. Keep the A2A endpoint a thin wrapper over the same service layer (this repo's layering rule in [AGENTS.md](AGENTS.md)).
- **A2A-later, but declared properly.** If you publish an A2A card, publish it well: signed, attributed, security-declared. A half-declared card is indexed as noise.
- **Payment-safe.** No payment surface on the card until limits, caps, and permission scope are declared next to it. An agent wallet without declared limits is a liability, not a feature.
- **Human-escalated.** The card text states the autonomy boundary and the human-review path explicitly. Downstream agents cannot infer restraint; it must be declared.

## Delegation-readiness checklist

What `validate-agent-card` checks statically on the card. Each check is `covered`, `gap`, or `not_applicable`.

| Check | Declare | Failure mode if absent |
|---|---|---|
| `identity_attribution` | provider org + url, `version`, `documentationUrl` | Anonymous surface; registries and buyers discount it |
| `capability_scope` | per-skill description + tags, input/output modes | Callers guess capabilities; misrouted requests |
| `interface_contract` | `supportedInterfaces[]` with url, binding, version | Integration requires trial-and-error probing |
| `security_declaration` | `securitySchemes` with actionable descriptions | Callers cannot authenticate; open posture stays implicit |
| `autonomy_boundary` | explicit limits + human-escalation statement (heuristic check) | Delegation without restraint; overclaimed authority |
| `payment_permissions` | if any payment surface: limits, caps, scope beside it | Unbounded spend authority declared to strangers |
| `operator_contact` | provider url + documentation url | No abuse/incident path to the operator |

The `autonomy_boundary` check is a text heuristic (it looks for an explicit boundary or human-oversight statement in card text); treat a `covered` there as "statement present", not "oversight implemented".

## Registry conformance preflight (static subset)

Registries score published agents on conformance. The linter pre-checks the statically checkable subset of the public Agenstry 9-criterion methodology v1.0 ([spec](https://agenstry.com/api/schemas/conformance.json), CC-BY-4.0) before a crawler does:

- Static (checked here): `valid_card_shape` (structural, not the official A2A schema), `protocol_version_string` (`"1.0"` as a string), `jws_signature_present` (accepts the A2A `signatures[]` array or a compact detached JWS `signature` string; presence/shape only — **not** cryptographic verification), `skills_declared`, `provider_attribution`, `business_identity_declared` (declaration only).
- Live-only (skipped here, honestly reported as skipped): `live_jsonrpc`, `uptime_track`, `freshness` — these require probes against the running endpoint.

## Run it

```bash
# lint a local card file
agenda-intelligence validate-agent-card path/to/agent-card.json

# fetch a live card first, then lint; --strict exits 1 on any gap
curl -s https://your-agent.example.com/.well-known/agent-card.json -o card.json
agenda-intelligence validate-agent-card card.json --format json --strict
```

Output contract: [schemas/v1/agent-readiness-report.schema.json](schemas/v1/agent-readiness-report.schema.json). Implementation: [src/agenda_intelligence/agent_readiness.py](src/agenda_intelligence/agent_readiness.py). This repo's own live A2A card (served from [deploy/cloudflare-worker/](deploy/cloudflare-worker/)) is the reference shape the golden test fixture is modeled on.

## Boundary

- Structural lint of declared fields only; declarations are not verified against behavior.
- No endpoint probing, no uptime checks, no reputation scoring.
- JWS signature check is presence/shape only; cryptographic verification against a JWKS is out of scope.
- Not a security audit, penetration test, or threat model.
- Not legal, compliance, sanctions, financial, or insurance advice.

## Evidence status and kill rule

Demand for this checklist is a hypothesis, not an observed buyer need; the registry telemetry above shows a supply-side gap, which is not the same thing. Kill rule: if two weeks after publication there is no external usage signal (an issue, a mention by a practitioner, a run against a third-party card we did not solicit), this stays a portfolio artifact and gets no further investment.
