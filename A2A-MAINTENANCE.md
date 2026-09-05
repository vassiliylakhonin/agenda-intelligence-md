# A2A maintenance

The Cloudflare deployments use one implementation:
`deploy/cloudflare-worker/src/index.js`. Deployment-specific behavior comes
from `wrangler.toml` profiles. Do not fork protocol handling into a separate
Worker unless the protocol behavior itself must differ.

## Protocol target

- Agent Cards advertise A2A `1.0` through `supportedInterfaces`.
- The JSON-RPC method is `SendMessage`.
- `A2A-Version: 1.0` is accepted and recommended in explicit probes.
- A successful response preserves the request `id` and returns either
  `result.task` or `result.message`.
- The legacy `message/send` and `tasks/send` methods remain unadvertised A2A
  `0.3` compatibility aliases. They retain the older direct-Task result shape.

A successful HTTP 200 is not sufficient evidence of A2A conformance.

Normative references:

- [A2A v1.0 specification](https://a2a-protocol.org/v1.0.0/specification/)
- [A2A v1 changes](https://a2a-protocol.org/latest/whats-new-v1/)
- [A2A v1.0.1 release](https://github.com/a2aproject/A2A/releases/tag/v1.0.1)

## Active deployments

| Wrangler environment | Public origin | Profile |
|---|---|---|
| default | `https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev` | `agenda` |
| `middle-corridor-deal-risk-gate` | `https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev` | `kazakhstan` |
| `cis-secondary-sanctions` | `https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev` | `cis_secondary_sanctions` |
| `agentic-interaction-trust` | `https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev` | `agentic_interaction_trust` |
| `gulf-maritime-exposure` | `https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev` | `gulf_maritime_exposure` |
| `kazakhstan-market-entry-readiness` | `https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev` | `market_entry_readiness` |
| `agent-output-verification` | `https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev` | `agent_output_verification` |
| `corridor-sanctions-assistant` | `https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev` | `corridor_sanctions_assistant` |
| `critical-minerals-due-diligence` | `https://critical-minerals-due-diligence-a2a.vassiliy-lakhonin.workers.dev` | `critical_minerals_due_diligence` |
| `dual-use-technology-export` | `https://dual-use-technology-export-a2a.vassiliy-lakhonin.workers.dev` | `dual_use_technology_export` |

Every deployment exposes:

- `GET /.well-known/agent-card.json`
- `GET /.well-known/jwks.json`
- `GET /health`
- `POST /message/send`


## Deprecated deployment

`https://kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev` was
removed in `fa4ab2d` (2026-05-31) and must not be reintroduced into discovery
files, `server.json`, `entitymap.json` or `scripts/verify-public-agents.js`.
Its profile is served by `middle-corridor-deal-risk-gate-a2a`.

Since 2026-09-02 the name serves a tombstone Worker from
`deploy/tombstone-kazakhstan-corridor-risk`: `410 Gone` on every path, with
`Sunset`, `Deprecation` and a `Link` header naming the successor. A retired
name should say it is gone rather than say nothing, and 410 is terminal where
the 404 from an unclaimed `workers.dev` host reads as "try again later".

Its first hours drew no external traffic, and this file said so, and said to
expect no change in request volume. Both statements were true and are no longer.
Measured over the 48h to 2026-09-05 the retired name took 24 external requests
from five distinct clients — `fasthttp` from Singapore, `TAR-Directory-Indexer`,
`A2A-Registry-Healthbot/1.0 (background-job)`, `jscrawler`, and Mac browsers —
fetching `/.well-known/agent-card.json`, `/`, `/robots.txt` and `/sitemap.xml`.
Stale listings are alive, they are being walked, and the crawlers walking them
now get 410 and a successor instead of a bare 404. Two hours was too short a
window to conclude from; a directory's crawl cycle is measured in days.

The tombstone carries no profile, no bindings and no discovery documents, and
stays out of the public matrix: it is not a deployment, it is the record of one
that ended.

### Reading `__unknown__` in Workers analytics

`workersInvocationsAdaptive` files a request under `__unknown__` when no
current script claims the name it arrived on, with no script tag and no
environment. The bucket ran at roughly 1,500 requests a day from at least
2026-08-03 — the far edge of analytics retention — and stopped at 2026-08-27
13:00 UTC. It has been zero since. What produced it is no longer recoverable:
Workers Logs keep 72 hours on the free plan, so the request lines for that
period are gone, and the analytics dataset carries neither host nor path.

Two cautions for anyone reading this bucket later, both learned the hard way
on 2026-09-02. A seven-day window ending after the traffic stopped still shows
a large total, and dividing that by seven turns a finished process into a
convincing weekly rate — group by hour and look at the shape before believing
any rate drawn from a window. And `__unknown__` is not evidence about any
particular retired hostname. It says only that some name went unclaimed, never
which one.

## Verification

Run local checks from `deploy/cloudflare-worker`:

```bash
npm run test:a2a
node scripts/verify-agent-card.js
```

After deployment, run the public matrix. It checks all ten Workers plus the
portfolio discovery alias:

```bash
npm run verify:public-agents
```

To verify a staged deployment before changing the others:

```bash
npm run verify:public-agents -- agent-output-verification
```

The public matrix checks discovery status and content type, the advertised
interface, `SendMessage`, request/response `id` correlation, the Task/Message
result wrapper, and JSON-RPC parse/request/method/parameter errors.

## Deployment

Deploy one lower-impact profile first, verify it, then deploy the remaining
profiles. The default Worker has no `--env` argument.

```bash
cd deploy/cloudflare-worker
npx wrangler deploy --env agent-output-verification
npm run verify:public-agents -- agent-output-verification

npx wrangler deploy
npx wrangler deploy --env middle-corridor-deal-risk-gate
npx wrangler deploy --env cis-secondary-sanctions
npx wrangler deploy --env agentic-interaction-trust
npx wrangler deploy --env gulf-maritime-exposure
npx wrangler deploy --env kazakhstan-market-entry-readiness
npx wrangler deploy --env corridor-sanctions-assistant
npx wrangler deploy --env critical-minerals-due-diligence
npx wrangler deploy --env dual-use-technology-export
npm run verify:public-agents
```

Wrangler auto-loads `.env`. Do not name an observability-only token
`CF_API_TOKEN`, because Wrangler will treat it as deployment credentials.

## Agent Card signing

The runtime signs the card with ES256 and publishes the public key at
`/.well-known/jwks.json`. The signature travels in `signatures` as A2A v1
section 8.4.2 defines it — a list of `{protected, signature}` — not in the
top-level `signature` field used until 2026-08-23, which is not a schema field.
Do not rotate an existing signing key merely because card content or signature
shape changed; the Worker signs the current card at request time, so an existing
key keeps working.

As of 2026-08-09, the first eight Worker deployments had signing secrets
configured and their signatures verified against their public JWKS. The
Kazakhstan Market Entry, Agent Output Verification, and Corridor & Sanctions
Assistant environments share one ES256 key created for that deployment group;
the five earlier deployments retain their existing keys.

Critical Minerals Due Diligence and Dual-Use Technology Export were added on
2026-08-27 and each carries its own ES256 key (`critical-minerals-2026-08-27-*`
and `dual-use-export-2026-08-27-*`), so they are outside that shared-key group
and rotate independently. All ten deployments now publish a signed card.

The new private key was passed directly from a permission-restricted temporary
file into Cloudflare secrets and was not retained locally. If any of those
three secrets must be recreated, treat it as a coordinated rotation: generate
one replacement key, update all three environments, redeploy them, and verify
all three signatures before considering the rotation complete.

If a separate key identifier is required, set `AGENT_CARD_SIGNING_KID` for the
same environment. Verify both the card signature and JWKS after any key change.

## Security declarations

The public endpoints require no credential unless a per-profile production
Bearer secret is explicitly configured. `X-Client-Id` is optional observability
metadata, not authentication, and must not be represented as an API-key
security scheme. A public deployment therefore publishes no
`securitySchemes` and uses an empty `securityRequirements` array.

Never add OAuth2, mTLS, payment, registry identity, or compliance claims to an
Agent Card unless the deployment actually implements and enforces them.
