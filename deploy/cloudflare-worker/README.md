# Agenda Intelligence A2A Worker

Free hosted A2A/JSON-RPC discovery and lightweight triage wrapper for Agenda Intelligence MD.

This Worker is intentionally small:

- serves public discovery documents at `/.well-known/agent-card.json`, `/.well-known/ai-catalog.json`, `/.well-known/mcp/server-card.json`, and `/.well-known/did.json`;
- responds to A2A 1.0 JSON-RPC `SendMessage`; legacy `message/send` and `tasks/send` aliases remain for A2A 0.3 clients;
- returns a sanctions/policy signal screen, source-planning guidance, quality gates, routing metadata, and install instructions for the stdio MCP server;
- serves a human-readable HTML landing page at `GET /` for browser visitors (clients with `Accept: text/html`), JSON for everything else;
- exposes a public JSON status endpoint at `GET /status` suitable for uptime monitoring (UptimeRobot, Better Stack, etc.) — includes version, profile, A2A protocol version, boundary flags;
- does not call paid APIs, payment rails, wallets, or live retrieval by default;
- does not replace the installable MCP server.

## Public endpoints

| Method | Path | Content negotiation | Purpose |
|---|---|---|---|
| GET | `/` | `text/html` -> HTML landing; otherwise JSON health | Discovery entry point |
| GET | `/health` | Always JSON | Backward-compatible health check for scripts |
| GET | `/status` | Always JSON | Status info for uptime monitors; includes version + boundary flags |
| GET | `/.well-known/agent-card.json` | Always JSON | A2A agent card |
| GET | `/.well-known/agenstry-verify` | Plain text or 404 | Optional Agenstry domain-ownership proof |
| GET | `/.well-known/ai-catalog.json` | Always JSON | Agentic resource discovery catalog |
| GET | `/.well-known/api-catalog` | Always JSON linkset | API catalog pointing to OpenAPI |
| GET | `/api/openapi.json` | Always JSON | OpenAPI 3.0 worker contract |
| GET | `/.well-known/mcp/server-card.json` | Always JSON | MCP server card for the installable stdio package |
| GET | `/.well-known/mcp-server.json` | Always JSON | Legacy MCP server-card alias |
| GET | `/.well-known/did.json` | Always JSON | DID document linking AI catalog, A2A card, and MCP card |
| GET | `/entitymap.json` | Always JSON | Machine-readable entity map for retrieval agents |
| GET | `/okf/index.md`, `/okf/*.md` | Always Markdown | OKF-style concept bundle served from the worker domain |
| GET | `/profiles/confidential-project-room`, `/profiles/confidential-project-room/redacted-example.json` | Markdown / JSON | Public alias-first confidential project-room profile contract and synthetic example |
| GET | `/stats` | JSON (requires `x-stats-token`) | Private usage analytics |
| GET | `/decisions` | JSON (requires `x-stats-token`) | Private decision journal: verdicts, input hashes, repeated-run diffs |
| POST | `/intake/cis-review` | JSON, CIS profile only | Store a validated redacted service request for 30 days |
| GET | `/intake/cis-review` | JSON (requires `x-stats-token`) | Read retained CIS service requests |
| POST | `/message/send`, `/` | JSON-RPC 2.0 | A2A 1.0 `SendMessage` |
| POST | `/mcp` | JSON-RPC 2.0 | MCP over Streamable HTTP, stateless |

### MCP endpoint

`POST /mcp` speaks MCP **2026-07-28**. That revision removed protocol sessions,
the `initialize` handshake, and stream resumability, which is what makes MCP fit
a Worker at all — there is no per-client state to keep, so no Durable Object.

It serves `server/discover`, `tools/list`, and `tools/call`. One deployment
serves one profile and a fixed profile-scoped tool set. Most profiles expose one
tool. Agent Output Verification exposes the existing `agent_output_verification`
and `pre_action_check` tools plus the hosted Decision Gate:
`decision_policies_list`, `decision_check`, and `decision_verify`.

```bash
curl -sX POST https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"server/discover"}'
```

