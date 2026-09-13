# snapshot-site

The static name index the `cis_secondary_sanctions` worker screens against,
published to Cloudflare Pages as `sanctions-name-index.pages.dev` and read via
`SNAPSHOT_INDEX_URL` (see ADR 0020).

Build and run every publication gate without changing production:

```
python3 scripts/publish_sanctions_index.py
```

Publish from a clean `main` checkout authenticated with Wrangler:

```
python3 scripts/publish_sanctions_index.py --publish
```

The build downloads OFAC SDN, OFAC consolidated (non-SDN), the EU consolidated
list, and the UK FCDO list, then writes both the full index and the compact
derivative the worker fetches. The compact file is the only one the worker
reads; the full one stays for browser-side use.

`scripts/publish_sanctions_index.py` requires every source, verifies the compact
file's shape and canaries, and rejects an unavailable or malformed production
baseline, timestamp rollback, or name-count drift above 10%. `--publish` also
requires a clean `main`, records the deployment decision workspace, invokes the
pinned Wrangler 4.122.0 client, and waits until the canonical URL serves the
candidate's exact SHA-256. Omit `--publish` to rehearse every non-mutating gate.
No Cloudflare credential is stored in GitHub; publication uses the operator's
local Wrangler login.

`.github/workflows/check-sanctions-index.yml` is the independent daily watchdog.
It verifies the URL users actually read, rebuilds from
the sources, compares drift when possible, and fails when the served index is
missing, malformed, or older than seven days. A temporary source outage is only
a warning while the served index is fresh. When production is stale and a
rebuild succeeds, the watchdog preserves another seven-day recovery artifact
before failing.

Break-glass recovery from an already verified Actions artifact remains a direct
Wrangler command:

```
npx --yes wrangler@4.122.0 pages deploy deploy/snapshot-site \
  --project-name=sanctions-name-index --branch=main --commit-dirty=true
```

Use that bypass only when a normal rebuild is impossible and the artifact has
passed `scripts/verify_sanctions_index.py`; it skips the baseline drift gate.

The index is a snapshot, not a live query: its freshness is whatever
`generated_at_utc` says, and the worker reports that date back to the caller in
`live_retrieval_snapshot_generated_at`. Rebuild on a schedule that matches how
current you are willing to claim the screening is.

Generated JSON is not committed — it is a 2.8 MB build artifact rebuilt from
official sources on demand.
