# Quickstart: evidence-packet preflight

This guide runs the primary Agenda Intelligence workflow: check whether claim-backed AI output is structurally ready for human review.

The check does not determine factual truth, source authority, compliance, or authorization. It does not fetch missing sources. Human review is required for every result.

## 1. Install

```bash
pip install agenda-intelligence-md
```

For a source checkout:

```bash
pip install -e .
```

Verify the CLI:

```bash
agenda-intelligence --help
```

## 2. Get the example packet

The bundled example paths below assume a source checkout:

```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
```

The runnable example is [`examples/evidence-packet/request.json`](../examples/evidence-packet/request.json). It contains:

- claims with stable IDs;
- the source IDs each claim names;
- an optional verbatim quote;
- the caller-supplied source text.

The request contract is [`schemas/v1/evidence-packet-request.schema.json`](../schemas/v1/evidence-packet-request.schema.json).

## 3. Run the preflight

```bash
agenda-intelligence check examples/evidence-packet/request.json
```

Expected summary:

```text
packet_status=packet_complete claims=2 sources=1 factuality=not_assessed
  c1: packet_complete (lexical_support=supported, coverage=1.0)
  c2: packet_complete (lexical_support=supported, coverage=1.0)
```

The result is `packet_complete` because both claims name an existing source, the declared quote is present, and the named source text has strong lexical overlap with each claim.

This is still not a factuality verdict. A structurally complete packet can contain wrong or low-quality source material.

## 4. Use JSON in an agent loop

```bash
agenda-intelligence check examples/evidence-packet/request.json --format json
```

The response contract is [`schemas/v1/evidence-packet-response.schema.json`](../schemas/v1/evidence-packet-response.schema.json). Stable machine-readable fields include:

- `packet_status`;
- `factuality_status`;
- per-claim missing source IDs and quote checks;
- lexical-support status and coverage;
- unmatched numbers;
- `owner_actions`;
- `human_review_required`.

## 5. Gate CI on packet completeness

```bash
agenda-intelligence check examples/evidence-packet/request.json --strict
```

`--strict` exits non-zero for `source_review_required` and `packet_incomplete`. Schema-invalid input also exits non-zero.

Use the default non-strict mode when you want a valid diagnostic report even if the packet still has gaps.

## 6. Call the Python service

```python
import json
from pathlib import Path

from agenda_intelligence.services import check_evidence_packet

packet = json.loads(Path("examples/evidence-packet/request.json").read_text())
result = check_evidence_packet(packet)

if not result["valid"]:
    raise ValueError(result["errors"])

print(result["response"]["packet_status"])
```

## Status meanings

| Status | Meaning |
|---|---|
| `packet_complete` | References resolve and lexical support is strong. |
| `source_review_required` | References resolve, but lexical support is weak or numbers are missing. |
| `packet_incomplete` | A source reference or quote is structurally broken. |

All statuses keep `human_review_required: true` and `factuality_status: not_assessed`.

## Compatibility workflows

The original agenda-analysis, evidence-audit, scoring, MCP, HTTP, A2A, and vertical-profile workflows remain available. They are compatibility surfaces, not the primary quickstart.

Common commands:

```bash
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence validate-evidence examples/source/evidence-pack.json
agenda-intelligence audit-claims examples/source-backed/eu-ai-act.audit.json
agenda-intelligence grounded-check examples/grounded-check/request.json
agenda-intelligence verify-claims examples/claim-verification/request.json
```

See [`ADOPTION.md`](../ADOPTION.md) for integration notes and [`MCP.md`](../MCP.md) for the compatibility MCP surface.
