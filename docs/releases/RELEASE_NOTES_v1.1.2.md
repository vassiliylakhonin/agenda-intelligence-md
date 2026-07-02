# v1.1.2 - Distribution checkpoint

v1.1.2 is a distribution-only patch release for the evidence-readiness
runtime. It does not add a new worker, buyer-facing surface, factual
verification, legal or compliance advice, sanctions screening, or autonomous
decision logic.

## What changed

- Packaged the repository as a Claude Code plugin marketplace:
  - `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`;
  - `.mcp.json` so the MCP server auto-loads on plugin install via
    `uvx --from agenda-intelligence-md agenda-intelligence-mcp`;
  - marketplace lists `agenda-intelligence`, `global-think-tank-analyst`,
    `central-asia-caspian`, and `gulf-middle-east`;
  - "Install in Claude Code" section in README.
- Staged official MCP Registry publication metadata:
  - `server.json` (registry name
    `io.github.vassiliylakhonin/agenda-intelligence-md`);
  - invisible `mcp-name:` marker in README for PyPI ownership verification.
- Added an `agenda-intelligence-md` console-script alias for
  `agenda_intelligence.mcp_stdio:main` so `uvx agenda-intelligence-md`
  resolves; registry clients construct the launch command from the package
  identifier.
- Bumped package, manifest, registry, and plugin metadata versions to
  `1.1.2`.

## Install

```text
/plugin marketplace add vassiliylakhonin/agenda-intelligence-md
/plugin install agenda-intelligence@agenda-intelligence
```

Or any MCP client: `uvx agenda-intelligence-md` (stdio).
