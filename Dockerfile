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
ARG AGENDA_INTELLIGENCE_VERSION=1.1.1

RUN pip install --no-cache-dir "agenda-intelligence-md==${AGENDA_INTELLIGENCE_VERSION}"

# The stdio MCP server is exposed as the `agenda-intelligence-mcp`
# console script (defined in pyproject.toml [project.scripts]).
ENTRYPOINT ["agenda-intelligence-mcp"]
