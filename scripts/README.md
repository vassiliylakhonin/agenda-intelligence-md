# scripts/

Development and CI helper scripts. Not part of the published package.

| Script | Purpose |
|---|---|
| `agenda_intelligence.py` | Legacy CLI wrapper (kept for backward compatibility) |
| `update_contract_responses.py` | Regenerate public contract response fixtures from the service layer |
| `smoke_mcp.py` | Wire-protocol verification: JSON-RPC cycle against the stdio server |
| `smoke_mcp_config.py` | MCP config generation smoke test |
| `validate.py` | Repo-wide schema consistency validator |
| `validate_public_examples.py` | Validate all public examples against schemas |
| `eval_before_after.py` | Before/after evaluation runner |
| `install-hooks.sh` | Git hooks installer |