Existing profile tools route through the same dispatch as `SendMessage`, so both
transports return the same verdict for the same payload. The three Decision Gate
tools are hosted-MCP-only: they list the one bounded policy, attach a five-minute
ES256 readiness receipt to the existing pre-action result, and verify that the
receipt is current and bound to the caller's expected request and action hashes.
`gate_passed` requires a valid `continue` receipt; it is not authorization and
the caller still enforces and performs the action. An enforcing caller computes
the expected hashes from its own request copy; echoing hashes copied from the
receipt response does not establish that the intended action matches. The Gate
is stateless, so an exactly bound receipt may be reused during its five-minute
lifetime; callers that require one-time execution must prevent replay at their
own execution boundary.

The card carries the same contracts. `capabilities.extensions[].params.x_tool_contracts`
lists every hosted tool with its complete input and output JSON Schema and the
same annotations `tools/list` returns, read from one source so the two surfaces
cannot drift. It rides in the vendor extension because the A2A v1 `AgentSkill`
field set is closed — a schema hung on the skill itself would make the served
card invalid. An A2A-only caller can therefore compose against a gate from its
card alone, without speaking MCP first. The contracts add weight to the card:
the largest, `agent-output-verification` with five tools, is ~35 kB.

Every `SendMessage` response says whether anything checked it. `task.metadata.verification`
carries `status` — `not_performed` for the nine gates that cannot verify their own
output, `self` for the verifier's own deployment — plus where verification is
available and a plain statement that the gate issues no receipt, holds no
authority, and performs no action. It is self-reported and names no outcome: a
field that could read as "checked and passed" would be worse than silence. It
rides in task metadata because every v1 response schema is
`additionalProperties: false`, and this says something about the transport, not
about the verdict.

`tools/call` inherits the same Bearer gate, rate limit, and usage logging.
`server/discover` and `tools/list` stay open, like `agent/card`. `tools/list`
embeds the complete JSON Schema for both input and output. Tools are read-only
and non-destructive; `decision_check` is marked non-idempotent because every
receipt has a new identifier and timestamps. `tools/call.arguments` is the
request object itself; the older `{ "request": { ... } }` wrapper remains
accepted for the two pre-existing tools as a compatibility shim and preserves
their former A2A task-shaped result. Decision Gate tools accept only their
published direct schemas. Direct-schema calls return the service response once
in `structuredContent` and a short text summary, not a duplicate A2A task envelope.
Older revisions (`initialize`, `ping`) are still answered. Rationale:
[ADR 0024](../../docs/adr/0024-mcp-2026-07-28-stateless-core.md).
Signed-receipt decision:
[ADR 0025](../../docs/adr/0025-signed-readiness-receipts.md).

The full product layer remains:

```bash
pip install agenda-intelligence-md
agenda-intelligence-mcp
```

## Why Cloudflare Workers

Cloudflare Workers Free is enough for this wrapper: the official limits currently include 100,000 requests per day, 10 ms CPU time, and 128 MB memory. This endpoint is a small JSON responder, so it fits the free tier better than a long-running Python service.

Docs: https://developers.cloudflare.com/workers/platform/limits/

## Deploy

Install Wrangler if you do not already have it:

```bash
npm install -g wrangler
```

Authenticate once:

```bash
wrangler login
```

Deploy:

```bash
cd deploy/cloudflare-worker
wrangler deploy
```

Recommended deploy checklist:

```bash
make verify-local
cd deploy/cloudflare-worker
npx wrangler deploy --env=""
npm run smoke:live
```

Use the profile `--env` deploy commands below only when profile Worker runtime
behavior changes. Documentation, schema, example, and base profile-route
changes usually require only the top-level Worker deploy.

To deploy everything at once, use the script rather than a hand-rolled loop:

```bash
cd deploy/cloudflare-worker
npm run deploy:all            # every env through the Vizier gate
npm run deploy:all -- --check # verify only, deploy nothing
```

Every environment ships through the gate. Until 2026-08-28 exactly one did, and
the other nine went out with a plain `wrangler deploy`: "who shipped this, and
did anything check it" had an answer for one tenth of the fleet. The gate costs
about twenty seconds per environment and needs the Vizier credential
(`VIZIER_API_KEY`, or the macOS Keychain entry) — without it nothing deploys,
which is the intended tightening and not a fallback to the old path.

The environment list is read from `wrangler.toml`, so a new profile is gated the
day it ships rather than the day someone remembers to add it to a list.

