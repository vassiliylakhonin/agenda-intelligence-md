# v1.0.0rc1 — Contract-freeze release candidate

v1.0.0rc1 is the first release candidate for the v1.0 contract-freeze line. No new product behavior. The RC exists so the contract surface defined by ADRs 0011–0013 can be exercised from downstream portfolio repos (Global Think Tank Analyst, Central Asia + Caspian, Gulf + Middle East) before the final v1.0.0 locks the contract per ADR 0003.

## What v1.0 freezes

The compatibility surface ([ADR 0003](../adr/0003-v1-compatibility-policy.md)) is the union of:

1. **Schemas** — every file under `schemas/v1/` ([ADR 0011](../adr/0011-schema-id-urls-are-versioned-by-major.md)). The major-version segment is part of each schema's `$id`. A v2 of any schema ships under `/v2/` while `/v1/` continues to identify v1.0 unchanged.
2. **MCP tool contracts** — the 16 tools listed in `agent-manifest.json` under `mcp.tools[*]` ([ADR 0012](../adr/0012-mcp-tool-contract-freeze-and-deprecation.md)). Names, input schemas, and ordering are mirrored by `tests/test_package_consistency.py` against the `TOOLS` dict in `src/agenda_intelligence/mcp_stdio.py`.
3. **Agent manifest contract fields** — `name`, `version`, `schemas`, `mcp`, `cli` ([ADR 0013](../adr/0013-agent-manifest-is-the-authoritative-contract-registry.md)). The manifest carries its own self-describing `_contract_fields` and `_informational_fields` arrays so tooling can verify membership without re-reading the ADR. Informational fields (`description`, `repository`, `entrypoint`, `adoption`, `llms`, `analysis_bank`, `protocols`, `lenses`, `eval`, `source_acquisition`) MAY change in any release.
4. **CLI behavior** — covered by ADR 0003. ADR 0013 leaves the manifest `cli` field as a single string pointer in v1.0; structuring it into a subcommand registry is deferred to ADR 0014 (post-v1.0).

## Pre-v1.0 follow-ups bundled in this RC

Three small fixes that closed gaps left after ADR 0011–0013 landed:

- **[#54](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/54)** — manifest `cli` field corrected from the stale shim path `scripts/agenda_intelligence.py` to `python3 -m agenda_intelligence.cli`.
- **[#55](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/55)** — top-level `schemas/v1/agent-manifest.schema.json` restored (was packaged-only); dual-copy parity test made bidirectional via set equality on filenames.
- **[#56](https://github.com/vassiliylakhonin/agenda-intelligence-md/pull/56)** — `agent-manifest.schema.json` rewritten to enforce the ADR 0013 contract surface (was still requiring the legacy `entrypoint, protocols, lenses` shape). Added `$id` per ADR 0011, `x-schema-version` per repo convention, canonical contract-field set guard, and lifted `validate-manifest` into pytest.

## Install

`pip install agenda-intelligence-md==1.0.0rc1`

By default `pip install agenda-intelligence-md` still resolves to the latest stable (0.9.3); the RC is opted into explicitly. Pre-release wheels are published from the `v1.0.0rc1` tag.

## Verification targets before v1.0.0

- Sibling portfolio repos consume the new manifest shape without breakage.
- `validate-manifest` and `mcp/tools/list` smoke checks pass against the RC wheel in a clean environment.
- No emergency follow-up ADRs surface during RC soak.

If issues surface, they ship in v1.0.0rc2; once the soak is clean the contract locks at v1.0.0.

## Not changed

- Product behavior, geography routing, schema content (other than the manifest schema), and the 16 MCP tools' input schemas — identical to v0.9.3.
- Live source retrieval is still not implemented.
- ADR 0014 (structured CLI registry) is intentionally out of scope.
