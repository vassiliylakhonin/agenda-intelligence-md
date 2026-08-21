# Minimal container for the Agenda Intelligence MD stdio MCP server.
#
# Used by Glama (https://glama.ai/mcp/servers) and any other MCP catalog
# that introspects servers by spinning them up and reading `tools/list`
# over JSON-RPC on stdio.
#
# This image starts `agenda-intelligence-mcp`. It is suitable for MCP
# catalogs and container-based introspection. It is not the future hosted
# HTTP API image.
#
# No Anthropic API call is required for MCP tool introspection, so the
# optional `[llm]` extra is intentionally omitted from the default image.
# No ANTHROPIC_API_KEY is required unless a derived image enables direct
# model calls from `analyze`.

FROM python:3.11-slim

# Pin to the current published release so introspection is reproducible.
# Bump in lockstep with pyproject.toml, agent-manifest.json, server.json
# on every release — see the project release checklist.
ARG AGENDA_INTELLIGENCE_VERSION=1.5.0

# Retry to tolerate PyPI CDN propagation lag. A release bumps this pin on the
# same push that publishes the wheel, so a catalog rebuild (Glama and similar)
# can fire before PyPI serves the new version. Mirrors the retry loop in
# .github/workflows/post-release-smoke.yml (5 attempts, 20s apart).
RUN for attempt in 1 2 3 4 5; do \
        pip install --no-cache-dir "agenda-intelligence-md==${AGENDA_INTELLIGENCE_VERSION}" && break; \
        echo "agenda-intelligence-md==${AGENDA_INTELLIGENCE_VERSION} not on PyPI yet; retry ${attempt}/5 in 20s..." >&2; \
        sleep 20; \
    done; \
    pip show agenda-intelligence-md >/dev/null 2>&1 || { echo "install failed after 5 attempts" >&2; exit 1; }

# The stdio MCP server is exposed as the `agenda-intelligence-mcp`
# console script (defined in pyproject.toml [project.scripts]).
ENTRYPOINT ["agenda-intelligence-mcp"]
