# v0.5.4 — Version Consistency Patch

v0.5.4 fixes release metadata drift found during a clean PyPI smoke test.

## Fixed

- `agenda_intelligence.__version__` now matches the published package version.
- `pyproject.toml`, `agent-manifest.json`, and packaged manifest data all report `0.5.4`.
- README GitHub Release install snippet now points at `v0.5.4`.

## Validation

- Clean PyPI install smoke test for v0.5.3 exposed the drift.
- Added regression coverage for package/manifest/README version consistency.
