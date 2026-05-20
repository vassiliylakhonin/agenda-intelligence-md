# Minimal container for the Agenda Intelligence stdio MCP server.
#
# Used by Glama (https://glama.ai/mcp/servers) and any other MCP catalog
# that introspects servers by spinning them up and reading `tools/list`
# over JSON-RPC on stdio.
#
# The container only needs to start the server and respond to the
# introspection request. No Anthropic API call is required for that, so
# the optional `[llm]` extra is intentionally omitted from the default
# image to keep the surface small. Hosts that want direct API calls
# from `analyze` should install the `[llm]` extra and set
# ANTHROPIC_API_KEY on top of this image.

FROM python:3.11-slim

# Pin to the current published release so introspection is reproducible.
# Bump in lockstep with pyproject.toml, agent-manifest.json, server.json
# on every release — see the project release checklist.
ARG AGENDA_INTELLIGENCE_VERSION=0.8.2

RUN pip install --no-cache-dir "agenda-intelligence-md==${AGENDA_INTELLIGENCE_VERSION}"

# The stdio MCP server is exposed as the `agenda-intelligence-mcp`
# console script (defined in pyproject.toml [project.scripts]).
ENTRYPOINT ["agenda-intelligence-mcp"]
