# Contributing to Agenda Intelligence

## Project Philosophy
- **Markdown is the source of truth.** All documentation, specifications, and examples live in Markdown files.
- **Python tooling** provides validation, generation, and integration. Keep the Python layer lightweight and focused on the protocol.
- **Avoid framework bloat.** The project should stay a simple, composable protocol, not a heavy framework.

## Development Setup
```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
make install                  # editable install + lint/type tooling
bash scripts/install-hooks.sh # strongly recommended: pre-push hook running `make ci-fast`
                              # skipping this leads to fix-CI-fix-CI commit chains
pytest
```

## Pre-push gate
`make ci-fast` mirrors the GitHub `Lint` and `CI` workflows:

```bash
make ci-fast   # flake8 + black --check + isort --check + ruff + mypy + pytest
make ci        # full surface, also runs CLI smoke + scripts/validate*.py
make format    # auto-fix black + isort
```

Run `make ci-fast` (or install the hook) before every push to avoid the
staircase of fix-CI-fix-CI commits. Bypass the hook in emergencies with
`git push --no-verify`.

## Validation Commands
```bash
agenda-intelligence validate-manifest
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence validate-evidence examples/source/evidence-pack.json
```

## Dual-copy sync rule

The repo keeps two copies of several files — top-level AND under `src/agenda_intelligence/data/`. Both copies must stay in sync or CI fails (enforced by `tests/test_package_consistency.py`):

- `Agenda-Intelligence.md` ↔ `src/agenda_intelligence/data/Agenda-Intelligence.md`
- `SOURCE_POLICY.md` ↔ `src/agenda_intelligence/data/SOURCE_POLICY.md`
- `llms.txt` ↔ `src/agenda_intelligence/data/llms.txt`
- `agent-manifest.json` ↔ `src/agenda_intelligence/data/agent-manifest.json`
- `schemas/*.json` ↔ `src/agenda_intelligence/data/schemas/*.json`
- `skills/**` ↔ `src/agenda_intelligence/data/skills/**`
- `source-requirements/*` ↔ `src/agenda_intelligence/data/source-requirements/*`

When editing any of these, update the paired copy in the same commit. Version bumps must propagate to packaged copies or release CI fails.

## Adding Schemas
- Preserve backward‑compatibility where possible.
- Add both **valid** and **invalid** fixtures.
- Update the test suite to cover new cases.

## Adding Lens Packs
- Keep lenses concise and focused on failure modes and watch‑next indicators.
- Update the manifest if a new lens pack is required.

## Adding Examples
- Clearly label synthetic or demo examples.
- Do not claim live verification unless the sources were actually retrieved.
- Include a source plan and evidence pack when relevant.

## Evaluation Policy
- Heuristic scoring measures adherence to the protocol, **not** truthfulness of the content.

## Pull Request Checklist
- `python -m compileall .` passes.
- `pytest` passes.
- CLI validation commands succeed.
- Documentation is updated when behavior changes.

---
*File added via automated contribution assistance.*