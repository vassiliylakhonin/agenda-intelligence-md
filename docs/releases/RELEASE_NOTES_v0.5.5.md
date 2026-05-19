# v0.5.5 — Release Hygiene and CLI Version

v0.5.5 tightens release mechanics and makes version checks available directly from the CLI.

## Added

- `agenda-intelligence --version`.

## Fixed

- Release workflow now cleans `dist/` and `build/` before building.
- Manual PyPI publish workflow now cleans `dist/` and `build/` before building.
- This prevents older tracked distribution artifacts from being included in `twine check dist/*` and `twine upload dist/*`.

## Validation

- Added CLI version regression coverage.
