# v0.8.2 — Official MCP Registry compatibility

v0.8.2 is a registry-compatibility patch. No functional changes.

## Added — Ownership marker in README

The official Model Context Protocol Registry verifies that a server author owns the underlying PyPI package by looking for a `mcp-name: <namespace>` marker in the package README. v0.8.2 adds the marker

```
mcp-name: io.github.vassiliylakhonin/agenda-intelligence-md
```

at the end of `README.md`, so that PyPI now serves a README containing the marker and the publishing workflow at `registry.modelcontextprotocol.io` accepts the `server.json` shipped with the repo.

## Unchanged

- All product and validation behavior is identical to v0.8.1.
- 16 MCP tools, request/memo schemas, geography routing, signal vendoring, machine-verified audit — no changes.
- Live source retrieval is still not implemented.

## Upgrade notes

Existing users do not need to upgrade unless they want to install from the marker-aware PyPI snapshot. `pip install -U agenda-intelligence-md` is safe.
