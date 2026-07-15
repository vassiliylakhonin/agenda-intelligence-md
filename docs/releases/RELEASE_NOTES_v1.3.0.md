# v1.3.0 — Evidence-packet preflight

v1.3.0 makes the deterministic evidence-packet checker the primary repository
workflow. The older strategic-intelligence runtime, transports, and vertical
workers remain available as compatibility surfaces.

## What changed

- Added `evidence-packet-request` and `evidence-packet-response` v1 schemas.
- Added `services.check_evidence_packet` and evidence-packet auto-detection in
  `agenda-intelligence check`.
- Added checks for missing source references, absent or undeclared quotes,
  lexical-support gaps, and numeric values missing from referenced sources.
- Added `--format json` for agent and CI use, plus `--strict` as a completeness
  gate.
- Added a runnable synthetic packet and contract tests while preserving legacy
  agenda-brief validation.

## Boundaries

The checker reports packet completeness, not factual truth, source authority,
compliance clearance, or authorization. It performs no live source retrieval.
Human review is required for every result. It is not legal, compliance,
sanctions, financial, investment, insurance, or trading advice.

## Install

```text
pip install agenda-intelligence-md==1.3.0
```

## Verify

```text
agenda-intelligence check examples/evidence-packet/request.json --strict
```
