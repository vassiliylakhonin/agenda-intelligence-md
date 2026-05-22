# Security Policy

## Reporting a vulnerability

Please report security issues privately via the GitHub security advisory workflow for this repository, or contact the repository owner directly.

Do not open public issues for undisclosed vulnerabilities.

## Scope

This repository ships a Python package, an MCP stdio server, a CLI, JSON schemas, validators, and packaged reasoning references. Treat the following as in scope:

- supply-chain and integrity risks in the Python package or its packaged data
- schema or validator bugs that cause silent acceptance of malformed input
- MCP tool behavior that violates the documented evidence-discipline contract (e.g. silent factual claims, undocumented retrieval)
- prompt-injection handling in retrieved or user-provided content processed by the toolkit

The toolkit is NOT a factuality verifier, a sanctions/AML screening product, or a live source retrieval engine. Limitations of those non-goals are documented behavior, not vulnerabilities.

## Skill safety posture

The product shell and its packaged skills are designed to reduce fabricated certainty and to preserve evidence boundaries:

- structured request/memo contract with explicit `evidence_mode`
- per-claim provenance tags (Axis A/B) documented in `SOURCE_POLICY.md`
- evidence audit and scoring surfaces
- explicit non-goals stated in `README.md` and `AGENTS.md`
- retrieved content is treated as data, not instructions (see `AGENTS.md` "Retrieved-content trust")

High-stakes decisions (legal, compliance, financial, sanctions, security) require human review independent of any output produced through this toolkit.
