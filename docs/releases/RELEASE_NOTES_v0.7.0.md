# v0.7.0 — MCP Scoring Tool

v0.7.0 promotes MCP scoring from a stub to a real before/after quality check.

## Added

- `score_output` is now exposed by `agenda-intelligence-mcp`.
- The tool scores before/after agenda-analysis output against protocol markers:
  - signal classification
  - what changed
  - actor specificity
  - mechanism
  - uncertainty
  - falsifiability
  - watch-next indicators
  - decision value
- MCP smoke coverage now verifies that `score_output` is present and returns an improved after-score.

## Changed

- The before/after evaluation script now reuses the package scorer instead of duplicating rubric criteria.

## Notes

- Scoring remains heuristic. It checks structure and protocol discipline, not factual truthfulness.
