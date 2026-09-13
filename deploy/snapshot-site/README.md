# snapshot-site

The static name index the `cis_secondary_sanctions` worker screens against,
published to Cloudflare Pages as `sanctions-name-index.pages.dev` and read via
`SNAPSHOT_INDEX_URL` (see ADR 0020).

Manual rebuild and republish fallback:

```
python3 scripts/sanctions_name_index.py
npx wrangler pages deploy deploy/snapshot-site \
  --project-name=sanctions-name-index --branch=main --commit-dirty=true
```

The build downloads OFAC SDN, OFAC consolidated (non-SDN), the EU consolidated
list, and the UK FCDO list, then writes both the full index and the compact
derivative the worker fetches. The compact file is the only one the worker
reads; the full one stays for browser-side use.

`.github/workflows/refresh-sanctions-index.yml` rebuilds and publishes daily.
Its build job has no deployment credential. It requires every source, verifies
the compact file's shape and canaries, compares it with production, and retains
every complete rebuild as a seven-day recovery artifact. The deploy job then
downloads that exact artifact through the `sanctions-index-production` GitHub
Environment and confirms that the canonical URL serves its SHA-256. A source
failure, unavailable or malformed production baseline, timestamp rollback, or
name-count drift above 10% stops before publication, leaving the last good
deployment in place.

The environment must contain `CLOUDFLARE_PAGES_API_TOKEN`, limited to deploying
the `sanctions-name-index` Pages project, and `CLOUDFLARE_ACCOUNT_ID`. Scheduled
runs cannot pass an approval dialog, so do not configure required reviewers on
this environment; restrict deployment branches to `main` instead. The repository
Actions variable `SANCTIONS_INDEX_AUTOPUBLISH_ENABLED` must also equal `true`.
Keep it `false` until both environment secrets exist, so the daily job remains a
green build/gate rehearsal rather than failing at authentication. A manual
dispatch defaults to `publish: false`, which exercises the complete build and
gate without exposing either credential. Set `publish: true` only to exercise
the production path; manual publication deliberately does not depend on the
scheduled-run opt-in variable.

`.github/workflows/check-sanctions-index.yml` remains an independent watchdog
and runs one hour later. It verifies the URL users actually read, rebuilds from
the sources, compares drift when possible, and fails when the served index is
missing, malformed, or older than seven days. A temporary source outage is only
a warning while the served index is fresh. When production is stale and a
rebuild succeeds, the watchdog preserves another seven-day recovery artifact
before failing. The local command above remains the break-glass recovery path.

The index is a snapshot, not a live query: its freshness is whatever
`generated_at_utc` says, and the worker reports that date back to the caller in
`live_retrieval_snapshot_generated_at`. Rebuild on a schedule that matches how
current you are willing to claim the screening is.

Generated JSON is not committed — it is a 2.8 MB build artifact rebuilt from
official sources on demand.
