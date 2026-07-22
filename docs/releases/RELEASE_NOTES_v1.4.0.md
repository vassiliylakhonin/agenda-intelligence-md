# v1.4.0 — MCP evidence-packet workflow

v1.4.0 exposes the primary evidence-packet preflight directly to MCP clients
and adds deterministic authoring helpers for building contract-valid briefs and
evidence packs.

## What changed

- Added the `check_evidence_packet` MCP tool for claim/source reference checks,
  quote matching, lexical-support diagnostics, unmatched-number flags, and
  reviewer actions.
- Added the `create_brief` and `append_evidence` MCP tools for stateless,
  contract-aware document assembly.
- Added a focused runnable stdio example under
  `examples/evidence-packet/mcp_client.py`.
- Kept existing MCP tool names, required arguments, schemas, CLI commands, and
  service response shapes compatible.

## Boundaries

The MCP tools use caller-supplied data. They do not retrieve sources, establish
factual truth, score source authority, authorize action, or write files. Human
review is required before any commercial action.

Not legal, compliance, sanctions, financial, investment, insurance, or trading
advice.

## Install

```text
pip install agenda-intelligence-md==1.4.0
```

## Verify the MCP call

From a source checkout with the package installed:

```text
python examples/evidence-packet/mcp_client.py
```

Expected summary:

```json
{
  "packet_status": "packet_complete",
  "factuality_status": "not_assessed",
  "human_review_required": true,
  "counts": {
    "packet_complete": 2,
    "source_review_required": 0,
    "packet_incomplete": 0
  }
}
```
