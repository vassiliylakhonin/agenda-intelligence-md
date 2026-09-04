# snapshot-site

The static name index the `cis_secondary_sanctions` worker screens against,
published to Cloudflare Pages as `sanctions-name-index.pages.dev` and read via
`SNAPSHOT_INDEX_URL` (see ADR 0020).

Rebuild and republish:

```
python3 scripts/sanctions_name_index.py
npx wrangler pages deploy deploy/snapshot-site \
  --project-name=sanctions-name-index --branch=main --commit-dirty=true
```

The build downloads OFAC SDN, OFAC consolidated (non-SDN), the EU consolidated
list, and the UK FCDO list, then writes both the full index and the compact
derivative the worker fetches. The compact file is the only one the worker
reads; the full one stays for browser-side use.

Publishing is deliberate and local — it uses your own `wrangler` login, so no
API token is stored anywhere. A scheduled GitHub workflow
(`.github/workflows/check-sanctions-index.yml`) watches the published file
instead of writing it: it rebuilds from the sources, compares against what the
URL is actually serving, and fails when the served index is missing, stale, or
has lost a source. That turns a silent stall into an email; the republish stays
the command above.

The index is a snapshot, not a live query: its freshness is whatever
`generated_at_utc` says, and the worker reports that date back to the caller in
`live_retrieval_snapshot_generated_at`. Rebuild on a schedule that matches how
current you are willing to claim the screening is.

Generated JSON is not committed — it is a 2.8 MB build artifact rebuilt from
official sources on demand.
