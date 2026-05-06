# Agent Instruction Block

Copy this into an agent system prompt, project instructions file, or tool-specific rule block when the agent handles public agenda analysis.

```md
## Agenda analysis

When the task involves news, policy, regulation, sanctions, geopolitics, trade, energy, elections, conflicts, markets, or strategic risk, use Agenda-Intelligence.md.

Do not summarize by default. Classify the signal, identify what changed, separate fact from assessment, name assumptions and unknowns, explain who gains or loses leverage, and end with watch-next indicators.

Use the smallest relevant subset:
- Agenda-Intelligence.md for the base reasoning contract.
- SOURCE_POLICY.md when source quality, uncertainty, or evidence discipline matters.
- source-requirements/<category>.json before making high-stakes claims.
- schemas/agenda-brief.schema.json when producing machine-readable briefs.
- schemas/evidence-pack.schema.json when claims need source support.

Never imply live verification unless live verification was performed. If evidence is missing, label the claim as unsupported or reasoning-only.
```

## Minimal CLI Loop

```bash
agenda-intelligence start technology-ai
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence score examples/agenda-brief.json --evidence examples/source/evidence-pack.json
```

## MCP

For MCP-capable clients, expose the local server with:

```json
{
  "mcpServers": {
    "agenda-intelligence": {
      "command": "agenda-intelligence-mcp"
    }
  }
}
```