`--check` ends by reading the live deployment list for every environment and
fails if the newest deployment carries no ALLOW receipt. That is detection, not
prevention — anyone can still call wrangler directly — but the drift is then
reported instead of going unnoticed. Observed 2026-08-14: a manual "deploy all
eight" loop overwrote two gated deployments with ungated ones within ninety
seconds of each, leaving the live version without a receipt.

`npx wrangler secret put ... --env agent-output-verification` drops the receipt
the same way, and is easier to do by accident because it looks like a config
change rather than a deployment: a secret write publishes a new version, and the
new version carries neither the ALLOW receipt nor the content stamp. Observed
2026-08-28 while adding `STATS_TOKEN` to five environments. After writing a
secret to the gated environment, re-run `npm run deploy:all` to ship it through
the gate again, then `-- --check` to confirm the receipt is back.

Until the first full gated deploy runs, `--check` reports nine environments as
`UNGATED` and exits non-zero. That is accurate — those live versions were shipped
before the gate covered them — and one `npm run deploy:all` clears it.

The supported production path for the `agent-output-verification` profile runs
the same Vizier gate locally or through the protected GitHub Actions environment:

```bash
cd deploy/cloudflare-worker
npm run deploy:agent-output-verification:gated
```

The script accepts no arguments. It requires a clean Git commit, reads the
Vizier integration credential from `VIZIER_API_KEY` in CI or macOS Keychain
service `com.vizier.gated-deploy` locally, and submits the fixed `deploy_worker`
action for `worker:agent-output-verification-a2a`. Wrangler runs only after a
validated `ALLOW` receipt. `REVIEW`, `BLOCK`, timeout, malformed output, or a
missing credential stops the deployment.

The GitHub workflow uses the `agent-output-verification-production` Environment,
which is restricted to `main`. Its `VIZIER_API_KEY`, `CLOUDFLARE_API_TOKEN`, and
`CLOUDFLARE_ACCOUNT_ID` secrets are available only to the deployment job. The
Cloudflare token must carry only the account-scoped `Workers Scripts Write`
permission. A relevant push to `main` runs the gate automatically; an operator
can also start it with `workflow_dispatch`. An administrator who can rewrite
workflows, change Environment rules, or mint Cloudflare credentials can still
bypass this application-level gate; autonomous agents should receive neither
that authority nor local Cloudflare credentials.

### Agenstry domain-ownership proof

The shared Worker serves `GET /.well-known/agenstry-verify` only when that
deployment has a valid `AGENSTRY_VERIFY_TOKEN` secret. Set the token
interactively for the profile Agenstry is checking; do not put the value in
source or `wrangler.toml`:

```bash
cd deploy/cloudflare-worker
npx wrangler secret put AGENSTRY_VERIFY_TOKEN --env kazakhstan-market-entry-readiness
```

The route returns the single-line `af-verify-...` value with `Cache-Control:
no-store`. It returns `404` when the binding is missing or malformed. Each
profile has a separate secret because Agenstry issues a token per domain.

Deploy the Kazakhstan / Middle Corridor Deal Risk Gate profile as a separate A2A listing:

```bash
cd deploy/cloudflare-worker
wrangler deploy -e middle-corridor-deal-risk-gate
```

Deploy the Agentic Interaction Trust profile as a separate A2A listing:

```bash
cd deploy/cloudflare-worker
wrangler deploy -e agentic-interaction-trust
```

The deploy output will include a `workers.dev` URL, usually:

```text
https://agenda-intelligence-a2a.<your-subdomain>.workers.dev
```

The Kazakhstan / Middle Corridor Deal Risk Gate profile deploys as:

```text
https://middle-corridor-deal-risk-gate-a2a.<your-subdomain>.workers.dev
```

The Agentic Interaction Trust Gate profile deploys as:

```text
https://agentic-interaction-trust-a2a.<your-subdomain>.workers.dev
```

### Optional Watchman activation for CIS sanctions matching

