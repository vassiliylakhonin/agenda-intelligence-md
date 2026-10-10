# Integration Guides

This directory holds short integration adapters for popular AI tooling platforms.

- **Interaction Trust + Vizier** – [action-bound-execution.md](action-bound-execution.md): request-bound scope, signed delegation, expiry, human approval and durable replay checks on the integration's dispatch path.
- **MCP Integration Check** – [mcp-integration-check.md](mcp-integration-check.md): CLI and GitHub Action using an official client to check discovery, schemas, auth, errors and opted-in examples.
- **Agent Checkout Readiness** – [checkout-readiness.md](checkout-readiness.md): bounded ACP sandbox trace profile, including idempotent repeats, cancellation and a merchant refund handoff.

- **RAG Output Verification** – [rag-output.md](rag-output.md): automatically
  assemble a packet from inline citations and actual source chunks, check locally
  without a wallet, and recheck corrections before human review. Includes a
  bounded optional LangGraph example.

- **Claude Code** – `docs/integrations/claude-code.md`
- **OpenAI Codex** – `docs/integrations/codex.md`
- **Cursor** – `docs/integrations/cursor.md`
- **MCP (Model Context Protocol) Server** – `docs/integrations/mcp.md`
  includes Claude Desktop, Cursor, Codex local MCP, and generic JSON config blocks.
- **Agenstry discovery** – `docs/integrations/agenstry.md`
  documents the public Agent Card, installable-MCP positioning, and optional free A2A Worker wrapper.
- **OEM / embedding in another product** – `docs/integrations/oem.md`
  covers running the HTTP shell with API keys, metering and CORS, the generated
  TypeScript client, and the compatibility promise a partner integrates against.
- **Verified MCP setup** – `docs/integrations/verified-mcp.md`
  helps confirm that the configured client can list and call the tools.

Each guide explains how to invoke `agenda-intelligence` from the respective environment, pass files, and handle validation results.
