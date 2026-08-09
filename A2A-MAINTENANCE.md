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

Every deployment exposes:

- `GET /.well-known/agent-card.json`
- `GET /.well-known/jwks.json`
- `GET /health`
- `POST /message/send`

The static card on `vassiliylakhonin.github.io` is a portfolio discovery alias.
It does not execute JSON-RPC; its `supportedInterfaces` entry points to the
default Worker above.

## Deprecated deployment

`https://kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev` was
removed. It currently returns Cloudflare 404/1042 and must not be reintroduced
into discovery files or deployment scripts. Historical directory listings can
remain stale until their next crawl.

## Verification

Run local checks from `deploy/cloudflare-worker`:

```bash
npm run test:a2a
node scripts/verify-agent-card.js
```

After deployment, run the public matrix. It checks all eight Workers plus the
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
npm run verify:public-agents
```

Wrangler auto-loads `.env`. Do not name an observability-only token
`CF_API_TOKEN`, because Wrangler will treat it as deployment credentials.

## Agent Card signing

The runtime preserves the existing detached compact ES256 JWS in `signature`
and publishes its public key at `/.well-known/jwks.json`. Do not rotate an
existing signing key merely because card content changed; the Worker signs the
current card at request time.

As of 2026-08-09, five Worker deployments have signing secrets configured.
These three do not:

- `kazakhstan-market-entry-readiness`
- `agent-output-verification`
- `corridor-sanctions-assistant`

Signing those cards requires operator-provided Cloudflare secrets. Do not
generate or substitute a key without an explicit key-management decision:

```bash
npx wrangler secret put AGENT_CARD_SIGNING_KEY --env kazakhstan-market-entry-readiness
npx wrangler secret put AGENT_CARD_SIGNING_KEY --env agent-output-verification
npx wrangler secret put AGENT_CARD_SIGNING_KEY --env corridor-sanctions-assistant
```

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
