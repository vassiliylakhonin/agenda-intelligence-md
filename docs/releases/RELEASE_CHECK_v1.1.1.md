# v1.1.1 release check

Date: 2026-06-30

This note records the post-release audit for `v1.1.1`. It is an evidence note
for release integrity, not a product traction claim.

## Release identity

- Tag: `v1.1.1`
- Commit: `b812c2eb43f78901c2f572755940e161eca9b365`
- GitHub release:
  <https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/tag/v1.1.1>
- Release title: `v1.1.1 - AnalysisBank and confidential workflow hardening`
- PyPI package: `agenda-intelligence-md==1.1.1`

## Checked

### GitHub release

`gh release view v1.1.1` confirmed:

- `isDraft: false`
- `isPrerelease: false`
- `publishedAt: 2026-06-30T17:38:14Z`
- release URL resolves to the expected tag page

### GitHub Actions

The tag and release workflows completed successfully:

- `Release`: success
- `Publish to MCP Registry`: success
- `Post-release smoke`: success

The release-prep commit also had green required checks on `main`:

- `lint`: success
- `bench`: success
- `build (3.11)`: success
- `build (3.12)`: success

### PyPI

Direct PyPI JSON check confirmed:

- `info.version: 1.1.1`
- `releases["1.1.1"]` exists
- files:
  - `agenda_intelligence_md-1.1.1-py3-none-any.whl`
  - `agenda_intelligence_md-1.1.1.tar.gz`

### Clean install smoke

A temporary clean virtual environment installed the public package:

```bash
pip install --no-cache-dir agenda-intelligence-md==1.1.1
agenda-intelligence --version
```

Observed:

```text
agenda-intelligence 1.1.1
manifest_version=1.1.1
```

The installed CLI then passed:

```bash
agenda-intelligence memo-quality-bench tests/fixtures/memo_quality --format json
agenda-intelligence weekly-delta-bench tests/fixtures/weekly_delta --format json
agenda-intelligence doctor --strict --mcp-command <clean-venv>/bin/agenda-intelligence-mcp --json
python3 scripts/smoke_mcp.py --command <clean-venv>/bin/agenda-intelligence-mcp --expected-version 1.1.1
```

### Discovery metadata

Raw GitHub metadata on `main` reports `1.1.1` for:

- `.well-known/agent-card.json`
- `.well-known/ai-catalog.json`
- `.well-known/mcp-server.json`
- `.well-known/mcp/server-card.json`
- `api/openapi.json`

MCP Registry search confirmed an entry for:

- name: `io.github.vassiliylakhonin/agenda-intelligence-md`
- version: `1.1.1`
- package: `agenda-intelligence-md`
- package version: `1.1.1`

Search endpoint used:

```text
https://registry.modelcontextprotocol.io/v0/servers?limit=20&search=agenda-intelligence-md
```

## Not checked

- No Cloudflare Worker deployment was performed as part of `v1.1.1`.
- No live Worker smoke was run for this release check.
- No buyer, pilot, payment, or usage traction is claimed.
- No factual truth verification capability is claimed.
- No legal, compliance, sanctions, financial, investment, procurement, tax, or
  customs advice capability is claimed.

## Decision

`v1.1.1` is a valid hardening release boundary. The release is installable from
PyPI, discoverable through the MCP Registry search endpoint, and smoke-tested
through the installed CLI and MCP stdio server.
