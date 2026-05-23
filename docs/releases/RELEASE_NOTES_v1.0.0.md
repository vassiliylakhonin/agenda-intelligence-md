# v1.0.0 — Contract freeze

v1.0.0 locks the compatibility surface defined by ADRs 0003 and 0011–0013. From this release forward, breaking changes to any of the surfaces below require a v2.0 bump.

No new product behavior versus v1.0.0rc1; this release promotes the RC after end-to-end verification against the published PyPI wheel via the post-release smoke workflow.

## What is frozen

The compatibility surface ([ADR 0003](../adr/0003-versioning-and-compatibility.md)) is the union of:

1. **Schemas** — every file under `schemas/v1/` ([ADR 0011](../adr/0011-schema-id-urls-are-versioned-by-major.md)). The major-version segment is part of each schema's `$id`. A v2 of any schema ships under `/v2/`; `/v1/` continues to identify v1.0 unchanged.
2. **MCP tool contracts** — the 16 tools listed in `agent-manifest.json` under `mcp.tools[*]` ([ADR 0012](../adr/0012-mcp-tool-contract-freeze-and-deprecation.md)). Names, input schemas, and ordering are mirrored by `tests/test_package_consistency.py` against the `TOOLS` dict in `src/agenda_intelligence/mcp_stdio.py`.
3. **Agent manifest contract fields** — `name`, `version`, `schemas`, `mcp`, `cli` ([ADR 0013](../adr/0013-agent-manifest-is-the-authoritative-contract-registry.md)). The manifest carries its own self-describing `_contract_fields` and `_informational_fields` arrays so tooling can verify membership without re-reading the ADR. Informational fields (`description`, `repository`, `entrypoint`, `adoption`, `llms`, `analysis_bank`, `protocols`, `lenses`, `eval`, `source_acquisition`) MAY change in any minor or patch release.
4. **CLI behavior** — covered by ADR 0003. The manifest `cli` field remains a single string pointer in v1.0; structuring it into a subcommand registry is deferred to ADR 0014 (post-v1.0).

## What was fixed on the way here (v0.9.3 → v1.0.0)

Six small PRs closed gaps left after the ADR 0011–0013 contract-freeze landed (PRs #50–#53):

- **[#54](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/54)** — manifest `cli` field corrected from the stale shim path to `python3 -m agenda_intelligence.cli`.
- **[#55](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/55)** — top-level `schemas/v1/agent-manifest.schema.json` restored (was packaged-only); dual-copy parity test made bidirectional.
- **[#56](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/56)** — `agent-manifest.schema.json` rewritten to enforce the ADR 0013 contract surface; added `$id` per ADR 0011, canonical contract-field set guard, and lifted `validate-manifest` into pytest.
- **[#57](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/57)** — CHANGELOG entry recording the above.
- **[#58](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/58)** — version bump to 1.0.0rc1, RC release notes, manifest version regex relaxed to accept PEP 440.
- **[#59](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/59)** — post-release-smoke workflow regex relaxed to accept PEP 440 pre/post/dev versions.

## Install

`pip install agenda-intelligence-md` (resolves to 1.0.0 by default).

Pinned-wheel install: see the URL in the project README.

## Not changed

- Product behavior, geography routing, schema content (other than the manifest schema itself), and the 16 MCP tools' input schemas — identical to v0.9.3.
- Live source retrieval is still not implemented.
- ADR 0014 (structured CLI registry) is intentionally out of scope for v1.0 and queued as a post-v1.0 decision.
