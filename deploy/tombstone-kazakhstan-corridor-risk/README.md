# `kazakhstan-corridor-risk-a2a` tombstone

A single Worker that answers `410 Gone` on every path, deployed to a name that
used to host an A2A gate.

## Why it exists

The alias was retired in `fa4ab2d` (2026-05-31) and the name was left
unclaimed. An unclaimed `workers.dev` host answers `404`, and a crawler reads
`404` as "try again later" — the wrong answer for a name that is never coming
back. `410` is terminal: registries that honour it drop the entry instead of
retrying, and the response body and `Link` header name the successor for the
ones that read it.

It exists so that whatever still holds the name in a listing gets a true
answer, and it turns out plenty still does. When this Worker went up on
2026-09-02 the retired name had drawn no external requests in the two hours
that followed, and this README said so and told you to expect no change in any
number. Measured over the 48h to 2026-09-05: 24 external requests from five
distinct clients — `fasthttp` (Singapore), `TAR-Directory-Indexer/1.0`,
`A2A-Registry-Healthbot/1.0 (background-job)`, `jscrawler`, and Mac browsers —
asking for `/.well-known/agent-card.json`, `/`, `/robots.txt` and
`/sitemap.xml`. Two hours was the wrong window: a directory's crawl cycle runs
in days, not hours.

An earlier version of this README, and of the commit that added the Worker,
justified it with about 2,900 requests a week arriving at the dead host. That
number was wrong — it came from a `__unknown__` bucket read as a rate when it
was the tail of a process that had already stopped on 2026-08-27. See
`A2A-MAINTENANCE.md`, "Reading `__unknown__` in Workers analytics".

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

## Removing it

Nothing depends on this Worker. Deleting it returns the name to Cloudflare's
`404`, which is the state it was in before 2026-09-02:

```bash
npx wrangler delete --name kazakhstan-corridor-risk-a2a
```
