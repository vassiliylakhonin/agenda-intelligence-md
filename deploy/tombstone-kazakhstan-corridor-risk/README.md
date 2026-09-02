# `kazakhstan-corridor-risk-a2a` tombstone

A single Worker that answers `410 Gone` on every path, deployed to a name that
used to host an A2A gate.

## Why it exists

The alias was retired in `fa4ab2d` (2026-05-31) and the name was left
unclaimed. An unclaimed `workers.dev` host answers `404`, which crawlers read
as "try again later", so directory listings that still carry the old URL kept
fetching it — about 2,900 requests a week as of 2026-09-02, roughly 8% of all
Worker invocations on the account, three months after retirement.

`410` is terminal. Registries that honour it drop the entry instead of
retrying, and the response body and `Link` header name the successor for the
ones that read it.

## What it must never become

This deployment has no profile, no bindings and no routes beyond the catch-all.
Do not add discovery documents to it, do not list it in `server.json`,
`.well-known/ai-catalog.json` or `entitymap.json`, and do not add it to
`scripts/verify-public-agents.js`. The retirement in `A2A-MAINTENANCE.md`
stands; this only changes the status code the dead name returns.

## Deploy

```bash
cd deploy/tombstone-kazakhstan-corridor-risk
npx wrangler deploy
```

## Verify

```bash
curl -sS -D- -o/dev/null https://kazakhstan-corridor-risk-a2a.vassiliy-lakhonin.workers.dev/.well-known/agent-card.json
```

Expect `HTTP/2 410`, a `sunset` header, and a `link` header pointing at
`middle-corridor-deal-risk-gate-a2a`.
