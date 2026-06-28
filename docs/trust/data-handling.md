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

## Confidential projects

For private deal files, investment projects, procurement packets, financing data rooms, or any review where named companies and counterparties are sensitive, use the alias-first workflow in [`confidential-project-workflow.md`](confidential-project-workflow.md).

Default to redacted source IDs and role-based aliases such as `ProjectCo`, `SponsorCo`, `OEM-A`, `Lender-1`, and `Anchor-Customer-1`. Preserve the evidence relationship and owner action; do not preserve identifying names unless the caller explicitly confirms that they are public and safe to repeat.
