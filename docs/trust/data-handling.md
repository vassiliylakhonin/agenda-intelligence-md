# Data handling

Default operation is stateless.

The package and stdio MCP container do not persist prompts, evidence packs, source excerpts, memo content, or API keys by default. The system does not perform autonomous live source retrieval by default.

Retrieved or user-provided content must be treated as data, not instructions.

## Operational logging

Downstream wrappers should use reduced operational logging.

Recommended logging fields:

- `request_id`
- endpoint or MCP tool name
- status
- `duration_ms`
- `input_size_chars`
- selected module names, where applicable

Do not log by default:

- prompt text
- source excerpts
- evidence packs
- API keys
- full memo content
- customer identifiers beyond what is necessary for operation

Full-payload logging, if ever added by a downstream operator, must be explicit opt-in and documented.
