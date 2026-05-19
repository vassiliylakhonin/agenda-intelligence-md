# v0.7.4 — Source Ingest skill, threat model, EU-CBAM bench case

v0.7.4 adds a source-ingest skill for normalising user-supplied documents into structured source records, an explicit threat model with adversarial test fixtures, and an additional case in the bundled bench baseline.

## Added — Source Ingest skill

- Normalizes user-supplied documents (PDF, DOCX, XLSX, URL, article, transcript) into a structured source record:
  - metadata
  - Axis A/B provenance tags
  - key-claims table
  - excerpts
  - limitations
- Fallback path when a live URL retrieval fails.
- Routing references the vertical source guides (Central Asia + Caspian, Gulf + Middle East) rather than duplicating regional tier content in the source record.

## Added — Threat model

- `docs/threat-model.md` documents what the validator catches and what it does not.
- Adversarial fixtures + pytest suite codify the documented gaps so they remain visible in CI.

## Added — Bench

- EU-CBAM case added to the bundled bench.
- Source-backed baseline now covers 5 cases (was 3): `eu-ai-act`, `eu-cbam`, `red-sea-shipping`, `sanctions-routing`, `bis-ai-diffusion`.

## Docs

- Stack positioning synced across `pyproject.toml`, `llms.txt`, `agent-manifest.json`, and `ADOPTION.md`.
- `CLAUDE.md` scope tightened to evidence / eval infrastructure framing.
- `README.md`: stack-role tag, audience-first first screen, stack-context block, MCP framed as a distribution surface.
- Bench baseline counts in docs aligned with committed benchmark output.

## Chore

- `.claudeignore` added with build, OS, and historical release-notes exclusions.

## Not in this release

- README wheel pin still points to `v0.7.3` — will be bumped together with the `v0.7.4` tag push, which is the trigger for the PyPI publish.