The `cis-secondary-sanctions` profile can use a self-hosted
[`moov-io/watchman`](https://github.com/moov-io/watchman) instance for
sanctions-list name matching. The Worker expects a public `WATCHMAN_URL` whose
Watchman server answers `GET /search`.

```bash
cd deploy/cloudflare-worker
npx wrangler secret put WATCHMAN_URL --env cis-secondary-sanctions
npx wrangler deploy --env cis-secondary-sanctions
curl https://cis-secondary-sanctions-a2a.<your-subdomain>.workers.dev/status
```

The status response should show `live_retrieval.active: true` and
`active_upstream: "Watchman"`. Name matching remains a screening aid only: it is
not legal-entity identity verification, ownership resolution, a 50% rule
determination, or legal/compliance advice.

Use this URL in Agenstry as an A2A agent URL:

```text
https://agenda-intelligence-a2a.<your-subdomain>.workers.dev
```

For the Kazakhstan / Middle Corridor Deal Risk Gate listing, submit:

```text
https://middle-corridor-deal-risk-gate-a2a.<your-subdomain>.workers.dev
```

For the Agentic Interaction Trust Gate listing, submit:

```text
https://agentic-interaction-trust-a2a.<your-subdomain>.workers.dev
```

The Agent Card URL will be:

```text
https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/.well-known/agent-card.json
```

## Smoke test

```bash
curl https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/.well-known/agent-card.json
```

```bash
curl -X POST https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/message/send \
  -H 'content-type: application/json' \
  -H 'A2A-Version: 1.0' \
  -d '{
    "jsonrpc": "2.0",
    "id": "probe-1",
    "method": "SendMessage",
    "params": {
      "message": {
        "messageId": "message-probe-1",
        "role": "ROLE_USER",
        "parts": [
          {
            "text": "Screen sanctions and policy risk for Red Sea shipping disruption and Kazakhstan transit exposure."
          }
        ]
      }
    }
  }'
```

Expected: HTTP 200 with a JSON-RPC 2.0 response, an unchanged request `id`, `result.task.status.state: "TASK_STATE_COMPLETED"`, and a routing note with `signal_screen`, suggested modules, source plan, quality gates, and next actions. A successful HTTP 200 is not sufficient evidence of A2A conformance.

After deploying the profile Workers, verify that each public profile returns a
valid Agent Card and a `readiness_contract` in `SendMessage`:

```bash
cd deploy/cloudflare-worker
npm run smoke:live
npm run verify:public-agents
```

`verify:public-agents` covers all ten deployed environments. `smoke:live` covers
the profiles whose response carries a `readiness_contract`, so it stops short of
`dual-use-technology-export`, which answers with `export_risk_triage` instead. A
profile added to only one of the two scripts is a profile nobody checks: on
2026-08-28 both `critical-minerals-due-diligence` and `dual-use-technology-export`
were live and passing `/health` while `verify:public-agents` had never called
either of them.

Set `WORKERS_SUBDOMAIN` when checking a non-default workers.dev account:

```bash
WORKERS_SUBDOMAIN=your-subdomain npm run smoke:live
```

## Verify live Agent Cards

After deploying, verify that Agenstry will see the expected product metadata:

```bash
cd deploy/cloudflare-worker
npm run verify:agent-card
```

This checks the public Agenda Intelligence card plus the Kazakhstan / Middle Corridor Deal Risk Gate and Agentic Interaction Trust Gate cards:

- `agenda-intelligence-a2a`
- `middle-corridor-deal-risk-gate-a2a`
- `agentic-interaction-trust-a2a`

To verify a custom URL:

```bash
npm run verify:agent-card -- https://your-worker.example/.well-known/agent-card.json
```

For the Middle Corridor cards, the verifier checks `product_profile`, product-contract schema links, source taxonomy link, required-before-go source categories, non-advice notice, and no-approval boundary.

## Verify agent discovery fetchability

After deploy, check that the public discovery documents are reachable by common agent and crawler user-agents:

```bash
cd deploy/cloudflare-worker
npm run verify:agent-discovery
```

To verify another deployment:

```bash
npm run verify:agent-discovery -- https://your-worker.example
```

This checks:

- `/.well-known/ai-catalog.json`
- `/.well-known/api-catalog`
- `/api/openapi.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/did.json`
- `/entitymap.json`
- `/okf/index.md`
- `/profiles/confidential-project-room`
- `/profiles/confidential-project-room/redacted-example.json`
- `/robots.txt`

Required user-agents are `curl/8.0`, a browser-like agent-readiness probe, `OAI-SearchBot`, and `GPTBot`. `Python-urllib/3.9` and `libwww-perl/6.72` are diagnostic, because Cloudflare blocks both by user-agent on `*.workers.dev` before the Worker runs. To make Python urllib a hard failure:

```bash
npm run verify:agent-discovery -- --strict-python
```

### What the `error code: 1010` block actually is

Measured 2026-08-18 against `gulf-maritime-exposure-a2a`, one request per client, same URL and body:

| Client user-agent | Result |
| --- | --- |
| `Python-urllib/3.14`, `Python-urllib/2.1`, `libwww-perl/6.72` | 403, `error code: 1010` |
| `curl/8.7.1`, no user-agent header at all, `python-requests/2.32.3`, `python-httpx/0.27.0`, `node`, `Go-http-client/2.0`, `axios/1.7.2`, `Java/17.0.1`, `okhttp/4.12.0`, `PostmanRuntime/7.39`, `Wget/1.24` | 200 |

It is the user-agent string alone: `curl` sending `-A 'Python-urllib/3.14'` is blocked, and Python urllib sending `User-Agent: curl/8.7.1` is served. A request marked with a unique query parameter and the urllib user-agent produced **no** Workers Logs event, while the same URL over curl did — the block happens at Cloudflare's edge, before the Worker executes, so no handler change can answer it.

It is also not ours to switch off. Browser Integrity Check and WAF skip rules are zone settings; `workers.dev` is Cloudflare's zone, and this account holds no zones of its own (`GET /zones` returns 0). The only remedy that removes the block is putting these Workers on a custom domain in a zone we control.

Practical exposure is narrow: every mainstream HTTP client passes, including a request with no user-agent at all. A caller stuck on stdlib `urllib` only has to set any user-agent header. Both Python clients in this repo — `upstream_opensanctions.py` and `cli.py` — already send an explicit one.

## Reaching a person from a machine response

Every successful `message/send` carries an `engagement` block in `metadata`:
`offer`, `contact_email`, `support_hours`, `next_step`, and `human_page`.

It exists because the earlier surfaces do not reach the caller that matters.
The agent card carries `support`, the landing page carries a mailto, and the
corridor assistant already puts the same block in its orientation response —
but measured 2026-08-22 against the live endpoint, a successful call to the
base profile returned `agent_card`, `repository`, `package`, `mcp_transport`,
`modules_used` and `triage`, and no contact anywhere in the payload. The only
external non-probe call on record took exactly that path: it arrived from
another Cloudflare Worker with no user agent, no referer and no origin, which
makes it unidentifiable from the logs and unlikely ever to render an HTML page.
The response is the only surface that can hand such a caller a way back.

The block carries no price, no customer claim, and no urgency, and a contract
test fails the build if one is added. It is not a measurement of anything: no
inbound contact has arrived through it.

## Usage analytics

This Worker uses Cloudflare's built-in free observability path:

- Cloudflare Workers Metrics show total requests, successful requests, errors, CPU time, and latency.
- Workers Logs capture one structured `agenda_intelligence_a2a_usage` event for each JSON-RPC `message/send`, `tasks/send`, or `SendMessage` call.
- Cloudflare KV stores one reduced usage event per call for the public `/stats` endpoint.
- Workers Logs also capture an `agenda_intelligence_a2a_funnel` event for each discovery GET — the steps before a call.
- Agenstry's public listing can show marketplace-side usage, but only for traffic Agenstry can observe.

### Funnel events (the steps before a call)

The KV usage log records calls only, so with a handful of visitors a week the drop-off is invisible: someone who opens the agent card and leaves produces no record at all. Each discovery GET therefore emits an `agenda_intelligence_a2a_funnel` event to Workers Logs with a `step` of `landing`, `card`, `discovery`, or `docs`, plus the same privacy-safe caller fields as the usage event. `/health`, `/status`, `/robots.txt`, `/stats`, and the JWKS route are deliberately silent — monitoring traffic would bury the real visits.

These go to Workers Logs rather than KV on purpose. The free KV tier allows 1,000 writes per day; discovery GETs already run 250-480, on a namespace shared with the rate limiter and the sanctions-snapshot cache. Workers Logs takes 200,000 events per day at no cost, with 3-day retention on the free plan.

Reading them needs an API token with Account Analytics and Workers Observability read scopes — the Wrangler OAuth token does not carry those. Put it in `.env` as `AGENDA_OBSERVABILITY_TOKEN` and run:

```bash
npm run funnel          # last 72h, the free-plan retention
npm run funnel -- 12    # last 12h
```

Without the token, `wrangler tail` shows the same events live.

Do not name that variable `CF_API_TOKEN`. Wrangler 4 auto-loads `.env` from the project directory and will authenticate with it, so a read-only analytics token silently takes precedence over your `wrangler login` session and every `wrangler deploy` fails with `Authentication error [code: 10000]` against the services endpoint. Observed 2026-08-09.

One trap the script works around: Cloudflare samples this dataset on wider timeframes. Measured 2026-08-07 — a 6-hour query ran at `abr_level` 1 (every row), a 24-hour query at `abr_level` 10, which reported five real events as one. `npm run funnel` therefore walks the window in 6-hour slices and merges them, and prints a warning if a slice comes back sampled anyway. A raw wide-window query against this dataset will quietly undercount.

The custom usage event is privacy-safe by design. It does not log IP addresses, cookies, authorization headers, or full prompt text. It keeps only:

- request method and path;
- JSON-RPC method;
- whether a JSON-RPC id was present;
- prompt character count;
- selected Agenda modules;
- coarse client class, such as `agenstry`, `curl`, `browser`, or `automation`;
- the user-agent string, truncated to 120 characters;
- `caller_kind` — `self_test`, `service_probe`, `external`, or `unsigned_external`;
- `caller_zone` — the calling Cloudflare Worker zone from the `cf-worker` header, when present;
- referrer hostname, when present;
- Cloudflare colo, country, and network operator (`asOrganization`), when Cloudflare provides them.

Note: Cloudflare's raw `wrangler tail` envelope can include request headers and other platform metadata around the custom event. Treat raw tail output as operational logs and avoid sharing or exporting it unless you have reviewed what your Cloudflare account includes there. The `agenda_intelligence_a2a_usage` event itself keeps only the reduced fields listed above.

View aggregate traffic in the Cloudflare dashboard:

```text
Workers & Pages -> agenda-intelligence-a2a -> Metrics
```

View live structured usage events:

```bash
cd deploy/cloudflare-worker
npx --yes wrangler tail agenda-intelligence-a2a --format=json
```

### Who the caller was

Two fields exist to stop the traffic count from reading as usage.

`caller_kind` splits every request four ways. `self_test` is this repository's own conformance and smoke scripts, which name themselves in the user agent. `service_probe` is a directory crawler, registry health check, grader, or security auditor. `external` is everything else that sent a user agent, which includes an ad-hoc `curl` from an operator's shell and any generic HTTP library; read it as "not identified as ours or as a probe", not as "a stranger". `unsigned_external` is a caller that sent no user agent at all.

A probe is recognised two ways, and both are needed. The first is a keyword — `bot`, `crawler`, `probe`, `audit`, `registry`, and so on. The second is the self-identification convention: a parenthesised contact prefixed with `+`, as in `(+https://example.com/bot)` or `(+someone@example.com)`. The keyword list alone is not enough — measured 2026-08-20..22, the two highest-volume crawlers against these endpoints name neither a role nor a bot suffix, and 411 requests over three days landed in `external` because of it, 224 of them from a single scheduled crawler.

That last bucket is the one worth reading. Measured across 12,155 raw log rows over 2026-08-19..22: 55 requests arrived unsigned, and the only one of them that was not a probe was the single external non-probe call in the whole window.

`caller_zone` carries the `cf-worker` header, which a request arriving from another Cloudflare Worker sets to the calling zone. Over the same window 50 rows carried it, and 49 were probes that already name themselves — ProofBench, mcpqueen-grader, x402-observatory, and Cloudflare's own infrastructure. The fiftieth sent no user agent and was that one external call. So this field is not a new layer of data: it is a signature on the rare row where nothing else identifies the caller, and it is worth keeping only because Workers Logs is destroyed after three days.

Neither field is evidence of demand. A high count of `external` or `unsigned_external` requests means machines arrived, and nothing more.

Useful filters in Workers Logs:

```text
event = "agenda_intelligence_a2a_usage"
jsonrpc_method = "SendMessage"
client = "agenstry"
likely_probe = false
caller_kind = "unsigned_external"
```

Set or rotate the stats token across the whole fleet:

```bash
cd deploy/cloudflare-worker
node scripts/rotate-stats-token.js          # rotate, re-publish, verify
node scripts/rotate-stats-token.js --check  # ask every environment, write nothing
```

Every environment needs its own copy: `wrangler secret put STATS_TOKEN` without
`--env` reaches the top-level Worker and nothing else. Observed 2026-08-28, four
environments answering `/stats` with 401 — a gap nothing else reports, because
`/stats` is the one endpoint no monitor calls. The script reads the environment
list from `wrangler.toml`, writes the secret everywhere, updates `.env` only
after every environment took it, and then runs `deploy:all` — because a secret
write publishes an unstamped version and, in the gated environment, one without
its ALLOW receipt.

View product-level daily counters:

```bash
npm run stats
```

Read retained CIS review requests with the same private token:

```bash
npm run intake
```

The intake endpoint accepts workflow context only: work email, role and deal type,
what is blocked, evidence already held, the reviewer's request, and deadline. It
rejects untrusted browser origins and oversized or incomplete requests, includes a
honeypot field for basic bot filtering, limits each hashed network address to five
submissions per hour, stores no attachments, and expires each
record from KV after 30 days. By default, it does not send an email
notification; the optional relay below must be configured before promising
email delivery.

An optional Gmail notification relay is available under
`deploy/google-apps-script/cis-review-email/`. When both
`CIS_REVIEW_EMAIL_WEBHOOK_URL` and `CIS_REVIEW_EMAIL_WEBHOOK_SECRET` are set as
Worker secrets, the Worker schedules a signed Google Apps Script webhook after
KV storage. Delivery failure is logged but never changes the successful intake
response. The operational email copy contains the same redacted fields; the
public form must disclose that transfer before the relay is enabled.

For a specific UTC date:

```bash
npm run stats -- 2026-05-22
```

The local `npm run stats` helper reads `STATS_TOKEN` from `deploy/cloudflare-worker/.env`, which is ignored by git. You can still call the endpoint directly:

```bash
curl 'https://agenda-intelligence-a2a.<your-subdomain>.workers.dev/stats?date=2026-05-22' \
  -H "x-stats-token: $STATS_TOKEN"
```

### Decision journal

`GET /decisions?date=YYYY-MM-DD` returns one record per `SendMessage`: timestamp,
profile, contract version, a `sha256:` hash of the input, the verdict
(`decision`, `status`, `score`), `human_review_required`, and the task state. It
takes the same `x-stats-token` as `/stats` and keeps records for 30 days.

```bash
npm run decisions            # today
npm run decisions -- 2026-08-27
```

It stores a hash of the input, never the input. These payloads carry counterparty
names, routes and cargo; a store that held them would be a different product with
a different privacy posture. The hash is enough for the question actually asked:
the same file hashes the same way, so the `runs` block pairs a repeated input with
the verdicts it received and marks the pair `changed` when they differ — including
when only the contract version moved, because a verdict that changed across a
version bump is a different fact from one that changed on the same contract.

The counters at `/stats` cannot answer this: they keep no input and no verdict, and
the detailed funnel events live in Workers Logs, which retains 72 hours on the free
plan. One KV write per call, none on discovery GETs.

The `/stats` response includes approximate daily totals, likely probes, non-probe calls, prompt character counts, client classes, per-host counts (`hosts` — every published worker shares one KV namespace, so this is the only way to attribute calls to a specific worker), countries, JSON-RPC methods, and selected Agenda modules. The counters are intentionally coarse and are not a billing or audit ledger.

Three of those breakdowns exist to identify a caller the coarse client class cannot name — every unrecognised agent otherwise lands in `unknown`:

- `networks` — the network operator behind the request (`Google LLC`, `Amazon`, a residential ISP), which usually separates a crawler from a person;
- `referrers` — the referring hostname, i.e. which listing or page sent the caller;
- `user_agents` — the truncated user-agent, capped at the top 15 rows per day because crawlers each ship their own string.

No IP address is stored in any of them.

`outcomes` and `counters.empty_handed` report what the caller actually received. `empty_handed` counts calls that ended in `insufficient_information` or `invalid_request` — the gate could not act on what was supplied. At this traffic level that ratio is the useful number: a caller who reaches the endpoint and leaves with nothing is a different failure from one who never arrives.

An A2A request is counted as a likely probe when the client is `agenstry` or the prompt payload is shorter than `PROBE_PROMPT_CHAR_THRESHOLD` (24 characters) — this filters untagged uptime pings from monitor colos that do not announce themselves in the user-agent. Inspect `non_probe` for genuine usage.

### Cost accounting

The `/stats` response also includes a `cost` block. No LLM is called on the Worker path, so the only real per-request spend is paid live-retrieval upstreams. Per [ADR 0014](../../docs/adr/0014-per-profile-live-retrieval.md) the OpenSanctions hosted API (€0.10/call) is the only billable upstream; Watchman self-host and the deterministic triage path cost €0. A call is counted as billable only when a paid upstream actually returned data (`live_retrieval_status: success`) — `degraded` (failed call) and `disabled` (no key) are not billed.

- `counters.billable_calls` — number of billable upstream calls that day.
- `cost.estimated_cost_eur` — `billable_calls × unit price`, rounded to cents. An estimate, not an invoice.
- `cost.budget` — daily spend vs an optional cap. Set the **plaintext** var `USAGE_BUDGET_EUR_PER_DAY` (e.g. `wrangler deploy --var USAGE_BUDGET_EUR_PER_DAY:5` or in `wrangler.toml [vars]`) to get `pct_of_budget` and an `alert_level` of `none`/`50`/`75`/`90`. The Worker never blocks on budget — it only reports. When unset, `budget.configured` is `false`.

## Test locally

```bash
npm test
```

## JWS-signed agent cards

The worker serves agent cards with an ES256 signature in `signatures`, the
shape A2A v1 section 8.4.2 defines: a list of `{protected, signature}`, both
base64url. The public key is exposed at `/.well-known/jwks.json` so any
verifier can fetch it without out-of-band coordination.

Until 2026-08-23 this was a compact detached JWS (`<header>..<signature>`,
RFC 7797 unencoded payload) in a top-level `signature` field, written to satisfy
Agenstry's `jws_signature` criterion. `signature` is not a field the A2A schema
defines, so a card carrying it failed official schema validation.

### One-time setup (operator hands)

```bash
cd deploy/cloudflare-worker

# 1. Generate a new ES256 keypair (prints the private JWK + kid).
node scripts/generate-signing-key.js

# 2. For each env that should serve signed cards, set the private JWK as a secret.
#    Paste the PRIVATE JWK from step 1 when prompted.
npx wrangler secret put AGENT_CARD_SIGNING_KEY
npx wrangler secret put AGENT_CARD_SIGNING_KEY --env middle-corridor-deal-risk-gate
npx wrangler secret put AGENT_CARD_SIGNING_KEY --env cis-secondary-sanctions
npx wrangler secret put AGENT_CARD_SIGNING_KEY --env agentic-interaction-trust

# 3. Redeploy each env so the new env reads the secret.
npx wrangler deploy
npx wrangler deploy --env middle-corridor-deal-risk-gate
npx wrangler deploy --env cis-secondary-sanctions
npx wrangler deploy --env agentic-interaction-trust

# 4. Verify.
curl https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/jwks.json
curl https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json | jq .signatures
```

### What the verifier does

1. `GET /.well-known/agent-card.json` → read one entry of `signatures`
   (`{protected, signature}`, both base64url).
2. Remove `signatures` from the card, JCS-canonicalise (RFC 8785) the
   rest → payload bytes.
3. Reconstruct signing input = `protected + "." + base64url(payload)`.
   Ordinary JWS: unlike the earlier detached form, the payload is encoded.
4. `GET /.well-known/jwks.json` → fetch the public JWK whose `kid`
   matches the protected header.
5. ECDSA P-256 + SHA-256 verify the signature.

### Rotation

Re-run `node scripts/generate-signing-key.js` and re-set
`AGENT_CARD_SIGNING_KEY`. The new `kid` shows up in
`/.well-known/jwks.json` automatically on next request. No code change.
