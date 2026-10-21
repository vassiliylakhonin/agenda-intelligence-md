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
Local publication uses the operator's normal Wrangler login.
`.github/workflows/publish-sanctions-index.yml` invokes the same gated publisher
daily at 04:05 UTC and on manual dispatch from immutable clean main, using the
existing protected production environment and a dedicated `CLOUDFLARE_PAGES_API_TOKEN` credential. The original Worker-only token was refused by Pages in run `39625335214`.
A separate Pages-only credential must be provisioned with owner confirmation;
Worker credentials are not widened or used as fallback. If the Pages token lacks access,
the job fails and the existing deployment remains; repair the credential boundary
explicitly rather than bypassing the gates. The scheduled publisher is separate
from the independent read-only watchdog.

`.github/workflows/check-sanctions-index.yml` is the independent daily watchdog.
It verifies the URL users actually read, rebuilds from
the sources, compares drift when possible, and fails when the served index is
missing, malformed, or older than 72 hours. A temporary source outage is only
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

The owner-confirmed `agenda-cis-snapshot-pages` credential has only
`Account / Cloudflare Pages / Edit` for the owned account and expires on
2027-01-19 (23:59 Asia/Almaty). Cloudflare scopes this permission to Pages in the
account, not to a single project. Rotate this dedicated environment secret before
expiry; never reuse or widen Worker deployment credentials. The workflow uses
only `CLOUDFLARE_PAGES_API_TOKEN` with the existing account ID and fails explicitly
when the Pages secret is absent. Store no credential value in source, artifacts
or logs.
