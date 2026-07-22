# v1.4.0 release preflight

Date: 2026-07-22

This note records the evidence available before publishing `v1.4.0`. It is a
release-integrity check, not evidence of customer usage or product-market fit.

## Claim ledger

| Claim | Evidence | Status |
|---|---|---|
| MCP clients can call `check_evidence_packet`. | `src/agenda_intelligence/mcp_stdio.py`, `tests/test_evidence_packet.py`, and `scripts/smoke_mcp.py`; exercised locally on 2026-07-22. | supported |
| MCP clients can call `create_brief` and `append_evidence`. | `src/agenda_intelligence/mcp_stdio.py` and `tests/test_authoring_tools.py`; included in the 505-test local suite on 2026-07-22. | supported |
| The focused example completes against the stdio server and preserves the factuality boundary. | `examples/evidence-packet/mcp_client.py`; focused test plus clean-wheel run returned `packet_complete`, `factuality_status=not_assessed`, and `human_review_required=true` on 2026-07-22. | supported |
| Package, manifest, discovery, plugin, container, and fixture version fields agree on `1.4.0`. | `tests/test_version_sync.py` and `tests/test_package_consistency.py`; both passed on 2026-07-22. | supported |
| `agenda-intelligence-md==1.4.0` is available from PyPI and the MCP Registry. | The release tag has not yet been published at preflight time. | unsupported until post-release checks pass |

## Verification observed

- `make ci`: 505 passed, 1 skipped; lint, formatting, import ordering, Ruff,
  mypy, compile checks, repository validators, and MCP wire smoke passed.
- A wheel built from the release branch installed into a new temporary virtual
  environment.
- The installed CLI reported `agenda-intelligence 1.4.0`.
- The focused `check_evidence_packet` example and full MCP wire smoke passed
  against the installed wheel.

## Boundaries

- No public PyPI or MCP Registry availability is claimed until tag-triggered
  workflows and post-release smoke complete.
- No Cloudflare Worker deployment is part of this release.
- No factual-truth, source-authority, authorization, legal, compliance,
  sanctions, financial, investment, insurance, or trading determination is
  provided.
- No customer, pilot, payment, or usage traction is claimed.
