# Embedding the checker in your product

This is for a team putting the evidence check inside their own product — a
reporting tool, a GRC platform, a research workspace — rather than running it at
a desk. Your users never see this service; they see your screen saying what is
missing.

Four things make that arrangement work, and all four are in place: a contract
that will not move under you, a client you did not have to write, a way to know
who called and how often, and no model in the path.

## Why the last one matters most

The check calls no model. That means: no key of yours, no token bill, no
provider outage inside your request path, and the same input gives the same
answer today and next year. A check that is itself a language model cannot
promise any of that, and cannot be put in front of an auditor.

What it reports is packet completeness — broken references, quote mismatches,
lexical-support gaps, unmatched numbers, claims that negate their source. Not
whether a claim is true. Say that in your own UI too; it is the boundary that
keeps the feature defensible.

## Run it

The shell is standard library only and ships as a pinned image.

```bash
docker run --rm -p 8080:8080 \
  -e AGENDA_INTELLIGENCE_REQUIRE_AUTH=1 \
  -e AGENDA_INTELLIGENCE_API_KEYS="acme-prod:$(openssl rand -hex 24)" \
  -e AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE=120 \
  -e AGENDA_INTELLIGENCE_ADMIN_KEY="$(openssl rand -hex 24)" \
  agenda-intelligence-md-api:1.8.0
```

`AGENDA_INTELLIGENCE_REQUIRE_AUTH=1` makes the container refuse to start without
keys, so a deployment cannot come up open by accident. A policy that cannot be
parsed also refuses to start rather than enforcing nothing quietly.

`GET /readyz` answers without a key and reports the policy it is enforcing:

```json
{"access": {"auth": "api-key", "clients": ["acme-prod"],
            "rate_limit_per_minute": 120, "cors_origins": [], "usage_endpoint": true}}
```

That one field settles the most common support question — a misconfigured
deployment and a rejected key look identical from the caller's side otherwise.

## Call it

```bash
npm install @agenda-intelligence/client
```

```ts
import { AgendaIntelligenceClient, RateLimitError } from "@agenda-intelligence/client";

const checks = new AgendaIntelligenceClient({
  baseUrl: process.env.CHECKS_URL!,
  apiKey: process.env.CHECKS_KEY!,
  timeoutMs: 10_000,
});

try {
  const result = await checks.preActionCheck(request, { requestId: correlationId });
  return result;
} catch (error) {
  if (error instanceof RateLimitError) {
    // Queue it. Retrying immediately spends the next window too.
    return scheduleRetry(error.retryAfterSeconds);
  }
  throw error;
}
```

The types are generated from `schemas/v1` and CI fails when they drift, so the
client cannot describe a contract the server does not serve.

Pass a `requestId`. It is echoed as `x-request-id` on the response and is what
turns "a check failed for a customer yesterday" into one line in two logs.

## Know what was spent

```bash
curl -H "authorization: Bearer $ADMIN_KEY" http://localhost:8080/usage
```

```json
{"rows": [{"client": "acme-prod", "endpoint": "/v1/agent-output/pre-action-check",
           "requests": 1841, "ok": 1802, "client_error": 35,
           "rate_limited": 4, "server_error": 0, "last_seen": 1772000000.0}]}
```

Refusals are counted next to answers on purpose: a partner querying an invoice
wants to see the 429s, and a rising `client_error` count is usually your
integration and not their usage.

The ledger is in memory, per process. Scrape it on an interval and keep the
series where your billing lives; a restart resets it.

## What you must decide, not us

**Where the boundary sentence goes.** Your users act on your screen. The result
carries the boundary notice; put it where they read it, and do not present a
`packet_complete` as a statement that anything is true.

**Whether the data leaves your tenant.** The shell is stateless by default: it
persists no prompts, no evidence packs, no source excerpts. Reduced logging
guidance is in [`docs/trust/data-handling.md`](../trust/data-handling.md), and
the alias-first workflow for named counterparties is in
[`confidential-project-workflow.md`](../trust/confidential-project-workflow.md).
Running the container inside your own perimeter is the default assumption.

**Your retry policy.** The client throws rather than retrying, because a check
in a submit path and a check in a nightly batch want opposite behaviour.

## Compatibility

Schemas, CLI behaviour, MCP tool names and signatures, packaged runtime asset
paths and score semantics are compatibility surfaces. Removing an enum value,
renaming a required field, changing a signature or changing score semantics
takes a major version or a stated deprecation path; new optional fields, new
enum values and new tools can arrive in a minor version. See
[ADR 0003](../adr/0003-v1-compatibility-policy.md),
[ADR 0011](../adr/0011-schema-id-urls-are-versioned-by-major.md) and
[ADR 0012](../adr/0012-mcp-tool-contract-freeze-and-deprecation.md).

Pin the image tag and the npm version together. Both carry the package version.

## What this shell is not

- Not multi-replica: the rate limiter and the usage ledger are per process.
  Behind two replicas each enforces its own limit and counts its own half.
- Not a billing system: it counts, it does not invoice or enforce a quota beyond
  the per-minute limit.
- Not an authorization service: a key names a client, nothing finer.
- Not a queue: a slow caller occupies a thread for the length of its request.

Each of those is a deliberate stopping point rather than an oversight. If your
deployment needs one of them, the seam is `agenda_intelligence.http_access` —
`RateLimiter` and `UsageLedger` are the two classes to put a shared store
behind.
